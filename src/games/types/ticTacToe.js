/**
 * Tic Tac Toe Game for Cloudflare Workers
 * Workers-compatible implementation of the classic 3x3 grid game
 */

import { BaseGame } from './baseGame.js';
import { Logger } from '../../utils/workerLogger.js';

const logger = new Logger('TicTacToe');

export class TicTacToeGame extends BaseGame {
  constructor(config) {
    super(config);
    this.boardSize = 3;
    this.winCondition = 3;
    this.gameType = 'Tic Tac Toe';
  }

  async initialize() {
    await super.initialize();
    
    this.gameState = {
      board: Array(9).fill(null),
      currentPlayer: 1,
      gamePhase: 'playing',
      moveCount: 0,
      winner: null,
      winningLine: null
    };

    await this.saveGameState();
    logger.info(`TicTacToe game ${this.sessionId} initialized`);
  }

  async processMove(userId, moveData) {
    try {
      const player = this.getPlayerByUserId(userId);
      if (!player) {
        return {
          valid: false,
          move: null,
          description: 'Player not found in this game',
          gameEnded: false
        };
      }

      if (player.player_number !== this.gameState.currentPlayer) {
        return {
          valid: false,
          move: null,
          description: 'Not your turn',
          gameEnded: false
        };
      }

      const { position } = moveData;
      
      if (typeof position !== 'number' || position < 1 || position > 9) {
        return {
          valid: false,
          move: null,
          description: 'Invalid position. Choose a number between 1-9',
          gameEnded: false
        };
      }

      const boardIndex = position - 1;
      
      if (this.gameState.board[boardIndex] !== null) {
        return {
          valid: false,
          move: null,
          description: 'Position already occupied',
          gameEnded: false
        };
      }

      // Make the move
      const symbol = player.player_number === 1 ? 'X' : 'O';
      this.gameState.board[boardIndex] = symbol;
      this.gameState.moveCount++;

      await this.recordMove(userId, {
        position,
        symbol,
        boardState: [...this.gameState.board]
      });

      const gameResult = this.checkGameEnd();
      
      if (gameResult.ended) {
        this.gameState.gamePhase = 'ended';
        this.gameState.winner = gameResult.winner;
        this.gameState.winningLine = gameResult.winningLine;
        
        await this.saveGameState();
        
        return {
          valid: true,
          move: `${symbol} at position ${position}`,
          description: `Placed ${symbol} at position ${position}`,
          gameEnded: true,
          winner: gameResult.winner,
          endReason: gameResult.reason,
          finalState: this.gameState,
          endMessage: this.getEndGameMessage(gameResult)
        };
      } else {
        // Switch to next player
        this.gameState.currentPlayer = this.gameState.currentPlayer === 1 ? 2 : 1;
        const nextPlayer = this.getPlayerByNumber(this.gameState.currentPlayer);
        
        await this.saveGameState();
        
        return {
          valid: true,
          move: `${symbol} at position ${position}`,
          description: `Placed ${symbol} at position ${position}`,
          gameEnded: false,
          nextPlayer: nextPlayer
        };
      }
    } catch (error) {
      logger.error(`Move processing error in game ${this.sessionId}:`, error);
      return {
        valid: false,
        move: null,
        description: error.message,
        gameEnded: false
      };
    }
  }

  async processAIMove(aiResponse) {
    try {
      let position = null;
      
      // Try to extract position from AI response
      if (aiResponse.move) {
        const moveStr = aiResponse.move.toString();
        const parsedPosition = parseInt(moveStr);
        
        if (parsedPosition >= 1 && parsedPosition <= 9) {
          position = parsedPosition;
        }
      }
      
      // Fallback to random valid move if AI didn't provide valid position
      if (!position) {
        position = this.getRandomValidMove();
      }
      
      if (!position) {
        throw new Error('No valid moves available');
      }
      
      const aiPlayer = this.getAIPlayer();
      if (!aiPlayer) {
        throw new Error('AI player not found');
      }
      
      return await this.processMove(aiPlayer.user_id, { position });
    } catch (error) {
      logger.error(`AI move processing error in game ${this.sessionId}:`, error);
      return {
        valid: false,
        move: null,
        description: error.message,
        gameEnded: false
      };
    }
  }

