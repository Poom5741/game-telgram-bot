/**
 * Cloudflare Workers optimized Game Engine
 * Manages game sessions and coordinates between games, database, and LLM
 */

import { TicTacToeGame } from './types/ticTacToe.js';
import { BigEaterCompetitionGame } from './types/bigEaterCompetition.js';
import { Logger } from '../utils/workerLogger.js';

const logger = new Logger('GameEngine');

export class GameEngine {
  constructor(db, env) {
    this.db = db;
    this.env = env;
    this.activeGames = new Map();
    this.gameTypes = new Map();
    
    this.initializeGameTypes();
  }

  initializeGameTypes() {
    this.gameTypes.set('Tic Tac Toe', TicTacToeGame);
    this.gameTypes.set('Big Eater Competition', BigEaterCompetitionGame);
    // Add more game types as they're implemented for Workers
  }

  async createGame(gameSessionId, gameTypeName) {
    try {
      const gameSession = await this.db.getGameSession(gameSessionId);
      if (!gameSession) {
        throw new Error('Game session not found');
      }

      const GameClass = this.gameTypes.get(gameTypeName);
      if (!GameClass) {
        throw new Error(`Unsupported game type: ${gameTypeName}`);
      }

      const players = await this.db.getGamePlayers(gameSessionId);
      const gameInstance = new GameClass({
        sessionId: gameSessionId,
        players: players,
        db: this.db,
        env: this.env
      });

      await gameInstance.initialize();
      this.activeGames.set(gameSessionId, gameInstance);

      // Update game status to active
      await this.db.updateGameState(gameSessionId, gameInstance.getState(), 'active');

      logger.info(`Created new ${gameTypeName} game with session ID: ${gameSessionId}`);
      return gameInstance;
    } catch (error) {
      logger.error(`Failed to create game:`, error);
      throw error;
    }
  }

  async getGame(gameSessionId) {
    if (this.activeGames.has(gameSessionId)) {
      return this.activeGames.get(gameSessionId);
    }

    const gameSession = await this.db.getGameSession(gameSessionId);
    if (!gameSession) {
      return null;
    }

    if (gameSession.status === 'completed' || gameSession.status === 'cancelled') {
      return null;
    }

    // Recreate game from saved state
    const game = await this.createGame(gameSessionId, gameSession.game_name);
    
    // Restore game state if it exists
    if (gameSession.game_state_json && gameSession.game_state_json !== '{}') {
      const savedState = JSON.parse(gameSession.game_state_json);
      await game.loadState(savedState);
    }
    
    return game;
  }

  async processPlayerMove(message, gameSessionId, moveInput) {
    try {
      const game = await this.getGame(gameSessionId);
      if (!game) {
        throw new Error('Game not found or already completed');
      }

      const userId = message.from.id;
      const chatId = message.chat.id;

      // Process the player's move
      const result = await game.processPlayerMove(userId, moveInput);
      
      // Save updated game state
      await this.db.updateGameState(gameSessionId, game.getState());
      
      // Record the move in database
      const moveNumber = (await this.db.getGameMoves(gameSessionId)).length + 1;
      await this.db.recordGameMove(gameSessionId, userId, moveNumber, {
        input: moveInput,
        result: result.move,
        valid: result.valid
      }, false);

      // Send response to player
      await this.sendGameResponse(message, game, result);

      // Check if game ended
      if (result.gameEnded) {
        await this.endGame(gameSessionId, result);
        this.activeGames.delete(gameSessionId);
        return result;
      }

      // Process AI turn if it's AI's turn next
      if (result.nextPlayer && result.nextPlayer.is_ai) {
        await this.processAITurn(gameSessionId, message);
      }

      return result;
    } catch (error) {
      logger.error(`Failed to process move for game ${gameSessionId}:`, error);
      
      // Send error message to user
      await this.sendMessage(message.chat.id, 
        `❌ Error processing move: ${error.message}\n\nTry again or use /quit to exit the game.`
      );
      
      throw error;
    }
  }

