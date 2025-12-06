/**
 * @fileoverview 提供整个应用可重用的通用工具函数。
 */

/**
 * 使用 Fisher-Yates 算法原地打乱一个数组。
 * @param {Array} array 要打乱的数组。
 * @returns {Array} 打乱后的原始数组。
 */
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * 创建一个防抖函数，该函数会延迟执行 func 直到在 wait 毫秒内没有再次调用它。
 * @param {Function} func 要防抖的函数。
 * @param {number} wait 延迟的毫秒数。
 * @returns {Function} 防抖后的函数。
 */
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        const later = function() {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
