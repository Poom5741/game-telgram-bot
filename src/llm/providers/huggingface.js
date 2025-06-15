import axios from 'axios';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('HuggingFace');

export class HuggingFaceProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.modelId = config.modelId || 'microsoft/DialoGPT-large';
        this.baseURL = config.baseURL || 'https://api-inference.huggingface.co/models';
        this.timeout = config.timeout || 45000; // HF can be slower
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            await this.validateConnection();
            this.initialized = true;
            logger.info(`HuggingFace provider initialized with model: ${this.modelId}`);
        } catch (error) {
            logger.error('Failed to initialize HuggingFace provider:', error);
            throw error;
        }
    }

    async validateConnection() {
        try {
            const response = await axios.post(
                `${this.baseURL}/${this.modelId}`,
                {
                    inputs: "Test",
                    parameters: {
                        max_length: 10,
                        do_sample: true
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            return true;
        } catch (error) {
            if (error.response) {
                const errorMessage = error.response.data.error || 'Unknown HuggingFace API error';
                throw new Error(`HuggingFace API error: ${error.response.status} - ${errorMessage}`);
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
            topP = 0.9,
            repetitionPenalty = 1.1,
            stopSequences = []
        } = options;

        try {
            const isConversationalModel = this.modelId.includes('DialoGPT') || 
                                       this.modelId.includes('blenderbot') ||
                                       this.modelId.includes('conversational');

            let requestData;
            
            if (isConversationalModel) {
                requestData = {
                    inputs: {
                        past_user_inputs: [],
                        generated_responses: [],
                        text: prompt
                    },
                    parameters: {
                        max_length: maxTokens,
                        temperature,
                        top_p: topP,
                        repetition_penalty: repetitionPenalty,
                        do_sample: true
                    }
                };
            } else {
                requestData = {
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: maxTokens,
                        temperature,
                        top_p: topP,
                        repetition_penalty: repetitionPenalty,
                        do_sample: true,
                        return_full_text: false
                    }
                };

                if (stopSequences.length > 0) {
                    requestData.parameters.stop_sequences = stopSequences;
                }
            }

            logger.debug('HuggingFace request:', { 
                model: this.modelId, 
                prompt: prompt.substring(0, 100) + '...',
                isConversational: isConversationalModel 
            });

            const response = await axios.post(
                `${this.baseURL}/${this.modelId}`,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            let generatedText;
            
            if (isConversationalModel) {
                generatedText = response.data.generated_text || '';
            } else if (Array.isArray(response.data)) {
                generatedText = response.data[0]?.generated_text || '';
                if (generatedText.startsWith(prompt)) {
                    generatedText = generatedText.substring(prompt.length);
                }
            } else {
                generatedText = response.data.generated_text || '';
            }

            generatedText = generatedText.trim();

            logger.debug('HuggingFace response:', {
                model: this.modelId,
                responseLength: generatedText.length
            });

            return generatedText;
        } catch (error) {
            logger.error('HuggingFace generation error:', error);
            
            if (error.response) {
                const errorData = error.response.data;
                if (errorData.error && errorData.error.includes('loading')) {
                    throw new Error('Model is currently loading. Please try again in a few moments.');
                }
                throw new Error(`HuggingFace error: ${errorData.error || 'Unknown API error'}`);
            }
            
            throw new Error(`HuggingFace request failed: ${error.message}`);
        }
    }

    async generateTextStream(prompt, options = {}, onChunk) {
        const result = await this.generateText(prompt, options);
        
        const words = result.split(' ');
        for (let i = 0; i < words.length; i++) {
            const chunk = i === 0 ? words[i] : ' ' + words[i];
            onChunk(chunk);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        return result;
    }

    getModelId() {
        return this.modelId;
    }

    getProvider() {
        return 'huggingface';
    }

    async getAvailableModels() {
        return [
            { 
                id: 'microsoft/DialoGPT-large', 
                name: 'DialoGPT Large', 
                description: 'Conversational AI model by Microsoft' 
            },
            { 
                id: 'facebook/blenderbot-400M-distill', 
                name: 'BlenderBot 400M', 
                description: 'Open-domain chatbot by Facebook' 
            },
            { 
                id: 'microsoft/DialoGPT-medium', 
                name: 'DialoGPT Medium', 
                description: 'Medium-sized conversational model' 
            },
            { 
                id: 'gpt2', 
                name: 'GPT-2', 
                description: 'OpenAI GPT-2 text generation model' 
            },
            { 
                id: 'EleutherAI/gpt-neo-2.7B', 
                name: 'GPT-Neo 2.7B', 
                description: 'Large open-source language model' 
            }
        ];
    }

    async estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }

    async getCost(inputTokens, outputTokens) {
        return {
            inputCost: 0,
            outputCost: 0,
            totalCost: 0,
            note: 'HuggingFace Inference API is free with rate limits'
        };
    }

    async getModelInfo() {
        try {
            const response = await axios.get(
                `https://huggingface.co/api/models/${this.modelId}`,
                {
                    timeout: 10000
                }
            );

            return {
                name: response.data.modelId,
                description: response.data.description || 'No description available',
                likes: response.data.likes || 0,
                downloads: response.data.downloads || 0,
                tags: response.data.tags || [],
                pipeline_tag: response.data.pipeline_tag
            };
        } catch (error) {
            logger.warn('Failed to fetch model info:', error);
            return {
                name: this.modelId,
                description: 'HuggingFace model information unavailable'
            };
        }
    }

    async waitForModel() {
        const maxRetries = 5;
        const retryDelay = 3000;

        for (let i = 0; i < maxRetries; i++) {
            try {
                await this.validateConnection();
                return true;
            } catch (error) {
                if (error.message.includes('loading') && i < maxRetries - 1) {
                    logger.info(`Model is loading, waiting ${retryDelay/1000}s... (attempt ${i + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                }
                throw error;
            }
        }
        
        throw new Error('Model failed to load after maximum retries');
    }
}