  async processAITurn(gameSessionId, originalMessage) {
    try {
      const game = await this.getGame(gameSessionId);
      if (!game) {
        return;
      }

      const gameSession = await this.db.getGameSession(gameSessionId);
      if (!gameSession.llm_model_id) {
        throw new Error('No AI model configured for this game');
      }

      // Get AI context and generate move
      const gameContext = game.getAIContext();
      const llmModel = await this.db.prepare(`
        SELECT * FROM llm_models WHERE id = ?
      `).bind(gameSession.llm_model_id).first();

      if (!llmModel) {
        throw new Error('AI model not found');
      }

      // Import LLM manager here to avoid circular dependencies
      const { LLMManager } = await import('../llm/llmManager.js');
      const llmManager = new LLMManager(this.env);
      
      const aiResponse = await llmManager.generateGameMove(llmModel, gameContext);
      
      // Process AI move
      const result = await game.processAIMove(aiResponse);
      
      // Save updated game state
      await this.db.updateGameState(gameSessionId, game.getState());
      
      // Record AI move
      const moveNumber = (await this.db.getGameMoves(gameSessionId)).length + 1;
      await this.db.recordGameMove(gameSessionId, null, moveNumber, {
        aiResponse: aiResponse,
        move: result.move
      }, true);

      // Send AI move response
      await this.sendGameResponse(originalMessage, game, result, true);

      // Check if game ended after AI move
      if (result.gameEnded) {
        await this.endGame(gameSessionId, result);
        this.activeGames.delete(gameSessionId);
      }

      return result;
    } catch (error) {
      logger.error(`Failed to process AI turn for game ${gameSessionId}:`, error);
      
      // Send error to user
      await this.sendMessage(originalMessage.chat.id,
        `🤖 AI encountered an error: ${error.message}\n\nYou can continue playing or use /quit to exit.`
      );
    }
  }

