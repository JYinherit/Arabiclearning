/**
 * @fileoverview ProgressBar 组件，封装了进度条的 UI 和更新逻辑。
 */

export class ProgressBar {
    /**
     * @param {HTMLElement} container - 进度条组件的根 DOM 元素。
     */
    constructor(container) {
        if (!container) {
            throw new Error('ProgressBar 组件需要一个有效的容器元素。');
        }
        this.container = container;

        // Find or create the inner bar. Ensure it's a child of the container.
        this.progressBar = this.container.querySelector('.progress-bar-inner');
        if (!this.progressBar) {
            this.progressBar = document.createElement('div');
            this.progressBar.className = 'progress-bar-inner';
            this.container.appendChild(this.progressBar);
        }

        // Find or create the text. Ensure it's a direct child of the container.
        this.progressText = this.container.querySelector('.progress-bar-text');
        if (!this.progressText) {
            this.progressText = document.createElement('span');
            this.progressText.className = 'progress-bar-text';
            this.container.appendChild(this.progressText);
        } else if (this.progressText.parentElement !== this.container) {
            // If text exists but is in the wrong place (e.g., inside the inner bar), move it.
            this.container.appendChild(this.progressText);
        }
    }

    /**
     * 渲染进度条的新状态。
     * @param {number} completed - 已完成的数量。
     * @param {number} total - 总数量。
     */
    render(completed, total) {
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        this.progressBar.style.width = `${percentage}%`;
        
        if (this.progressText) {
            this.progressText.textContent = `${completed} / ${total}`;
        } else {
            // 兼容旧的、文本在 .progress-bar-inner 上的情况
            this.progressBar.textContent = `${completed} / ${total}`;
        }
    }
}
