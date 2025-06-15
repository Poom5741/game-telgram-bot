# 🚀 Quick Start Guide

Your Telegram Gaming Bot is **ready to use**! 

## ✅ What's Already Configured

- ✅ **Bot Token**: `7718277502:AAHCj9wtgEgMNMZ2jE_0iU4hDbaOK-fEcK4`
- ✅ **DeepSeek API**: `sk-34f3bb05f5e24d7b885eaddb3c48b21b`
- ✅ **Database**: SQLite auto-configured
- ✅ **Games**: Tic Tac Toe with AI opponents
- ✅ **Dependencies**: All packages installed

## 🎮 Start Playing in 30 Seconds

### 1. Start the Bot
```bash
./start.sh
```

### 2. Find Your Bot on Telegram
- Search for your bot using the token `7718277502`
- Or use the direct link: `https://t.me/YourBotUsername`

### 3. Begin Gaming (Two Ways!)

#### 🚀 Super Quick (Direct Commands)
- Send `/play tic` - Instantly start Tic Tac Toe!
- Send `/play eater` - Big Eater Competition with your AI girlfriend!
- Send numbers `1-9` to make moves (Tic Tac Toe)
- Use `/bite`, `/romantic`, `/sabotage` (Big Eater)
- Beat the AI and win!

#### 📱 Menu Style
- Send `/start` to your bot
- Choose "🤖 Manage AI Models" 
- Add a DeepSeek model
- Go back and select "🆕 New Game"
- Choose "Tic Tac Toe"
- Play against AI!

## 🎯 Example Game Flows

### 🚀 Quick Command Flow

#### Tic Tac Toe
```
You: /play tic
Bot: [Game starts, shows empty board]

You: 5
Bot: [AI thinks and plays, shows updated board]

You: 1
Bot: [AI responds strategically]

You: 9
Bot: 🎉 You win!
```

#### Big Eater Competition
```
You: /play eater
Bot: 💕 Big Eater Competition Started!
     [Romantic story setup with your AI girlfriend]

You: /bite
Bot: 🍴 CHOMP! You take a big bite!
     😍 Your girlfriend watches in awe!

You: /romantic feed_partner
Bot: 💕 You lovingly feed your girlfriend!
     Both gain energy and love points!

You: /sabotage tickle_attack
Bot: 😘 You playfully tickle her! She laughs!

Bot: 🎉 Competition complete! Love wins! 💑
```

### 📱 Menu Flow
1. **Start**: `/start` → Main menu appears
2. **Add AI**: "🤖 Manage AI Models" → "➕ Add DeepSeek Model"  
3. **Create Game**: "🆕 New Game" → "Tic Tac Toe"
4. **Play**: Send numbers 1-9 to place your moves
5. **Win**: Beat the AI and see your stats!

## 🛠️ Commands Reference

### 🎯 Game Commands  
| Command | Description |
|---------|-------------|
| `/play tic` | Start Tic Tac Toe instantly |
| `/play eater` | Start Big Eater Competition |
| `/move 5` | Make a move at position 5 |
| `/bite` | Take a bite (Big Eater) |
| `/romantic <move>` | Use romantic move |
| `/sabotage <type>` | Playful sabotage |
| `/board` | Show current game board |
| `/quit` | Quit current game |
| `/status` | Show game information |

### ⚙️ Menu Commands
| Command | Description |
|---------|-------------|
| `/start` | Main menu and welcome |
| `/menu` | Show main menu |
| `/models` | Manage AI models |
| `/help` | Show full help |
| `/stats` | Gaming statistics |

## 🎪 Game Features

### ✅ Available Games
- **Tic Tac Toe**: 3x3 grid, AI opponents
- **Big Eater Competition**: Romantic couples eating game!

### 🤖 AI Features  
- **Smart AI**: Uses DeepSeek for strategic gameplay
- **AI Girlfriend**: Romantic, competitive, and playful
- **Story-driven**: Dynamic narratives based on choices
- **Adaptive**: AI responds to your romantic gestures

### 📊 Game Features
- **Statistics**: Track wins/losses/playtime  
- **Game History**: Review all your moves
- **Multi-Session**: Play multiple games
- **Couple Scoring**: Relationship points and bonuses

## 🔧 If Something Goes Wrong

### Bot Not Responding?
```bash
node test-setup.js  # Check configuration
```

### Want to Restart?
```bash
# Kill any running processes
pkill -f "node src/index.js"

# Restart
./start.sh
```

### Need Logs?
```bash
tail -f logs/combined.log
```

## 🎉 You're Ready!

Your bot is fully configured and ready for gaming. The AI is smart, the games are fun, and everything just works!

**Enjoy playing! 🎮**