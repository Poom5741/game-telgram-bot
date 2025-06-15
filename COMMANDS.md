# 🎮 Bot Commands Reference

## 🚀 Quick Game Commands

### Start Playing
- `/play` - Show game selection menu
- `/play tic` - Start Tic Tac Toe instantly
- `/play chess` - Start Chess (coming soon)
- `/play rps` - Start Rock Paper Scissors (coming soon)

### Game Control
- `/move <position>` - Make a move (e.g., `/move 5`)
- `/board` - Show current game board
- `/quit` - Quit/forfeit current game
- `/status` - Show game status and information
- `/history` - Show move history of current game

### Quick Shortcuts
- `/tic` - Start Tic Tac Toe (same as `/play tic`)
- `/forfeit` - Forfeit current game (same as `/quit`)

## ⚙️ Menu & Management Commands

### Basic Navigation
- `/start` - Welcome message and main menu
- `/menu` - Show main menu
- `/help` - Show comprehensive help

### AI Model Management
- `/models` - View and manage your AI models
- `/addmodel` - Add a new AI model

### Game Management
- `/games` - Browse available games
- `/newgame` - Start a new game (menu style)
- `/mygames` - Show your active games
- `/stats` - View your gaming statistics

## 🎯 How to Play Tic Tac Toe

### Starting a Game
```
/play tic
```

### Making Moves
You can make moves in several ways:

1. **Send numbers directly**: Just type `5` to place at position 5
2. **Use move command**: `/move 5` 
3. **Use buttons**: Click the numbered buttons shown

### Board Positions
```
1 | 2 | 3
---------
4 | 5 | 6
---------
7 | 8 | 9
```

### Game Commands During Play
- `/board` - See current board state
- `/status` - Game info and duration
- `/history` - See all moves made
- `/quit` - Forfeit the game

## 💡 Pro Tips

### Quick Play Flow
1. `/play tic` - Start game
2. `5` - Make center move
3. Continue with numbers 1-9
4. Win! 🎉

### Efficient Commands
- Just send numbers (1-9) during games - no need for `/move`
- Use `/board` if you lose track
- `/quit` works anytime to exit

### AI Gameplay
- AI uses DeepSeek for intelligent moves
- AI thinks strategically and adapts to your play
- Each game is different and challenging

## 🎮 Available Games

### ✅ Current Games
- **Tic Tac Toe** (`/play tic`) - Classic 3x3 grid game

### 🔜 Coming Soon
- **Chess** (`/play chess`) - Full chess implementation
- **Checkers** - Traditional checkers
- **Rock Paper Scissors** (`/play rps`) - Quick matches
- **Word Guessing** - Hangman-style game

## 🆘 Troubleshooting

### Common Issues

**Bot not responding to moves?**
- Make sure you have an active game (`/play tic`)
- Check if it's your turn (`/status`)
- Try `/board` to refresh

**Invalid move error?**
- Use numbers 1-9 for Tic Tac Toe
- Make sure position isn't already taken
- Check `/board` for current state

**No AI model error?**
- Use `/start` → "🤖 Manage AI Models"
- Add a DeepSeek model first
- Then start playing

**Game stuck or frozen?**
- Use `/quit` to exit current game
- Start fresh with `/play tic`
- Check `/status` for game state

### Getting Help
- `/help` - Full command reference
- `/status` - Current game information
- Check the logs if running your own bot

## 🎪 Example Game Session

```
You: /play tic
Bot: [Shows empty board, your turn]

You: 5
Bot: [AI thinks and plays, shows updated board]

You: 1  
Bot: [AI responds strategically]

You: 9
Bot: 🎉 You win! [Game over]
```

## 🏆 Advanced Features

### Game Statistics
- Track wins/losses per game type
- View total playtime
- Compare performance over time

### Game History
- Full move-by-move replay
- See AI reasoning (if available)
- Export game data

### Multiple Sessions
- Play several games simultaneously
- Switch between active games
- Resume paused games

---

**Ready to play? Start with `/play tic` and have fun! 🎮**