#!/bin/bash

echo "🤖 Starting Telegram Gaming Bot..."
echo "📋 Checking environment..."

if [ ! -f ".env" ]; then
    echo "❌ .env file not found! Please create it from .env.example"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🎮 Environment configured:"
echo "   Bot Token: $(grep BOT_TOKEN .env | cut -d'=' -f2 | cut -c1-10)..."
echo "   DeepSeek Key: $(grep DEEPSEEK_API_KEY .env | cut -d'=' -f2 | cut -c1-8)..."

echo ""
echo "🚀 Starting bot in development mode..."
echo "   Press Ctrl+C to stop"
echo ""

npm run dev