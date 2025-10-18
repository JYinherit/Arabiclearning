import { fileInput } from './dom.js';

// 解析CSV文件
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV文件格式错误：至少需要标题行和一行数据');
    }

    const words = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(part => part.trim());
        if (parts.length >= 2) {
            words.push({
                chinese: parts[0],
                arabic: parts[1],
                explanation: parts[2] || '暂无解释'
            });
        }
    }
    return words;
}

// 处理解析后的数据
function processData(data) {
    // 检查是否是单词库格式（有deckName和words字段）
    if (data.deckName && data.words && Array.isArray(data.words)) {
        // 格式2：单词库格式
        data.words.forEach((word, index) => {
            if (!word.chinese || !word.arabic) {
                throw new Error(`第${index + 1}个单词缺少必要字段（chinese 或 arabic）`);
            }
            if (!word.explanation) {
                word.explanation = '暂无解释';
            }
        });
        return { type: 'single', data: data };
    } else {
        // 格式1：多词库格式（对象的每个属性都是一个词库）
        const decks = {};
        let totalWords = 0;

        for (const [deckName, words] of Object.entries(data)) {
            if (Array.isArray(words)) {
                // 验证每个单词
                words.forEach((word, index) => {
                    if (!word.chinese || !word.arabic) {
                        throw new Error(`词库"${deckName}"的第${index + 1}个单词缺少必要字段`);
                    }
                    if (!word.explanation) {
                        word.explanation = '暂无解释';
                    }
                });
                decks[deckName] = words;
                totalWords += words.length;
            }
        }

        if (Object.keys(decks).length === 0) {
            throw new Error('未找到有效的词库数据');
        }

        return { type: 'multiple', data: decks, totalWords: totalWords };
    }
}


//解析json文件
function parseJSON(jsonText) {
    try {
        // 清理文本
        let cleanedText = jsonText.trim();
        
        // Bug 9 修复：移除可能的UTF-8 BOM字符，增强健壮性
        if (cleanedText.startsWith('\uFEFF')) {
            cleanedText = cleanedText.substring(1);
        }

        // 1. 尝试直接解析为标准JSON
        try {
            const data = JSON.parse(cleanedText);
            return processData(data);
        } catch (e) {
            // 继续尝试其他格式
        }

        // 2. 处理可能的JavaScript对象格式
        // 移除常见的变量声明
        cleanedText = cleanedText
            .replace(/^(const|let|var)\s+\w+\s*=\s*/, '')  // 移除变量声明
            .replace(/;[\s\n]*$/, '')  // 移除末尾分号
            .replace(/\/\*[\s\S]*?\*\//g, '')  // 移除多行注释
            .replace(/\/\/.*$/gm, '');  // 移除单行注释

        // 3. 检查是否缺少外层花括号
        cleanedText = cleanedText.trim();
        if (!cleanedText.startsWith('{')) {
            // 检查是否是直接的属性列表（如 "xxx": [...], "yyy": [...]）
            if (cleanedText.match(/^"[^"]+"\s*:/)) {
                cleanedText = '{' + cleanedText;
            }
        }
        if (!cleanedText.endsWith('}')) {
            // 移除末尾可能的逗号
            cleanedText = cleanedText.replace(/,\s*$/, '');
            cleanedText = cleanedText + '}';
        }

        // 4. 尝试作为JavaScript对象解析
        try {
            // 使用更安全的方式解析JavaScript对象
            const data = new Function('return ' + cleanedText)();
            return processData(data);
        } catch (e) {
            // 继续尝试
        }

        // 5. 最后尝试：修复常见的JSON错误
        cleanedText = cleanedText
            .replace(/,\s*}/g, '}')  // 移除对象末尾的逗号
            .replace(/,\s*]/g, ']')  // 移除数组末尾的逗号
            .replace(/'/g, '"')  // 将单引号替换为双引号
            .replace(/(\w+):/g, '"$1":');  // 给没有引号的属性名加引号

        const data = JSON.parse(cleanedText);
        return processData(data);

    } catch (error) {
        throw new Error(`解析失败，请检查文件格式。原始错误：${error.message}`);
    }
}

export function handleFileImport(event, vocabularyDecks, setupSelectionScreenCallback, saveDecksToStorageCallback) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            let importedCount = 0;
            let importedDecks = [];

            if (file.name.endsWith('.csv')) {
                // CSV格式处理
                const words = parseCSV(content);
                let deckName = file.name.replace('.csv', '').replace(/[_-]/g, ' ');

                // 如果词库名称已存在，添加数字后缀
                let finalDeckName = deckName;
                let counter = 1;
                while (vocabularyDecks[finalDeckName]) {
                    finalDeckName = `${deckName} (${counter})`;
                    counter++;
                }

                vocabularyDecks[finalDeckName] = words;
                importedCount = words.length;
                importedDecks.push(finalDeckName);

            } else {
                // JSON/JS格式处理
                const result = parseJSON(content);

                if (result.type === 'single') {
                    // 单词库导入
                    const data = result.data;
                    let deckName = data.deckName;

                    // 检查是否存在
                    if (vocabularyDecks[deckName]) {
                        const overwrite = confirm(`词库"${deckName}"已存在，是否覆盖？`);
                        if (!overwrite) {
                            // 添加数字后缀
                            let counter = 1;
                            while (vocabularyDecks[`${deckName} (${counter})`]) {
                                counter++;
                            }
                            deckName = `${deckName} (${counter})`;
                        }
                    }

                    vocabularyDecks[deckName] = data.words;
                    importedCount = data.words.length;
                    importedDecks.push(deckName);

                } else if (result.type === 'multiple') {
                    // 多词库批量导入
                    const decks = result.data;
                    let skippedDecks = [];

                    for (const [deckName, words] of Object.entries(decks)) {
                        if (vocabularyDecks[deckName]) {
                            const overwrite = confirm(`词库"${deckName}"已存在（${words.length}个词），是否覆盖？`);
                            if (!overwrite) {
                                skippedDecks.push(deckName);
                                continue;
                            }
                        }
                        vocabularyDecks[deckName] = words;
                        importedDecks.push(deckName);
                        importedCount += words.length;
                    }

                    // 如果有跳过的词库，显示提示
                    if (skippedDecks.length > 0) {
                        setTimeout(() => {
                            showImportMessage(`已跳过 ${skippedDecks.length} 个已存在的词库`, false);
                        }, 500);
                    }
                }
            }

            // 刷新词库选择界面
            setupSelectionScreenCallback();
            //保存到本地
            saveDecksToStorageCallback();

            // 显示成功消息
            if (importedDecks.length === 1) {
                showImportMessage(`成功导入词库"${importedDecks[0]}"（${importedCount}个单词）`);
            } else {
                showImportMessage(`成功导入 ${importedDecks.length} 个词库（共${importedCount}个单词）`);
            }

            // 清空文件输入
            fileInput.value = '';

        } catch (error) {
            showImportMessage(`导入失败：${error.message}`, false);
            fileInput.value = '';
        }
    };

    reader.readAsText(file, 'UTF-8');
}
