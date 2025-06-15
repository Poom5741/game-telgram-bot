import { Telegraf, Markup } from 'telegraf';
import Database from '../database/database.js';
import GameCommands from './gameCommands.js';
import { createLogger } from '../utils/logger.js';
import { encrypt, decrypt } from '../utils/crypto.js';

const logger = createLogger('Bot');

class TelegramBot {
    constructor() {
        this.bot = new Telegraf(process.env.BOT_TOKEN);
        this.db = new Database();
        this.userSessions = new Map();
        this.gameCommands = null;
        
        this.setupMiddleware();
        this.setupCommands();
        this.setupCallbacks();
    }

    setupMiddleware() {
        this.bot.use(async (ctx, next) => {
            try {
                await this.updateUserData(ctx);
                logger.info(`User ${ctx.from.id} (${ctx.from.username || 'no username'}) used: ${ctx.message?.text || ctx.callbackQuery?.data || 'callback'}`);
                await next();
            } catch (error) {
                logger.error('Middleware error:', error);
                await ctx.reply('❌ An error occurred. Please try again.');
            }
        });

        this.bot.catch((err, ctx) => {
            logger.error('Bot error:', err);
            return ctx.reply('❌ Something went wrong. Please try again later.');
        });
    }

    async updateUserData(ctx) {
        const user = ctx.from;
        await this.db.createUser(user.id, {
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            language_code: user.language_code
        });
        await this.db.updateUserActivity(user.id);
    }

    setupCommands() {
        this.bot.start(async (ctx) => {
            const user = await this.db.getUser(ctx.from.id);
            const welcomeMessage = `
🎮 Welcome to the Gaming & LLM Bot!

Hi ${user.first_name || 'there'}! I can help you:

🤖 Manage AI models for gaming
🎯 Play text-based board games
📊 Track your gaming statistics

Use /menu to see all available options!
            `;
            
            await ctx.reply(welcomeMessage, this.getMainMenuKeyboard());
        });

        this.bot.command('menu', async (ctx) => {
            await ctx.reply('🎮 Main Menu - Choose an option:', this.getMainMenuKeyboard());
        });

        this.bot.command('models', async (ctx) => {
            await this.showLLMModels(ctx);
        });

        this.bot.command('games', async (ctx) => {
            await this.showGames(ctx);
        });

        this.bot.command('addmodel', async (ctx) => {
            await this.startAddModel(ctx);
        });

        this.bot.command('newgame', async (ctx) => {
            await this.showGameTypes(ctx);
        });

        this.bot.command('mygames', async (ctx) => {
            await this.showActiveGames(ctx);
        });

        this.bot.command('stats', async (ctx) => {
            await ctx.reply('📊 Statistics feature coming soon!');
        });

        this.bot.command('help', async (ctx) => {
            const helpMessage = `
🎮 **Gaming & LLM Bot Help**

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

**⚙️ Menu Commands:**
• \`/start\` - Welcome message and main menu
• \`/menu\` - Show main menu
• \`/models\` - Manage your AI models
• \`/games\` - Browse available games
• \`/stats\` - View your gaming statistics

**🎮 How to Play:**
1. Start: \`/play tic\` (for Tic Tac Toe)
2. Move: Send numbers 1-9 or use \`/move 5\`
3. Win: Get 3 in a row!
4. Quit: \`/quit\` anytime

**💡 Pro Tips:**
• Just send numbers 1-9 during a game to move
• Use buttons for quick actions
• AI responds intelligently to your moves

Need more help? Contact support!
            `;
            await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
        });
    }

    setupCallbacks() {
        this.bot.action('main_menu', async (ctx) => {
            await ctx.editMessageText('🎮 Main Menu - Choose an option:', this.getMainMenuKeyboard());
        });

        this.bot.action('manage_models', async (ctx) => {
            await this.showLLMModels(ctx, true);
        });

        this.bot.action('browse_games', async (ctx) => {
            await this.showGames(ctx, true);
        });

        this.bot.action('new_game', async (ctx) => {
            await this.showGameTypes(ctx, true);
        });

        this.bot.action('active_games', async (ctx) => {
            await this.showActiveGames(ctx, true);
        });

        this.bot.action(/^add_model_(.+)$/, async (ctx) => {
            const provider = ctx.match[1];
            await this.handleAddModelProvider(ctx, provider);
        });

        this.bot.action(/^game_type_(.+)$/, async (ctx) => {
            const gameTypeId = parseInt(ctx.match[1]);
            await this.createNewGame(ctx, gameTypeId);
        });

        this.bot.action(/^join_game_(.+)$/, async (ctx) => {
            const gameId = parseInt(ctx.match[1]);
            await this.joinGame(ctx, gameId);
        });

        this.bot.action(/^game_move_(.+)_(.+)$/, async (ctx) => {
            const gameId = parseInt(ctx.match[1]);
            const move = ctx.match[2];
            await this.handleGameMove(ctx, gameId, move);
        });
    }

    getMainMenuKeyboard() {
        return Markup.inlineKeyboard([
            [Markup.button.callback('🤖 Manage AI Models', 'manage_models')],
            [Markup.button.callback('🎯 Browse Games', 'browse_games')],
            [Markup.button.callback('🆕 New Game', 'new_game')],
            [Markup.button.callback('📋 Active Games', 'active_games')],
            [Markup.button.callback('📊 Statistics', 'stats')]
        ]);
    }

