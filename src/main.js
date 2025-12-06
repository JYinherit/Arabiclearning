import { App } from './app/App.js';

/**
 * Main entry point for the application.
 * Executed when the window is fully loaded.
 */
window.onload = () => {
    const app = new App();
    app.init();
};
