/**
 * Meteora监控平台 V2.0 - 核心JavaScript模块
 * 提供全局功能和工具函数
 */

class MeteoraCore {
    constructor() {
        this.config = {
            apiBaseUrl: '/api',
            refreshInterval: 30000, // 30秒
            autoRefresh: true,
            pageSize: 100,
            debounceDelay: 300
        };

        this.state = {
            isConnected: false,
            lastUpdate: null,
            totalPools: 0,
            filteredPools: 0,
            currentFilters: {},
            sortConfig: { field: 'liquidity', direction: 'DESC' }
        };

        this.eventListeners = new Map();
        this.refreshTimer = null;

        this.init();
    }

    /**
     * 初始化核心模块
     */
    init() {
        this.setupEventDelegation();
        this.loadUserConfig();
        this.startAutoRefresh();
        this.updateConnectionStatus(true);

        console.log('🚀 Meteora Core 初始化完成');
    }

    /**
     * 设置事件委托
     */
    setupEventDelegation() {
        // 全局键盘快捷键
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

        // 全局点击事件处理
        document.addEventListener('click', this.handleGlobalClick.bind(this));

        // 窗口失焦/聚焦处理
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

        // 网络状态监听
        window.addEventListener('online', () => this.updateConnectionStatus(true));
        window.addEventListener('offline', () => this.updateConnectionStatus(false));
    }

