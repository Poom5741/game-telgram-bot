import { Markup } from 'telegraf';
import GameEngine from '../games/gameEngine.js';
import LLMManager from '../llm/llmManager.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('GameCommands');

class GameCommands {
    constructor(bot, db) {
        this.bot = bot;
        this.db = db;
        this.gameEngine = new GameEngine();
        this.llmManager = new LLMManager();
        this.activeUserGames = new Map(); // userId -> gameSessionId
        
        this.setupGameCommands();
    }

    setupGameCommands() {
        // Main game commands
        this.bot.command('play', this.handlePlay.bind(this));
        this.bot.command('move', this.handleMove.bind(this));
        this.bot.command('board', this.handleBoard.bind(this));
        this.bot.command('quit', this.handleQuit.bind(this));
        // this.bot.command('join', this.handleJoin.bind(this)); // TODO: Implement multiplayer
        
        // Game-specific commands
        this.bot.command('tic', this.handleTicTacToe.bind(this));
        this.bot.command('chess', this.handleChess.bind(this));
        this.bot.command('rps', this.handleRockPaperScissors.bind(this));
        this.bot.command('eater', this.handleBigEaterCompetition.bind(this));
        
        // Big Eater Competition specific commands
        this.bot.command('bite', this.handleBite.bind(this));
        this.bot.command('powerup', this.handlePowerUp.bind(this));
        this.bot.command('romantic', this.handleRomanticMove.bind(this));
        this.bot.command('sabotage', this.handleSabotage.bind(this));
        
        // Utility commands
        this.bot.command('status', this.handleStatus.bind(this));
        this.bot.command('history', this.handleHistory.bind(this));
        this.bot.command('forfeit', this.handleForfeit.bind(this));
        
        // Text message handler for moves
        this.bot.on('text', this.handleTextMove.bind(this));
    }

    async handlePlay(ctx) {
        const args = ctx.message.text.split(' ').slice(1);
        
        if (args.length === 0) {
            return this.showGameOptions(ctx);
        }
        
        const gameType = args[0].toLowerCase();
        
        switch (gameType) {
            case 'tic':
            case 'tictactoe':
                return this.startTicTacToe(ctx);
            case 'chess':
                return this.startChess(ctx);
            case 'rps':
            case 'rockpaperscissors':
                return this.startRockPaperScissors(ctx);
            case 'eater':
            case 'bigeater':
            case 'eating':
                return this.startBigEaterCompetition(ctx);
            default:
                return this.showGameOptions(ctx);
        }
    }

