/**
 * Cloudflare D1 Database Manager
 * Replaces SQLite with Cloudflare's distributed SQL database
 */

import { Logger } from '../utils/workerLogger.js';

const logger = new Logger('D1Database');

export class DatabaseManager {
  constructor(d1Database) {
    this.db = d1Database;
  }

  async initialize() {
    try {
      // Create tables if they don't exist
      await this.createTables();
      await this.insertDefaultData();
      logger.info('D1 Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize D1 database:', error);
      throw error;
    }
  }

  async createTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id BIGINT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        language_code TEXT DEFAULT 'en',
        is_admin BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // LLM Models table
      `CREATE TABLE IF NOT EXISTS llm_models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        model_id TEXT NOT NULL,
        api_key_encrypted TEXT NOT NULL,
        config_json TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`,

      // Game Types table
      `CREATE TABLE IF NOT EXISTS game_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        min_players INTEGER DEFAULT 1,
        max_players INTEGER DEFAULT 1,
        estimated_duration_minutes INTEGER,
        rules_text TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Game Sessions table
      `CREATE TABLE IF NOT EXISTS game_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_type_id INTEGER NOT NULL,
        creator_user_id INTEGER NOT NULL,
        llm_model_id INTEGER,
        status TEXT DEFAULT 'waiting',
        current_turn INTEGER DEFAULT 1,
        game_state_json TEXT,
        winner_user_id INTEGER,
        started_at DATETIME,
        ended_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_type_id) REFERENCES game_types (id),
        FOREIGN KEY (creator_user_id) REFERENCES users (id),
        FOREIGN KEY (llm_model_id) REFERENCES llm_models (id),
        FOREIGN KEY (winner_user_id) REFERENCES users (id)
      )`,

      // Game Players table
      `CREATE TABLE IF NOT EXISTS game_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_session_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        player_number INTEGER NOT NULL,
        is_ai BOOLEAN DEFAULT FALSE,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        left_at DATETIME,
        FOREIGN KEY (game_session_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,

      // Game Moves table
      `CREATE TABLE IF NOT EXISTS game_moves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_session_id INTEGER NOT NULL,
        user_id INTEGER,
        move_number INTEGER NOT NULL,
        move_data_json TEXT NOT NULL,
        is_ai_move BOOLEAN DEFAULT FALSE,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_session_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,

      // User Statistics table
      `CREATE TABLE IF NOT EXISTS user_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        game_type_id INTEGER NOT NULL,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        games_lost INTEGER DEFAULT 0,
        total_playtime_minutes INTEGER DEFAULT 0,
        last_played DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (game_type_id) REFERENCES game_types (id)
      )`
    ];

    for (const table of tables) {
      await this.db.exec(table);
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)',
      'CREATE INDEX IF NOT EXISTS idx_llm_models_user_id ON llm_models(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_game_sessions_creator ON game_sessions(creator_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status)',
      'CREATE INDEX IF NOT EXISTS idx_game_players_session ON game_players(game_session_id)',
      'CREATE INDEX IF NOT EXISTS idx_game_moves_session ON game_moves(game_session_id)'
    ];

    for (const index of indexes) {
      await this.db.exec(index);
    }
  }

  async insertDefaultData() {
    // Insert default game types
    const gameTypes = [
      ['Tic Tac Toe', 'Classic 3x3 grid game', 2, 2, 5, 'Players take turns placing X or O on a 3x3 grid. First to get 3 in a row wins.'],
      ['Big Eater Competition', 'Romantic competitive eating game for couples', 2, 2, 20, 'Compete with your partner in fun eating challenges with power-ups, sabotage, and romantic moments!'],
      ['Chess', 'Strategic board game', 2, 2, 60, 'Classic chess with standard rules. Checkmate wins.'],
      ['Rock Paper Scissors', 'Hand game', 2, 2, 1, 'Rock beats scissors, scissors beats paper, paper beats rock.']
    ];

    for (const [name, description, minPlayers, maxPlayers, duration, rules] of gameTypes) {
      await this.db.prepare(`
        INSERT OR IGNORE INTO game_types 
        (name, description, min_players, max_players, estimated_duration_minutes, rules_text) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(name, description, minPlayers, maxPlayers, duration, rules).run();
    }
  }

  // User operations
  async createUser(telegramId, userData = {}) {
    const { username, first_name, last_name, language_code } = userData;
    
    const result = await this.db.prepare(`
      INSERT OR REPLACE INTO users 
      (telegram_id, username, first_name, last_name, language_code, updated_at, last_active)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(telegramId, username, first_name, last_name, language_code || 'en').run();
    
    return result;
  }

  async getUser(telegramId) {
    const result = await this.db.prepare(`
      SELECT * FROM users WHERE telegram_id = ?
    `).bind(telegramId).first();
    
    return result;
  }

  async updateUserActivity(telegramId) {
    const result = await this.db.prepare(`
      UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE telegram_id = ?
    `).bind(telegramId).run();
    
    return result;
  }

  // LLM Model operations
  async createLLMModel(userId, modelData) {
    const { name, provider, model_id, api_key_encrypted, config_json } = modelData;
    
    const result = await this.db.prepare(`
      INSERT INTO llm_models 
      (user_id, name, provider, model_id, api_key_encrypted, config_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(userId, name, provider, model_id, api_key_encrypted, config_json).run();
    
    return result;
  }

  async getUserLLMModels(userId) {
    const result = await this.db.prepare(`
      SELECT * FROM llm_models WHERE user_id = ? AND is_active = TRUE
    `).bind(userId).all();
    
    return result.results || [];
  }

  // Game operations
  async getGameType(name) {
    const result = await this.db.prepare(`
      SELECT * FROM game_types WHERE name = ?
    `).bind(name).first();
    
    return result;
  }

  async getGameTypes() {
    const result = await this.db.prepare(`
      SELECT * FROM game_types WHERE is_active = TRUE ORDER BY name
    `).all();
    
    return result.results || [];
  }

  async createGameSession(gameData) {
    const { game_type_id, creator_user_id, llm_model_id } = gameData;
    
    const result = await this.db.prepare(`
      INSERT INTO game_sessions 
      (game_type_id, creator_user_id, llm_model_id, game_state_json)
      VALUES (?, ?, ?, '{}')
    `).bind(game_type_id, creator_user_id, llm_model_id).run();
    
    return { id: result.meta.last_row_id };
  }

  async getGameSession(sessionId) {
    const result = await this.db.prepare(`
      SELECT gs.*, gt.name as game_name, gt.description, gt.min_players, gt.max_players
      FROM game_sessions gs
      JOIN game_types gt ON gs.game_type_id = gt.id
      WHERE gs.id = ?
    `).bind(sessionId).first();
    
    return result;
  }

  async addGamePlayer(gameSessionId, userId, playerNumber, isAI = false) {
    const result = await this.db.prepare(`
      INSERT INTO game_players (game_session_id, user_id, player_number, is_ai)
      VALUES (?, ?, ?, ?)
    `).bind(gameSessionId, userId, playerNumber, isAI).run();
    
    return result;
  }

  async getGamePlayers(gameSessionId) {
    const result = await this.db.prepare(`
      SELECT gp.*, u.username, u.first_name
      FROM game_players gp
      JOIN users u ON gp.user_id = u.id
      WHERE gp.game_session_id = ? AND gp.left_at IS NULL
      ORDER BY gp.player_number
    `).bind(gameSessionId).all();
    
    return result.results || [];
  }

  async recordGameMove(gameSessionId, userId, moveNumber, moveData, isAiMove = false) {
    const result = await this.db.prepare(`
      INSERT INTO game_moves 
      (game_session_id, user_id, move_number, move_data_json, is_ai_move)
      VALUES (?, ?, ?, ?, ?)
    `).bind(gameSessionId, userId, moveNumber, JSON.stringify(moveData), isAiMove).run();
    
    return result;
  }

  async getGameMoves(gameSessionId) {
    const result = await this.db.prepare(`
      SELECT gm.*, u.username
      FROM game_moves gm
      LEFT JOIN users u ON gm.user_id = u.id
      WHERE gm.game_session_id = ?
      ORDER BY gm.move_number
    `).bind(gameSessionId).all();
    
    return result.results || [];
  }

  async updateGameState(gameSessionId, gameState, status = null) {
    let query = `UPDATE game_sessions SET game_state_json = ?, updated_at = CURRENT_TIMESTAMP`;
    let params = [JSON.stringify(gameState)];
    
    if (status) {
      query += `, status = ?`;
      params.push(status);
    }
    
    query += ` WHERE id = ?`;
    params.push(gameSessionId);
    
    const result = await this.db.prepare(query).bind(...params).run();
    return result;
  }

  async getUserActiveGames(userId) {
    const result = await this.db.prepare(`
      SELECT gs.*, gt.name as game_name
      FROM game_sessions gs
      JOIN game_types gt ON gs.game_type_id = gt.id
      WHERE gs.creator_user_id = ? AND gs.status IN ('waiting', 'active')
    `).bind(userId).all();
    
    return result.results || [];
  }

  // Batch operations for better performance
  async batch(operations) {
    return await this.db.batch(operations);
  }

  // Prepared statement helper
  prepare(query) {
    return this.db.prepare(query);
  }

  // Execute raw SQL
  async exec(query) {
    return await this.db.exec(query);
  }
}