    async showLLMModels(ctx, isEdit = false) {
        const user = await this.db.getUser(ctx.from.id);
        const models = await this.db.getUserLLMModels(user.id);
        
        let message = '🤖 **Your AI Models:**\n\n';
        
        if (models.length === 0) {
            message += 'No AI models configured yet.\n\nAdd your first model to start playing with AI opponents!';
        } else {
            models.forEach((model, index) => {
                message += `${index + 1}. **${model.name}** (${model.provider})\n`;
                message += `   Model: ${model.model_id}\n`;
                message += `   Status: ${model.is_active ? '✅ Active' : '❌ Inactive'}\n\n`;
            });
        }

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('➕ Add DeepSeek Model', 'add_model_deepseek')],
            [Markup.button.callback('➕ Add OpenAI Model', 'add_model_openai')],
            [Markup.button.callback('➕ Add Anthropic Model', 'add_model_anthropic')],
            [Markup.button.callback('➕ Add HuggingFace Model', 'add_model_huggingface')],
            [Markup.button.callback('🔙 Back to Menu', 'main_menu')]
        ]);

        if (isEdit) {
            await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
        } else {
            await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
        }
    }

    async showGames(ctx, isEdit = false) {
        const gameTypes = await this.db.getGameTypes();
        
        let message = '🎯 **Available Games:**\n\n';
        
        gameTypes.forEach((game, index) => {
            message += `${index + 1}. **${game.name}**\n`;
            message += `   ${game.description}\n`;
            message += `   Players: ${game.min_players}-${game.max_players} | Duration: ~${game.estimated_duration_minutes}min\n\n`;
        });

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🆕 Start New Game', 'new_game')],
            [Markup.button.callback('🔙 Back to Menu', 'main_menu')]
        ]);

        if (isEdit) {
            await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
        } else {
            await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
        }
    }

    async showGameTypes(ctx, isEdit = false) {
        const gameTypes = await this.db.getGameTypes();
        
        const message = '🎮 **Choose a game to play:**';
        
        const buttons = gameTypes.map(game => 
            [Markup.button.callback(`${game.name} (${game.min_players}-${game.max_players} players)`, `game_type_${game.id}`)]
        );
        buttons.push([Markup.button.callback('🔙 Back to Menu', 'main_menu')]);

        const keyboard = Markup.inlineKeyboard(buttons);

        if (isEdit) {
            await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
        } else {
            await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
        }
    }

    async showActiveGames(ctx, isEdit = false) {
        const user = await this.db.getUser(ctx.from.id);
        const games = await this.db.getUserActiveGames(user.id);
        
        let message = '📋 **Your Active Games:**\n\n';
        
        if (games.length === 0) {
            message += 'No active games found.\n\nStart a new game to begin playing!';
        } else {
            for (const game of games) {
                const players = await this.db.getGamePlayers(game.id);
                message += `🎮 **${game.game_name}**\n`;
                message += `Status: ${game.status === 'waiting' ? '⏳ Waiting for players' : '🎯 In progress'}\n`;
                message += `Players: ${players.length}/${game.max_players}\n`;
                message += `Created: ${new Date(game.created_at).toLocaleDateString()}\n\n`;
            }
        }

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🆕 New Game', 'new_game')],
            [Markup.button.callback('🔙 Back to Menu', 'main_menu')]
        ]);

        if (isEdit) {
            await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
        } else {
            await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
        }
    }

    async handleAddModelProvider(ctx, provider) {
        const session = {
            step: 'waiting_api_key',
            provider: provider,
            data: {}
        };
        
        this.userSessions.set(ctx.from.id, session);
        
        const providerNames = {
            'deepseek': 'DeepSeek',
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'huggingface': 'HuggingFace'
        };
        
        await ctx.editMessageText(
            `🔐 Adding ${providerNames[provider]} model\n\nPlease send your API key:`,
            Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'manage_models')]])
        );
    }

    async createNewGame(ctx, gameTypeId) {
        const user = await this.db.getUser(ctx.from.id);
        const models = await this.db.getUserLLMModels(user.id);
        
        if (models.length === 0) {
            await ctx.editMessageText(
                '❌ You need to add at least one AI model to play games.\n\nWould you like to add one now?',
                Markup.inlineKeyboard([
                    [Markup.button.callback('➕ Add AI Model', 'manage_models')],
                    [Markup.button.callback('🔙 Back to Games', 'browse_games')]
                ])
            );
            return;
        }

        const result = await this.db.createGameSession({
            game_type_id: gameTypeId,
            creator_user_id: user.id,
            llm_model_id: models[0].id
        });

        await this.db.addGamePlayer(result.id, user.id, 1);

        await ctx.editMessageText(
            `🎮 Game created successfully!\n\nGame ID: ${result.id}\nWaiting for the game to start...`,
            Markup.inlineKeyboard([
                [Markup.button.callback('📋 View Active Games', 'active_games')],
                [Markup.button.callback('🔙 Back to Menu', 'main_menu')]
            ])
        );
    }

    async start() {
        try {
            await this.db.initialize();
            
            // Initialize game commands after database is ready
            this.gameCommands = new GameCommands(this.bot, this.db);
            this.gameCommands.setupCallbacks(this.bot);
            
            logger.info('Starting Telegram bot...');
            
            if (process.env.NODE_ENV === 'production') {
                const webhookUrl = `${process.env.WEBHOOK_URL}/webhook`;
                await this.bot.telegram.setWebhook(webhookUrl);
                logger.info(`Webhook set to: ${webhookUrl}`);
            } else {
                await this.bot.launch();
                logger.info('Bot started in polling mode');
            }
            
            logger.info('Bot is running!');
        } catch (error) {
            logger.error('Failed to start bot:', error);
            throw error;
        }
    }

    async stop() {
        logger.info('Stopping bot...');
        this.bot.stop('SIGINT');
        await this.db.close();
        logger.info('Bot stopped');
    }

    getWebhookHandler() {
        return this.bot.webhookCallback('/webhook');
    }
}

export default TelegramBot;