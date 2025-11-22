/**
 * @fileoverview 一个简单的事件总线，用于模块间的解耦通信。
 */

export class EventBus {
    constructor() {
        this.listeners = {};
    }

    /**
     * 监听一个事件。
     * @param {string} eventName - 事件名称。
     * @param {Function} callback - 事件触发时执行的回调函数。
     * @returns {Function} 一个可以用来取消监听的函数。
     */
    on(eventName, callback) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);

        // 返回一个取消订阅的函数
        return () => {
            this.listeners[eventName] = this.listeners[eventName].filter(
                listener => listener !== callback
            );
        };
    }

    /**
     * 触发一个事件。
     * @param {string} eventName - 事件名称。
     * @param {*} [data] - 传递给监听器的数据。
     */
    emit(eventName, data) {
        if (this.listeners[eventName]) {
            this.listeners[eventName].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[EventBus] 事件 '${eventName}' 的监听器执行出错:`, error);
                }
            });
        }
    }
}
