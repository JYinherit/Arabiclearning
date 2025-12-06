/**
 * @fileoverview 集中管理应用中用于浏览器存储 (localStorage, IndexedDB) 的所有键 (key)。
 * 这样做可以防止因拼写错误导致的 bug，并确保整个应用的一致性。
 */

export const STORAGE_KEYS = {
    DECKS: 'arabic_vocabulary_decks',
    PROGRESS: 'arabic_learning_progress',
    SETTINGS: 'arabic_app_settings',
    STATS: 'arabic_learning_stats',
    STUDY_MODE: 'study_mode',
    RECALL_MODE: 'recall_mode',
    DAILY_REVIEW_WORDS: 'daily_review_words',
    DAILY_NEW_WORDS: 'daily_new_words',
    THEME: 'theme',
    LAST_ACTIVE_DECK: 'last_active_deck',
    REGULAR_STUDY_STATS: 'regular_study_stats',
    DEFAULT_STUDY_PLAN: 'default_study_plan',
    ARABIC_TTS_ENABLED: 'arabic_tts_enabled',
    ARABIC_TTS_VOICE: 'arabic_tts_voice',
    ARABIC_TTS_RATE: 'arabic_tts_rate',
    ARABIC_TTS_PITCH: 'arabic_tts_pitch',
    ARABIC_TTS_VOLUME: 'arabic_tts_volume',
    ARABIC_TTS_AUTO_PLAY: 'arabic_tts_auto_play',
    MISTAKE_NOTEBOOK: 'mistake_notebook_words',
    AI_API_URL: 'ai_api_url',
    AI_API_KEY: 'ai_api_key',
    AI_MODEL: 'ai_model',
    AI_PROMPT_TEMPLATE: 'ai_prompt_template'
};

export const DEFAULT_AI_PROMPT = `需求：阿拉伯语单词复合记忆

---

阿拉伯语词汇深度学习提示词（Three-Step Method）

指令：
请你以阿拉伯语词汇学者和文化讲解者的身份，带领我系统认识一个阿拉伯语单词，分为三个层次：


---

Step 1: The How — 结构与构形

讲解该单词的 词根（جذر） 及其语义核心。

展示该词根衍生出的其他形式：

动词三式及其派生式（列表格写出存在且含义确定的变化Form，以下名词变化每一种Form存在就输出出来）

主动名词（اسم الفاعل）

被动名词（اسم المفعول）

时间/空间名词（اسم الزمان/المكان）

工具名词（اسم الآلة）


说明这些变化如何影响意义与语法功能。


🧩 目标：理解单词的“构造逻辑”。


---

Step 2: The When & Where — 历史与词源

分析该词的历史起源与语义演变：

是否属于 蒙昧时期（الجاهلية） 的古语？

是否因 伊斯兰文明发展 而产生的新词？

是否来自 外来语（مثل الفارسية، اليونانية...）？


可引用古诗（شعر جاهلي）或古兰经（القرآن）中的早期用例。


📜 目标：理解单词的“时间与空间归属”。


---

Step 3: The Why — 文化语义与思想维度

从阿拉伯语文化与伊斯兰语境出发，解释该词背后的 文化意象与社会心理。

配合：

谚语（مثل المثل العربي）

常见表达或句型

生活/宗教语境中的例句


可探讨词汇与阿拉伯世界价值观（如尊敬、命运、荣誉、信仰）的关系。


🌿 目标：理解单词的“文化灵魂”。


---

✅ 输出格式建议

请按照以下结构输出：

📖 单词：XXXXX
🔹 Step 1 – The How：
（词根、构形、语法说明）

🔹 Step 2 – The When & Where：
（词源、历史语境）

🔹 Step 3 – The Why：
（文化语义、谚语与例句）


---
理解后使用中文作为正文回复我，单词为{word}`;
