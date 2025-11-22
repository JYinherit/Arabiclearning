/**
 * @fileoverview 统一管理应用中所有的模态框（Modal）
 * 包括打开、关闭、内容渲染等。
 */

import * as dom from './dom-elements.js';

/** 
 * 通过添加 'visible' 类来打开一个模态框。
 * 这是模块内部函数，不导出。
 */
function openModal(modalElement) {
    // 为确保一次只显示一个模态框，先关闭所有已打开的。
    const visibleModals = document.querySelectorAll('.modal.visible');
    visibleModals.forEach(modal => modal.classList.remove('visible'));

    if (modalElement) modalElement.classList.add('visible');
}

/** 
 * 通过移除 'visible' 类来关闭一个模态框。
 * 这是模块内部函数，不导出。
 */
function closeModal(modalElement) {
    if (modalElement) modalElement.classList.remove('visible');
}

// --- 导出的模态框控制函数 ---

export const openStatsModal = () => openModal(dom.statsModal);
export const closeStatsModal = () => closeModal(dom.statsModal);

export const openClearDataModal = () => openModal(dom.clearDataModal);
export const closeClearDataModal = () => closeModal(dom.clearDataModal);

export const closeContinueSessionModal = () => closeModal(dom.continueSessionModal);

/**
 * 动态渲染学习统计模态框中的内容。
 * @param {Array<object>} statsSummary - 从 stats.js 的 getStatsSummary 生成的数据。
 */
export function renderStats(statsSummary) {
    if (!dom.statsContent) return;
    dom.statsContent.innerHTML = ''; // 清空现有内容

    statsSummary.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'stats-category';

        const categoryTitle = document.createElement('h3');
        categoryTitle.textContent = category.category;
        categoryDiv.appendChild(categoryTitle);

        const statsList = document.createElement('ul');
        category.stats.forEach(stat => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<strong>${stat.label}:</strong> ${stat.value}`;
            statsList.appendChild(listItem);
        });

        categoryDiv.appendChild(statsList);
        dom.statsContent.appendChild(categoryDiv);
    });
}

/**
 * 打开“继续会话”模态框并为其按钮附加回调。
 * @param {Function} onConfirm - “继续”按钮的回调。
 * @param {Function} onDecline - “重新开始”按钮的回调。
 */
export function openContinueSessionModal(onConfirm, onDecline) {
    if (!dom.continueSessionModal) return;

    // 使用 cloneNode 清理旧监听器，这是确保事件监听器不重复添加的健壮方法
    const newConfirmBtn = dom.confirmContinueBtn.cloneNode(true);
    dom.confirmContinueBtn.parentNode.replaceChild(newConfirmBtn, dom.confirmContinueBtn);

    const newDeclineBtn = dom.declineContinueBtn.cloneNode(true);
    dom.declineContinueBtn.parentNode.replaceChild(newDeclineBtn, dom.declineContinueBtn);
    
    newConfirmBtn.addEventListener('click', () => {
        onConfirm();
        closeContinueSessionModal();
    });
    
    newDeclineBtn.addEventListener('click', () => {
        onDecline();
        closeContinueSessionModal();
    });
    
    openModal(dom.continueSessionModal);
}
