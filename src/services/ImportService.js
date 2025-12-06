/**
 * @fileoverview Service for handling the import of vocabularies from various sources.
 * It supports parsing different file formats and fetching online lexicons,
 * then merging them into the existing vocabulary set.
 */

import { Word } from '../core/Word.js';

// --- LRU Cache for online lexicon list ---
class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    put(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.capacity) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }
}

export class ImportService {
    constructor() {
        this.lexiconCache = new LRUCache(1);
        this.CACHE_KEY = 'onlineLexicons';
    }

    /**
     * Fetches the list of available online lexicons from the GitHub repository.
     * @returns {Promise<Array<object>>} A list of file objects from the API.
     */
    async getOnlineLexicons() {
        const cachedFiles = this.lexiconCache.get(this.CACHE_KEY);
        if (cachedFiles) {
            return cachedFiles;
        }

        try {
            const response = await fetch('https://api.github.com/repos/OctagonalStar/Arabiclearning/contents/%E8%AF%8D%E5%BA%93');
            if (!response.ok) {
                throw new Error(`GitHub API request failed: ${response.statusText}`);
            }
            const files = await response.json();
            const jsonFiles = files.filter(file => file.name.endsWith('.json') && file.type === 'file');
            this.lexiconCache.put(this.CACHE_KEY, jsonFiles);
            return jsonFiles;
        } catch (error) {
            console.error('Failed to fetch online lexicon list:', error);
            throw error; // Re-throw for the UI layer to handle
        }
    }

    /**
     * Imports a lexicon from a given URL.
     * @param {string} url - The download URL of the lexicon file.
     * @param {string} fileName - The name of the file.
     * @param {Array<Word>} vocabularyWords - The current array of all vocabulary words.
     * @returns {Promise<{newWordsCount: number, newDefsCount: number}>}
     */
    async importFromUrl(url, fileName, vocabularyWords) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download lexicon: ${response.statusText}`);
        }
        const content = await response.text();
        return this.importFromFileContent(content, fileName, vocabularyWords);
    }

    /**
     * Processes file content, parses it, and merges it with the existing vocabulary.
     * This is the core import logic.
     * @param {string} content - The string content of the file.
     * @param {string} fileName - The name of the file.
     * @param {Array<Word>} vocabularyWords - The array of all vocabulary words (will be mutated).
     * @returns {{newWordsCount: number, newDefsCount: number}}
     */
    importFromFileContent(content, fileName, vocabularyWords) {
        const parsedResult = this._parseJSON(content);
        if (!parsedResult || !parsedResult.data) {
            throw new Error('File parsing did not return valid data.');
        }

        const parsedDecks = parsedResult.data;
        let newWordsCount = 0;
        let newDefsCount = 0;

        // Create a Map of existing Arabic words for efficient lookup.
        const wordsMap = new Map(vocabularyWords.map(w => [w.arabic, w]));

        for (const deckName in parsedDecks) {
            const wordsToImport = parsedDecks[deckName];
            if (!Array.isArray(wordsToImport)) continue;

            for (const importedWord of wordsToImport) {
                if (!importedWord.arabic || !importedWord.chinese) continue;

                // --- Smart Merging Logic ---
                if (wordsMap.has(importedWord.arabic)) {
                    // If the Arabic word already exists, add the new definition to it.
                    const existingWord = wordsMap.get(importedWord.arabic);
                    const newDefinition = {
                        id: `def_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        chinese: importedWord.chinese,
                        explanation: importedWord.explanation || '暂无解释',
                        sourceDeck: `${fileName}//${deckName}`
                    };

                    if (existingWord.addDefinition(newDefinition)) {
                        newDefsCount++;
                    }
                } else {
                    // If it's a completely new Arabic word, create a new Word instance.
                    const newWord = Word.fromImport(importedWord, fileName, deckName);
                    vocabularyWords.push(newWord);
                    wordsMap.set(newWord.arabic, newWord); // Update map for the current session.
                    newWordsCount++;
                }
            }
        }

        return { newWordsCount, newDefsCount };
    }

    /**
     * Parses a string as JSON, with a fallback for non-standard JS object notation.
     * @private
     */
    _parseJSON(text) {
        let cleanedText = text.trim();
        // Remove BOM (Byte Order Mark) if it exists.
        if (cleanedText.startsWith('﻿')) {
            cleanedText = cleanedText.substring(1);
        }

        try {
            const data = JSON.parse(cleanedText);
            return this._processData(data);
        } catch (error) {
            console.error('JSON parsing failed:', error);
            throw new Error('File parsing failed. Please ensure the file is strict JSON format. JavaScript object literals are no longer supported for security reasons.');
        }
    }

    /**
     * Processes raw parsed data, validates its structure, and normalizes it.
     * @private
     */
    _processData(data) {
        const decks = {};
        for (const [deckName, words] of Object.entries(data)) {
            if (Array.isArray(words)) {
                const uniqueWords = [];
                const seen = new Set(); // To track "arabic|chinese" combinations seen within a single file

                words.forEach((word, index) => {
                    if (!word.chinese || !word.arabic) {
                        throw new Error(`Word at index ${index} in deck "${deckName}" is missing required fields.`);
                    }
                    
                    const key = `${word.arabic}|${word.chinese}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        if (!word.explanation) word.explanation = '暂无解释';
                        uniqueWords.push(word);
                    }
                });
                decks[deckName] = uniqueWords;
            }
        }
        if (Object.keys(decks).length === 0) throw new Error('No valid decks found in the imported file.');
        return { type: 'multiple', data: decks };
    }
}
