import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Database {
    constructor() {
        this.db = null;
        this.dbPath = process.env.DATABASE_URL || './data/bot.db';
    }

    async initialize() {
        try {
            const dataDir = path.dirname(this.dbPath);
            await fs.mkdir(dataDir, { recursive: true });

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    throw err;
                }
                console.log('Connected to SQLite database');
            });

            this.db.configure('busyTimeout', 3000);
            
            await this.runSchema();
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    async runSchema() {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = await fs.readFile(schemaPath, 'utf8');
        
        return new Promise((resolve, reject) => {
            this.db.exec(schema, (err) => {
                if (err) {
                    console.error('Error running schema:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async createUser(telegramId, userData = {}) {
        const { username, first_name, last_name, language_code } = userData;
        const sql = `
            INSERT OR REPLACE INTO users 
            (telegram_id, username, first_name, last_name, language_code, updated_at, last_active)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        return this.run(sql, [telegramId, username, first_name, last_name, language_code || 'en']);
    }

    async getUser(telegramId) {
        const sql = 'SELECT * FROM users WHERE telegram_id = ?';
        return this.get(sql, [telegramId]);
    }

    async updateUserActivity(telegramId) {
        const sql = 'UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE telegram_id = ?';
        return this.run(sql, [telegramId]);
    }

    async createLLMModel(userId, modelData) {
        const { name, provider, model_id, api_key_encrypted, config_json } = modelData;
        const sql = `
            INSERT INTO llm_models 
            (user_id, name, provider, model_id, api_key_encrypted, config_json)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        return this.run(sql, [userId, name, provider, model_id, api_key_encrypted, config_json]);
    }

    async getUserLLMModels(userId) {
        const sql = 'SELECT * FROM llm_models WHERE user_id = ? AND is_active = TRUE';
        return this.all(sql, [userId]);
    }

    async createGameSession(gameData) {
        const { game_type_id, creator_user_id, llm_model_id } = gameData;
        const sql = `
            INSERT INTO game_sessions 
            (game_type_id, creator_user_id, llm_model_id, game_state_json)
            VALUES (?, ?, ?, '{}')
        `;
        return this.run(sql, [game_type_id, creator_user_id, llm_model_id]);
    }

    async getGameSession(sessionId) {
        const sql = `
            SELECT gs.*, gt.name as game_name, gt.description, gt.min_players, gt.max_players
            FROM game_sessions gs
            JOIN game_types gt ON gs.game_type_id = gt.id
            WHERE gs.id = ?
        `;
        return this.get(sql, [sessionId]);
    }

    async getUserActiveGames(userId) {
        const sql = `
            SELECT gs.*, gt.name as game_name
            FROM game_sessions gs
            JOIN game_types gt ON gs.game_type_id = gt.id
            WHERE gs.creator_user_id = ? AND gs.status IN ('waiting', 'active')
        `;
        return this.all(sql, [userId]);
    }

    async addGamePlayer(gameSessionId, userId, playerNumber) {
        const sql = `
            INSERT INTO game_players (game_session_id, user_id, player_number)
            VALUES (?, ?, ?)
        `;
        return this.run(sql, [gameSessionId, userId, playerNumber]);
    }

    async getGamePlayers(gameSessionId) {
        const sql = `
            SELECT gp.*, u.username, u.first_name
            FROM game_players gp
            JOIN users u ON gp.user_id = u.id
            WHERE gp.game_session_id = ? AND gp.left_at IS NULL
            ORDER BY gp.player_number
        `;
        return this.all(sql, [gameSessionId]);
    }

    async recordGameMove(gameSessionId, userId, moveNumber, moveData, isAiMove = false) {
        const sql = `
            INSERT INTO game_moves 
            (game_session_id, user_id, move_number, move_data_json, is_ai_move)
            VALUES (?, ?, ?, ?, ?)
        `;
        return this.run(sql, [gameSessionId, userId, moveNumber, JSON.stringify(moveData), isAiMove]);
    }

    async getGameMoves(gameSessionId) {
        const sql = `
            SELECT gm.*, u.username
            FROM game_moves gm
            LEFT JOIN users u ON gm.user_id = u.id
            WHERE gm.game_session_id = ?
            ORDER BY gm.move_number
        `;
        return this.all(sql, [gameSessionId]);
    }

    async updateGameState(gameSessionId, gameState, status = null) {
        let sql = 'UPDATE game_sessions SET game_state_json = ?, updated_at = CURRENT_TIMESTAMP';
        const params = [JSON.stringify(gameState)];
        
        if (status) {
            sql += ', status = ?';
            params.push(status);
        }
        
        sql += ' WHERE id = ?';
        params.push(gameSessionId);
        
        return this.run(sql, params);
    }

    async getGameTypes() {
        const sql = 'SELECT * FROM game_types WHERE is_active = TRUE ORDER BY name';
        return this.all(sql);
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    } else {
                        console.log('Database connection closed');
                    }
                    resolve();
                });
            });
        }
    }
}

export default Database;