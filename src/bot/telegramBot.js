/**
 * Cloudflare Workers optimized Telegram Bot
 * Uses fetch API instead of Telegraf for better Workers compatibility
 */

import { GameEngine } from '../games/gameEngine.js';
import { LLMManager } from '../llm/llmManager.js';
import { Logger } from '../utils/workerLogger.js';
import { Crypto } from '../utils/workerCrypto.js';

const logger = new Logger('TelegramBot');

export class TelegramBot {
  constructor(env, db) {
    this.env = env;
    this.db = db;
    this.gameEngine = new GameEngine(db, env);
    this.llmManager = new LLMManager(env);
    this.userSessions = new Map();
    this.activeUserGames = new Map();
    this.crypto = new Crypto(env.ENCRYPTION_KEY);
    
    this.botToken = env.BOT_TOKEN;
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async processUpdate(update) {
    try {
      if (update.message) {
        return await this.handleMessage(update.message);
      } else if (update.callback_query) {
        return await this.handleCallbackQuery(update.callback_query);
      }
      
      return { ok: true };
    } catch (error) {
      logger.error('Update processing error:', error);
      throw error;
    }
  }

  async handleMessage(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text;

    // Update user data
    await this.updateUserData(message.from);

    // Handle commands
    if (text && text.startsWith('/')) {
      return await this.handleCommand(message);
    }

    // Handle text input during games
    if (text && this.activeUserGames.has(userId)) {
      return await this.handleGameInput(message);
    }

    // Default response
    return await this.sendMessage(chatId, 
      'Hi! Use /start to begin or /help for assistance. Try /play tic for instant gaming!'
    );
  }

  async handleCommand(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text;
    const args = text.split(' ');
    const command = args[0].slice(1); // Remove '/'

    switch (command) {
      case 'start':
        return await this.handleStart(message);
      
      case 'help':
        return await this.handleHelp(message);
      
      case 'play':
        return await this.handlePlay(message, args.slice(1));
      
      case 'tic':
        return await this.startTicTacToe(message);
      
      case 'eater':
        return await this.startBigEaterCompetition(message);
      
      case 'move':
        return await this.handleMove(message, args.slice(1));
      
      case 'bite':
        return await this.handleBite(message);
      
      case 'romantic':
        return await this.handleRomantic(message, args.slice(1));
      
      case 'sabotage':
        return await this.handleSabotage(message, args.slice(1));
      
      case 'powerup':
        return await this.handlePowerUp(message, args.slice(1));
      
      case 'board':
        return await this.handleBoard(message);
      
      case 'status':
        return await this.handleStatus(message);
      
      case 'quit':
        return await this.handleQuit(message);
      
      case 'models':
        return await this.handleModels(message);
      
      default:
        return await this.sendMessage(chatId, 
          '❌ Unknown command. Use /help for available commands.'
        );
    }
  }

  async handleStart(message) {
    const chatId = message.chat.id;
    const user = await this.db.getUser(message.from.id);
    
    const welcomeMessage = `🎮 Welcome to the Gaming & LLM Bot!

Hi ${user?.first_name || 'there'}! I can help you:

🤖 Manage AI models for gaming
🎯 Play text-based board games  
💕 Enjoy romantic couple games
📊 Track your gaming statistics

**Quick Start:**
• /play tic - Tic Tac Toe
• /play eater - Big Eater Competition
• /help - Full command list

Choose an option below:`;

    return await this.sendMessage(chatId, welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 Play Tic Tac Toe', callback_data: 'quick_tic' }],
          [{ text: '💕 Big Eater Competition', callback_data: 'quick_eater' }],
          [{ text: '🤖 Manage AI Models', callback_data: 'manage_models' }],
          [{ text: '❓ Help & Commands', callback_data: 'help' }]
        ]
      }
    });
  }

  async handleHelp(message) {
    const chatId = message.chat.id;
    
    const helpMessage = `🎮 **Gaming & LLM Bot Help**

**🎯 Quick Game Commands:**
• \`/play\` - Choose and start a game
• \`/play tic\` - Start Tic Tac Toe instantly
• \`/play eater\` - Big Eater Competition (couples game!)
• \`/move <position>\` - Make a move (e.g., /move 5)
• \`/bite\` - Take a bite (Big Eater Competition)
• \`/romantic <move>\` - Use romantic moves
• \`/board\` - Show current game board
• \`/quit\` - Quit current game
• \`/status\` - Show game status and info

**⚙️ Management Commands:**
• \`/start\` - Welcome message and main menu
• \`/models\` - Manage your AI models
• \`/help\` - Show this help message

**🎮 How to Play:**
1. Start: \`/play tic\` (for Tic Tac Toe)
2. Move: Send numbers 1-9 or use \`/move 5\`
3. Win: Get 3 in a row!
4. Quit: \`/quit\` anytime

**💕 Big Eater Competition:**
1. Start: \`/play eater\`
2. Actions: \`/bite\`, \`/romantic\`, \`/sabotage\`
3. Compete with your AI girlfriend!

**💡 Pro Tips:**
• Just send numbers 1-9 during Tic Tac Toe
• Use buttons for quick actions
• AI responds intelligently to your moves

Ready to play? Try \`/play tic\` or \`/play eater\`!`;

    return await this.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  }

  async handlePlay(message, args) {
    const chatId = message.chat.id;
    
    if (args.length === 0) {
      return await this.showGameOptions(message);
    }
    
    const gameType = args[0].toLowerCase();
    
    switch (gameType) {
      case 'tic':
      case 'tictactoe':
        return await this.startTicTacToe(message);
      case 'eater':
      case 'bigeater':
      case 'eating':
        return await this.startBigEaterCompetition(message);
      default:
        return await this.showGameOptions(message);
    }
  }

  async showGameOptions(message) {
    const chatId = message.chat.id;
    
    const text = `🎮 **Choose a game to play:**

Available games:
• \`/play tic\` - Tic Tac Toe (quick 3x3 game)
• \`/play eater\` - Big Eater Competition (romantic couple game!)

Or use the buttons below:`;

    return await this.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 Tic Tac Toe', callback_data: 'quick_tic' }],
          [{ text: '💕 Big Eater Competition', callback_data: 'quick_eater' }],
          [{ text: '📋 My Active Games', callback_data: 'active_games' }]
        ]
      }
    });
  }

  async startTicTacToe(message) {
    try {
      const chatId = message.chat.id;
      const userId = message.from.id;
      
      // Check if user has AI models
      const models = await this.db.getUserLLMModels(userId);
      if (models.length === 0) {
        return await this.sendMessage(chatId,
          '❌ You need an AI model to play games.\n\nUse the button below to add one first.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '➕ Add AI Model', callback_data: 'add_model_deepseek' }]
              ]
            }
          }
        );
      }

      // Create new game session
      const gameType = await this.db.getGameType('Tic Tac Toe');
      const gameSession = await this.db.createGameSession({
        game_type_id: gameType.id,
        creator_user_id: userId,
        llm_model_id: models[0].id
      });

      // Add players
      await this.db.addGamePlayer(gameSession.id, userId, 1);
      
      // Add AI player
      const aiUserId = 999999;
      await this.db.createUser(aiUserId, {
        username: 'ai_player',
        first_name: 'AI',
        last_name: 'Player'
      });
      await this.db.addGamePlayer(gameSession.id, aiUserId, 2, true);

      // Set as active game
      this.activeUserGames.set(userId, gameSession.id);

      // Initialize game
      const game = await this.gameEngine.createGame(gameSession.id, 'Tic Tac Toe');
      const gameState = game.getDisplayState();

      const text = `🎯 **Tic Tac Toe Started!**

${gameState.board}

**${gameState.status}**

💡 **How to play:**
• Send a number 1-9 to place your X
• Or use \`/move <position>\`
• Use \`/board\` to see the current board
• Use \`/quit\` to forfeit

Your turn! Choose position 1-9:`;

      return await this.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '1', callback_data: `move_${gameSession.id}_1` },
              { text: '2', callback_data: `move_${gameSession.id}_2` },
              { text: '3', callback_data: `move_${gameSession.id}_3` }
            ],
            [
              { text: '4', callback_data: `move_${gameSession.id}_4` },
              { text: '5', callback_data: `move_${gameSession.id}_5` },
              { text: '6', callback_data: `move_${gameSession.id}_6` }
            ],
            [
              { text: '7', callback_data: `move_${gameSession.id}_7` },
              { text: '8', callback_data: `move_${gameSession.id}_8` },
              { text: '9', callback_data: `move_${gameSession.id}_9` }
            ],
            [
              { text: '📋 Show Board', callback_data: `board_${gameSession.id}` },
              { text: '❌ Quit Game', callback_data: `quit_${gameSession.id}` }
            ]
          ]
        }
      });

    } catch (error) {
      logger.error('Error starting Tic Tac Toe:', error);
      return await this.sendMessage(message.chat.id, '❌ Failed to start game. Please try again.');
    }
  }

  async startBigEaterCompetition(message) {
    try {
      const chatId = message.chat.id;
      const userId = message.from.id;
      
      // Check if user has AI models
      const models = await this.db.getUserLLMModels(userId);
      if (models.length === 0) {
        return await this.sendMessage(chatId,
          '❌ You need an AI model for the Big Eater Competition.\n\nUse the button below to add one first.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '➕ Add AI Model', callback_data: 'add_model_deepseek' }]
              ]
            }
          }
        );
      }

      // Create new game session
      const gameType = await this.db.getGameType('Big Eater Competition');
      const gameSession = await this.db.createGameSession({
        game_type_id: gameType.id,
        creator_user_id: userId,
        llm_model_id: models[0].id
      });

      // Add players
      await this.db.addGamePlayer(gameSession.id, userId, 1);
      
      // Add AI girlfriend
      const aiUserId = 888888;
      await this.db.createUser(aiUserId, {
        username: 'ai_girlfriend',
        first_name: 'Your Girlfriend',
        last_name: '💕'
      });
      await this.db.addGamePlayer(gameSession.id, aiUserId, 2, true);

      // Set as active game
      this.activeUserGames.set(userId, gameSession.id);

      // Initialize game
      const game = await this.gameEngine.createGame(gameSession.id, 'Big Eater Competition');
      const gameState = game.getDisplayState();

      const text = `💕 **Big Eater Competition Started!**

${gameState.board}

🎮 **How to Play:**
• \`/bite\` - Take a bite of food
• \`/powerup <type>\` - Use power-ups 
• \`/romantic <move>\` - Use romantic special moves
• \`/sabotage <type>\` - Playfully mess with your girlfriend
• \`/board\` - Show current status
• \`/quit\` - End the competition

💡 **This is a story-driven game where you and your AI girlfriend compete in eating challenges while having romantic moments together!**

Ready to start? Use \`/bite\` to begin eating!`;

      return await this.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🍴 Take a Bite', callback_data: `bite_${gameSession.id}` }],
            [{ text: '💕 Romantic Move', callback_data: `romantic_${gameSession.id}` }],
            [{ text: '😏 Playful Sabotage', callback_data: `sabotage_${gameSession.id}` }],
            [
              { text: '📋 Show Status', callback_data: `board_${gameSession.id}` },
              { text: '❌ Quit', callback_data: `quit_${gameSession.id}` }
            ]
          ]
        }
      });

    } catch (error) {
      logger.error('Error starting Big Eater Competition:', error);
      return await this.sendMessage(message.chat.id, '❌ Failed to start Big Eater Competition. Please try again.');
    }
  }

  async handleGameInput(message) {
    const userId = message.from.id;
    const text = message.text.trim();
    const gameId = this.activeUserGames.get(userId);
    
    if (!gameId) return;
    
    // Handle number inputs for Tic Tac Toe
    if (/^[1-9]$/.test(text)) {
      return await this.processGameMove(message, gameId, text);
    }
  }

  async processGameMove(message, gameSessionId, moveInput) {
    // Implementation similar to original but adapted for Workers
    // This would be quite long, so I'll create a separate method
    return await this.gameEngine.processPlayerMove(message, gameSessionId, moveInput);
  }

  async handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    // Answer callback query to remove loading state
    await this.answerCallbackQuery(callbackQuery.id);

    // Handle different callback types
    if (data === 'quick_tic') {
      return await this.startTicTacToe({ chat: { id: chatId }, from: callbackQuery.from });
    } else if (data === 'quick_eater') {
      return await this.startBigEaterCompetition({ chat: { id: chatId }, from: callbackQuery.from });
    } else if (data.startsWith('move_')) {
      const [, gameId, position] = data.split('_');
      this.activeUserGames.set(userId, parseInt(gameId));
      return await this.processGameMove({ chat: { id: chatId }, from: callbackQuery.from }, parseInt(gameId), position);
    }
    // Add more callback handlers...
  }

  async updateUserData(user) {
    await this.db.createUser(user.id, {
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      language_code: user.language_code
    });
    await this.db.updateUserActivity(user.id);
  }

  // Telegram API methods using fetch
  async sendMessage(chatId, text, options = {}) {
    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
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

  async editMessageText(chatId, messageId, text, options = {}) {
    try {
      const response = await fetch(`${this.apiUrl}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: text,
          ...options
        })
      });

      return await response.json();
    } catch (error) {
      logger.error('Edit message error:', error);
      throw error;
    }
  }

  async answerCallbackQuery(callbackQueryId, options = {}) {
    try {
      const response = await fetch(`${this.apiUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          ...options
        })
      });

      return await response.json();
    } catch (error) {
      logger.error('Answer callback query error:', error);
      throw error;
    }
  }

  // Command handler implementations
  async handleMove(message, args) {
    const userId = message.from.id;
    const gameId = this.activeUserGames.get(userId);
    
    if (!gameId) {
      return await this.sendMessage(message.chat.id, 
        '❌ You are not in an active game. Use /play to start one!'
      );
    }
    
    if (args.length === 0) {
      return await this.sendMessage(message.chat.id, 
        '❌ Please specify a move. Example: /move 5'
      );
    }
    
    const moveInput = args[0];
    return await this.gameEngine.processPlayerMove(message, gameId, moveInput);
  }

  async handleBite(message) {
    const userId = message.from.id;
    const gameId = this.activeUserGames.get(userId);
    
    if (!gameId) {
      return await this.sendMessage(message.chat.id, 
        '❌ You are not in an active Big Eater Competition. Use /play eater to start one!'
      );
    }
    
    return await this.gameEngine.processPlayerMove(message, gameId, { action: 'bite' });
  }

  async handleRomantic(message, args) {
    const userId = message.from.id;
    const gameId = this.activeUserGames.get(userId);
    
    if (!gameId) {
      return await this.sendMessage(message.chat.id, 
        '❌ You are not in an active Big Eater Competition. Use /play eater to start one!'
      );
    }
    
    const romanticMove = args.length > 0 ? args.join(' ') : 'romantic_gesture';
    return await this.gameEngine.processPlayerMove(message, gameId, { 
      action: 'romantic', 
      move: romanticMove 
    });
  }

  async handleSabotage(message, args) {
    const userId = message.from.id;
    const gameId = this.activeUserGames.get(userId);
    
    if (!gameId) {
      return await this.sendMessage(message.chat.id, 
        '❌ You are not in an active Big Eater Competition. Use /play eater to start one!'
      );
    }
    
    const sabotageType = args.length > 0 ? args.join(' ') : 'playful_distraction';
    return await this.gameEngine.processPlayerMove(message, gameId, { 
      action: 'sabotage', 
      type: sabotageType 
    });
  }

  async handlePowerUp(message, args) {
    const userId = message.from.id;
    const gameId = this.activeUserGames.get(userId);
    
    if (!gameId) {
      return await this.sendMessage(message.chat.id, 
        '❌ You are not in an active game. Use /play to start one!'
      );
    }
    
    const powerUpType = args.length > 0 ? args.join(' ') : 'boost';
    return await this.gameEngine.processPlayerMove(message, gameId, { 
      action: 'powerup', 
      type: powerUpType 
    });
  }

  async handleBoard(message) {
    const userId = message.from.id;
    const gameId = this.activeUserGames.get(userId);
    
    if (!gameId) {
      return await this.sendMessage(message.chat.id, 
        '❌ You are not in an active game. Use /play to start one!'
      );
    }
    
    try {
      const gameState = await this.gameEngine.getGameState(gameId);
      if (!gameState) {
        return await this.sendMessage(message.chat.id, 
          '❌ Could not retrieve game state.'
        );
      }
      
      const text = `📋 **Current Game State**\n\n${gameState.board}\n\n**${gameState.status}**`;
      
      return await this.sendMessage(message.chat.id, text, { parse_mode: 'Markdown' });
    } catch (error) {
      return await this.sendMessage(message.chat.id, 
        '❌ Error retrieving game state. Please try again.'
      );
    }
  }

  async handleStatus(message) {
    const userId = message.from.id;
    const gameId = this.activeUserGames.get(userId);
    
    if (!gameId) {
      return await this.sendMessage(message.chat.id, 
        '❌ You are not in an active game. Use /play to start one!'
      );
    }
    
    try {
      const gameSession = await this.db.getGameSession(gameId);
      const players = await this.db.getGamePlayers(gameId);
      const moves = await this.db.getGameMoves(gameId);
      
      let statusText = `📊 **Game Status**\n\n`;
      statusText += `🎮 **Game:** ${gameSession.game_name}\n`;
      statusText += `👥 **Players:** ${players.length}\n`;
      statusText += `🎯 **Moves:** ${moves.length}\n`;
      statusText += `⏱️ **Status:** ${gameSession.status}\n`;
      
      if (gameSession.started_at) {
        statusText += `🕐 **Started:** ${new Date(gameSession.started_at).toLocaleString()}\n`;
      }
      
      statusText += '\n**Players:**\n';
      players.forEach(player => {
        const icon = player.is_ai ? '🤖' : '👤';
        statusText += `${icon} ${player.first_name} (Player ${player.player_number})\n`;
      });
      
      return await this.sendMessage(message.chat.id, statusText, { parse_mode: 'Markdown' });
    } catch (error) {
      return await this.sendMessage(message.chat.id, 
        '❌ Error retrieving game status. Please try again.'
      );
    }
  }

  async handleQuit(message) {
    const userId = message.from.id;
    const gameId = this.activeUserGames.get(userId);
    
    if (!gameId) {
      return await this.sendMessage(message.chat.id, 
        '❌ You are not in an active game.'
      );
    }
    
    try {
      // End the game session
      await this.db.updateGameState(gameId, {}, 'cancelled');
      this.activeUserGames.delete(userId);
      
      return await this.sendMessage(message.chat.id, 
        '✅ You have quit the game. Thanks for playing!',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎯 Start New Game', callback_data: 'quick_tic' }],
              [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
            ]
          }
        }
      );
    } catch (error) {
      return await this.sendMessage(message.chat.id, 
        '❌ Error quitting game. Please try again.'
      );
    }
  }

  async handleModels(message) {
    const userId = message.from.id;
    
    try {
      const models = await this.db.getUserLLMModels(userId);
      
      let text = `🤖 **Your AI Models**\n\n`;
      
      if (models.length === 0) {
        text += `You haven't added any AI models yet.\n\n`;
        text += `To play games with AI, you need to add a model first.`;
        
        return await this.sendMessage(message.chat.id, text, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Add DeepSeek Model', callback_data: 'add_model_deepseek' }],
              [{ text: '❓ Help with Models', callback_data: 'help_models' }]
            ]
          }
        });
      }
      
      models.forEach((model, index) => {
        text += `**${index + 1}. ${model.name}**\n`;
        text += `Provider: ${model.provider}\n`;
        text += `Model: ${model.model_id}\n`;
        text += `Status: ${model.is_active ? '✅ Active' : '❌ Inactive'}\n\n`;
      });
      
      return await this.sendMessage(message.chat.id, text, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Add New Model', callback_data: 'add_model_deepseek' }],
            [{ text: '🔧 Manage Models', callback_data: 'manage_models' }]
          ]
        }
      });
    } catch (error) {
      return await this.sendMessage(message.chat.id, 
        '❌ Error retrieving models. Please try again.'
      );
    }
  }
}