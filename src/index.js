import dotenv from 'dotenv';
import TelegramBot from './bot/bot.js';
import { createLogger } from './utils/logger.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

dotenv.config();

const logger = createLogger('Main');

async function startBot() {
    try {
        if (!process.env.BOT_TOKEN) {
            throw new Error('BOT_TOKEN environment variable is required');
        }

        const bot = new TelegramBot();
        
        if (process.env.NODE_ENV === 'production') {
            const app = express();
            const port = process.env.PORT || 3000;

            app.use(helmet());
            app.use(cors());
            app.use(express.json());

            app.use('/webhook', bot.getWebhookHandler());

            app.get('/health', (req, res) => {
                res.json({ status: 'ok', timestamp: new Date().toISOString() });
            });

            app.get('/', (req, res) => {
                res.json({ 
                    name: 'Telegram Gaming Bot', 
                    version: '1.0.0',
                    status: 'running'
                });
            });

            app.listen(port, () => {
                logger.info(`Server running on port ${port}`);
            });
        }

        await bot.start();

        process.once('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            await bot.stop();
            process.exit(0);
        });

        process.once('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            await bot.stop();
            process.exit(0);
        });

    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

async function main() {
    logger.info('Starting Telegram Gaming Bot...');
    logger.info(`Node.js version: ${process.version}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    await startBot();
}

main().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
});