    /**
     * 键盘快捷键处理
     */
    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + R: 刷新数据
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            this.refreshData();
            return;
        }

        // Ctrl/Cmd + F: 聚焦搜索框
        if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
            event.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
            return;
        }

        // Escape: 清除筛选器
        if (event.key === 'Escape') {
            this.clearFilters();
            return;
        }

        // F5: 强制刷新
        if (event.key === 'F5') {
            event.preventDefault();
            this.refreshData(true);
            return;
        }
    }

    /**
     * 全局点击事件处理
     */
    handleGlobalClick(event) {
        // 关闭所有下拉菜单和弹出框
        const dropdowns = document.querySelectorAll('.dropdown-menu.show');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(event.target)) {
                dropdown.classList.remove('show');
            }
        });

        // 关闭上下文菜单
        const contextMenus = document.querySelectorAll('.context-menu');
        contextMenus.forEach(menu => {
            if (!menu.contains(event.target)) {
                menu.remove();
            }
        });
    }

    /**
     * 页面可见性变化处理
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // 页面隐藏时暂停自动刷新
            this.pauseAutoRefresh();
        } else {
            // 页面显示时恢复自动刷新并立即刷新一次
            this.startAutoRefresh();
            this.refreshData();
        }
    }

    /**
     * API请求封装
     */
    async apiRequest(endpoint, options = {}) {
        const url = `${this.config.apiBaseUrl}${endpoint}`;
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const requestOptions = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, requestOptions);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.updateConnectionStatus(true);
            return data;

        } catch (error) {
            console.error(`API请求失败 [${endpoint}]:`, error);
            this.updateConnectionStatus(false);
            throw error;
        }
    }

    /**
     * 获取池子数据
     */
    async getPools(filters = {}, pagination = {}) {
        const params = new URLSearchParams();

        // 添加筛选参数
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                params.append(key, value);
            }
        });

        // 添加分页参数
        if (pagination.page) params.append('page', pagination.page);
        if (pagination.size) params.append('size', pagination.size);
        if (pagination.sort) params.append('sort', pagination.sort);
        if (pagination.order) params.append('order', pagination.order);

        const query = params.toString();
        const endpoint = query ? `/pools?${query}` : '/pools';

        return await this.apiRequest(endpoint);
    }

    /**
     * 获取字段配置
     */
    async getFields() {
        return await this.apiRequest('/fields');
    }

    /**
     * 获取系统状态
     */
    async getSystemStatus() {
        return await this.apiRequest('/health');
    }

    /**
     * 保存用户配置
     */
    async saveUserConfig(config) {
        return await this.apiRequest('/config', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    }

    /**
     * 加载用户配置
     */
    loadUserConfig() {
        try {
            const saved = localStorage.getItem('meteora_user_config');
            if (saved) {
                const config = JSON.parse(saved);
                this.config = { ...this.config, ...config };
            }
        } catch (error) {
            console.warn('加载用户配置失败:', error);
        }
    }

    /**
     * 更新连接状态
     */
    updateConnectionStatus(isConnected) {
        this.state.isConnected = isConnected;

        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            const icon = statusElement.querySelector('i');
            const text = statusElement.querySelector('small');

            if (isConnected) {
                icon.className = 'fas fa-circle text-success me-1';
                text.textContent = '实时连接';
            } else {
                icon.className = 'fas fa-circle text-danger me-1';
                text.textContent = '连接断开';
            }
        }

        this.emit('connectionStatusChanged', isConnected);
    }

    /**
     * 更新统计信息
     */
    updateStats(stats) {
        this.state.totalPools = stats.total || 0;
        this.state.filteredPools = stats.filtered || stats.total || 0;
        this.state.lastUpdate = new Date();

        // 更新UI
        const totalElement = document.getElementById('totalPools');
        if (totalElement) {
            totalElement.textContent = this.formatNumber(this.state.totalPools);
        }

        const updateElement = document.getElementById('lastUpdate');
        if (updateElement) {
            updateElement.textContent = this.formatTime(this.state.lastUpdate);
        }

        const displayElement = document.getElementById('displayCount');
        if (displayElement) {
            displayElement.textContent = this.formatNumber(this.state.filteredPools);
        }

        const totalCountElement = document.getElementById('totalCount');
        if (totalCountElement) {
            totalCountElement.textContent = this.formatNumber(this.state.totalPools);
        }
    }

    /**
     * 开始自动刷新
     */
    startAutoRefresh() {
        if (!this.config.autoRefresh) return;

        this.pauseAutoRefresh();
        this.refreshTimer = setInterval(() => {
            this.refreshData();
        }, this.config.refreshInterval);
    }

    /**
     * 暂停自动刷新
     */
    pauseAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    /**
     * 刷新数据
     */
    async refreshData(force = false) {
        this.emit('dataRefreshStart', force);

        try {
            // 这里会被其他模块重写具体的刷新逻辑
            console.log('🔄 数据刷新中...');
            this.emit('dataRefreshSuccess');

        } catch (error) {
            console.error('数据刷新失败:', error);
            this.emit('dataRefreshError', error);
        }
    }

    /**
     * 清除筛选器
     */
    clearFilters() {
        this.state.currentFilters = {};
        this.emit('filtersCleared');
    }

    /**
     * 数字格式化
     */
    formatNumber(num, decimals = 0) {
        if (num === null || num === undefined) return '-';

        const absNum = Math.abs(num);

        if (absNum >= 1e9) {
            return (num / 1e9).toFixed(decimals) + 'B';
        } else if (absNum >= 1e6) {
            return (num / 1e6).toFixed(decimals) + 'M';
        } else if (absNum >= 1e3) {
            return (num / 1e3).toFixed(decimals) + 'K';
        }

        return num.toLocaleString('en-US', { maximumFractionDigits: decimals });
    }

    /**
     * 货币格式化
     */
    formatCurrency(amount, decimals = 2) {
        if (amount === null || amount === undefined) return '-';
        return '$' + this.formatNumber(amount, decimals);
    }

    /**
     * 百分比格式化
     */
    formatPercentage(value, decimals = 2) {
        if (value === null || value === undefined) return '-';
        return value.toFixed(decimals) + '%';
    }

    /**
     * 时间格式化
     */
    formatTime(date) {
        if (!date) return '-';

        const now = new Date();
        const diff = now - date;

        if (diff < 60000) { // 1分钟内
            return '刚刚';
        } else if (diff < 3600000) { // 1小时内
            return Math.floor(diff / 60000) + '分钟前';
        } else if (diff < 86400000) { // 24小时内
            return Math.floor(diff / 3600000) + '小时前';
        } else {
            return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    /**
     * 地址格式化
     */
    formatAddress(address, start = 6, end = 4) {
        if (!address) return '-';
        if (address.length <= start + end) return address;
        return `${address.slice(0, start)}...${address.slice(-end)}`;
    }

    /**
     * 防抖函数
     */
    debounce(func, wait = this.config.debounceDelay) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 节流函数
     */
    throttle(func, limit = 1000) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-header">
                <h6 class="notification-title">${this.getNotificationTitle(type)}</h6>
                <button class="notification-close">&times;</button>
            </div>
            <div class="notification-body">${message}</div>
        `;

        document.body.appendChild(notification);

        // 关闭按钮事件
        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.removeNotification(notification);
        });

        // 自动关闭
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification);
            }, duration);
        }

        return notification;
    }

    /**
     * 获取通知标题
     */
    getNotificationTitle(type) {
        const titles = {
            success: '成功',
            error: '错误',
            warning: '警告',
            info: '信息'
        };
        return titles[type] || '通知';
    }

    /**
     * 移除通知
     */
    removeNotification(notification) {
        if (notification && notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }

    /**
     * 事件发射器
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);

        return () => this.off(event, callback);
    }

    /**
     * 移除事件监听器
     */
    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 触发事件
     */
    emit(event, ...args) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`事件回调错误 [${event}]:`, error);
                }
            });
        }
    }

    /**
     * 复制到剪贴板
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('已复制到剪贴板', 'success', 2000);
            return true;
        } catch (error) {
            console.error('复制失败:', error);
            this.showNotification('复制失败', 'error', 3000);
            return false;
        }
    }

    /**
     * 导出数据
     */
    exportData(data, filename, format = 'json') {
        try {
            let content;
            let mimeType;

            switch (format.toLowerCase()) {
                case 'json':
                    content = JSON.stringify(data, null, 2);
                    mimeType = 'application/json';
                    filename = filename.endsWith('.json') ? filename : filename + '.json';
                    break;

                case 'csv':
                    content = this.convertToCSV(data);
                    mimeType = 'text/csv';
                    filename = filename.endsWith('.csv') ? filename : filename + '.csv';
                    break;

                default:
                    throw new Error('不支持的导出格式');
            }

            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
            this.showNotification(`数据已导出: ${filename}`, 'success');

        } catch (error) {
            console.error('导出失败:', error);
            this.showNotification('导出失败', 'error');
        }
    }

    /**
     * 转换为CSV格式
     */
    convertToCSV(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return '';
        }

        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');

        const csvRows = data.map(row => {
            return headers.map(header => {
                const value = row[header];
                // 处理包含逗号或引号的值
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',');
        });

        return [csvHeaders, ...csvRows].join('\n');
    }

    /**
     * 销毁实例
     */
    destroy() {
        this.pauseAutoRefresh();
        this.eventListeners.clear();

        // 移除事件监听器
        document.removeEventListener('keydown', this.handleKeyboardShortcuts);
        document.removeEventListener('click', this.handleGlobalClick);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);

        console.log('💫 Meteora Core 已销毁');
    }
}

// 创建全局实例
window.MeteoraCore = MeteoraCore;
window.meteora = new MeteoraCore(); 