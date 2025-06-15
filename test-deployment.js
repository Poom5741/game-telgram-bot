#!/usr/bin/env node

/**
 * Cloudflare Workers Deployment Test Script
 * Tests the deployed worker endpoint and basic functionality
 */

const WORKER_URL = process.env.WORKER_URL || 'https://your-worker-name.your-subdomain.workers.dev';

async function testHealthCheck() {
  console.log('🔍 Testing health check endpoint...');
  
  try {
    const response = await fetch(`${WORKER_URL}/health`);
    const result = await response.json();
    
    if (response.ok && result.status === 'healthy') {
      console.log('✅ Health check passed');
      return true;
    } else {
      console.log('❌ Health check failed:', result);
      return false;
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    return false;
  }
}

async function testWebhookEndpoint() {
  console.log('🔍 Testing webhook endpoint...');
  
  const testMessage = {
    message: {
      chat: { id: 123456789 },
      from: { 
        id: 123456789, 
        first_name: 'Test',
        username: 'testuser'
      },
      text: '/start'
    }
  };
  
  try {
    const response = await fetch(`${WORKER_URL}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMessage)
    });
    
    if (response.ok) {
      console.log('✅ Webhook endpoint responding');
      return true;
    } else {
      console.log('❌ Webhook endpoint failed:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook endpoint error:', error.message);
    return false;
  }
}

async function testGameCommand() {
  console.log('🔍 Testing game command...');
  
  const testMessage = {
    message: {
      chat: { id: 123456789 },
      from: { 
        id: 123456789, 
        first_name: 'Test',
        username: 'testuser'
      },
      text: '/play tic'
    }
  };
  
  try {
    const response = await fetch(`${WORKER_URL}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMessage)
    });
    
    if (response.ok) {
      console.log('✅ Game command processed');
      return true;
    } else {
      console.log('❌ Game command failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Game command error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log(`🚀 Testing Cloudflare Workers deployment at: ${WORKER_URL}\n`);
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Webhook Endpoint', fn: testWebhookEndpoint },
    { name: 'Game Command', fn: testGameCommand }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    console.log(`\n📝 Running: ${test.name}`);
    const result = await test.fn();
    if (result) passed++;
  }
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Deployment looks good.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check deployment configuration.');
    process.exit(1);
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  console.log('Telegram Gaming Bot - Cloudflare Workers Test Suite');
  console.log('='.repeat(50));
  
  if (!process.env.WORKER_URL) {
    console.log('⚠️  Set WORKER_URL environment variable to test your deployment');
    console.log('Example: WORKER_URL=https://your-worker.your-subdomain.workers.dev node test-deployment.js');
    console.log('Using default URL for now...\n');
  }
  
  runTests().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testHealthCheck,
  testWebhookEndpoint,
  testGameCommand,
  runTests
};