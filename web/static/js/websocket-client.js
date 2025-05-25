/**
 * Meteora监控平台 V2.0 - WebSocket客户端
 * 处理实时数据通信和连接管理
 */

class WebSocketClient {
    constructor() {
        this.websocket = null;
        this.messageHandlers = new Map();
        this.subscriptions = new Set();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnecting = false;
        this.url = this.getWebSocketUrl();
        this.clientId = this.generateClientId();

        // 🔧 新增：报警池子追踪
        this.alertedPools = new Map(); // 存储报警的池子地址和报警时间
        this.alertDuration = 300000; // 5分钟 = 300秒 = 300000毫秒

        console.log('💻 WebSocket客户端初始化完成');
    }

    /**
     * 初始化WebSocket客户端
     */
    init() {
        this.setupMessageHandlers();
        this.connect();

        console.log('🔌 WebSocket客户端初始化完成');
    }

    /**
     * 设置消息处理器
     */
    setupMessageHandlers() {
        // 欢迎消息
        this.onMessage('welcome', (data) => {
            console.log('🎉 WebSocket连接成功:', data.client_id);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.startPing();

            // 触发连接成功事件
            this.emit('connected', data);
        });

        // 池子数据更新
        this.onMessage('pools_update', (data) => {
            console.log('📊 收到池子数据更新:', data.data?.length || 0, '个池子');

            // 更新表格管理器
            if (window.tableManager) {
                window.tableManager.updateData(data.data);
            }

            // 更新图表管理器
            if (window.chartManager) {
                window.chartManager.handleDataUpdate(data.data);
            }

            // 触发数据更新事件
            this.emit('poolsUpdated', data);
        });

        // 系统状态更新
        this.onMessage('system_status', (data) => {
            console.log('⚡ 收到系统状态更新');
            this.updateSystemStatus(data.data);

            // 触发系统状态更新事件
            this.emit('systemStatusUpdated', data);
        });

        // 池子详情
        this.onMessage('pool_detail', (data) => {
            console.log('🔍 收到池子详情:', data.address);

            // 触发池子详情事件
            this.emit('poolDetailReceived', data);
        });

        // 🔧 新增：报警通知处理
        this.onMessage('new_alert', (data) => {
            console.log('🚨 收到新报警通知:', data.data?.pool_name);
            console.log('📋 报警数据详情:', data.data);

            // 🔧 直接在前端实现池子闪烁效果
            if (data.data && data.data.pool_address) {
                console.log(`🎯 处理报警池子: ${data.data.pool_name} (${data.data.pool_address})`);

                // 直接查找并标记表格中的池子行
                this.markPoolRowAsAlerted(data.data.pool_address, data.data.pool_name);

                // 记录报警池子地址（保持现有功能）
                this.addAlertedPool(data.data.pool_address);
            } else {
                console.warn('⚠️ 报警数据中缺少池子地址:', data);
            }

            // 🔧 简化：直接播放声音和显示通知，不依赖应用实例
            console.log('📞 执行报警处理');
            this.handleAlertFallback(data.data);

            // 触发报警事件
            this.emit('alertReceived', data);
        });

        // Pong响应
        this.onMessage('pong', (data) => {
            // 静默处理心跳响应
        });

        // 错误消息
        this.onMessage('error', (data) => {
            console.error('❌ WebSocket错误:', data.message);

            if (window.meteora) {
                window.meteora.showNotification(
                    'WebSocket错误: ' + data.message,
                    'error',
                    5000
                );
            }
        });

        // 订阅成功
        this.onMessage('subscription_success', (data) => {
            console.log('✅ 订阅成功:', data.subscription);
            this.subscriptions.add(data.subscription);
        });

        // 取消订阅成功
        this.onMessage('unsubscription_success', (data) => {
            console.log('❌ 取消订阅:', data.subscription);
            this.subscriptions.delete(data.subscription);
        });
    }

