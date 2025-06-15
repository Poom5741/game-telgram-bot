import axios from 'axios';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('OpenAI');

export class OpenAIProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.modelId = config.modelId || 'gpt-3.5-turbo';
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';
        this.timeout = config.timeout || 30000;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            await this.validateConnection();
            this.initialized = true;
            logger.info(`OpenAI provider initialized with model: ${this.modelId}`);
        } catch (error) {
            logger.error('Failed to initialize OpenAI provider:', error);
            throw error;
        }
    }

    async validateConnection() {
        try {
            const response = await axios.get(`${this.baseURL}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            });

            const availableModels = response.data.data.map(model => model.id);
            if (!availableModels.includes(this.modelId)) {
                throw new Error(`Model ${this.modelId} not available`);
            }

            return true;
        } catch (error) {
            if (error.response) {
                throw new Error(`OpenAI API error: ${error.response.status} - ${error.response.data.error?.message || 'Unknown error'}`);
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
                presence_penalty: presencePenalty,
                stop: stopSequences.length > 0 ? stopSequences : undefined
            };

            logger.debug('OpenAI request:', { model: this.modelId, prompt: prompt.substring(0, 100) + '...' });

            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            const generatedText = response.data.choices[0].message.content;
            const usage = response.data.usage;

            logger.debug('OpenAI response:', {
                model: this.modelId,
                tokensUsed: usage.total_tokens,
                responseLength: generatedText.length
            });

            return generatedText;
        } catch (error) {
            logger.error('OpenAI generation error:', error);
            
            if (error.response) {
                const errorData = error.response.data;
                throw new Error(`OpenAI error: ${errorData.error?.message || 'Unknown API error'}`);
            }
            
            throw new Error(`OpenAI request failed: ${error.message}`);
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
                stop: stopSequences.length > 0 ? stopSequences : undefined,
                stream: true
            };

            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'stream',
                    timeout: this.timeout
                }
            );

            let fullResponse = '';

            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') return;
                        
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
            });

            return new Promise((resolve, reject) => {
                response.data.on('end', () => resolve(fullResponse));
                response.data.on('error', reject);
            });
        } catch (error) {
            logger.error('OpenAI streaming error:', error);
            throw new Error(`OpenAI streaming failed: ${error.message}`);
        }
    }

    getModelId() {
        return this.modelId;
    }

    getProvider() {
        return 'openai';
    }

    async getAvailableModels() {
        try {
            const response = await axios.get(`${this.baseURL}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            });

            return response.data.data
                .filter(model => model.id.includes('gpt'))
                .map(model => ({
                    id: model.id,
                    name: model.id,
                    description: `OpenAI ${model.id}`
                }))
                .sort((a, b) => a.id.localeCompare(b.id));
        } catch (error) {
            logger.error('Failed to fetch OpenAI models:', error);
            return [
                { id: 'gpt-4', name: 'GPT-4', description: 'Most capable OpenAI model' },
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient' }
            ];
        }
    }

    async estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }

    async getCost(inputTokens, outputTokens) {
        const pricing = {
            'gpt-4': { input: 0.03, output: 0.06 },
            'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
            'gpt-4-turbo': { input: 0.01, output: 0.03 }
        };

        const modelPricing = pricing[this.modelId] || pricing['gpt-3.5-turbo'];
        
        return {
            inputCost: (inputTokens / 1000) * modelPricing.input,
            outputCost: (outputTokens / 1000) * modelPricing.output,
            totalCost: (inputTokens / 1000) * modelPricing.input + (outputTokens / 1000) * modelPricing.output
        };
    }
}