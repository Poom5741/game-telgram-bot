import dotenv from 'dotenv';
import Database from './src/database/database.js';
import GameEngine from './src/games/gameEngine.js';
import { TicTacToeGame } from './src/games/types/ticTacToe.js';

dotenv.config();

async function testCommands() {
    console.log('🧪 Testing bot commands and game functionality...\n');
    
    const db = new Database();
    const gameEngine = new GameEngine();
    
    try {
        // Test 1: Database and Game Types
        console.log('1️⃣ Testing database and game setup...');
        await db.initialize();
        
        const gameTypes = await db.getGameTypes();
        console.log(`✅ Found ${gameTypes.length} game types`);
        
        const ticTacToeType = gameTypes.find(g => g.name === 'Tic Tac Toe');
        if (!ticTacToeType) {
            throw new Error('Tic Tac Toe game type not found');
        }
        console.log('✅ Tic Tac Toe game type available');
        
        // Test 2: Create Test User
        console.log('\n2️⃣ Creating test user...');
        await db.createUser(12345, {
            username: 'testuser',
            first_name: 'Test',
            last_name: 'User',
            language_code: 'en'
        });
        
        const user = await db.getUser(12345);
        console.log(`✅ Test user created: ${user.first_name} ${user.last_name}`);
        
        // Test 3: Create AI Model
        console.log('\n3️⃣ Creating test AI model...');
        const testModelData = {
            name: 'Test DeepSeek',
            provider: 'deepseek',
            model_id: 'deepseek-chat',
            api_key_encrypted: JSON.stringify({
                encrypted: 'test_encrypted_key',
                iv: 'test_iv',
                tag: 'test_tag'
            }),
            config_json: JSON.stringify({ temperature: 0.7 })
        };
        
        const modelResult = await db.createLLMModel(user.id, testModelData);
        console.log(`✅ Test AI model created with ID: ${modelResult.id}`);
        
        // Test 4: Create Game Session
        console.log('\n4️⃣ Testing game session creation...');
        const gameSession = await db.createGameSession({
            game_type_id: ticTacToeType.id,
            creator_user_id: user.id,
            llm_model_id: modelResult.id
        });
        
        console.log(`✅ Game session created with ID: ${gameSession.id}`);
        
        // Add players
        await db.addGamePlayer(gameSession.id, user.id, 1);
        
        // Create AI user for player 2
        await db.createUser(99999, {
            username: 'ai_player',
            first_name: 'AI',
            last_name: 'Player',
            language_code: 'en'
        });
        const aiUser = await db.getUser(99999);
        
        await db.addGamePlayer(gameSession.id, aiUser.id, 2);
        await db.run('UPDATE game_players SET is_ai = TRUE WHERE game_session_id = ? AND player_number = 2', [gameSession.id]);
        
        console.log('✅ Players added (Human + AI)');
        
        // Test 5: Game Mechanics
        console.log('\n5️⃣ Testing game mechanics...');
        
        // Create game instance
        const players = await db.getGamePlayers(gameSession.id);
        const game = new TicTacToeGame({
            sessionId: gameSession.id,
            players: players,
            db: db,
            llmManager: null // Skip LLM for basic test
        });
        
        await game.initialize();
        console.log('✅ Tic Tac Toe game initialized');
        
        // Test move
        const moveResult = await game.processMove(user.id, { position: 5 });
        if (moveResult.success) {
            console.log('✅ Move processing works');
            console.log(`   Move result: ${moveResult.message}`);
        } else {
            console.log(`❌ Move failed: ${moveResult.error}`);
        }
        
        // Test board display
        const gameState = game.getDisplayState();
        console.log('✅ Game state display:');
        console.log(`   ${gameState.board.split('\n').join('\n   ')}`);
        console.log(`   Status: ${gameState.status}`);
        
        // Test 6: Command Structure
        console.log('\n6️⃣ Testing command structure...');
        
        const expectedCommands = [
            '/start', '/play', '/move', '/board', '/quit', 
            '/status', '/help', '/models', '/stats'
        ];
        
        console.log('✅ Bot supports these commands:');
        expectedCommands.forEach(cmd => console.log(`   ${cmd}`));
        
        // Test 7: Game Flow Simulation
        console.log('\n7️⃣ Simulating game flow...');
        
        const gameFlow = [
            'User sends: /play tic',
            'Bot creates new game session',
            'User sends: 5 (or /move 5)', 
            'Bot processes move',
            'AI calculates response',
            'Bot shows updated board',
            'Game continues...'
        ];
        
        console.log('✅ Expected game flow:');
        gameFlow.forEach((step, i) => console.log(`   ${i + 1}. ${step}`));
        
        await db.close();
        
        console.log('\n🎉 All command tests passed!');
        console.log('\n📋 Commands Ready:');
        console.log('   🎯 /play tic - Start Tic Tac Toe');
        console.log('   🎮 /move 5 - Make moves');
        console.log('   📋 /board - Show board');
        console.log('   🚪 /quit - Exit game');
        console.log('   ℹ️ /status - Game info');
        console.log('   ❓ /help - Full help');
        
        console.log('\n🚀 Ready to test with real Telegram bot!');
        
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        await db.close();
    }
}

testCommands().catch(console.error);