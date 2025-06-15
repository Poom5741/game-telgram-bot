import dotenv from 'dotenv';
import Database from './src/database/database.js';
import { DeepSeekProvider } from './src/llm/providers/deepseek.js';

dotenv.config();

async function testSetup() {
    console.log('🧪 Testing bot setup...\n');
    
    // Test 1: Environment variables
    console.log('1️⃣ Checking environment variables...');
    const botToken = process.env.BOT_TOKEN;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    
    if (!botToken) {
        console.log('❌ BOT_TOKEN missing');
        return false;
    }
    console.log(`✅ BOT_TOKEN: ${botToken.substring(0, 10)}...`);
    
    if (!deepseekKey || deepseekKey === 'your_deepseek_api_key_here') {
        console.log('⚠️  DEEPSEEK_API_KEY not configured (games will work without AI)');
    } else {
        console.log(`✅ DEEPSEEK_API_KEY: ${deepseekKey.substring(0, 8)}...`);
    }
    
    // Test 2: Database
    console.log('\n2️⃣ Testing database connection...');
    try {
        const db = new Database();
        await db.initialize();
        
        const result = await db.run('SELECT 1 as test');
        console.log('✅ Database connection successful');
        
        const gameTypes = await db.getGameTypes();
        console.log(`✅ Found ${gameTypes.length} game types available`);
        
        await db.close();
    } catch (error) {
        console.log('❌ Database error:', error.message);
        return false;
    }
    
    // Test 3: DeepSeek API (if configured)
    if (deepseekKey && deepseekKey !== 'your_deepseek_api_key_here') {
        console.log('\n3️⃣ Testing DeepSeek API...');
        try {
            const provider = new DeepSeekProvider({
                apiKey: deepseekKey,
                modelId: 'deepseek-chat'
            });
            
            const response = await provider.generateText('Say "Hello" in one word', {
                maxTokens: 5
            });
            
            console.log(`✅ DeepSeek API working: "${response.trim()}"`);
        } catch (error) {
            console.log('❌ DeepSeek API error:', error.message);
            console.log('   Games will still work, but without AI opponents');
        }
    }
    
    console.log('\n🎉 Setup test completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: ./start.sh (or npm run dev)');
    console.log('   2. Message your bot on Telegram');
    console.log('   3. Use /start to begin');
    console.log('   4. Add a DeepSeek model from the menu');
    console.log('   5. Start playing games!');
    
    return true;
}

testSetup().catch(console.error);