    async showGameOptions(ctx) {
        const message = `🎮 **Choose a game to play:**

Available games:
• \`/play tic\` - Tic Tac Toe (quick 3x3 game)
• \`/play eater\` - Big Eater Competition (romantic couple game!)
• \`/play chess\` - Chess (strategic board game)
• \`/play rps\` - Rock Paper Scissors (instant fun)

Or use the buttons below:`;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🎯 Tic Tac Toe', 'quick_tic')],
            [Markup.button.callback('💕 Big Eater Competition', 'quick_eater')],
            [Markup.button.callback('♟️ Chess', 'quick_chess')],
            [Markup.button.callback('✂️ Rock Paper Scissors', 'quick_rps')],
            [Markup.button.callback('📋 My Active Games', 'active_games')]
        ]);

        await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
    }

    async startTicTacToe(ctx) {
        try {
            const user = await this.db.getUser(ctx.from.id);
            const models = await this.db.getUserLLMModels(user.id);
            
            if (models.length === 0) {
                return ctx.reply(
                    '❌ You need an AI model to play games.\n\nUse /start → "🤖 Manage AI Models" to add one first.',
                    Markup.inlineKeyboard([[Markup.button.callback('➕ Add AI Model', 'manage_models')]])
                );
            }

            // Create new game session
            const gameType = await this.db.get('SELECT * FROM game_types WHERE name = ?', ['Tic Tac Toe']);
            const result = await this.db.createGameSession({
                game_type_id: gameType.id,
                creator_user_id: user.id,
                llm_model_id: models[0].id
            });

            // Add player to game
            await this.db.addGamePlayer(result.id, user.id, 1);
            
            // Create/get AI user for player 2
            const aiUserId = 999999; // Special AI user ID
            await this.db.createUser(aiUserId, {
                username: 'ai_player',
                first_name: 'AI',
                last_name: 'Player',
                language_code: 'en'
            });
            
            await this.db.addGamePlayer(result.id, aiUserId, 2);
            await this.db.run('UPDATE game_players SET is_ai = TRUE WHERE game_session_id = ? AND player_number = 2', [result.id]);

            // Set as user's active game
            this.activeUserGames.set(ctx.from.id, result.id);

            // Initialize game
            const game = await this.gameEngine.createGame(result.id, 'Tic Tac Toe');
            const gameState = game.getDisplayState();

            const message = `🎯 **Tic Tac Toe Started!**

${gameState.board}

**${gameState.status}**

💡 **How to play:**
• Send a number 1-9 to place your X
• Or use \`/move <position>\`
• Use \`/board\` to see the current board
• Use \`/quit\` to forfeit

Your turn! Choose position 1-9:`;

            const keyboard = Markup.inlineKeyboard([
                ['1', '2', '3'].map(num => Markup.button.callback(num, `move_${result.id}_${num}`)),
                ['4', '5', '6'].map(num => Markup.button.callback(num, `move_${result.id}_${num}`)),
                ['7', '8', '9'].map(num => Markup.button.callback(num, `move_${result.id}_${num}`)),
                [Markup.button.callback('📋 Show Board', `board_${result.id}`), Markup.button.callback('❌ Quit Game', `quit_${result.id}`)]
            ]);

            await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });

        } catch (error) {
            logger.error('Error starting Tic Tac Toe:', error);
            await ctx.reply('❌ Failed to start game. Please try again.');
        }
    }

    async handleMove(ctx) {
        const args = ctx.message.text.split(' ').slice(1);
        
        if (args.length === 0) {
            return ctx.reply('❌ Please specify your move.\n\nExample: `/move 5` (for Tic Tac Toe)');
        }

        const userGameId = this.activeUserGames.get(ctx.from.id);
        if (!userGameId) {
            return ctx.reply('❌ You don\'t have an active game.\n\nUse `/play` to start a new game.');
        }

        await this.processGameMove(ctx, userGameId, args[0]);
    }

    async handleTextMove(ctx) {
        // Handle simple number inputs as moves for active games
        if (!ctx.message.text || ctx.message.text.startsWith('/')) return;
        
        const text = ctx.message.text.trim();
        const userGameId = this.activeUserGames.get(ctx.from.id);
        
        if (!userGameId) return;
        
        // Check if it's a valid move (number 1-9 for tic tac toe)
        if (/^[1-9]$/.test(text)) {
            await this.processGameMove(ctx, userGameId, text);
        }
    }

    async processGameMove(ctx, gameSessionId, moveInput) {
        try {
            const gameSession = await this.db.getGameSession(gameSessionId);
            if (!gameSession) {
                this.activeUserGames.delete(ctx.from.id);
                return ctx.reply('❌ Game not found.');
            }

            if (gameSession.status === 'completed') {
                this.activeUserGames.delete(ctx.from.id);
                return ctx.reply('❌ This game has already ended.');
            }

            // Process player move
            let moveData;
            if (gameSession.game_name === 'Tic Tac Toe') {
                const position = parseInt(moveInput);
                if (isNaN(position) || position < 1 || position > 9) {
                    return ctx.reply('❌ Invalid position. Please choose a number from 1-9.');
                }
                moveData = { position };
            } else {
                moveData = { move: moveInput };
            }

            const moveResult = await this.gameEngine.processMove(gameSessionId, ctx.from.id, moveData);
            
            if (!moveResult.success) {
                return ctx.reply(`❌ ${moveResult.error}`);
            }

            // Show move result
            await this.displayGameState(ctx, gameSessionId, moveResult);

            // If game ended, clean up
            if (moveResult.gameEnded) {
                this.activeUserGames.delete(ctx.from.id);
                return;
            }

            // Process AI move if it's AI's turn
            if (gameSession.llm_model_id) {
                setTimeout(async () => {
                    await this.processAIMove(ctx, gameSessionId);
                }, 1000); // Small delay for better UX
            }

        } catch (error) {
            logger.error('Error processing move:', error);
            await ctx.reply('❌ Error processing move. Please try again.');
        }
    }

    async processAIMove(ctx, gameSessionId) {
        try {
            const gameSession = await this.db.getGameSession(gameSessionId);
            if (!gameSession || gameSession.status === 'completed') return;

            await ctx.reply('🤖 AI is thinking...');

            const aiResult = await this.gameEngine.processAIMove(gameSessionId, gameSession.llm_model_id);
            
            if (aiResult.success) {
                await this.displayGameState(ctx, gameSessionId, aiResult, true);
                
                if (aiResult.gameEnded) {
                    this.activeUserGames.delete(ctx.from.id);
                }
            }

        } catch (error) {
            logger.error('Error processing AI move:', error);
            await ctx.reply('❌ AI move failed. You can continue playing.');
        }
    }

    async displayGameState(ctx, gameSessionId, moveResult, isAIMove = false) {
        const game = await this.gameEngine.getGame(gameSessionId);
        if (!game) return;

        const gameState = game.getDisplayState();
        
        let message = '';
        
        if (moveResult.gameEnded) {
            message = `🎮 **Game Over!**\n\n${gameState.board}\n\n`;
            
            if (moveResult.winner) {
                const winnerName = moveResult.winner.first_name || moveResult.winner.username || 'Player';
                message += `🎉 **${winnerName} wins!**\n\n`;
            } else {
                message += `🤝 **It's a draw!**\n\n`;
            }
            
            message += moveResult.message || '';
            
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('🎯 Play Again', 'quick_tic')],
                [Markup.button.callback('📊 View Stats', 'stats')],
                [Markup.button.callback('🔙 Main Menu', 'main_menu')]
            ]);
            
            await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
        } else {
            const movePrefix = isAIMove ? '🤖 **AI played!**\n\n' : '✅ **Move accepted!**\n\n';
            message = `${movePrefix}${gameState.board}\n\n**${gameState.status}**`;
            
            if (!isAIMove && gameState.currentPlayer === 1) {
                message += '\n\nYour turn! Choose position 1-9:';
                
                const keyboard = Markup.inlineKeyboard([
                    ['1', '2', '3'].map(num => Markup.button.callback(num, `move_${gameSessionId}_${num}`)),
                    ['4', '5', '6'].map(num => Markup.button.callback(num, `move_${gameSessionId}_${num}`)),
                    ['7', '8', '9'].map(num => Markup.button.callback(num, `move_${gameSessionId}_${num}`)),
                    [Markup.button.callback('❌ Quit', `quit_${gameSessionId}`)]
                ]);
                
                await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
            } else {
                await ctx.reply(message, { parse_mode: 'Markdown' });
            }
        }
    }

    async handleBoard(ctx) {
        const userGameId = this.activeUserGames.get(ctx.from.id);
        if (!userGameId) {
            return ctx.reply('❌ You don\'t have an active game.\n\nUse `/play` to start a new game.');
        }

        const game = await this.gameEngine.getGame(userGameId);
        if (!game) {
            this.activeUserGames.delete(ctx.from.id);
            return ctx.reply('❌ Game not found.');
        }

        const gameState = game.getDisplayState();
        const message = `📋 **Current Game State:**\n\n${gameState.board}\n\n**${gameState.status}**`;
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
    }

    async handleQuit(ctx) {
        const userGameId = this.activeUserGames.get(ctx.from.id);
        if (!userGameId) {
            return ctx.reply('❌ You don\'t have an active game to quit.');
        }

        try {
            const game = await this.gameEngine.getGame(userGameId);
            if (game) {
                const result = await game.forfeit(ctx.from.id);
                this.activeUserGames.delete(ctx.from.id);
                
                await ctx.reply(
                    `🏳️ **Game forfeited!**\n\n${result.message}\n\nThanks for playing!`,
                    Markup.inlineKeyboard([[Markup.button.callback('🎯 Play Again', 'quick_tic')]])
                );
            }
        } catch (error) {
            logger.error('Error quitting game:', error);
            this.activeUserGames.delete(ctx.from.id);
            await ctx.reply('✅ Game quit successfully.');
        }
    }

    async handleStatus(ctx) {
        const userGameId = this.activeUserGames.get(ctx.from.id);
        
        if (!userGameId) {
            const user = await this.db.getUser(ctx.from.id);
            const activeGames = await this.db.getUserActiveGames(user.id);
            
            if (activeGames.length === 0) {
                return ctx.reply('📊 **Game Status:**\n\nNo active games.\n\nUse `/play` to start playing!');
            } else {
                let message = '📊 **Your Active Games:**\n\n';
                activeGames.forEach((game, index) => {
                    message += `${index + 1}. ${game.game_name} - ${game.status}\n`;
                });
                message += '\nUse `/play` to start a new game.';
                return ctx.reply(message);
            }
        }

        const gameSession = await this.db.getGameSession(userGameId);
        const game = await this.gameEngine.getGame(userGameId);
        
        if (!game || !gameSession) {
            this.activeUserGames.delete(ctx.from.id);
            return ctx.reply('❌ No active game found.');
        }

        const gameState = game.getDisplayState();
        const gameInfo = game.getGameInfo();
        
        const message = `📊 **Game Status:**

**Game:** ${gameSession.game_name}
**Status:** ${gameSession.status}
**Duration:** ${Math.floor(gameInfo.duration / 60)}m ${gameInfo.duration % 60}s
**Moves:** ${gameInfo.moveCount}

**Current State:**
${gameState.board}

**${gameState.status}**`;

        await ctx.reply(message, { parse_mode: 'Markdown' });
    }

    async handleHistory(ctx) {
        const userGameId = this.activeUserGames.get(ctx.from.id);
        if (!userGameId) {
            return ctx.reply('❌ You don\'t have an active game to show history for.');
        }

        try {
            const history = await this.gameEngine.getGameHistory(userGameId);
            
            if (history.length === 0) {
                return ctx.reply('📜 **Game History:**\n\nNo moves yet. Make your first move!');
            }

            let message = '📜 **Game History:**\n\n';
            history.forEach((move, index) => {
                const player = move.isAI ? '🤖 AI' : '👤 You';
                const moveDesc = move.move.position ? `Position ${move.move.position}` : JSON.stringify(move.move);
                message += `${index + 1}. ${player}: ${moveDesc}\n`;
            });

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('Error getting game history:', error);
            await ctx.reply('❌ Failed to get game history.');
        }
    }

    // Quick game starters
    async handleTicTacToe(ctx) {
        await this.startTicTacToe(ctx);
    }

    async handleChess(ctx) {
        await ctx.reply('♟️ Chess game coming soon! Try `/play tic` for now.');
    }

    async handleRockPaperScissors(ctx) {
        await ctx.reply('✂️ Rock Paper Scissors coming soon! Try `/play tic` for now.');
    }

    async handleBigEaterCompetition(ctx) {
        await this.startBigEaterCompetition(ctx);
    }

    async startBigEaterCompetition(ctx) {
        try {
            const user = await this.db.getUser(ctx.from.id);
            const models = await this.db.getUserLLMModels(user.id);
            
            if (models.length === 0) {
                return ctx.reply(
                    '❌ You need an AI model for the Big Eater Competition.\n\nUse /start → "🤖 Manage AI Models" to add one first.',
                    Markup.inlineKeyboard([[Markup.button.callback('➕ Add AI Model', 'manage_models')]])
                );
            }

            // Create new game session
            const gameType = await this.db.get('SELECT * FROM game_types WHERE name = ?', ['Big Eater Competition']);
            const result = await this.db.createGameSession({
                game_type_id: gameType.id,
                creator_user_id: user.id,
                llm_model_id: models[0].id
            });

            // Add human player
            await this.db.addGamePlayer(result.id, user.id, 1);
            
            // Create AI girlfriend player
            const aiUserId = 888888; // Special AI girlfriend user ID
            await this.db.createUser(aiUserId, {
                username: 'ai_girlfriend',
                first_name: 'Your Girlfriend',
                last_name: '💕',
                language_code: 'en'
            });
            
            await this.db.addGamePlayer(result.id, aiUserId, 2);
            await this.db.run('UPDATE game_players SET is_ai = TRUE WHERE game_session_id = ? AND player_number = 2', [result.id]);

            // Set as user's active game
            this.activeUserGames.set(ctx.from.id, result.id);

            // Initialize game
            const game = await this.gameEngine.createGame(result.id, 'Big Eater Competition');
            const gameState = game.getDisplayState();

            const message = `💕 **Big Eater Competition Started!**

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

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('🍴 Take a Bite', `bite_${result.id}`)],
                [Markup.button.callback('💕 Romantic Move', `romantic_${result.id}`)],
                [Markup.button.callback('😏 Playful Sabotage', `sabotage_${result.id}`)],
                [Markup.button.callback('📋 Show Status', `board_${result.id}`), Markup.button.callback('❌ Quit', `quit_${result.id}`)]
            ]);

            await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });

        } catch (error) {
            logger.error('Error starting Big Eater Competition:', error);
            await ctx.reply('❌ Failed to start Big Eater Competition. Please try again.');
        }
    }

    // Big Eater Competition command handlers
    async handleBite(ctx) {
        const userGameId = this.activeUserGames.get(ctx.from.id);
        if (!userGameId) {
            return ctx.reply('❌ You don\'t have an active Big Eater Competition.\n\nUse `/play eater` to start one!');
        }

        await this.processBigEaterMove(ctx, userGameId, 'bite');
    }

    async handlePowerUp(ctx) {
        const args = ctx.message.text.split(' ').slice(1);
        const powerUpType = args[0] || 'energy_drink';
        
        const userGameId = this.activeUserGames.get(ctx.from.id);
        if (!userGameId) {
            return ctx.reply('❌ You don\'t have an active Big Eater Competition.\n\nUse `/play eater` to start one!');
        }

        await this.processBigEaterMove(ctx, userGameId, 'power_up', powerUpType);
    }

    async handleRomanticMove(ctx) {
        const args = ctx.message.text.split(' ').slice(1);
        const moveType = args[0] || 'motivational_speech';
        
        const userGameId = this.activeUserGames.get(ctx.from.id);
        if (!userGameId) {
            return ctx.reply('❌ You don\'t have an active Big Eater Competition.\n\nUse `/play eater` to start one!');
        }

        await this.processBigEaterMove(ctx, userGameId, 'romantic_move', moveType);
    }

    async handleSabotage(ctx) {
        const args = ctx.message.text.split(' ').slice(1);
        const sabotageType = args[0] || 'tickle_attack';
        
        const userGameId = this.activeUserGames.get(ctx.from.id);
        if (!userGameId) {
            return ctx.reply('❌ You don\'t have an active Big Eater Competition.\n\nUse `/play eater` to start one!');
        }

        await this.processBigEaterMove(ctx, userGameId, 'sabotage', sabotageType);
    }

    async processBigEaterMove(ctx, gameSessionId, action, target = null) {
        try {
            const gameSession = await this.db.getGameSession(gameSessionId);
            if (!gameSession) {
                this.activeUserGames.delete(ctx.from.id);
                return ctx.reply('❌ Game not found.');
            }

            if (gameSession.status === 'completed') {
                this.activeUserGames.delete(ctx.from.id);
                return ctx.reply('❌ This game has already ended.');
            }

            // Process move
            const moveResult = await this.gameEngine.processMove(gameSessionId, ctx.from.id, { action, target });
            
            if (!moveResult.success) {
                return ctx.reply(`❌ ${moveResult.error}`);
            }

            // Display result
            await this.displayBigEaterGameState(ctx, gameSessionId, moveResult);

            // If game ended, clean up
            if (moveResult.gameEnded) {
                this.activeUserGames.delete(ctx.from.id);
                return;
            }

            // Process AI girlfriend's response
            if (gameSession.llm_model_id) {
                setTimeout(async () => {
                    await this.processAIGirlfriendMove(ctx, gameSessionId);
                }, 2000); // Delay for better narrative flow
            }

        } catch (error) {
            logger.error('Error processing Big Eater move:', error);
            await ctx.reply('❌ Error processing move. Please try again.');
        }
    }

    async processAIGirlfriendMove(ctx, gameSessionId) {
        try {
            const gameSession = await this.db.getGameSession(gameSessionId);
            if (!gameSession || gameSession.status === 'completed') return;

            await ctx.reply('💕 Your girlfriend is planning her next move...');

            const aiResult = await this.gameEngine.processAIMove(gameSessionId, gameSession.llm_model_id);
            
            if (aiResult.success) {
                await this.displayBigEaterGameState(ctx, gameSessionId, aiResult, true);
                
                if (aiResult.gameEnded) {
                    this.activeUserGames.delete(ctx.from.id);
                }
            }

        } catch (error) {
            logger.error('Error processing AI girlfriend move:', error);
            await ctx.reply('💔 Your girlfriend seems distracted... You can continue playing!');
        }
    }

    async displayBigEaterGameState(ctx, gameSessionId, moveResult, isAIMove = false) {
        const game = await this.gameEngine.getGame(gameSessionId);
        if (!game) return;

        const gameState = game.getDisplayState();
        
        let message = '';
        
        if (moveResult.gameEnded) {
            message = `🎉 **Big Eater Competition Complete!**\n\n${gameState.board}\n\n`;
            
            if (moveResult.winner) {
                const winnerName = moveResult.winner.first_name || moveResult.winner.username || 'Player';
                message += `🏆 **${winnerName} wins the eating competition!**\n\n`;
            } else {
                message += `💕 **It's a tie! Love wins!**\n\n`;
            }
            
            if (moveResult.romanticEnding) {
                message += `💑 No matter who won, you both had an amazing time together!\n\n`;
            }
            
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('💕 Play Again', 'quick_eater')],
                [Markup.button.callback('📊 View Stats', 'stats')],
                [Markup.button.callback('🔙 Main Menu', 'main_menu')]
            ]);
            
            await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
        } else {
            const movePrefix = isAIMove ? '💕 **Your girlfriend\'s turn!**\n\n' : '🍴 **Your move!**\n\n';
            message = `${movePrefix}${gameState.board}`;
            
            if (moveResult.message) {
                message += `\n\n📖 ${moveResult.message}`;
            }
            
            if (moveResult.partnerReaction) {
                message += `\n\n${moveResult.partnerReaction}`;
            }
            
            if (!isAIMove) {
                const keyboard = Markup.inlineKeyboard([
                    [Markup.button.callback('🍴 Bite', `bite_${gameSessionId}`), Markup.button.callback('💕 Romance', `romantic_${gameSessionId}`)],
                    [Markup.button.callback('😏 Sabotage', `sabotage_${gameSessionId}`), Markup.button.callback('⚡ Power-up', `powerup_${gameSessionId}`)],
                    [Markup.button.callback('📋 Status', `board_${gameSessionId}`), Markup.button.callback('❌ Quit', `quit_${gameSessionId}`)]
                ]);
                
                await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
            } else {
                await ctx.reply(message, { parse_mode: 'Markdown' });
            }
        }
    }

    async handleForfeit(ctx) {
        await this.handleQuit(ctx);
    }

    // Setup callback handlers for inline buttons
    setupCallbacks(bot) {
        bot.action(/^move_(\d+)_(\d+)$/, async (ctx) => {
            const gameId = parseInt(ctx.match[1]);
            const position = ctx.match[2];
            
            await ctx.answerCbQuery();
            await this.processGameMove(ctx, gameId, position);
        });

        bot.action(/^board_(\d+)$/, async (ctx) => {
            const gameId = parseInt(ctx.match[1]);
            this.activeUserGames.set(ctx.from.id, gameId);
            
            await ctx.answerCbQuery();
            await this.handleBoard(ctx);
        });

        bot.action(/^quit_(\d+)$/, async (ctx) => {
            const gameId = parseInt(ctx.match[1]);
            this.activeUserGames.set(ctx.from.id, gameId);
            
            await ctx.answerCbQuery();
            await this.handleQuit(ctx);
        });

        bot.action('quick_tic', async (ctx) => {
            await ctx.answerCbQuery();
            await this.startTicTacToe(ctx);
        });

        bot.action('quick_chess', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.reply('♟️ Chess coming soon! Try Tic Tac Toe for now.');
        });

        bot.action('quick_rps', async (ctx) => {
            await ctx.answerCbQuery();
            await ctx.reply('✂️ Rock Paper Scissors coming soon! Try Tic Tac Toe for now.');
        });

        bot.action('quick_eater', async (ctx) => {
            await ctx.answerCbQuery();
            await this.startBigEaterCompetition(ctx);
        });

        // Big Eater Competition callbacks
        bot.action(/^bite_(\d+)$/, async (ctx) => {
            const gameId = parseInt(ctx.match[1]);
            this.activeUserGames.set(ctx.from.id, gameId);
            
            await ctx.answerCbQuery();
            await this.processBigEaterMove(ctx, gameId, 'bite');
        });

        bot.action(/^romantic_(\d+)$/, async (ctx) => {
            const gameId = parseInt(ctx.match[1]);
            this.activeUserGames.set(ctx.from.id, gameId);
            
            await ctx.answerCbQuery();
            await this.processBigEaterMove(ctx, gameId, 'romantic_move', 'motivational_speech');
        });

        bot.action(/^sabotage_(\d+)$/, async (ctx) => {
            const gameId = parseInt(ctx.match[1]);
            this.activeUserGames.set(ctx.from.id, gameId);
            
            await ctx.answerCbQuery();
            await this.processBigEaterMove(ctx, gameId, 'sabotage', 'tickle_attack');
        });

        bot.action(/^powerup_(\d+)$/, async (ctx) => {
            const gameId = parseInt(ctx.match[1]);
            this.activeUserGames.set(ctx.from.id, gameId);
            
            await ctx.answerCbQuery();
            await this.processBigEaterMove(ctx, gameId, 'power_up', 'energy_drink');
        });
    }
}

export default GameCommands;