    /**
     * 连接WebSocket服务器
     */
    connect() {
        try {
            console.log('🔌 正在连接WebSocket服务器:', this.url);

            this.websocket = new WebSocket(this.url, this.protocols);

            this.websocket.onopen = this.handleOpen.bind(this);
            this.websocket.onmessage = this.handleMessage.bind(this);
            this.websocket.onclose = this.handleClose.bind(this);
            this.websocket.onerror = this.handleError.bind(this);

        } catch (error) {
            console.error('❌ WebSocket连接失败:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * 处理连接打开
     */
    handleOpen(event) {
        console.log('🟢 WebSocket连接已建立');
        this.updateConnectionStatus(true);
    }

    /**
     * 处理收到消息
     */
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            const messageType = message.type;

            // 查找并执行相应的处理器
            const handler = this.messageHandlers.get(messageType);
            if (handler) {
                handler(message);
            } else {
                console.warn('⚠️ 未知消息类型:', messageType, message);
            }

        } catch (error) {
            console.error('❌ 解析WebSocket消息失败:', error);
        }
    }

    /**
     * 处理连接关闭
     */
    handleClose(event) {
        console.log('🔴 WebSocket连接已关闭:', event.code, event.reason);

        this.isConnected = false;
        this.stopPing();
        this.updateConnectionStatus(false);

        // 触发断开连接事件
        this.emit('disconnected', { code: event.code, reason: event.reason });

        // 如果不是正常关闭，尝试重连
        if (event.code !== 1000 && event.code !== 1001) {
            this.scheduleReconnect();
        }
    }

    /**
     * 处理连接错误
     */
    handleError(event) {
        console.error('❌ WebSocket连接错误:', event);

        if (window.meteora) {
            window.meteora.showNotification(
                'WebSocket连接错误',
                'error',
                3000
            );
        }

        // 触发错误事件
        this.emit('error', event);
    }

    /**
     * 发送消息
     */
    send(message) {
        if (this.isConnected && this.websocket) {
            try {
                const messageStr = JSON.stringify(message);
                this.websocket.send(messageStr);
                return true;
            } catch (error) {
                console.error('❌ 发送WebSocket消息失败:', error);
                return false;
            }
        } else {
            console.warn('⚠️ WebSocket未连接，无法发送消息');
            return false;
        }
    }

    /**
     * 订阅数据类型
     */
    subscribe(subscriptionType) {
        console.log('📋 订阅:', subscriptionType);

        return this.send({
            type: 'subscribe',
            subscription: subscriptionType
        });
    }

    /**
     * 取消订阅
     */
    unsubscribe(subscriptionType) {
        console.log('❌ 取消订阅:', subscriptionType);

        return this.send({
            type: 'unsubscribe',
            subscription: subscriptionType
        });
    }

    /**
     * 设置筛选器
     */
    setFilters(filters) {
        console.log('🔍 设置筛选器:', filters);

        return this.send({
            type: 'set_filters',
            filters: filters
        });
    }

    /**
     * 请求特定数据
     */
    requestData(requestType, params = {}) {
        console.log('📝 请求数据:', requestType, params);

        return this.send({
            type: 'request_data',
            request_type: requestType,
            ...params
        });
    }

    /**
     * 请求池子详情
     */
    requestPoolDetail(address) {
        return this.requestData('pool_detail', { address });
    }

    /**
     * 开始心跳检测
     */
    startPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.pingInterval = setInterval(() => {
            this.send({ type: 'ping' });
        }, this.pingInterval);
    }

    /**
     * 停止心跳检测
     */
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * 安排重连
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ 达到最大重连次数，停止重连');

