/**
 * @fileoverview 处理用户提供的词库文件的解析和导入。
 * 它支持多种格式，并能智能地将新数据与现有词汇合并。
 */

import { fileInput } from './dom.js';
import * as ui from './ui.js';

/**
 * 处理原始的已解析数据，验证其结构并进行规范化。
 * @param {object} data - 从文件中解析出的原始数据对象。
 * @returns {{type: string, data: object}} 一个指示格式类型和已处理数据的对象。
 */
function processData(data) {
    const decks = {};
    for (const [deckName, words] of Object.entries(data)) {
        if (Array.isArray(words)) {
            const uniqueWords = [];
            const seen = new Set(); // 用于跟踪在单个文件中已见过的 "阿拉伯语|中文" 组合

            words.forEach((word, index) => {
                if (!word.chinese || !word.arabic) {
                    throw new Error(`词库 "${deckName}" 中，索引为 ${index} 的单词缺少必要字段。`);
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
    if (Object.keys(decks).length === 0) throw new Error('导入的文件中未找到有效的词库。');
    return { type: 'multiple', data: decks };
}

/**
 * 将字符串解析为 JSON，并提供备用方案来处理非标准的 JS 对象表示法。
 * @param {string} text - 作为字符串的文件内容。
 * @returns {object} 经过 processData 规范化后的已解析数据。
 */
function parseJSON(text) {
    let cleanedText = text.trim();
    // 如果存在，移除 BOM (字节顺序标记)。
    if (cleanedText.startsWith('﻿')) {
        cleanedText = cleanedText.substring(1);
    }

    try {
        const data = JSON.parse(cleanedText);
        return processData(data);
    } catch (error) {
        console.error('JSON 解析失败:', error);
        throw new Error('文件解析失败。请确保文件是严格的 JSON 格式。出于安全原因，不再支持 JavaScript 对象字面量。');
    }
}

/**
 * 从头到尾处理文件导入过程。
 * 它读取文件，解析其内容，并智能地将其与现有词汇合并。
 * @param {Event} event - 文件输入的 change 事件。
 * @param {Array} vocabularyWords - 对主词汇数组的引用。
 * @param {Function} renderDeckSelectionCallback - 用于重新渲染 UI 的回调函数。
 * @param {Function} saveDecksToStorageCallback - 用于保存更新后数据的回调函数。
 */
export async function handleFileImport(event, vocabularyWords, renderDeckSelectionCallback, saveDecksToStorageCallback) {
    const file = event.target.files[0];
    if (!file) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
        ui.showImportMessage(`文件过大 (超过 ${MAX_FILE_SIZE / 1024 / 1024}MB)。请导入更小的文件。`, false);
        if (fileInput) fileInput.value = ''; // 重置文件输入框
        return;
    }
    const fileName = file.name;

    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const content = e.target.result;
            let parsedResult;

            if (file.name.endsWith('.csv')) {
                throw new Error("此版本尚不支持 CSV 导入。");
            } else {
                parsedResult = parseJSON(content);
            }

            if (!parsedResult || !parsedResult.data) {
                throw new Error('文件解析未返回有效数据。');
            }

            const parsedDecks = parsedResult.data;
            let newWordsCount = 0;
            let newDefsCount = 0;

            // 为了高效查找，创建一个现有阿拉伯语单词的 Map。
            const wordsMap = new Map(vocabularyWords.map(w => [w.arabic, w]));

            for (const deckName in parsedDecks) {
                const wordsToImport = parsedDecks[deckName];
                if (!Array.isArray(wordsToImport)) continue;

                for (const importedWord of wordsToImport) {
                    if (!importedWord.arabic || !importedWord.chinese) continue;

                    const newDefinition = {
                        id: `def_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        chinese: importedWord.chinese,
                        explanation: importedWord.explanation || '暂无解释',
                        sourceDeck: `${fileName}//${deckName}`
                    };

                    // --- 智能合并逻辑 ---
                    if (wordsMap.has(importedWord.arabic)) {
                        // 如果阿拉伯语单词已存在，则将新释义添加到其中，避免重复。
                        const existingWord = wordsMap.get(importedWord.arabic);
                        const defExists = existingWord.definitions.some(
                            def => def.chinese === newDefinition.chinese && def.sourceDeck === newDefinition.sourceDeck
                        );

                        if (!defExists) {
                            existingWord.definitions.push(newDefinition);
                            newDefsCount++;
                        }
                    } else {
                        // 如果是全新的阿拉伯语单词，则创建一个新的单词对象。
                        const newWord = {
                            arabic: importedWord.arabic,
                            definitions: [newDefinition],
                            progress: null // 进度在会话开始时初始化。
                        };
                        vocabularyWords.push(newWord);
                        wordsMap.set(newWord.arabic, newWord); // 在当前会话中更新 map。
                        newWordsCount++;
                    }
                }
            }

            if (newWordsCount > 0 || newDefsCount > 0) {
                ui.showImportMessage(`导入完成: 新增 ${newWordsCount} 个单词, 追加 ${newDefsCount} 个新义项。`);
                await saveDecksToStorageCallback();
                renderDeckSelectionCallback();
            } else {
                ui.showImportMessage('没有新增内容被导入。词库可能已存在。', false);
            }

        } catch (error) {
            console.error('[Importer] 导入失败:', error);
            ui.showImportMessage(`导入失败：${error.message}`, false);
        } finally {
            // 重置文件输入框，以允许再次导入相同的文件。
            if (fileInput) fileInput.value = '';
        }
    };

    reader.readAsText(file, 'UTF-8');
}
