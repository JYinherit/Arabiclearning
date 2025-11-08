/**
 * @fileoverview 处理应用内的更新检查和通知。
 * 该模块从远程 JSON 文件获取版本信息，与当前应用版本进行比较，
 * 并在有可用更新时通知用户。
 * 它包含了对 Web 环境的回退方案以及对原生 Android 函数的调用。
 */

import * as ui from './ui.js';

class UpdateChecker {
    constructor() {
        this.APP_VERSION = (window.Android && Android.getAppVersion) ? Android.getAppVersion() : "1.0.1";
        this.VERSION_CHECK_URL = "https://raw.githubusercontent.com/JYinherit/Arabiclearning/main/android-version.json";
        this.currentVersionInfo = null;
    }
    /**
     * 初始化更新检查器并绑定事件监听器。
     */
    init() {
        this.bindManualCheckButton();
        // 应用启动后不久自动检查更新。
        setTimeout(() => this.checkForUpdates(false), 5000);
    }

    /** 绑定设置页面中的“检查更新”按钮。 */
    bindManualCheckButton() {
        const checkUpdatesLink = document.getElementById('check-updates-link');
        if (checkUpdatesLink) {
            checkUpdatesLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.checkForUpdates(true); // 用户点击时 `isManual` 为 true。
            });
        }
    }

    /**
     * 通过从仓库获取版本 JSON 来检查更新。
     * @param {boolean} isManual - 如果检查是由用户操作触发的，则为 true。
     */
    async checkForUpdates(isManual) {
        try {
            // 追加时间戳以绕过浏览器缓存。
            const response = await fetch(`${this.VERSION_CHECK_URL}?t=${Date.now()}`);
            if (!response.ok) throw new Error('网络响应不正常。');
            
            const versionInfo = await response.json();
            this.processUpdateInfo(versionInfo, isManual);
            
        } catch (error) {
            console.error('更新检查失败:', error);
            if (isManual) {
                ui.showImportMessage('❌ 检查更新失败，请稍后重试', false);
            }
        }
    }

    /**
     * 处理获取到的版本信息，并决定是否显示通知。
     * @param {object} versionInfo - 从 JSON 文件解析的版本信息。
     * @param {boolean} isManual - 如果检查是由用户操作触发的，则为 true。
     */
    processUpdateInfo(versionInfo, isManual) {
        const hasUpdate = this.compareVersions(versionInfo.latestVersion, this.APP_VERSION) > 0;
        
        if (hasUpdate) {
            this.currentVersionInfo = versionInfo;
            this.showUpdateModal(versionInfo);
        } else if (isManual) {
            // 仅在手动检查时显示“已是最新版本”的消息。
            ui.showImportMessage('✅ 已是最新版本', true);
        }
    }

    /**
     * 比较两个语义化版本字符串 (例如, "1.2.1" vs "1.2.0")。
     * @returns {number} 如果 a > b 返回 1, 如果 a < b 返回 -1, 如果 a === b 返回 0。
     */
    compareVersions(a, b) {
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aVal = aParts[i] || 0;
            const bVal = bParts[i] || 0;
            if (aVal > bVal) return 1;
            if (aVal < bVal) return -1;
        }
        return 0;
    }

    /**
     * 创建并显示包含最新版本信息的更新模态框。
     * @param {object} versionInfo - 版本信息对象。
     */
    showUpdateModal(versionInfo) {
        // 首先关闭任何已存在的模态框。
        this.closeUpdateModal();

        const modal = document.createElement('div');
        modal.id = 'update-modal';
        modal.className = 'modal visible';
        
        const releaseNotesHTML = versionInfo.releaseNotes
            ? versionInfo.releaseNotes.map(note => `<p>• ${note}</p>`).join('')
            : '<p>暂无详细更新说明</p>';

        modal.innerHTML = `
            <div class="modal-content">
                <h3>发现新版本</h3>
                <p><strong>当前版本：</strong> v${this.APP_VERSION}</p>
                <p><strong>最新版本：</strong> v${versionInfo.latestVersion}</p>
                <p><strong>更新内容：</strong></p>
                <div class="release-notes">${releaseNotesHTML}</div>
                <div class="modal-actions" style="margin-top: 1.5rem;">
                    <button id="update-later-btn" class="btn btn-secondary">稍后提醒</button>
                    <button id="update-now-btn" class="btn">立即更新</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 为新模态框的按钮绑定事件。
        modal.querySelector('#update-later-btn').addEventListener('click', () => this.closeUpdateModal());
        modal.querySelector('#update-now-btn').addEventListener('click', () => this.triggerUpdateDownload());
    }

    /** 关闭并从 DOM 中移除更新模态框。 */
    closeUpdateModal() {
        const modal = document.getElementById('update-modal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * 触发新版本的下载。
     * 如果可用，则调用原生 Android 函数，否则直接打开 URL。
     */
    triggerUpdateDownload() {
        if (!this.currentVersionInfo || !this.currentVersionInfo.apkDownloadUrl) return;

        const url = this.currentVersionInfo.apkDownloadUrl;
        if (window.Android && Android.downloadApk) {
            Android.downloadApk(url);
        } else {
            window.open(url, '_blank');
        }
        this.closeUpdateModal();
    }
}

// DOM 加载完毕后初始化检查器。
document.addEventListener('DOMContentLoaded', () => {
    new UpdateChecker().init();
});
