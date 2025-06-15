# 🎮 Complete Command Reference

## 🚀 NEW! Interactive Game Commands

Your bot now supports **direct command gameplay**! No more clicking through menus - just send commands and play instantly.

### ⚡ Quick Start Commands

```bash
/play tic     # Start Tic Tac Toe instantly
/move 5       # Place move at position 5  
/board        # Show current board
/quit         # Exit current game
```

### 🎯 Complete Command List

#### 🎮 Game Control
- `/play` - Show game selection menu
- `/play tic` - Start Tic Tac Toe instantly
- `/move <pos>` - Make a move (e.g., `/move 5`)
- `/board` - Display current game board
- `/quit` - Quit/forfeit current game
- `/status` - Show detailed game information
- `/history` - View move history

#### 🎲 Quick Game Starters  
- `/tic` - Start Tic Tac Toe (shortcut)
- `/chess` - Chess (coming soon)
- `/rps` - Rock Paper Scissors (coming soon)

#### ⚙️ Bot Management
- `/start` - Welcome & main menu
- `/menu` - Show main menu
- `/help` - Comprehensive help
- `/models` - Manage AI models
- `/stats` - View statistics

## 🎯 How to Play

### 🚀 Instant Gameplay
```
You: /play tic
Bot: [Shows empty 3x3 board with positions 1-9]

You: 5
Bot: ✅ Move accepted! 
     [Shows board with X in center]
     AI is thinking...
     🤖 AI played! 
     [Shows updated board with AI's O]
     Your turn! Choose position 1-9:

You: 1
Bot: [Continue playing...]
```

### 🎲 Position Numbers
```
1 | 2 | 3
---------
4 | 5 | 6  
---------
7 | 8 | 9
```

### 💡 Pro Tips
- **Simple moves**: Just send `5` during a game (no `/move` needed)
- **Quick commands**: Use `/play tic` to start immediately
- **Button gameplay**: Click numbered buttons for moves
- **Status check**: Use `/board` if you lose track
- **Easy exit**: `/quit` works anytime

## 🎪 Game Features

### ✅ Fully Working
- **Tic Tac Toe** with smart AI opponents
- Real-time move processing
- Interactive button controls
- Game state persistence
- Move history tracking
- Win/loss statistics

### 🔜 Coming Soon
- **Chess** with full piece movement
- **Rock Paper Scissors** tournaments  
- **Word Guessing** games
- **Multiplayer** support

## 🤖 AI Features

- **DeepSeek Integration**: Smart, strategic gameplay
- **Adaptive AI**: Learns from your moves
- **Multiple Difficulty**: Different AI models available
- **Game Narration**: AI commentary on moves
- **Cost Effective**: Only ~$0.14 per 1M tokens

## 🛠️ Command Examples

### Start a Quick Game
```
/play tic
```

### Make Strategic Moves
```
/move 5     # Center position
/move 1     # Top-left corner
3           # Just send the number
```

### Check Game Status
```
/board      # Current state
/status     # Detailed info
/history    # All moves
```

### Manage Your Bot
```
/start      # Main menu
/models     # Add AI models
/stats      # Your performance
/help       # This guide
```

## 🎉 Ready to Play!

Your bot is **fully configured** and ready for gaming:

1. **Start**: `./start.sh` or `npm run dev`
2. **Message your bot**: Find it on Telegram  
3. **Play**: Send `/play tic` and start winning!

**The future of Telegram gaming is here! 🎮**