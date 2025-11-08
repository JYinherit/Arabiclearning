***建议使用@OctagonalStar的https://github.com/OctagonalStar/arabic_learning/***
本库用于测试新功能

[![zread](https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMSAxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff)](https://zread.ai/JYinherit/Arabiclearning)


# ArabicMemory: 一个专注的阿拉伯语单词记忆工具

本项目由“钧鸢inherit”创建，众多开发者共创，是一个基于 **FSRS** (Free Spaced Repetition Scheduler) 算法的语言学习应用。它为阿拉伯语学习者设计，希望能提供一个纯粹、高效的单词记忆体验。

## 核心功能

- **学习引擎 (FSRS)**:
  - **间隔重复算法**: 应用核心采用了 **FSRS 算法**。它会根据您的记忆行为（正确、模糊、忘记）动态调整每个单词的复习计划，以期更适合长期记忆。
  - **动态调整复习计划**: FSRS 能够计算出每个单词的复习时间，在您可能将要忘记的临界点安排复习，以帮助提升记忆效率。

- **规律学习模式**:
  - **自动化学习计划**: “规律学习”模式会为您安排每日学习任务，结合了“新单词学习”和“到期单词复习”，您只需点击开始，即可进行当天的学习。
  - **可配置的学习强度**: 您可以在设置中调整每日学习的新词数量和复习词数量，以适应自己的学习节奏。

- **界面与功能**:
  - **新的用户界面**: 应用界面设计为带底部导航的单页应用 (SPA)，可以在“学习”、“词库”和“设置”三个核心模块间进行切换。
  - **跨平台支持**: 基于 Electron 和 Capacitor，本项目可作为桌面应用 (Windows/macOS) 和移动应用 (Android) 使用，以提供稳定的使用体验。
  - **会话持久化**: 学习可以随时中断。应用会自动保存您的学习会话，下次打开时可选择从上次中断的地方继续。

- **词库管理**:
  - **支持多种导入方式**: 支持从 `JSON`, `CSV`, `.js` 或 `TXT` 文件导入您自己的词库，方便您进行个性化学习。
  - **在线词库 (新!)**: 新增了“在线词库”功能，可以一键从云端获取、导入一些预置的词库。
  - **数据管理**: 提供了数据管理选项，包括学习统计、备份与恢复，也可以按类型（如词库、进度、设置）清除数据。

- **阿拉伯语盲打训练**:
  - **独立训练模块**: 项目依然内置了阿拉伯语键盘盲打训练工具 (`盲打训练.html`)。
  - **科学练习**: 支持键位提示、多种字符集练习，并提供准确率、反应时间、CPM/WPM 等统计，帮助您进行练习。

## 未来计划

为了让这个工具能更好地陪伴您的学习旅程，我们构思了一些未来可能增加的功能和改进方向：

- **AI 辅助学习**:
  - **语音朗读**: 计划为单词和例句集成语音合成功能，帮助您更好地掌握发音。
  - **学习伙伴**: 考虑引入 AI 学习助理，可以围绕单词进行智能问答、生成更多例句等。

- **游戏化与激励**:
  - **成就系统**: 可能会加入一些简单的成就徽章，如“连续学习7天”、“掌握1000词汇”等，为学习增添一些乐趣。
  - **学习日历**: 考虑以热力图的形式，将每日的学习情况可视化，记录您的点滴进步。

- **内容与生态**:
  - **云词库社区**: 希望将现有的在线词库功能，逐步发展为一个由社区驱动的分享平台，用户可以上传、下载和评价词库。
  - **错题本功能**: 计划增加一个专门的“错题本”功能，自动收录您经常记错的单词，以便进行强化复习。

- **云服务支持**:
  - **跨设备同步**: 我们正在探索为用户提供学习进度和词库的云同步选项，方便您在不同设备上无缝切换。

- **持续改进**:
  - 我们会持续关注 FSRS 算法的进展并优化参数，并根据大家的反馈，不断改进应用的操作体验。

## 快速上手

1.  **单词记忆**:
    - **桌面端**: 运行 `npm start` 启动 Electron 应用。
    - **浏览器**: 直接用浏览器打开 `index.html` 文件。
    - **开始学习**:
      1.  在“词库”页面，点击“规律学习”即可自动开始当天的学习任务。
      2.  您也可以手动选择一个词库开始学习。
      3.  通过“在线词库”或“从本地文件导入”来添加新词库。
2.  **盲打训练**:
    - 用浏览器直接打开 `盲打训练.html` 文件即可开始练习。

---
*由 钧鸢inherit及其他开源开发者 开发。愿这款工具能成为您学习路上的一个小小助力。*
