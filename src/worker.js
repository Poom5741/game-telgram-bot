/**
 * Cloudflare Workers optimized Telegram Gaming Bot
 * Handles webhooks efficiently with D1 database and modern Web APIs
 */

import { TelegramBot } from './bot/telegramBot.js';
import { DatabaseManager } from './database/d1Database.js';
import { Logger } from './utils/workerLogger.js';

const logger = new Logger('Worker');

// Main worker entry point
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      
      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          version: '2.0.0-cloudflare'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Root endpoint info
      if (url.pathname === '/') {
        return new Response(JSON.stringify({
          name: 'Telegram Gaming Bot',
          version: '2.0.0',
          status: 'running',
          platform: 'Cloudflare Workers',
          features: ['Tic Tac Toe', 'Big Eater Competition', 'DeepSeek AI']
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Telegram webhook endpoint
      if (url.pathname === '/webhook' && request.method === 'POST') {
        return await handleWebhook(request, env, ctx);
      }
      
      // Set webhook endpoint (for setup)
      if (url.pathname === '/set-webhook' && request.method === 'POST') {
        return await setWebhook(request, env);
      }
      
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      logger.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

async function handleWebhook(request, env, ctx) {
  try {
    const update = await request.json();
    
    // Initialize database and bot
    const db = new DatabaseManager(env.DB);
    const bot = new TelegramBot(env, db);
    
    // Process the update
    const result = await bot.processUpdate(update);
    
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    logger.error('Webhook processing error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function setWebhook(request, env) {
  try {
    const { url: webhookUrl } = await request.json();
    
    const telegramUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`;
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query', 'inline_query']
      })
    });
    
    const result = await response.json();
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    logger.error('Set webhook error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}