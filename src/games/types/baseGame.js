/**
 * Base Game class for Cloudflare Workers
 * Provides common functionality for all game types
 */

import { Logger } from '../../utils/workerLogger.js';

const logger = new Logger('BaseGame');

export class BaseGame {
  constructor(config) {
    this.sessionId = config.sessionId;
    this.players = config.players || [];
    this.db = config.db;
    this.env = config.env;
    this.gameState = {};
    this.moveCounter = 0;
    this.startTime = null;
    this.endTime = null;
    this.gameType = 'Base Game';
  }

  async initialize() {
    this.startTime = new Date();
    await this.db.prepare(
      'UPDATE game_sessions SET started_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?'
    ).bind('active', this.sessionId).run();
    
    logger.info(`Base game ${this.sessionId} initialized`);
  }

  async saveGameState() {
    try {
      await this.db.updateGameState(this.sessionId, this.gameState);
    } catch (error) {
      logger.error(`Failed to save game state for ${this.sessionId}:`, error);
      throw error;
    }
  }

  async loadState(savedState) {
    this.gameState = { ...this.gameState, ...savedState };
  }

  getState() {
    return this.gameState;
  }

  async recordMove(userId, moveData, isAI = false) {
    try {
      this.moveCounter++;
      await this.db.recordGameMove(
        this.sessionId,
        userId,
        this.moveCounter,
        moveData,
        isAI
      );
    } catch (error) {
      logger.error(`Failed to record move for game ${this.sessionId}:`, error);
      throw error;
    }
  }

  getPlayerByUserId(userId) {
    return this.players.find(player => player.user_id === userId);
  }

  getPlayerByNumber(playerNumber) {
    return this.players.find(player => player.player_number === playerNumber);
  }

  getAIPlayer() {
    return this.players.find(player => player.is_ai === true);
  }

  getHumanPlayers() {
    return this.players.filter(player => player.is_ai === false);
  }

  getCurrentPlayer() {
    if (!this.gameState.currentPlayer) return null;
    return this.getPlayerByNumber(this.gameState.currentPlayer);
  }

  isPlayerTurn(userId) {
    const player = this.getPlayerByUserId(userId);
    if (!player) return false;
    
    return player.player_number === this.gameState.currentPlayer;
  }

  // These methods must be implemented by subclasses
  async processPlayerMove(userId, moveInput) {
    // Parse move input and call processMove
    let moveData;
    
    if (typeof moveInput === 'string' && /^[1-9]$/.test(moveInput)) {
      moveData = { position: parseInt(moveInput) };
    } else if (typeof moveInput === 'object') {
      moveData = moveInput;
    } else {
      throw new Error('Invalid move input');
    }

    return await this.processMove(userId, moveData);
  }

  async processMove(userId, moveData) {
    throw new Error('processMove must be implemented by game subclass');
  }

  async processAIMove(aiResponse) {
    throw new Error('processAIMove must be implemented by game subclass');
  }

  getDisplayState() {
    throw new Error('getDisplayState must be implemented by game subclass');
  }

  getValidMoves(userId = null) {
    throw new Error('getValidMoves must be implemented by game subclass');
  }

  getAIContext() {
    throw new Error('getAIContext must be implemented by game subclass');
  }

  checkGameEnd() {
    throw new Error('checkGameEnd must be implemented by game subclass');
  }

  async endGame(winner = null, reason = 'completed') {
    this.endTime = new Date();
    this.gameState.gamePhase = 'ended';
    this.gameState.endReason = reason;
    this.gameState.winner = winner;
    
    await this.saveGameState();
    
    await this.db.prepare(
      'UPDATE game_sessions SET ended_at = CURRENT_TIMESTAMP, status = ?, winner_user_id = ? WHERE id = ?'
    ).bind('completed', winner?.user_id || null, this.sessionId).run();
  }

  getGameDuration() {
    if (!this.startTime) return 0;
    const endTime = this.endTime || new Date();
    return Math.floor((endTime - this.startTime) / 1000);
  }

  getPlayerCount() {
    return this.players.length;
  }

  getHumanPlayerCount() {
    return this.getHumanPlayers().length;
  }

  getAIPlayerCount() {
    return this.players.filter(p => p.is_ai).length;
  }

  validateMove(userId, moveData) {
    const player = this.getPlayerByUserId(userId);
    if (!player) {
      throw new Error('Player not found in this game');
    }

    if (this.gameState.gamePhase === 'ended') {
      throw new Error('Game has already ended');
    }

    if (!this.isPlayerTurn(userId)) {
      throw new Error('Not your turn');
    }

    return true;
  }

  async forfeit(userId) {
    try {
      const player = this.getPlayerByUserId(userId);
      if (!player) {
        throw new Error('Player not found in this game');
      }

      const otherPlayers = this.players.filter(p => p.user_id !== userId);
      const winner = otherPlayers.length === 1 ? otherPlayers[0] : null;

      await this.recordMove(userId, { action: 'forfeit' });
      await this.endGame(winner, 'forfeit');

      return {
        success: true,
        gameEnded: true,
        winner: winner,
        endReason: 'forfeit',
        message: `${player.first_name || player.username} has forfeited the game.`
      };
    } catch (error) {
      logger.error(`Forfeit error in game ${this.sessionId}:`, error);
      throw error;
    }
  }

  async pause() {
    this.gameState.gamePhase = 'paused';
    await this.saveGameState();
  }

  async resume() {
    this.gameState.gamePhase = 'playing';
    await this.saveGameState();
  }

  getGameInfo() {
    return {
      sessionId: this.sessionId,
      playerCount: this.getPlayerCount(),
      gamePhase: this.gameState.gamePhase,
      currentPlayer: this.gameState.currentPlayer,
      moveCount: this.moveCounter,
      duration: this.getGameDuration(),
      startTime: this.startTime,
      endTime: this.endTime
    };
  }

  async getGameHistory() {
    try {
      const moves = await this.db.getGameMoves(this.sessionId);
      return moves.map(move => ({
        moveNumber: move.move_number,
        player: move.username || 'AI',
        isAI: move.is_ai_move,
        moveData: JSON.parse(move.move_data_json),
        timestamp: move.timestamp
      }));
    } catch (error) {
      logger.error(`Failed to get game history for ${this.sessionId}:`, error);
      return [];
    }
  }

  static getGameInfo() {
    return {
      name: 'Base Game',
      description: 'Base game class',
      minPlayers: 1,
      maxPlayers: 2,
      estimatedDuration: 0,
      rules: [],
      commands: []
    };
  }
}