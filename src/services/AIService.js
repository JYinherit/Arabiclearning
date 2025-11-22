/**
 * @fileoverview Service for interacting with OpenAI-compatible APIs to generate word explanations.
 */

export class AIService {
    /**
     * Constructs the prompt by replacing the placeholder in the template.
     * @param {string} template - The prompt template.
     * @param {string} word - The word to be explained.
     * @returns {string} - The formatted prompt.
     */
    static constructPrompt(template, word) {
        if (!template) return '';
        return template.replace(/\{word\}/g, word);
    }

    /**
     * Calls the AI API to generate an explanation for the word.
     * Streams the response back via the onChunk callback.
     *
     * @param {object} params - The parameters for the generation.
     * @param {string} params.word - The word to explain.
     * @param {string} params.apiUrl - The base URL of the API (e.g., "https://api.openai.com/v1").
     * @param {string} params.apiKey - The API key.
     * @param {string} params.model - The model name (e.g., "gpt-3.5-turbo").
     * @param {string} params.promptTemplate - The prompt template.
     * @param {function(string):void} onChunk - Callback for each text chunk received.
     * @param {function(Error):void} onError - Callback for errors.
     * @param {function():void} onComplete - Callback when the stream is finished.
     */
    static async generateExplanation({ word, apiUrl, apiKey, model, promptTemplate }, onChunk, onError, onComplete) {
        try {
            const prompt = this.constructPrompt(promptTemplate, word);

            // Ensure apiUrl doesn't end with slash to avoid double slashes, but handle if it's empty
            const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : 'https://api.openai.com/v1';
            const url = `${baseUrl}/chat/completions`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    stream: true
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const json = JSON.parse(data);
                            const content = json.choices[0]?.delta?.content || '';
                            if (content) {
                                onChunk(content);
                            }
                        } catch (e) {
                            console.warn('Error parsing stream chunk:', e);
                        }
                    }
                }
            }

            if (onComplete) onComplete();

        } catch (error) {
            console.error('AIService Error:', error);
            if (onError) onError(error);
        }
    }
}
