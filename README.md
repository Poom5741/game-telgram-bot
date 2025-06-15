# Telegram Gaming Bot

A comprehensive Telegram bot for managing LLM models and playing text-based board games with AI opponents.

## Features

### 🤖 LLM Model Management
- **DeepSeek Integration**: Primary AI provider with chat and coder models
- **Multiple Providers**: Support for OpenAI, Anthropic, and HuggingFace
- **Secure Storage**: Encrypted API key storage
- **Model Validation**: Automatic testing of API connections

### 🎮 Text-Based Games
- **Tic Tac Toe**: Classic 3x3 grid game
- **Chess**: Full chess implementation (coming soon)
- **Checkers**: Traditional checkers game (coming soon)
- **Rock Paper Scissors**: Quick matches
- **Word Guessing**: Hangman-style game (coming soon)

### 📊 Game Features
- **AI Opponents**: Play against configured LLM models
- **Game Statistics**: Track wins, losses, and playtime
- **Game History**: Complete move-by-move replay
- **Multiple Sessions**: Play multiple games simultaneously
- **Smart Narration**: AI-generated game commentary

## Quick Start

### Prerequisites
- Node.js 18+ 
- Telegram Bot Token
- DeepSeek API Key

### Installation

1. **Dependencies Installation**
   ```bash
   npm install
   ```

2. **Environment Setup**
   Your bot is already configured with:
   ```env
   BOT_TOKEN=7718277502:AAHCj9wtgEgMNMZ2jE_0iU4hDbaOK-fEcK4
   DEEPSEEK_API_KEY=sk-34f3bb05f5e24d7b885eaddb3c48b21b
   ```

3. **Test Setup**
   ```bash
   node test-setup.js
   ```

4. **Start the Bot**
   ```bash
   # Easy start
   ./start.sh
   
   # Or manually
   npm run dev
   ```

## Bot Commands

### Basic Commands
- `/start` - Welcome message and main menu
- `/menu` - Show main menu options
- `/help` - Display help information

### Model Management
- `/models` - View your configured AI models
- `/addmodel` - Add a new AI model

### Gaming Commands
- `/games` - Browse available games
- `/newgame` - Start a new game
- `/mygames` - View your active games
- `/stats` - View gaming statistics

## Game Instructions

### Tic Tac Toe
1. Start a new game from the menu
2. Choose Tic Tac Toe
3. Send position numbers 1-9 to place your symbol
4. Get 3 in a row to win!

### Adding AI Models

1. **DeepSeek (Recommended)**
   - Get API key from [DeepSeek](https://platform.deepseek.com/)
   - Choose from `deepseek-chat` or `deepseek-coder`
   - Very cost-effective and intelligent

2. **Other Providers**
   - OpenAI: GPT-4, GPT-3.5 Turbo
   - Anthropic: Claude 3 models
   - HuggingFace: Open source models

## Architecture

```
src/
├── bot/           # Telegram bot logic
├── games/         # Game engine and implementations
├── llm/           # LLM provider integrations
├── database/      # SQLite database layer
└── utils/         # Utilities (crypto, logging)
```

### Key Components

- **TelegramBot**: Main bot interface with Telegraf
- **GameEngine**: Manages game sessions and state
- **LLMManager**: Handles AI model interactions
- **Database**: SQLite with comprehensive schema
- **Security**: Encrypted API key storage

## Database Schema

- **users**: Telegram user profiles
- **llm_models**: AI model configurations
- **game_sessions**: Active and completed games
- **game_players**: Player participation
- **game_moves**: Complete move history
- **user_stats**: Gaming statistics

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Type Checking
```bash
npm run typecheck
```

### Database Management
The bot automatically creates and migrates the SQLite database on startup.

## Deployment

### Docker (Recommended)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables
- `NODE_ENV`: production/development
- `PORT`: Server port (default: 3000)
- `WEBHOOK_URL`: For production webhook mode
- `LOG_LEVEL`: Logging level (debug/info/warn/error)

## API Documentation

### Webhook Endpoint
- `POST /webhook` - Telegram webhook handler
- `GET /health` - Health check endpoint
- `GET /` - Bot information

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with proper tests
4. Submit a pull request

## Security

- API keys are encrypted using AES-256-GCM
- Rate limiting on bot interactions
- Input validation on all game moves
- No sensitive data in logs

## Cost Optimization

### DeepSeek Pricing (Very Affordable)
- Input: $0.14 per 1M tokens
- Output: $0.28 per 1M tokens
- ~95% cheaper than GPT-4

### Tips
- Use `deepseek-chat` for general gameplay
- Enable conversation context for better moves
- Set reasonable token limits

## Troubleshooting

### Common Issues

1. **Bot Not Responding**
   - Check BOT_TOKEN validity
   - Verify network connectivity
   - Check logs for errors

2. **AI Models Not Working**
   - Validate API keys
   - Check provider status
   - Review error logs

3. **Database Issues**
   - Ensure write permissions
   - Check disk space
   - Verify SQLite installation

### Logs
Check `logs/combined.log` for detailed information.

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: Check inline code comments
- Community: Join our Discord (link coming soon)

---

Built with ❤️ using Node.js, Telegraf, and SQLite.