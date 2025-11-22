/**
 * @fileoverview Controller for the application update UI.
 * It handles manual update checks, and displays the update modal when an
 * update is found by the UpdateService.
 */

import { showNotification } from './notifications.js';
import { UpdateService } from '../services/UpdateService.js';

export class UpdateController {
    /**
     * @param {string} currentAppVersion The current version of the application.
     */
    constructor(currentAppVersion) {
        this.APP_VERSION = currentAppVersion;
        this.updateService = new UpdateService(currentAppVersion);
        this.currentVersionInfo = null;

        this.manualCheckButton = document.getElementById('check-updates-link');
    }

    /**
     * Initializes the controller by setting up event listeners.
     */
    initialize() {
        if (this.manualCheckButton) {
            this.manualCheckButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleManualCheck();
            });
        }
        // Automatic check on startup
        setTimeout(() => this.handleAutoCheck(), 5000);
    }

    /**
     * Handles the automatic, silent update check on startup.
     */
    async handleAutoCheck() {
        try {
            const versionInfo = await this.updateService.checkForUpdates();
            if (versionInfo) {
                this.currentVersionInfo = versionInfo;
                this.showUpdateModal();
            }
        } catch (error) {
            console.error('Automatic update check failed silently:', error);
        }
    }

    /**
     * Handles a user-initiated manual update check.
     */
    async handleManualCheck() {
        showNotification('正在检查更新...', true);
        try {
            const versionInfo = await this.updateService.checkForUpdates();
            if (versionInfo) {
                this.currentVersionInfo = versionInfo;
                this.showUpdateModal();
            } else {
                showNotification('✅ 已是最新版本', true);
            }
        } catch (error) {
            showNotification('❌ 检查更新失败，请稍后重试', false);
        }
    }

    /**
     * Creates and displays the update modal with the latest version info.
     */
    showUpdateModal() {
        // Close any existing modal first
        this.closeUpdateModal();

        const versionInfo = this.currentVersionInfo;
        if (!versionInfo) return;

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
        
        modal.querySelector('#update-later-btn').addEventListener('click', () => this.closeUpdateModal());
        modal.querySelector('#update-now-btn').addEventListener('click', () => this.triggerUpdateDownload());
    }

    /** Closes and removes the update modal from the DOM. */
    closeUpdateModal() {
        const modal = document.getElementById('update-modal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Triggers the download of the new version.
     * Calls the native Android function if available, otherwise opens the URL.
     */
    triggerUpdateDownload() {
        if (!this.currentVersionInfo || !this.currentVersionInfo.apkDownloadUrl) return;

        const url = this.currentVersionInfo.apkDownloadUrl;
        if (window.Android && window.Android.downloadApk) {
            window.Android.downloadApk(url);
        } else {
            window.open(url, '_blank');
        }
        this.closeUpdateModal();
    }
}
