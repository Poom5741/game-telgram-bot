# Cloudflare Workers Deployment Guide

This Telegram Gaming Bot has been optimized for Cloudflare Workers deployment with D1 database support.

## Prerequisites

1. **Cloudflare Account** with Workers and D1 access
2. **Wrangler CLI** installed globally: `npm install -g wrangler`
3. **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)
4. **DeepSeek API Key** from [DeepSeek](https://platform.deepseek.com)

## Setup Steps

### 1. Authenticate with Cloudflare

```bash
wrangler login
```

### 2. Create D1 Database

```bash
# Create the D1 database
wrangler d1 create telegram-gaming-bot

# Copy the database_id from output and update wrangler.toml
```

### 3. Configure Environment Variables

Update `wrangler.toml` with your database ID, then set secrets:

```bash
# Set your Telegram bot token
wrangler secret put BOT_TOKEN

# Set DeepSeek API key
wrangler secret put DEEPSEEK_API_KEY

# Set encryption key for secure data storage
wrangler secret put ENCRYPTION_KEY
```

### 4. Initialize Database Schema

```bash
# Apply database migrations
wrangler d1 execute telegram-gaming-bot --local --file=./schema.sql
wrangler d1 execute telegram-gaming-bot --file=./schema.sql
```

### 5. Deploy to Workers

```bash
# Deploy to Cloudflare Workers
wrangler deploy
```

### 6. Set Telegram Webhook

After deployment, set your bot's webhook URL:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-worker-name.your-subdomain.workers.dev/webhook"}'
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BOT_TOKEN` | Telegram Bot Token from BotFather | ✅ |
| `DEEPSEEK_API_KEY` | DeepSeek API key for AI functionality | ✅ |
| `ENCRYPTION_KEY` | Key for encrypting sensitive data | ✅ |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | ❌ |

## Database Schema

The bot uses Cloudflare D1 with the following tables:

- **users** - User profiles and settings
- **llm_models** - User's AI model configurations
- **game_types** - Available game types
- **game_sessions** - Active and completed games
- **game_players** - Players in each game session
- **game_moves** - Move history for all games
- **user_stats** - Player statistics and achievements

## Features

### ✅ Implemented
- **Tic Tac Toe** - Classic 3x3 grid game with AI opponent
- **Big Eater Competition** - Romantic couple game (framework ready)
- **Direct Commands** - `/play tic`, `/move 5`, `/bite`, etc.
- **Button Interactions** - Interactive inline keyboards
- **AI Integration** - DeepSeek-powered game opponents
- **User Management** - Automatic user registration and activity tracking
- **Game Statistics** - Win/loss tracking per game type

### 🚧 Ready for Extension
- Additional game types (Chess, Checkers, Word Games)
- Multiple AI provider support (OpenAI, Anthropic, HuggingFace)
- Tournament mode and multiplayer games
- Advanced AI personalities and difficulty levels

## Testing Locally

```bash
# Start local development server
wrangler dev

# Test webhook endpoint
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{"message": {"chat": {"id": 123}, "from": {"id": 123, "first_name": "Test"}, "text": "/start"}}'
```

## Troubleshooting

### Common Issues

1. **D1 Database Connection Failed**
   - Verify database_id in wrangler.toml
   - Ensure D1 database exists in your Cloudflare account

2. **Bot Not Responding to Commands**
   - Check webhook URL is set correctly
   - Verify BOT_TOKEN secret is configured
   - Check Workers logs: `wrangler tail`

3. **AI Responses Not Working**
   - Verify DEEPSEEK_API_KEY is set
   - Check DeepSeek API quota and billing
   - Monitor API request logs

### Monitoring and Logs

```bash
# View real-time logs
wrangler tail

# Check D1 database
wrangler d1 execute telegram-gaming-bot --command="SELECT * FROM users LIMIT 5"
```

## Performance Considerations

- **Cold Starts**: Workers warm up quickly, ~1-50ms response time
- **Concurrent Games**: D1 supports multiple concurrent game sessions
- **AI Requests**: DeepSeek API calls add ~200-1000ms latency
- **Memory Usage**: Each game session uses minimal memory (~1-5KB)

## Security Features

- **Data Encryption**: Sensitive data encrypted with Web Crypto API
- **Input Validation**: All user inputs sanitized and validated
- **Rate Limiting**: Natural rate limiting through Telegram API
- **No Secrets in Code**: All credentials stored as Cloudflare secrets

## Cost Estimation

For typical usage (100 users, 500 games/month):

- **Workers Requests**: ~$0.15/month (free tier covers most usage)
- **D1 Database**: ~$0.10/month (first 5GB free)
- **DeepSeek API**: ~$1-5/month depending on game frequency
- **Total**: ~$1-6/month for moderate usage

## Next Steps

1. **Add More Games**: Implement Chess, Checkers, or custom games
2. **Enhanced AI**: Add difficulty levels and AI personalities
3. **Multiplayer**: Support human vs human games
4. **Tournaments**: Create tournament brackets and competitions
5. **Analytics**: Add game analytics and user engagement metrics

## Support

For issues and questions:
- Check Cloudflare Workers documentation
- Review Telegram Bot API documentation
- Monitor DeepSeek API status and documentation