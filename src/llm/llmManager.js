/**
 * Cloudflare Workers optimized LLM Manager
 * Uses fetch API instead of axios for HTTP requests
 */

import { DeepSeekProvider } from './providers/deepseek.js';
import { Logger } from '../utils/workerLogger.js';

const logger = new Logger('LLMManager');

export class LLMManager {
  constructor(env) {
    this.env = env;
    this.providers = new Map();
    this.initializeProviders();
  }

  initializeProviders() {
    this.providers.set('deepseek', DeepSeekProvider);
    // Add other providers as needed
  }

  async createModelInstance(modelConfig) {
    try {
      const { provider, model_id, api_key_encrypted, config_json } = modelConfig;
      
      if (!this.providers.has(provider)) {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // For Workers, we'll use the encrypted key directly or decrypt it
      let apiKey;
      if (typeof api_key_encrypted === 'string' && api_key_encrypted.startsWith('{')) {
        // It's an encrypted object, would need to decrypt
        // For now, assume it's the raw key for simplicity
        apiKey = api_key_encrypted;
      } else {
        apiKey = api_key_encrypted;
      }
      
      const config = config_json ? JSON.parse(config_json) : {};
      
      const ProviderClass = this.providers.get(provider);
      const instance = new ProviderClass({
        apiKey: this.env.DEEPSEEK_API_KEY || apiKey, // Use env var if available
        modelId: model_id,
        ...config
      });

      await instance.initialize();
      return instance;
    } catch (error) {
      logger.error(`Failed to create model instance for ${modelConfig.provider}:`, error);
      throw error;
    }
  }

  async generateGameMove(modelConfig, gameContext) {
    try {
      const model = await this.createModelInstance(modelConfig);
      
      const prompt = this.buildGamePrompt(gameContext);
      const response = await model.generateText(prompt, {
        maxTokens: 150,
        temperature: 0.7,
        stopSequences: ['\n\n', 'Human:', 'Player:']
      });

      return this.parseGameResponse(response, gameContext);
    } catch (error) {
      logger.error('Failed to generate game move:', error);
      throw error;
    }
  }

  async generateGameNarration(modelConfig, gameContext) {
    try {
      const model = await this.createModelInstance(modelConfig);
      
      const prompt = this.buildNarrationPrompt(gameContext);
      const response = await model.generateText(prompt, {
        maxTokens: 200,
        temperature: 0.8
      });

      return response.trim();
    } catch (error) {
      logger.error('Failed to generate game narration:', error);
      return 'The game continues...';
    }
  }

  buildGamePrompt(gameContext) {
    const { gameType, gameState, playerTurn, availableMoves, gameHistory } = gameContext;
    
    let prompt = `You are playing ${gameType}. Here's the current game state:\n\n`;
    
    if (gameState.board) {
      prompt += `Board:\n${this.formatBoard(gameState.board, gameType)}\n\n`;
    }
    
    if (gameHistory && gameHistory.length > 0) {
      prompt += `Recent moves:\n`;
      gameHistory.slice(-3).forEach(move => {
        prompt += `- ${move.player}: ${move.description}\n`;
      });
      prompt += '\n';
    }
    
    prompt += `It's your turn (Player ${playerTurn}).`;
    
    if (availableMoves && availableMoves.length > 0) {
      prompt += ` Available moves: ${availableMoves.join(', ')}`;
    }
    
    prompt += '\n\nChoose your move and explain your strategy briefly:';
    
    return prompt;
  }

  buildNarrationPrompt(gameContext) {
    const { gameType, lastMove, gameState, winner } = gameContext;
    
    let prompt = `You are a game narrator for ${gameType}. `;
    
    if (winner) {
      prompt += `The game has ended with ${winner} as the winner. Provide a brief congratulatory message.`;
    } else if (lastMove) {
      prompt += `Player ${lastMove.player} just made this move: ${lastMove.description}. `;
      prompt += `Provide engaging commentary about the move and current game situation.`;
    } else {
      prompt += 'The game is starting. Provide an exciting opening narration.';
    }
    
    prompt += ' Keep it brief (1-2 sentences) and entertaining.';
    
    return prompt;
  }

  formatBoard(board, gameType) {
    switch (gameType.toLowerCase()) {
      case 'tic tac toe':
        return this.formatTicTacToeBoard(board);
      case 'big eater competition':
        return board; // Already formatted in the game
      default:
        return JSON.stringify(board, null, 2);
    }
  }

  formatTicTacToeBoard(board) {
    let result = '';
    for (let i = 0; i < 3; i++) {
      result += board.slice(i * 3, (i + 1) * 3).map((cell, index) => {
        const position = i * 3 + index + 1;
        return cell || position.toString();
      }).join(' | ') + '\n';
      if (i < 2) result += '---------\n';
    }
    return result;
  }

  parseGameResponse(response, gameContext) {
    const lines = response.trim().split('\n');
    let move = null;
    let explanation = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      if (trimmedLine.includes(':')) {
        const [key, value] = trimmedLine.split(':', 2);
        if (key.toLowerCase().includes('move')) {
          move = value.trim();
        }
      } else if (!move && this.isValidMove(trimmedLine, gameContext)) {
        move = trimmedLine;
      } else {
        explanation += trimmedLine + ' ';
      }
    }
    
    if (!move) {
      move = this.extractMoveFromText(response, gameContext);
    }
    
    return {
      move: move || 'pass',
      explanation: explanation.trim() || 'Making my move...',
      confidence: move ? 0.8 : 0.3
    };
  }

  isValidMove(move, gameContext) {
    const { availableMoves } = gameContext;
    if (!availableMoves) return true;
    
    return availableMoves.some(validMove => 
      move.toLowerCase().includes(validMove.toLowerCase())
    );
  }

  extractMoveFromText(text, gameContext) {
    const { gameType, availableMoves } = gameContext;
    
    if (!availableMoves) return null;
    
    const lowerText = text.toLowerCase();
    
    for (const move of availableMoves) {
      if (lowerText.includes(move.toLowerCase())) {
        return move;
      }
    }
    
    // Game-specific patterns
    if (gameType.toLowerCase() === 'tic tac toe') {
      const matches = text.match(/\b[1-9]\b/g);
      if (matches && matches.length > 0) {
        return matches[0];
      }
    }
    
    return null;
  }

  async validateModel(provider, apiKey, modelId) {
    try {
      if (!this.providers.has(provider)) {
        return { valid: false, error: 'Unsupported provider' };
      }

      const ProviderClass = this.providers.get(provider);
      const instance = new ProviderClass({
        apiKey,
        modelId
      });

      await instance.initialize();
      
      const testResponse = await instance.generateText('Test message', {
        maxTokens: 5
      });

      return { 
        valid: true, 
        modelId: instance.getModelId(),
        response: testResponse 
      };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }

  getSupportedProviders() {
    return Array.from(this.providers.keys());
  }

  getProviderInfo(provider) {
    const info = {
      deepseek: {
        name: 'DeepSeek',
        models: ['deepseek-chat', 'deepseek-coder'],
        description: 'DeepSeek models for intelligent gameplay and reasoning'
      }
    };

    return info[provider] || null;
  }
}