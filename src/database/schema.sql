-- Users table for storing Telegram user information
CREATE TABLE IF NOT EXISTS users (
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
);

-- LLM Models table for storing configured AI models
CREATE TABLE IF NOT EXISTS llm_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'openai', 'anthropic', 'huggingface', etc.
    model_id TEXT NOT NULL, -- API model identifier
    api_key_encrypted TEXT NOT NULL,
    config_json TEXT, -- JSON string for model-specific config
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Game Types table for different board games
CREATE TABLE IF NOT EXISTS game_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    min_players INTEGER DEFAULT 1,
    max_players INTEGER DEFAULT 1,
    estimated_duration_minutes INTEGER,
    rules_text TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Game Sessions table for active and completed games
CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_type_id INTEGER NOT NULL,
    creator_user_id INTEGER NOT NULL,
    llm_model_id INTEGER,
    status TEXT DEFAULT 'waiting', -- 'waiting', 'active', 'completed', 'cancelled'
    current_turn INTEGER DEFAULT 1,
    game_state_json TEXT, -- JSON string storing game state
    winner_user_id INTEGER,
    started_at DATETIME,
    ended_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_type_id) REFERENCES game_types (id),
    FOREIGN KEY (creator_user_id) REFERENCES users (id),
    FOREIGN KEY (llm_model_id) REFERENCES llm_models (id),
    FOREIGN KEY (winner_user_id) REFERENCES users (id)
);

-- Game Players table for tracking participants
CREATE TABLE IF NOT EXISTS game_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    player_number INTEGER NOT NULL,
    is_ai BOOLEAN DEFAULT FALSE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    FOREIGN KEY (game_session_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(game_session_id, user_id),
    UNIQUE(game_session_id, player_number)
);

-- Game Moves table for storing move history
CREATE TABLE IF NOT EXISTS game_moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_session_id INTEGER NOT NULL,
    user_id INTEGER,
    move_number INTEGER NOT NULL,
    move_data_json TEXT NOT NULL, -- JSON string with move details
    is_ai_move BOOLEAN DEFAULT FALSE,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_session_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- User Statistics table
CREATE TABLE IF NOT EXISTS user_stats (
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
    FOREIGN KEY (game_type_id) REFERENCES game_types (id),
    UNIQUE(user_id, game_type_id)
);

-- Bot Settings table for configuration
CREATE TABLE IF NOT EXISTS bot_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_llm_models_user_id ON llm_models(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_creator ON game_sessions(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_players_session ON game_players(game_session_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_session ON game_moves(game_session_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_game ON user_stats(user_id, game_type_id);

-- Insert default game types
INSERT OR IGNORE INTO game_types (name, description, min_players, max_players, estimated_duration_minutes, rules_text) VALUES
('Tic Tac Toe', 'Classic 3x3 grid game', 2, 2, 5, 'Players take turns placing X or O on a 3x3 grid. First to get 3 in a row wins.'),
('Chess', 'Strategic board game', 2, 2, 60, 'Classic chess with standard rules. Checkmate wins.'),
('Checkers', 'Jump and capture game', 2, 2, 30, 'Move diagonally, jump opponents pieces to capture them.'),
('Rock Paper Scissors', 'Hand game', 2, 2, 1, 'Rock beats scissors, scissors beats paper, paper beats rock.'),
('Word Guessing', 'Guess the word game', 1, 2, 15, 'One player thinks of a word, other guesses letters.'),
('Big Eater Competition', 'Romantic competitive eating game for couples', 2, 2, 20, 'Compete with your partner in fun eating challenges with power-ups, sabotage, and romantic moments!');

-- Insert default bot settings
INSERT OR IGNORE INTO bot_settings (setting_key, setting_value, description) VALUES
('max_concurrent_games_per_user', '3', 'Maximum number of active games per user'),
('game_timeout_hours', '24', 'Hours before inactive games are cancelled'),
('default_language', 'en', 'Default bot language'),
('maintenance_mode', 'false', 'Whether bot is in maintenance mode');