  async sendGameResponse(message, game, result, isAIMove = false) {
    const chatId = message.chat.id;
    const gameState = game.getDisplayState();
    
    let responseText = '';
    
    if (isAIMove) {
      responseText += `🤖 **AI Move:** ${result.description || result.move}\n\n`;
    } else {
      responseText += `✅ **Your Move:** ${result.description || result.move}\n\n`;
    }
    
    responseText += gameState.board + '\n\n';
    
    if (result.gameEnded) {
      if (result.winner) {
        responseText += `🎉 **Game Over!** ${result.winner.first_name || 'Player'} wins!\n\n`;
      } else {
        responseText += `🤝 **Game Over!** It's a tie!\n\n`;
      }
      responseText += result.endMessage || 'Thanks for playing!';
    } else {
      responseText += `**${gameState.status}**`;
      
      if (result.nextPlayer && !result.nextPlayer.is_ai) {
        responseText += '\n\n💡 Your turn! Choose your next move.';
      } else if (result.nextPlayer && result.nextPlayer.is_ai) {
        responseText += '\n\n🤖 AI is thinking...';
      }
    }

    // Create appropriate inline keyboard based on game type and state
    const keyboard = this.createGameKeyboard(game, result);

    await this.sendMessage(chatId, responseText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined
    });
  }

  createGameKeyboard(game, result) {
    if (result.gameEnded) {
      return [
        [
          { text: '🎯 Play Again', callback_data: `new_game_${game.gameType}` },
          { text: '🏠 Main Menu', callback_data: 'main_menu' }
        ]
      ];
    }

    const gameType = game.gameType;
    const sessionId = game.sessionId;

    if (gameType === 'Tic Tac Toe') {
      const validMoves = game.getValidMoves();
      if (validMoves.length > 0) {
        const rows = [];
        for (let i = 0; i < 3; i++) {
          const row = [];
          for (let j = 0; j < 3; j++) {
            const position = i * 3 + j + 1;
            if (validMoves.includes(position.toString())) {
              row.push({ text: position.toString(), callback_data: `move_${sessionId}_${position}` });
            } else {
              row.push({ text: '•', callback_data: 'noop' });
            }
          }
          rows.push(row);
        }
        
        rows.push([
          { text: '📋 Board', callback_data: `board_${sessionId}` },
          { text: '❌ Quit', callback_data: `quit_${sessionId}` }
        ]);
        
        return rows;
      }
    } else if (gameType === 'Big Eater Competition') {
      return [
        [{ text: '🍴 Take a Bite', callback_data: `bite_${sessionId}` }],
        [{ text: '💕 Romantic Move', callback_data: `romantic_${sessionId}` }],
        [{ text: '😏 Playful Sabotage', callback_data: `sabotage_${sessionId}` }],
        [
          { text: '📋 Status', callback_data: `board_${sessionId}` },
          { text: '❌ Quit', callback_data: `quit_${sessionId}` }
        ]
      ];
    }

    return [
      [
        { text: '📋 Status', callback_data: `board_${sessionId}` },
        { text: '❌ Quit', callback_data: `quit_${sessionId}` }
      ]
    ];
  }

  async endGame(gameSessionId, gameResult) {
    try {
      const { winner, finalState, endReason } = gameResult;
      
      await this.db.updateGameState(gameSessionId, finalState, 'completed');
      
      if (winner) {
        const result = await this.db.prepare(`
          UPDATE game_sessions 
          SET winner_user_id = ?, ended_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(winner.user_id || winner.id, gameSessionId).run();
      }

      await this.updatePlayerStats(gameSessionId, gameResult);
      
      logger.info(`Game ${gameSessionId} ended. Winner: ${winner ? winner.username : 'None'}, Reason: ${endReason}`);
    } catch (error) {
      logger.error(`Failed to end game ${gameSessionId}:`, error);
      throw error;
    }
  }

  async updatePlayerStats(gameSessionId, gameResult) {
    try {
      const gameSession = await this.db.getGameSession(gameSessionId);
      const players = await this.db.getGamePlayers(gameSessionId);
      
      for (const player of players) {
        if (player.is_ai) continue; // Skip AI players for stats
        
        const isWinner = gameResult.winner && gameResult.winner.user_id === player.user_id;
        const isLoss = gameResult.winner && gameResult.winner.user_id !== player.user_id;
        
        const existingStats = await this.db.prepare(`
          SELECT * FROM user_stats WHERE user_id = ? AND game_type_id = ?
        `).bind(player.user_id, gameSession.game_type_id).first();

        if (existingStats) {
          await this.db.prepare(`
            UPDATE user_stats 
            SET games_played = games_played + 1,
                games_won = games_won + ?,
                games_lost = games_lost + ?,
                last_played = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND game_type_id = ?
          `).bind(isWinner ? 1 : 0, isLoss ? 1 : 0, player.user_id, gameSession.game_type_id).run();
        } else {
          await this.db.prepare(`
            INSERT INTO user_stats 
            (user_id, game_type_id, games_played, games_won, games_lost, last_played)
            VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP)
          `).bind(player.user_id, gameSession.game_type_id, isWinner ? 1 : 0, isLoss ? 1 : 0).run();
        }
      }
    } catch (error) {
      logger.error('Failed to update player stats:', error);
    }
  }

  async getGameState(gameSessionId) {
    try {
      const game = await this.getGame(gameSessionId);
      if (!game) {
        return null;
      }

      return game.getDisplayState();
    } catch (error) {
      logger.error(`Failed to get game state for ${gameSessionId}:`, error);
      return null;
    }
  }

  async getValidMoves(gameSessionId, userId) {
    try {
      const game = await this.getGame(gameSessionId);
      if (!game) {
        return [];
      }

      return game.getValidMoves(userId);
    } catch (error) {
      logger.error(`Failed to get valid moves for game ${gameSessionId}:`, error);
      return [];
    }
  }

  getSupportedGameTypes() {
    return Array.from(this.gameTypes.keys());
  }

  async getGameHistory(gameSessionId) {
    try {
      const moves = await this.db.getGameMoves(gameSessionId);
      return moves.map(move => ({
        moveNumber: move.move_number,
        player: move.username || 'AI',
        move: JSON.parse(move.move_data_json),
        isAI: move.is_ai_move,
        timestamp: move.timestamp
      }));
    } catch (error) {
      logger.error(`Failed to get game history for ${gameSessionId}:`, error);
      return [];
    }
  }

  // Helper method for sending messages (imported from bot)
  async sendMessage(chatId, text, options = {}) {
    const botToken = this.env.BOT_TOKEN;
    const apiUrl = `https://api.telegram.org/bot${botToken}`;
    
    try {
      const response = await fetch(`${apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          ...options
        })
      });

      return await response.json();
    } catch (error) {
      logger.error('Send message error:', error);
      throw error;
    }
  }
}