            if (window.meteora) {
                window.meteora.showNotification(
                    'WebSocket连接失败，请检查网络连接',
                    'error',
                    10000
                );
            }
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            this.maxReconnectDelay
        );

        console.log(`⏰ ${delay / 1000}秒后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, delay);
    }

    /**
     * 更新连接状态显示
     */
    updateConnectionStatus(connected) {
        const statusIndicator = document.getElementById('connectionStatus');
        if (statusIndicator) {
            const icon = statusIndicator.querySelector('i');
            const text = statusIndicator.querySelector('small');

            if (connected) {
                icon.className = 'fas fa-circle text-success me-1';
                text.textContent = '实时连接';
            } else {
                icon.className = 'fas fa-circle text-warning me-1';
                text.textContent = '连接断开';
            }
        }

        // 更新核心模块状态
        if (window.meteora) {
            window.meteora.updateConnectionStatus(connected);
        }
    }

    /**
     * 更新系统状态显示
     */
    updateSystemStatus(statusData) {
        if (!statusData || !statusData.stats) return;

        // 更新总池数
        const totalPools = document.getElementById('totalPools');
        if (totalPools && statusData.stats.total_pools) {
            totalPools.textContent = window.meteora?.formatNumber(statusData.stats.total_pools) || statusData.stats.total_pools;
        }

        // 更新最后更新时间
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate && statusData.timestamp) {
            const updateTime = new Date(statusData.timestamp);
            lastUpdate.textContent = updateTime.toLocaleTimeString('zh-CN');
        }
    }

    /**
     * 注册消息处理器
     */
    onMessage(messageType, handler) {
        this.messageHandlers.set(messageType, handler);
    }

    /**
     * 移除消息处理器
     */
    offMessage(messageType) {
        this.messageHandlers.delete(messageType);
    }

    /**
     * 简单事件系统
     */
    emit(eventType, data) {
        // 触发全局事件
        if (window.meteora) {
            window.meteora.emit('websocket_' + eventType, data);
        }

        // 分发事件到相关模块
        switch (eventType) {
            case 'poolsUpdated':
                if (window.tableManager) {
                    window.tableManager.handleWebSocketUpdate(data);
                }
                if (window.chartManager) {
                    window.chartManager.handleDataUpdate(data.data);
                }
                break;

            case 'connected':
                // 自动订阅默认数据流
                setTimeout(() => {
                    this.subscribe('pools');
                    this.subscribe('system');
                    this.subscribe('alerts');  // 🔧 新增：订阅报警通知
                }, 500);
                break;
        }
    }

    /**
     * 手动断开连接
     */
    disconnect() {
        console.log('🔌 手动断开WebSocket连接');

        this.stopPing();
        this.reconnectAttempts = this.maxReconnectAttempts; // 阻止重连

        if (this.websocket) {
            this.websocket.close(1000, 'Manual disconnect');
        }
    }

    /**
     * 重新连接
     */
    reconnect() {
        console.log('🔄 手动重连WebSocket');

        this.disconnect();
        this.reconnectAttempts = 0;

        setTimeout(() => {
            this.connect();
        }, 1000);
    }

    /**
     * 获取连接状态
     */
    getStatus() {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            subscriptions: Array.from(this.subscriptions),
            socket: this.websocket ? {
                readyState: this.websocket.readyState,
                url: this.websocket.url,
                protocol: this.websocket.protocol
            } : null
        };
    }

    /**
     * 销毁WebSocket客户端
     */
    destroy() {
        this.disconnect();
        this.messageHandlers.clear();
        this.subscriptions.clear();

        // 🔧 清理报警池子追踪
        this.clearAlertedPools();

        console.log('🗑️ WebSocket客户端已销毁');
    }

    // 🔧 新增：报警池子管理方法

    /**
     * 添加报警池子
     * @param {string} poolAddress - 池子地址
     */
    addAlertedPool(poolAddress) {
        const currentTime = Date.now();
        this.alertedPools.set(poolAddress, currentTime);

        console.log(`🚨 记录报警池子: ${poolAddress}`);

        // 清理过期的报警记录
        this.cleanupExpiredAlerts();

        // 🔧 修复：增强表格管理器的调用和调试
        if (window.tableManager && typeof window.tableManager.markPoolAsAlerted === 'function') {
            console.log(`📋 调用表格管理器标记报警池子: ${poolAddress}`);
            window.tableManager.markPoolAsAlerted(poolAddress);

            // 🔧 验证标记是否成功
            setTimeout(() => {
                if (window.tableManager.isPoolAlerted(poolAddress)) {
                    console.log(`✅ 池子报警标记成功: ${poolAddress}`);
                } else {
                    console.warn(`⚠️ 池子报警标记失败: ${poolAddress}`);
                }
            }, 100);
        } else {
            console.warn('⚠️ 表格管理器未找到或markPoolAsAlerted方法不存在');
            console.log('可用的window对象:', Object.keys(window).filter(key => key.includes('table') || key.includes('Table')));
        }

        // 设置定时器，在指定时间后移除报警标记
        setTimeout(() => {
            this.removeAlertedPool(poolAddress);
        }, this.alertDuration);
    }

    /**
     * 移除报警池子
     * @param {string} poolAddress - 池子地址
     */
    removeAlertedPool(poolAddress) {
        if (this.alertedPools.has(poolAddress)) {
            this.alertedPools.delete(poolAddress);
            console.log(`🔕 移除报警池子: ${poolAddress}`);

            // 通知表格管理器更新显示
            if (window.tableManager) {
                window.tableManager.unmarkPoolAsAlerted(poolAddress);
            }
        }
    }

    /**
     * 检查池子是否正在报警
     * @param {string} poolAddress - 池子地址
     * @returns {boolean} - 是否正在报警
     */
    isPoolAlerted(poolAddress) {
        return this.alertedPools.has(poolAddress);
    }

    /**
     * 获取所有报警池子
     * @returns {Array} - 报警池子地址数组
     */
    getAlertedPools() {
        return Array.from(this.alertedPools.keys());
    }

    /**
     * 清理过期的报警记录
     */
    cleanupExpiredAlerts() {
        const currentTime = Date.now();
        const toRemove = [];

        for (const [poolAddress, alertTime] of this.alertedPools.entries()) {
            if (currentTime - alertTime > this.alertDuration) {
                toRemove.push(poolAddress);
            }
        }

        toRemove.forEach(poolAddress => {
            this.removeAlertedPool(poolAddress);
        });
    }

    /**
     * 清空所有报警池子
     */
    clearAlertedPools() {
        const alertedPools = Array.from(this.alertedPools.keys());
        this.alertedPools.clear();

        // 通知表格管理器清理所有报警标记
        if (window.tableManager) {
            alertedPools.forEach(poolAddress => {
                window.tableManager.unmarkPoolAsAlerted(poolAddress);
            });
        }

        console.log('🧹 已清空所有报警池子');
    }

    /**
     * 获取报警池子状态信息
     * @returns {Object} - 报警状态信息
     */
    getAlertStatus() {
        const currentTime = Date.now();
        const alertedPools = [];

        for (const [poolAddress, alertTime] of this.alertedPools.entries()) {
            const remainingTime = this.alertDuration - (currentTime - alertTime);
            alertedPools.push({
                address: poolAddress,
                alertTime: new Date(alertTime).toISOString(),
                remainingTime: Math.max(0, remainingTime),
                remainingMinutes: Math.max(0, Math.ceil(remainingTime / 60000))
            });
        }

        return {
            totalAlerted: this.alertedPools.size,
            alertDurationMinutes: this.alertDuration / 60000,
            alertedPools: alertedPools
        };
    }

    /**
     * 处理报警的备用方案
     * @param {Object} alertData - 报警数据
     */
    handleAlertFallback(alertData) {
        console.log('🚨 使用备用方案处理报警:', alertData);

        try {
            // 🔧 检查是否已有太多弹窗，避免界面被阻塞
            const existingNotifications = document.querySelectorAll('.fallback-alert-notification');
            if (existingNotifications.length >= 3) {
                console.warn('⚠️ 已有过多弹窗，跳过此次报警通知');
                // 只播放声音，不显示更多弹窗
                this.playSimpleAlert();
                return;
            }

            // 播放简单的提示音
            this.playSimpleAlert();

            // 显示轻量级通知（而不是模态框）
            this.showLightweightNotification(alertData);

            // 显示浏览器通知
            this.showBrowserNotification(alertData);

            // 更新页面标题
            this.updatePageTitleForAlert(alertData);

        } catch (error) {
            console.error('❌ 备用报警处理失败:', error);
        }
    }

    /**
     * 🔧 新增：显示轻量级通知（避免遮盖界面）
     */
    showLightweightNotification(alertData) {
        try {
            // 创建轻量级通知元素
            const notification = document.createElement('div');
            notification.className = 'fallback-alert-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(45deg, #ff4444, #ff6666);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(255, 68, 68, 0.3);
                z-index: 9998;
                max-width: 350px;
                font-size: 14px;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                cursor: pointer;
            `;

            notification.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="font-weight: bold; margin-bottom: 5px;">
                            🚨 ${alertData.pool_name}
                        </div>
                        <div style="font-size: 12px; opacity: 0.9;">
                            ${alertData.alert_type} ${alertData.change_type === 'increase' ? '📈' : '📉'} ${Math.abs(alertData.change_percent || 0).toFixed(1)}%
                        </div>
                    </div>
                    <div style="margin-left: 15px; font-size: 18px;">×</div>
                </div>
            `;

            // 点击关闭
            notification.addEventListener('click', () => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            });

            // 添加到页面
            document.body.appendChild(notification);

            // 动画显示
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);

            // 5秒后自动移除
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        if (notification.parentElement) {
                            notification.remove();
                        }
                    }, 300);
                }
            }, 5000);

            console.log('📢 显示轻量级报警通知');
        } catch (error) {
            console.warn('⚠️ 显示轻量级通知失败:', error);
        }
    }

    /**
     * 播放简单的报警声音
     */
    playSimpleAlert() {
        try {
            // 创建音频上下文
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // 设置简单的提示音
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);

            console.log('🔊 播放备用报警声音');
        } catch (error) {
            console.warn('⚠️ 无法播放备用报警声音:', error);
        }
    }

    /**
     * 显示浏览器通知
     */
    showBrowserNotification(alertData) {
        try {
            if ('Notification' in window) {
                // 请求通知权限
                if (Notification.permission === 'granted') {
                    new Notification('Meteora 报警提醒', {
                        body: `${alertData.pool_name} - ${alertData.alert_type} ${alertData.change_type} ${Math.abs(alertData.change_percent).toFixed(1)}%`,
                        icon: '/static/images/favicon.png',
                        tag: 'meteora-alert'
                    });
                } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            this.showBrowserNotification(alertData);
                        }
                    });
                }
            }
        } catch (error) {
            console.warn('⚠️ 无法显示浏览器通知:', error);
        }
    }

    /**
     * 更新页面标题显示报警
     */
    updatePageTitleForAlert(alertData) {
        try {
            const originalTitle = document.title;
            document.title = `🚨 新报警 - ${alertData.pool_name} - ${originalTitle}`;

            // 5秒后恢复原标题
            setTimeout(() => {
                document.title = originalTitle;
            }, 5000);
        } catch (error) {
            console.warn('⚠️ 无法更新页面标题:', error);
        }
    }

    /**
     * 🔧 新增：直接标记表格中的池子行为报警状态
     * @param {string} poolAddress - 池子地址
     * @param {string} poolName - 池子名称
     */
    markPoolRowAsAlerted(poolAddress, poolName) {
        try {
            console.log(`🎨 开始标记池子行为报警状态: ${poolName} (${poolAddress})`);

            // 方法1：通过池子地址查找行
            let targetRow = document.querySelector(`tr[data-address="${poolAddress}"]`);

            // 方法2：如果没找到，通过池子名称查找
            if (!targetRow) {
                const nameElements = document.querySelectorAll('.cell-pool-name');
                for (const element of nameElements) {
                    if (element.textContent.trim() === poolName) {
                        targetRow = element.closest('tr');
                        break;
                    }
                }
            }

            // 方法3：如果还没找到，通过包含池子名称的元素查找
            if (!targetRow) {
                const allRows = document.querySelectorAll('#poolsTable tbody tr');
                for (const row of allRows) {
                    const nameCell = row.querySelector('td:first-child') || row.querySelector('.cell-pool-name');
                    if (nameCell && nameCell.textContent.includes(poolName)) {
                        targetRow = row;
                        break;
                    }
                }
            }

            if (targetRow) {
                console.log(`✅ 找到目标池子行: ${poolName}`);

                // 添加报警行样式
                targetRow.classList.add('alert-pool-row');
                console.log(`📌 已添加alert-pool-row类到行`);

                // 查找池子名称单元格并添加报警样式
                const nameCell = targetRow.querySelector('.cell-pool-name') ||
                    targetRow.querySelector('td:first-child');

                if (nameCell) {
                    nameCell.classList.add('alert-pool-name');
                    console.log(`📌 已添加alert-pool-name类到池子名称`);

                    // 验证CSS动画是否应用
                    setTimeout(() => {
                        const computedStyle = window.getComputedStyle(nameCell);
                        const animation = computedStyle.animation || computedStyle.webkitAnimation;
                        if (animation && animation !== 'none') {
                            console.log(`✅ 池子 ${poolName} 动画已应用: ${animation}`);
                        } else {
                            console.warn(`⚠️ 池子 ${poolName} 动画未应用，检查CSS`);
                        }
                    }, 100);
                } else {
                    console.warn(`⚠️ 未找到池子名称单元格: ${poolName}`);
                }

                // 5分钟后自动移除报警样式
                setTimeout(() => {
                    this.removePoolRowAlertStyle(targetRow, poolName);
                }, 300000); // 5分钟

            } else {
                console.warn(`⚠️ 未找到池子行: ${poolName} (${poolAddress})`);
                console.log('当前表格中的池子:', this.getCurrentTablePools());
            }

        } catch (error) {
            console.error(`❌ 标记池子行报警状态失败: ${error}`);
        }
    }

    /**
     * 🔧 新增：移除池子行的报警样式
     * @param {Element} row - 表格行元素
     * @param {string} poolName - 池子名称
     */
    removePoolRowAlertStyle(row, poolName) {
        try {
            if (row && row.parentElement) {
                row.classList.remove('alert-pool-row');

                const nameCell = row.querySelector('.cell-pool-name') ||
                    row.querySelector('td:first-child');
                if (nameCell) {
                    nameCell.classList.remove('alert-pool-name');
                }

                console.log(`🔄 已移除池子 ${poolName} 的报警样式`);
            }
        } catch (error) {
            console.error(`❌ 移除池子报警样式失败: ${error}`);
        }
    }

    /**
     * 🔧 新增：获取当前表格中的池子列表（用于调试）
     */
    getCurrentTablePools() {
        try {
            const pools = [];
            const rows = document.querySelectorAll('#poolsTable tbody tr');

            rows.forEach((row, index) => {
                const nameCell = row.querySelector('.cell-pool-name') ||
                    row.querySelector('td:first-child');
                const address = row.getAttribute('data-address');

                if (nameCell) {
                    pools.push({
                        index: index,
                        name: nameCell.textContent.trim(),
                        address: address || 'unknown'
                    });
                }
            });

            return pools;
        } catch (error) {
            console.error('获取表格池子列表失败:', error);
            return [];
        }
    }

    /**
     * 🔧 新增：紧急清理所有通知
     */
    emergencyCleanupNotifications() {
        try {
            console.log('🚨 WebSocket客户端：紧急清理所有通知');

            // 清理轻量级通知
            const notifications = document.querySelectorAll('.fallback-alert-notification');
            notifications.forEach(notification => {
                if (notification.parentElement) {
                    notification.remove();
                }
            });

            // 清理报警池子标记
            this.clearAlertedPools();

            console.log('✅ WebSocket客户端清理完成');
        } catch (error) {
            console.error('❌ WebSocket客户端清理失败:', error);
        }
    }
}

// 创建全局实例
window.WebSocketClient = WebSocketClient;

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 稍微延迟初始化，确保其他模块先加载
    setTimeout(() => {
        window.websocketClient = new WebSocketClient();
    }, 1000);
}); 