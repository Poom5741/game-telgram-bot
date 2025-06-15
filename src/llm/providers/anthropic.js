import axios from 'axios';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('Anthropic');

export class AnthropicProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.modelId = config.modelId || 'claude-3-sonnet-20240229';
        this.baseURL = config.baseURL || 'https://api.anthropic.com/v1';
        this.timeout = config.timeout || 30000;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            await this.validateConnection();
            this.initialized = true;
            logger.info(`Anthropic provider initialized with model: ${this.modelId}`);
        } catch (error) {
            logger.error('Failed to initialize Anthropic provider:', error);
            throw error;
        }
    }

    async validateConnection() {
        try {
            const testResponse = await axios.post(
                `${this.baseURL}/messages`,
                {
                    model: this.modelId,
                    max_tokens: 10,
                    messages: [
                        {
                            role: 'user',
                            content: 'Test'
                        }
                    ]
                },
                {
                    headers: {
                        'x-api-key': this.apiKey,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    },
                    timeout: this.timeout
                }
            );

            return true;
        } catch (error) {
            if (error.response) {
                throw new Error(`Anthropic API error: ${error.response.status} - ${error.response.data.error?.message || 'Unknown error'}`);
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
            stopSequences = []
        } = options;

        try {
            const requestData = {
                model: this.modelId,
                max_tokens: maxTokens,
                temperature,
                top_p: topP,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            };

            if (stopSequences.length > 0) {
                requestData.stop_sequences = stopSequences;
            }

            logger.debug('Anthropic request:', { model: this.modelId, prompt: prompt.substring(0, 100) + '...' });

            const response = await axios.post(
                `${this.baseURL}/messages`,
                requestData,
                {
                    headers: {
                        'x-api-key': this.apiKey,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    },
                    timeout: this.timeout
                }
            );

            const generatedText = response.data.content[0].text;
            const usage = response.data.usage;

            logger.debug('Anthropic response:', {
                model: this.modelId,
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens,
                responseLength: generatedText.length
            });

            return generatedText;
        } catch (error) {
            logger.error('Anthropic generation error:', error);
            
            if (error.response) {
                const errorData = error.response.data;
                throw new Error(`Anthropic error: ${errorData.error?.message || 'Unknown API error'}`);
            }
            
            throw new Error(`Anthropic request failed: ${error.message}`);
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
            stopSequences = []
        } = options;

        try {
            const requestData = {
                model: this.modelId,
                max_tokens: maxTokens,
                temperature,
                top_p: topP,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                stream: true
            };

            if (stopSequences.length > 0) {
                requestData.stop_sequences = stopSequences;
            }

            const response = await axios.post(
                `${this.baseURL}/messages`,
                requestData,
                {
                    headers: {
                        'x-api-key': this.apiKey,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
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
                        
                        try {
                            const parsed = JSON.parse(data);
                            
                            if (parsed.type === 'content_block_delta') {
                                const delta = parsed.delta.text;
                                if (delta) {
                                    fullResponse += delta;
                                    onChunk(delta);
                                }
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
            logger.error('Anthropic streaming error:', error);
            throw new Error(`Anthropic streaming failed: ${error.message}`);
        }
    }

    getModelId() {
        return this.modelId;
    }

    getProvider() {
        return 'anthropic';
    }

    async getAvailableModels() {
        return [
            { 
                id: 'claude-3-opus-20240229', 
                name: 'Claude 3 Opus', 
                description: 'Most capable Claude model for complex tasks' 
            },
            { 
                id: 'claude-3-sonnet-20240229', 
                name: 'Claude 3 Sonnet', 
                description: 'Balanced performance and speed' 
            },
            { 
                id: 'claude-3-haiku-20240307', 
                name: 'Claude 3 Haiku', 
                description: 'Fast and efficient for quick responses' 
            }
        ];
    }

    async estimateTokens(text) {
        return Math.ceil(text.length / 3.5);
    }

    async getCost(inputTokens, outputTokens) {
        const pricing = {
            'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
            'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
            'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
        };

        const modelPricing = pricing[this.modelId] || pricing['claude-3-sonnet-20240229'];
        
        return {
            inputCost: (inputTokens / 1000) * modelPricing.input,
            outputCost: (outputTokens / 1000) * modelPricing.output,
            totalCost: (inputTokens / 1000) * modelPricing.input + (outputTokens / 1000) * modelPricing.output
        };
    }
}