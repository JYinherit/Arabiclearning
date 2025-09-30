class UpdateChecker {
    constructor() {
        this.APP_VERSION = this.getAppVersion();
        this.VERSION_CODE = this.getVersionCode();
        this.UPDATE_CHECK_URL = "https://raw.githubusercontent.com/JYinherit/Arabiclearning/main/android-version.json";
        this.init();
    }

    init() {
        this.bindEvents();
        // 应用启动时自动检查更新
        setTimeout(() => {
            this.checkForUpdates();
        }, 5000);
    }

    bindEvents() {
        // 绑定手动检查更新按钮
        const checkUpdatesLink = document.getElementById('check-updates-link');
        if (checkUpdatesLink) {
            checkUpdatesLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.checkForUpdates();
            });
        }

        // 绑定更新操作按钮
        const updateNowBtn = document.getElementById('update-now-btn');
        const updateLaterBtn = document.getElementById('update-later-btn');
        const viewReleaseBtn = document.getElementById('view-release-btn');
        
        if (updateNowBtn) {
            updateNowBtn.addEventListener('click', () => this.updateNow());
        }
        
        if (updateLaterBtn) {
            updateLaterBtn.addEventListener('click', () => this.updateLater());
        }
        
        if (viewReleaseBtn) {
            viewReleaseBtn.addEventListener('click', () => this.viewReleasePage());
        }
    }

    getAppVersion() {
        // 从Android原生层获取版本号
        if (window.Android && typeof Android.getAppVersion === 'function') {
            return Android.getAppVersion();
        }
        return "1.0.0";
    }

    getVersionCode() {
        // 从Android原生层获取版本代码
        if (window.Android && typeof Android.getVersionCode === 'function') {
            return Android.getVersionCode();
        }
        return 1;
    }

    checkForUpdates() {
        if (window.Android && typeof Android.checkForUpdates === 'function') {
            // 调用原生方法检查更新
            Android.checkForUpdates();
        } else {
            // 备用方案：直接使用JavaScript检查
            this.checkForUpdatesJS();
        }
    }

    // JavaScript实现的更新检查（备用方案）
    async checkForUpdatesJS() {
        try {
            const response = await fetch(this.UPDATE_CHECK_URL + '?t=' + Date.now());
            if (!response.ok) {
                throw new Error('网络错误');
            }
            
            const versionInfo = await response.json();
            this.processUpdateInfo(versionInfo);
            
        } catch (error) {
            console.error('检查更新失败:', error);
            if (window.showImportMessage) {
                window.showImportMessage('❌ 检查更新失败，请稍后重试', false);
            }
        }
    }

    // 处理更新信息
    processUpdateInfo(versionInfo) {
        const hasUpdate = this.compareVersions(versionInfo.latestVersion, this.APP_VERSION) > 0;
        
        if (hasUpdate) {
            this.showUpdateNotification(versionInfo);
        } else {
            if (window.showImportMessage) {
                window.showImportMessage('✅ 已是最新版本', true);
            }
        }
    }

    // 显示更新信息（由原生代码调用）
    showUpdateInfo(latestVersion, latestVersionCode, releasePage, apkUrl, versionInfoJson) {
        try {
            const versionInfo = JSON.parse(versionInfoJson);
            this.currentVersionInfo = versionInfo;
            this.showUpdateNotification(versionInfo);
        } catch (e) {
            console.error('解析版本信息失败:', e);
        }
    }

    // 显示更新错误（由原生代码调用）
    showUpdateError(errorMessage) {
        if (window.showImportMessage) {
            window.showImportMessage('❌ ' + errorMessage, false);
        }
    }

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

    showUpdateNotification(versionInfo) {
        // 创建或显示更新通知
        let notification = document.getElementById('update-notification');
        if (!notification) {
            notification = document.createElement('button');
            notification.id = 'update-notification';
            notification.innerHTML = '🔄 有新版本可用';
            notification.title = '点击查看更新详情';
            notification.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
                color: white;
                padding: 12px 18px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                max-width: 300px;
                animation: slideInRight 0.5s ease-out;
                cursor: pointer;
                border: none;
                font-weight: bold;
            `;
            document.body.appendChild(notification);
            
            notification.addEventListener('click', () => {
                this.showUpdateModal(versionInfo);
            });
        }
        notification.style.display = 'block';
        
        // 保存版本信息
        this.currentVersionInfo = versionInfo;
        
        // 强制更新处理
        if (versionInfo.forceUpdate) {
            this.showUpdateModal(versionInfo, true);
        }
    }

    showUpdateModal(versionInfo, isForceUpdate = false) {
        // 创建或显示更新模态框
        let modal = document.getElementById('update-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'update-modal';
            modal.style.cssText = `
                display: flex;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 2000;
                justify-content: center;
                align-items: center;
            `;
            
            const modalContent = document.createElement('div');
            modalContent.className = 'update-content';
            modalContent.style.cssText = `
                background-color: white;
                padding: 2rem;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                max-width: 500px;
                width: 90%;
                text-align: left;
            `;
            
            modalContent.innerHTML = `
                <h3 style="color: #004d40; margin-top: 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.5rem;">
                    ${isForceUpdate ? '⚠️ 强制更新' : '发现新版本'}
                </h3>
                <p><strong>当前版本：</strong> <span id="current-version">v${this.APP_VERSION}</span></p>
                <p><strong>最新版本：</strong> <span id="latest-version">v${versionInfo.latestVersion}</span></p>
                <p><strong>更新内容：</strong></p>
                <div class="release-notes" id="release-notes">
                    ${versionInfo.releaseNotes ? versionInfo.releaseNotes.map(note => `<p>• ${note}</p>`).join('') : '<p>暂无详细更新说明</p>'}
                </div>
                <div class="update-actions" style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 10px;">
                    ${isForceUpdate ? '' : '<button id="update-later-btn" class="btn" style="background-color: #757575; padding: 8px 16px; font-size: 0.9rem;">稍后提醒</button>'}
                    <button id="view-release-btn" class="btn" style="background-color: #1976d2; padding: 8px 16px; font-size: 0.9rem;">查看详情</button>
                    <button id="update-now-btn" class="btn" style="background-color: #43a047; padding: 8px 16px; font-size: 0.9rem;">立即更新</button>
                </div>
            `;
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            // 绑定事件
            modal.querySelector('#update-later-btn').addEventListener('click', () => this.updateLater());
            modal.querySelector('#view-release-btn').addEventListener('click', () => this.viewReleasePage());
            modal.querySelector('#update-now-btn').addEventListener('click', () => this.updateNow());
        }
        
        modal.style.display = 'flex';
        
        // 更新内容
        modal.querySelector('#latest-version').textContent = `v${versionInfo.latestVersion}`;
        const releaseNotes = modal.querySelector('#release-notes');
        releaseNotes.innerHTML = versionInfo.releaseNotes ? 
            versionInfo.releaseNotes.map(note => `<p>• ${note}</p>`).join('') : 
            '<p>暂无详细更新说明</p>';
            
        // 强制更新时隐藏"稍后提醒"按钮
        if (isForceUpdate) {
            const laterBtn = modal.querySelector('#update-later-btn');
            if (laterBtn) laterBtn.style.display = 'none';
        }
    }

    updateNow() {
        if (this.currentVersionInfo && this.currentVersionInfo.apkDownloadUrl) {
            if (window.Android && typeof Android.downloadApk === 'function') {
                // 使用原生方法下载APK
                Android.downloadApk(this.currentVersionInfo.apkDownloadUrl);
            } else {
                // 备用方案：直接打开下载链接
                window.open(this.currentVersionInfo.apkDownloadUrl, '_system');
            }
        }
    }

    viewReleasePage() {
        if (this.currentVersionInfo && this.currentVersionInfo.releasePage) {
            if (window.Android && typeof Android.openReleasePage === 'function') {
                // 使用原生方法打开Release页面
                Android.openReleasePage(this.currentVersionInfo.releasePage);
            } else {
                // 备用方案：直接打开链接
                window.open(this.currentVersionInfo.releasePage, '_system');
            }
        }
    }

    updateLater() {
        const modal = document.getElementById('update-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        // 设置24小时后再次提醒
        localStorage.setItem('updateRemindLater', (Date.now() + 24 * 60 * 60 * 1000).toString());
    }
}

// 初始化更新检查器
document.addEventListener('DOMContentLoaded', function() {
    window.updateChecker = new UpdateChecker();
});
