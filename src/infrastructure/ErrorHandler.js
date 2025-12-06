/**
 * @fileoverview Provides a unified error handler to distinguish between
 * user-facing and developer-facing errors.
 */

import { showNotification } from '../ui/notifications.js';

export class ErrorHandler {
    /**
     * Handles user-level errors.
     * These are often recoverable and should display a friendly message to the user.
     * @param {string} message - The message to display to the user.
     * @param {Error} [originalError] - The optional, original Error object that caused this.
     */
    userError(message, originalError) {
        showNotification(message, false); // 'false' indicates this is an error message
        if (originalError) {
            console.error(`[User Error] ${message}`, originalError);
        } else {
            console.error(`[User Error] ${message}`);
        }
    }

    /**
     * Handles developer-level errors.
     * These are unexpected exceptions that need developer attention.
     * They are only logged to the console and not shown directly to the user.
     * @param {Error} error - The Error object to log.
     * @param {string} [context=''] - Contextual information about where the error occurred.
     */
    devError(error, context = '') {
        if (context) {
            console.error(`[Dev Error] [Context: ${context}]`, error);
        } else {
            console.error('[Dev Error]', error);
        }
    }
}
