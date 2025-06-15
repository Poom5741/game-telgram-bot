/**
 * Cloudflare Workers optimized DeepSeek provider
 * Uses fetch API instead of axios
 */

import { Logger } from '../../utils/workerLogger.js';

const logger = new Logger('DeepSeek');

export class DeepSeekProvider {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.modelId = config.modelId || 'deepseek-chat';
    this.baseURL = config.baseURL || 'https://api.deepseek.com/v1';
    this.timeout = config.timeout || 30000;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await this.validateConnection();
      this.initialized = true;
      logger.info(`DeepSeek provider initialized with model: ${this.modelId}`);
    } catch (error) {
      logger.error('Failed to initialize DeepSeek provider:', error);
      throw error;
    }
  }

  async validateConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: [
            {
              role: 'user',
              content: 'Test'
            }
          ],
          max_tokens: 5,
          temperature: 0.1
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`DeepSeek API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      return true;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw new Error(`Connection error: ${error.message}`);
    }
  }

  async generateText(prompt, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      maxTokens = 150,
      temperature = 0.7,
      topP = 1,
      frequencyPenalty = 0,
      presencePenalty = 0,
      stopSequences = []
    } = options;

    try {
      const requestData = {
        model: this.modelId,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty
      };

      if (stopSequences.length > 0) {
        requestData.stop = stopSequences;
      }

      logger.debug('DeepSeek request:', { model: this.modelId, prompt: prompt.substring(0, 100) + '...' });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`DeepSeek error: ${errorData.error?.message || 'Unknown API error'}`);
      }

      const data = await response.json();
      const generatedText = data.choices[0].message.content;
      const usage = data.usage;

      logger.debug('DeepSeek response:', {
        model: this.modelId,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        responseLength: generatedText.length
      });

      return generatedText;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      logger.error('DeepSeek generation error:', error);
      throw new Error(`DeepSeek request failed: ${error.message}`);
    }
  }

  async generateTextStream(prompt, options = {}, onChunk) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      maxTokens = 150,
      temperature = 0.7,
      topP = 1,
      frequencyPenalty = 0,
      presencePenalty = 0,
      stopSequences = []
    } = options;

    try {
      const requestData = {
        model: this.modelId,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        stream: true
      };

      if (stopSequences.length > 0) {
        requestData.stop = stopSequences;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`DeepSeek error: ${errorData.error?.message || 'Unknown API error'}`);
      }

      let fullResponse = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') return fullResponse;
              
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices[0]?.delta?.content;
                
                if (delta) {
                  fullResponse += delta;
                  onChunk(delta);
                }
              } catch (parseError) {
                logger.warn('Failed to parse streaming chunk:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return fullResponse;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      logger.error('DeepSeek streaming error:', error);
      throw new Error(`DeepSeek streaming failed: ${error.message}`);
    }
  }

  getModelId() {
    return this.modelId;
  }

  getProvider() {
    return 'deepseek';
  }

  async getAvailableModels() {
    return [
      { 
        id: 'deepseek-chat', 
        name: 'DeepSeek Chat', 
        description: 'DeepSeek general-purpose conversational model' 
      },
      { 
        id: 'deepseek-coder', 
        name: 'DeepSeek Coder', 
        description: 'DeepSeek specialized coding model' 
      }
    ];
  }

  async estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  async getCost(inputTokens, outputTokens) {
    const pricing = {
      'deepseek-chat': { input: 0.00014, output: 0.00028 },
      'deepseek-coder': { input: 0.00014, output: 0.00028 }
    };

    const modelPricing = pricing[this.modelId] || pricing['deepseek-chat'];
    
    return {
      inputCost: (inputTokens / 1000) * modelPricing.input,
      outputCost: (outputTokens / 1000) * modelPricing.output,
      totalCost: (inputTokens / 1000) * modelPricing.input + (outputTokens / 1000) * modelPricing.output
    };
  }

  async getModelInfo() {
    const modelInfo = {
      'deepseek-chat': {
        name: 'DeepSeek Chat',
        description: 'Advanced conversational AI model by DeepSeek',
        contextLength: '32K tokens',
        strengths: ['General conversation', 'Reasoning', 'Analysis']
      },
      'deepseek-coder': {
        name: 'DeepSeek Coder',
        description: 'Specialized coding and programming model',
        contextLength: '16K tokens',
        strengths: ['Code generation', 'Code explanation', 'Debugging']
      }
    };

    return modelInfo[this.modelId] || modelInfo['deepseek-chat'];
  }
}