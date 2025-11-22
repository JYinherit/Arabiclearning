/**
 * @fileoverview Handles in-app update checking and notifications.
 * This module fetches version information from a remote JSON file, compares it
 * with the current app version, and notifies the user if an update is available.
 * It includes fallbacks for web environments and calls to native Android functions.
 */

export class UpdateService {
    /**
     * @param {string} currentAppVersion The current version of the application.
     */
    constructor(currentAppVersion) {
        this.APP_VERSION = currentAppVersion;
        this.VERSION_CHECK_URL = "https://raw.githubusercontent.com/JYinherit/Arabiclearning/main/android-version.json";
    }

    /**
     * Checks for updates by fetching the remote version info.
     * @returns {Promise<object|null>} The version info object if an update is available, otherwise null.
     */
    async checkForUpdates() {
        try {
            // Append timestamp to bypass browser cache.
            const response = await fetch(`${this.VERSION_CHECK_URL}?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error('Network response was not ok.');
            }
            
            const versionInfo = await response.json();
            
            const hasUpdate = this._compareVersions(versionInfo.latestVersion, this.APP_VERSION) > 0;

            if (hasUpdate) {
                return versionInfo;
            }
            
            return null; // No update available
            
        } catch (error) {
            console.error('Update check failed:', error);
            // Re-throw the error so the calling layer (UI) can handle it,
            // e.g., by showing a "check failed" message.
            throw error;
        }
    }

    /**
     * Compares two semantic version strings (e.g., "1.2.1" vs "1.2.0").
     * @returns {number} 1 if a > b, -1 if a < b, 0 if a === b.
     * @private
     */
    _compareVersions(a, b) {
        if (!a || !b) return 0;
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
}