  checkGameEnd() {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (this.gameState.board[a] && 
          this.gameState.board[a] === this.gameState.board[b] && 
          this.gameState.board[a] === this.gameState.board[c]) {
        
        const winnerSymbol = this.gameState.board[a];
        const winnerPlayerNumber = winnerSymbol === 'X' ? 1 : 2;
        const winner = this.players.find(p => p.player_number === winnerPlayerNumber);
        
        return {
          ended: true,
          winner: winner,
          reason: 'win',
          winningLine: pattern
        };
      }
    }

    // Check for draw
    if (this.gameState.moveCount === 9) {
      return {
        ended: true,
        winner: null,
        reason: 'draw'
      };
    }

    return { ended: false };
  }

  getDisplayState() {
    const board = [];
    for (let i = 0; i < 3; i++) {
      const row = this.gameState.board.slice(i * 3, (i + 1) * 3)
        .map((cell, index) => {
          const position = i * 3 + index + 1;
          return cell || position.toString();
        });
      board.push(row.join(' | '));
    }

    const boardDisplay = board.join('\n---------\n');
    
    let statusMessage = '';
    if (this.gameState.gamePhase === 'ended') {
      if (this.gameState.winner) {
        const winnerName = this.gameState.winner.first_name || this.gameState.winner.username;
        statusMessage = `🎉 ${winnerName} wins!`;
      } else {
        statusMessage = '🤝 It\'s a draw!';
      }
    } else {
      const currentPlayerName = this.getCurrentPlayerName();
      const symbol = this.gameState.currentPlayer === 1 ? 'X' : 'O';
      statusMessage = `${currentPlayerName}'s turn (${symbol})`;
    }

    return {
      board: boardDisplay,
      status: statusMessage,
      moveCount: this.gameState.moveCount,
      currentPlayer: this.gameState.currentPlayer,
      gamePhase: this.gameState.gamePhase,
      validMoves: this.getValidMoves()
    };
  }

  getValidMoves(userId = null) {
    if (this.gameState.gamePhase === 'ended') {
      return [];
    }

    if (userId) {
      const player = this.getPlayerByUserId(userId);
      if (!player || player.player_number !== this.gameState.currentPlayer) {
        return [];
      }
    }

    return this.gameState.board
      .map((cell, index) => cell === null ? (index + 1).toString() : null)
      .filter(pos => pos !== null);
  }

  getRandomValidMove() {
    const validMoves = this.getValidMoves();
    if (validMoves.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * validMoves.length);
    return parseInt(validMoves[randomIndex]);
  }

  getAIContext() {
    const validMoves = this.getValidMoves();
    const boardString = this.gameState.board
      .map((cell, index) => cell || (index + 1).toString())
      .join(' ');
    
    return {
      gameType: 'Tic Tac Toe',
      gameState: this.gameState,
      playerTurn: this.gameState.currentPlayer,
      availableMoves: validMoves,
      gameHistory: this.getMoveHistory(),
      currentBoardString: boardString
    };
  }

  getEndGameMessage(gameResult) {
    if (gameResult.reason === 'draw') {
      return '🤝 Game ended in a draw! Good game!';
    } else if (gameResult.winner) {
      const winnerName = gameResult.winner.first_name || gameResult.winner.username || 'Player';
      return `🎉 Congratulations ${winnerName}! You won the game!`;
    }
    return 'Game ended.';
  }

  getMoveHistory() {
    return this.gameState.board
      .map((cell, index) => {
        if (cell) {
          return {
            position: index + 1,
            symbol: cell,
            player: cell === 'X' ? 'Player 1' : 'Player 2'
          };
        }
        return null;
      })
      .filter(move => move !== null);
  }

  getCurrentPlayerName() {
    const currentPlayer = this.players.find(p => p.player_number === this.gameState.currentPlayer);
    return currentPlayer ? (currentPlayer.first_name || currentPlayer.username) : `Player ${this.gameState.currentPlayer}`;
  }

  static getGameInfo() {
    return {
      name: 'Tic Tac Toe',
      description: 'Classic 3x3 grid game where players take turns placing X or O',
      minPlayers: 2,
      maxPlayers: 2,
      estimatedDuration: 5,
      rules: [
        'Players take turns placing their symbol (X or O) on a 3x3 grid',
        'First player to get 3 symbols in a row (horizontal, vertical, or diagonal) wins',
        'If all 9 squares are filled without a winner, the game is a draw',
        'Choose a position by sending a number from 1-9'
      ],
      commands: [
        '/move <position>: Place your symbol at position 1-9',
        '/board: Show current board state',
        '/quit: Quit the current game'
      ]
    };
  }
}