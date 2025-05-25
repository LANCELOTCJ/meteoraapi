/**
 * Meteora监控平台 V2.0 - 主应用入口
 * 协调各个模块，处理应用级事件
 */

class MeteoraApp {
    constructor() {
        this.isInitialized = false;
        this.modules = {};
        this.config = {
            updateInterval: 30000,
            maxRetries: 3,
            retryDelay: 5000
        };

        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        try {
            console.log('🚀 Meteora应用初始化开始...');

            this.showGlobalLoading();

            // 等待模块加载
            console.log('📦 等待模块加载...');
            await this.waitForModules();

            // 设置模块引用
            console.log('🔗 设置模块引用...');
            this.setupModuleReferences();

            // 设置事件监听器
            console.log('👂 设置事件监听器...');
            this.setupEventListeners();

            // 设置按钮事件
            this.setupButtonEvents();

            // 设置模态框事件
            this.setupModalEvents();

            // 设置应用功能
            this.setupApplicationFeatures();

            // 初始化提示工具
            this.initializeTooltips();

            // 设置键盘快捷键
            this.setupKeyboardShortcuts();

            // 设置主题切换
            this.setupThemeToggle();

            // 设置自动保存
            this.setupAutoSave();

            // 执行初始数据加载
            console.log('📊 执行初始数据加载...');
            await this.initialDataLoad();

            this.isInitialized = true;
            this.hideGlobalLoading();

            console.log('✅ Meteora应用初始化完成 - 界面已准备就绪');

        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            this.hideGlobalLoading(); // 确保移除加载状态
            this.showInitializationError(error);
        }
    }

    /**
     * 等待所有模块加载完成
     */
    async waitForModules() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5秒超时

            const checkModules = () => {
                attempts++;

                const requiredModules = ['meteora', 'filterManager', 'tableManager', 'configManager'];
                const loadedModules = requiredModules.filter(module => window[module]);

                console.log(`模块加载进度: ${loadedModules.length}/${requiredModules.length}`,
                    `已加载: [${loadedModules.join(', ')}]`);

                if (loadedModules.length === requiredModules.length) {
                    console.log('✅ 所有必需模块已加载');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    const missingModules = requiredModules.filter(module => !window[module]);
                    console.warn(`⚠️ 模块加载超时，缺少: [${missingModules.join(', ')}]`);

                    // 如果核心模块已加载，允许继续
                    if (window.meteora) {
                        console.log('核心模块已加载，允许应用继续初始化');
                        resolve();
                    } else {
                        reject(new Error(`关键模块未加载: ${missingModules.join(', ')}`));
                    }
                } else {
                    setTimeout(checkModules, 100);
                }
            };

            checkModules();
        });
    }

    /**
     * 设置模块引用
     */
    setupModuleReferences() {
        this.modules = {
            core: window.meteora,
            filter: window.filterManager,
            table: window.tableManager,
            config: window.configManager
        };

        // 建立模块间的交叉引用
        if (this.modules.core) {
            this.modules.core.modules = this.modules;
        }

        console.log('🔗 模块引用设置完成');
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听核心事件
        if (this.modules.core) {
            this.modules.core.on('dataRefreshStart', this.handleDataRefreshStart.bind(this));
            this.modules.core.on('dataRefreshSuccess', this.handleDataRefreshSuccess.bind(this));
            this.modules.core.on('dataRefreshError', this.handleDataRefreshError.bind(this));
        }

        // 监听筛选器事件
        if (this.modules.filter) {
            this.modules.core.on('filtersApplied', this.handleFiltersApplied.bind(this));
        }

        // 监听页面关闭事件
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

        console.log('👂 事件监听器设置完成');
    }

    /**
     * 设置按钮事件
     */
    setupButtonEvents() {
        // 设置按钮
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', this.showSettingsModal.bind(this));
        }

        // 视图切换按钮
        const tableViewBtn = document.getElementById('tableViewBtn');
        const chartViewBtn = document.getElementById('chartViewBtn');
        const alertViewBtn = document.getElementById('alertViewBtn');

        if (tableViewBtn) {
            tableViewBtn.addEventListener('click', () => this.switchView('table'));
        }
        if (chartViewBtn) {
            chartViewBtn.addEventListener('click', () => this.switchView('chart'));
        }
        if (alertViewBtn) {
            alertViewBtn.addEventListener('click', () => this.switchView('alert'));
        }

        // 清除筛选器按钮 - 修复调用方式
        const clearFiltersBtn = document.getElementById('clearFiltersBtn2');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                if (this.modules.filter) {
                    this.modules.filter.clearAllFilters();
                } else {
                    console.warn('筛选器模块未加载');
                }
            });
        }

        // 报警记录相关按钮
        const refreshAlertRecords = document.getElementById('refreshAlertRecords');
        const clearAlertRecordsBtn = document.getElementById('clearAlertRecordsBtn');

        if (refreshAlertRecords) {
            refreshAlertRecords.addEventListener('click', this.loadAlertRecords.bind(this));
        }
        if (clearAlertRecordsBtn) {
            clearAlertRecordsBtn.addEventListener('click', this.clearAlertRecords.bind(this));
        }
    }

    /**
     * 切换视图
     */
    switchView(viewType) {
        // 更新按钮状态
        document.querySelectorAll('.view-switcher .btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeBtn = document.querySelector(`[data-view="${viewType}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // 隐藏所有视图
        document.querySelectorAll('.view-content').forEach(view => {
            view.classList.add('d-none');
        });

        // 显示选中的视图
        const targetView = document.getElementById(`${viewType}View`);
        if (targetView) {
            targetView.classList.remove('d-none');
        }

        // 更新页面标题
        const pageTitle = document.getElementById('pageTitle');
        const titleMap = {
            'table': '<i class="fas fa-table me-2 text-accent-cyan"></i>数据表格',
            'chart': '<i class="fas fa-chart-bar me-2 text-accent-cyan"></i>图表分析',
            'alert': '<i class="fas fa-bell me-2 text-accent-cyan"></i>报警记录'
        };

        if (pageTitle && titleMap[viewType]) {
            pageTitle.innerHTML = titleMap[viewType];
        }

        // 根据视图类型执行相应的初始化
        switch (viewType) {
            case 'table':
                // 表格视图已经在应用初始化时加载
                break;
            case 'chart':
                // 图表视图的初始化（暂时为占位符）
                this.initializeChartView();
                break;
            case 'alert':
                // 报警记录视图的初始化
                this.initializeAlertView();
                break;
        }

        console.log(`✅ 切换到 ${viewType} 视图`);
    }

    /**
     * 初始化图表视图
     */
    initializeChartView() {
        // 图表功能的初始化逻辑
        console.log('📈 初始化图表视图...');
        // TODO: 在这里添加图表初始化代码
    }

    /**
     * 初始化报警视图
     */
    initializeAlertView() {
        console.log('🚨 初始化报警视图...');
        // 加载报警记录
        this.loadAlertRecords();
    }

    /**
     * 设置模态框事件
     */
    setupModalEvents() {
        // 保存设置按钮
        const saveSettings = document.getElementById('saveSettings');
        if (saveSettings) {
            saveSettings.addEventListener('click', this.saveSettings.bind(this));
        }

        // 报警设置相关事件
        this.setupAlertSettingsEvents();
    }

    /**
     * 设置报警设置相关事件
     */
    setupAlertSettingsEvents() {
        // 测试声音按钮
        const testAlertSound = document.getElementById('testAlertSound');
        if (testAlertSound) {
            testAlertSound.addEventListener('click', this.testAlertSound.bind(this));
        }
    }

    /**
     * 设置应用功能
     */
    setupApplicationFeatures() {
        // 加载用户设置
        this.loadUserSettings();

        // 加载报警配置
        this.loadAlertConfiguration();

        // 设置报警实时检查
        this.setupAlertMonitoring();

        // 设置页面标题动态更新
        this.setupPageTitleUpdates();

        // 设置网络状态监听
        this.setupNetworkStatusListener();

        // 设置性能监控
        this.setupPerformanceMonitoring();

        console.log('✅ 应用功能设置完成');
    }

    /**
     * 初始化提示工具
     */
    initializeTooltips() {
        // 如果Bootstrap可用，初始化所有tooltips
        if (typeof bootstrap !== 'undefined') {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }
    }

    /**
     * 设置键盘快捷键
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // 🔧 紧急功能：Ctrl+Shift+C 或 Alt+C: 紧急关闭所有弹窗
            if ((event.ctrlKey && event.shiftKey && event.key === 'C') ||
                (event.altKey && event.key === 'c')) {
                event.preventDefault();
                this.emergencyCloseAll();
                return;
            }

            // ESC: 关闭报警通知弹窗
            if (event.key === 'Escape') {
                this.closeAllAlertNotifications();
                return;
            }

            // Alt + S: 打开设置
            if (event.altKey && event.key === 's') {
                event.preventDefault();
                this.showSettingsModal();
                return;
            }

            // Alt + H: 显示帮助
            if (event.altKey && event.key === 'h') {
                event.preventDefault();
                this.showHelp();
                return;
            }
        });
    }

    /**
     * 🔧 新增：紧急关闭所有弹窗和遮罩
     */
    emergencyCloseAll() {
        try {
            console.log('🚨 紧急关闭所有弹窗和遮罩');

            // 关闭所有报警通知
            this.closeAllAlertNotifications();

            // 🔧 调用WebSocket客户端的清理方法
            if (window.websocketClient && typeof window.websocketClient.emergencyCleanupNotifications === 'function') {
                window.websocketClient.emergencyCleanupNotifications();
            }

            // 关闭所有可能的模态框
            const modals = document.querySelectorAll('.modal, .modal-backdrop, .offcanvas-backdrop');
            modals.forEach(modal => {
                if (modal.parentElement) {
                    modal.remove();
                }
            });

            // 🔧 关闭所有Bootstrap模态框实例
            if (typeof bootstrap !== 'undefined') {
                document.querySelectorAll('.modal').forEach(modalEl => {
                    const modalInstance = bootstrap.Modal.getInstance(modalEl);
                    if (modalInstance) {
                        modalInstance.hide();
                    }
                });
            }

            // 关闭所有可能的弹出层和通知
            const overlays = document.querySelectorAll('[style*="z-index"], .toast, .alert, .notification');
            overlays.forEach(overlay => {
                const zIndex = parseInt(overlay.style.zIndex);
                if (zIndex && zIndex > 1000) {
                    if (overlay.parentElement) {
                        overlay.remove();
                    }
                } else if (overlay.classList.contains('toast') ||
                    overlay.classList.contains('alert') ||
                    overlay.classList.contains('notification')) {
                    if (overlay.parentElement) {
                        overlay.remove();
                    }
                }
            });

            // 🔧 清理所有轻量级通知
            const lightweightNotifications = document.querySelectorAll('.fallback-alert-notification, .notification-item, .toast-item');
            lightweightNotifications.forEach(notification => {
                if (notification.parentElement) {
                    notification.remove();
                }
            });

            // 移除可能的loading状态
            document.body.classList.remove('app-loading', 'modal-open');

            // 恢复body的样式
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';

            // 🔧 清理所有动画和定时器
            const animatedElements = document.querySelectorAll('[style*="animation"]');
            animatedElements.forEach(element => {
                element.style.animation = '';
            });

            // 🔧 移除所有可能的事件监听器遮罩
            const eventBlockers = document.querySelectorAll('.event-blocker, .overlay, .mask');
            eventBlockers.forEach(blocker => {
                if (blocker.parentElement) {
                    blocker.remove();
                }
            });

            // 显示成功提示（延迟显示，避免被立即清理）
            setTimeout(() => {
                if (this.modules.core) {
                    this.modules.core.showNotification('✅ 已清除所有弹窗和通知', 'success', 2000);
                }
            }, 100);

            console.log('✅ 紧急清理完成 - 界面应该已恢复正常');
        } catch (error) {
            console.error('❌ 紧急清理失败:', error);

            // 最后的强制清理手段
            try {
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
                document.body.classList.remove('app-loading', 'modal-open');

                // 强制移除所有高z-index元素
                const allElements = document.querySelectorAll('*');
                allElements.forEach(element => {
                    const zIndex = parseInt(window.getComputedStyle(element).zIndex);
                    if (zIndex && zIndex > 5000) {
                        element.style.display = 'none';
                    }
                });

                console.log('🔧 执行了强制清理');
            } catch (forceError) {
                console.error('❌ 强制清理也失败:', forceError);
            }
        }
    }

    /**
     * 设置主题切换
     */
    setupThemeToggle() {
        // 从本地存储加载主题
        const savedTheme = localStorage.getItem('meteora_theme') || 'meteora';
        this.changeTheme(savedTheme);

        // 监听主题选择器变化
        const themeColor = document.getElementById('themeColor');
        if (themeColor) {
            themeColor.value = savedTheme;
            themeColor.addEventListener('change', (e) => {
                this.changeTheme(e.target.value);
            });
        }
    }

    /**
     * 设置自动保存
     */
    setupAutoSave() {
        // 每30秒自动保存用户配置
        setInterval(() => {
            this.autoSaveUserConfig();
        }, 30000);
    }

    /**
     * 执行初始数据加载
     */
    async initialDataLoad() {
        try {
            console.log('📊 开始初始数据加载...');

            // 加载系统状态 (不阻塞初始化)
            this.loadSystemStatus().catch(error => {
                console.warn('系统状态加载失败，但不影响初始化:', error);
            });

            // 重写核心的refreshData方法
            if (this.modules.core) {
                const originalRefresh = this.modules.core.refreshData;
                this.modules.core.refreshData = async (force = false) => {
                    try {
                        this.modules.core.emit('dataRefreshStart', force);

                        // 执行数据加载
                        if (this.modules.table) {
                            await this.modules.table.loadData(force);
                        }

                        this.modules.core.emit('dataRefreshSuccess');
                    } catch (error) {
                        this.modules.core.emit('dataRefreshError', error);
                    }
                };
            }

            // 触发初始数据加载 (使用超时保护)
            if (this.modules.table) {
                try {
                    // 设置5秒超时
                    const loadPromise = this.modules.table.loadData();
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('数据加载超时')), 5000)
                    );

                    await Promise.race([loadPromise, timeoutPromise]);
                    console.log('✅ 初始数据加载完成');
                } catch (error) {
                    console.warn('⚠️ 初始数据加载失败，但应用将继续运行:', error);
                    // 数据加载失败不阻止应用初始化
                }
            }

            // 数据加载完成后，恢复筛选器状态
            this.restoreUserFilters();

        } catch (error) {
            console.error('❌ 初始数据加载失败:', error);
            // 不再抛出错误，允许应用继续初始化
        }
    }

    /**
     * 恢复用户筛选器状态
     */
    restoreUserFilters() {
        setTimeout(() => {
            if (this.modules.filter) {
                // 触发筛选器状态恢复
                this.modules.filter.restoreFiltersToUI();
                console.log('🔄 用户筛选器状态已恢复');
            } else {
                console.warn('⚠️ 筛选器模块未加载，无法恢复筛选状态');
            }
        }, 500); // 延迟500ms确保所有模块都已初始化完成
    }

    /**
     * 加载系统状态
     */
    async loadSystemStatus() {
        try {
            if (this.modules.core) {
                const status = await this.modules.core.apiRequest('/health');
                this.updateSystemStatus(status);
            }
        } catch (error) {
            console.warn('系统状态加载失败:', error);
        }
    }

    /**
     * 更新系统状态显示
     */
    updateSystemStatus(status) {
        if (status && status.stats) {
            const totalPools = document.getElementById('totalPools');
            if (totalPools && status.stats.total_pools) {
                totalPools.textContent = this.modules.core.formatNumber(status.stats.total_pools);
            }
        }
    }

    /**
     * 处理数据刷新开始
     */
    handleDataRefreshStart(force) {
        console.log('🔄 数据刷新开始...', force ? '(强制)' : '');

        // 更新刷新按钮状态
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            const icon = refreshBtn.querySelector('i');
            if (icon) {
                icon.classList.add('fa-spin');
            }
        }
    }

    /**
     * 处理数据刷新成功
     */
    handleDataRefreshSuccess() {
        console.log('✅ 数据刷新完成');

        // 恢复刷新按钮状态
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.disabled = false;
            const icon = refreshBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-spin');
            }
        }

        // 显示成功通知
        if (this.modules.core) {
            this.modules.core.showNotification('数据已更新', 'success', 2000);
        }
    }

    /**
     * 处理数据刷新错误
     */
    handleDataRefreshError(error) {
        console.error('❌ 数据刷新失败:', error);

        // 恢复刷新按钮状态
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.disabled = false;
            const icon = refreshBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-spin');
            }
        }

        // 显示错误通知
        if (this.modules.core) {
            this.modules.core.showNotification(
                '数据刷新失败: ' + error.message,
                'error',
                5000
            );
        }
    }

    /**
     * 处理筛选器应用
     */
    handleFiltersApplied(filters) {
        console.log('🔍 筛选器已应用:', filters);
    }

    /**
     * 显示设置模态框
     */
    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal && typeof bootstrap !== 'undefined') {
            // 🔧 修复：先清理可能的遮盖状态
            this.emergencyCloseAll();

            const bsModal = new bootstrap.Modal(modal);
            this.loadSettingsForm();

            // 🔧 修复：添加报警配置加载
            this.loadAlertConfiguration();

            // 🔧 修复：添加模态框关闭事件监听
            modal.addEventListener('hidden.bs.modal', () => {
                // 确保模态框完全关闭后清理遮盖状态
                setTimeout(() => {
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.paddingRight = '';

                    // 移除可能残留的backdrop
                    const backdrops = document.querySelectorAll('.modal-backdrop');
                    backdrops.forEach(backdrop => {
                        if (backdrop.parentElement) {
                            backdrop.remove();
                        }
                    });
                }, 100);
            }, { once: true }); // 只监听一次

            bsModal.show();
        }
    }

    /**
     * 加载设置表单
     */
    loadSettingsForm() {
        const settings = this.loadUserSettings();

        // 设置表单值
        const formElements = {
            'themeColor': settings.themeColor || 'meteora',
            'fontSize': settings.fontSize || 'normal',
            'dataDensity': settings.dataDensity || 'normal',
            'animations': settings.animations || 'normal',
            'autoRefresh': settings.autoRefresh !== false,
            'refreshInterval': settings.refreshInterval || 30,
            'backgroundUpdate': settings.backgroundUpdate !== false
        };

        Object.entries(formElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
            }
        });
    }

    /**
     * 保存设置
     */
    async saveSettings() {
        try {
            const settings = this.collectSettingsFromForm();
            this.applySettings(settings);
            this.saveCurrentConfig(settings);

            // 同时保存报警配置
            await this.saveAlertConfiguration();

            // 关闭模态框
            const modal = document.getElementById('settingsModal');
            if (modal && typeof bootstrap !== 'undefined') {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) {
                    bsModal.hide();
                }
            }

            // 显示成功通知
            if (this.modules.core) {
                this.modules.core.showNotification('设置已保存', 'success', 2000);
            }

        } catch (error) {
            console.error('保存设置失败:', error);
            if (this.modules.core) {
                this.modules.core.showNotification('保存设置失败', 'error', 3000);
            }
        }
    }

    /**
     * 从表单收集设置
     */
    collectSettingsFromForm() {
        const settings = {};

        const formElements = [
            'themeColor', 'fontSize', 'dataDensity', 'animations',
            'autoRefresh', 'refreshInterval', 'backgroundUpdate',
            'enableAlertsSystem', 'liquidityThreshold', 'volumeThreshold',
            'fees24hThreshold', 'fees1hThreshold', 'soundAlertsEnabled', 'alertSoundVolume',
            'enableAlerts', 'newPoolAlert', 'soundAlerts', 'soundVolume',
            'apyChangeThreshold'
        ];

        formElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') {
                    settings[id] = element.checked;
                } else if (element.type === 'range' || element.type === 'number') {
                    settings[id] = parseFloat(element.value);
                } else {
                    settings[id] = element.value;
                }
            }
        });

        return settings;
    }

    /**
     * 应用设置
     */
    applySettings(settings) {
        // 应用主题
        if (settings.themeColor) {
            this.changeTheme(settings.themeColor);
        }

        // 应用字体大小
        if (settings.fontSize) {
            document.body.className = document.body.className.replace(/font-size-\w+/g, '');
            document.body.classList.add(`font-size-${settings.fontSize}`);
        }

        // 应用数据密度
        if (settings.dataDensity) {
            document.body.className = document.body.className.replace(/density-\w+/g, '');
            document.body.classList.add(`density-${settings.dataDensity}`);
        }

        // 应用动画设置
        if (settings.animations) {
            document.body.className = document.body.className.replace(/animations-\w+/g, '');
            document.body.classList.add(`animations-${settings.animations}`);
        }

        // 更新核心配置
        if (this.modules.core) {
            this.modules.core.config.autoRefresh = settings.autoRefresh;
            this.modules.core.config.refreshInterval = (settings.refreshInterval || 30) * 1000;

            // 重启自动刷新
            if (settings.autoRefresh) {
                this.modules.core.startAutoRefresh();
            } else {
                this.modules.core.pauseAutoRefresh();
            }
        }
    }

    /**
     * 加载用户设置
     */
    loadUserSettings() {
        try {
            const saved = localStorage.getItem('meteora_app_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.applySettings(settings);
                return settings;
            }
        } catch (error) {
            console.warn('加载用户设置失败:', error);
        }

        return {
            themeColor: 'meteora',
            fontSize: 'normal',
            dataDensity: 'normal',
            animations: 'normal',
            autoRefresh: true,
            refreshInterval: 30,
            backgroundUpdate: true,
            enableAlertsSystem: false,
            liquidityThreshold: 20.0,
            volumeThreshold: 20.0,
            fees24hThreshold: 20.0,
            fees1hThreshold: 20.0,
            soundAlertsEnabled: true,
            alertSoundVolume: 70,
            enableAlerts: true,
            newPoolAlert: true,
            soundAlerts: true,
            soundVolume: 70,
            apyChangeThreshold: 20
        };
    }

    /**
     * 更改主题
     */
    changeTheme(theme) {
        document.body.className = document.body.className.replace(/theme-\w+/g, '');
        document.body.classList.add(`theme-${theme}`);

        localStorage.setItem('meteora_theme', theme);
    }

    /**
     * 保存当前配置
     */
    saveCurrentConfig(settings = null) {
        try {
            const config = settings || this.collectSettingsFromForm();
            config.timestamp = new Date().toISOString();

            localStorage.setItem('meteora_app_settings', JSON.stringify(config));
        } catch (error) {
            console.error('保存配置失败:', error);
        }
    }

    /**
     * 自动保存用户配置
     */
    autoSaveUserConfig() {
        try {
            const appState = this.getAppState();

            const autoSaveData = {
                timestamp: new Date().toISOString(),
                appState: appState,
                modules: {
                    filters: this.modules.filter?.getFilters(),
                    tableConfig: this.modules.table?.getCurrentConfig?.(),
                    fieldConfig: this.modules.config?.getCurrentConfig?.()
                }
            };

            localStorage.setItem('meteora_auto_save', JSON.stringify(autoSaveData));

        } catch (error) {
            console.warn('自动保存失败:', error);
        }
    }

    /**
     * 显示帮助信息
     */
    showHelp() {
        const helpContent = `
        <div class="help-content">
            <h5>键盘快捷键</h5>
            <ul>
                <li><kbd>Ctrl</kbd> + <kbd>R</kbd> - 刷新数据</li>
                <li><kbd>Ctrl</kbd> + <kbd>F</kbd> - 聚焦搜索框</li>
                <li><kbd>Esc</kbd> - 清除筛选器</li>
                <li><kbd>Alt</kbd> + <kbd>S</kbd> - 打开设置</li>
                <li><kbd>Alt</kbd> + <kbd>H</kbd> - 显示帮助</li>
            </ul>
            
            <h5>功能说明</h5>
            <ul>
                <li>使用左侧筛选面板快速筛选池子</li>
                <li>点击表格标题进行排序</li>
                <li>右键点击表格行显示上下文菜单</li>
                <li>拖拽字段配置面板中的字段进行排序</li>
            </ul>
        </div>
        `;

        if (this.modules.core) {
            // 创建帮助模态框或通知
            this.modules.core.showNotification(helpContent, 'info', 10000);
        }
    }

    /**
     * 显示全局加载状态
     */
    showGlobalLoading() {
        document.body.classList.add('app-loading');
    }

    /**
     * 隐藏全局加载状态
     */
    hideGlobalLoading() {
        document.body.classList.remove('app-loading');
    }

    /**
     * 显示初始化错误
     */
    showInitializationError(error) {
        const errorHTML = `
            <div class="alert alert-danger" role="alert">
                <h4 class="alert-heading">应用初始化失败</h4>
                <p>抱歉，应用无法正常启动。请尝试刷新页面或联系管理员。</p>
                <hr>
                <p class="mb-0"><small>错误详情: ${error.message}</small></p>
            </div>
        `;

        const container = document.querySelector('.main-content') || document.body;
        container.innerHTML = errorHTML;
    }

    /**
     * 处理页面关闭前事件
     */
    handleBeforeUnload(event) {
        // 保存当前状态
        this.autoSaveUserConfig();

        // 如果有未保存的更改，提示用户
        const hasUnsavedChanges = false; // 这里可以检查是否有未保存的更改
        if (hasUnsavedChanges) {
            event.preventDefault();
            event.returnValue = '您有未保存的更改，确定要离开吗？';
            return event.returnValue;
        }
    }

    /**
     * 获取应用状态
     */
    getAppState() {
        return {
            isInitialized: this.isInitialized,
            currentPage: this.modules.table?.currentPage || 1,
            pageSize: this.modules.table?.pageSize || 100,
            sortConfig: this.modules.table?.sortConfig || { field: 'liquidity', direction: 'DESC' }
        };
    }

    /**
     * 销毁应用
     */
    destroy() {
        // 保存最终状态
        this.autoSaveUserConfig();

        // 停止报警监控
        this.stopAlertMonitoring();

        // 销毁各模块
        Object.values(this.modules).forEach(module => {
            if (module && typeof module.destroy === 'function') {
                module.destroy();
            }
        });

        console.log('💫 Meteora应用已销毁');
    }

    /**
     * 设置页面标题动态更新
     */
    setupPageTitleUpdates() {
        if (this.modules.core) {
            this.modules.core.on('dataRefreshSuccess', () => {
                const totalPools = this.modules.core.state.totalPools;
                if (totalPools > 0) {
                    document.title = `Meteora监控平台 (${totalPools}池) - V2.0`;
                }
            });
        }
    }

    /**
     * 设置网络状态监听
     */
    setupNetworkStatusListener() {
        window.addEventListener('online', () => {
            if (this.modules.core) {
                this.modules.core.updateConnectionStatus(true);
                this.modules.core.showNotification('网络连接已恢复', 'success', 3000);
            }
        });

        window.addEventListener('offline', () => {
            if (this.modules.core) {
                this.modules.core.updateConnectionStatus(false);
                this.modules.core.showNotification('网络连接已断开', 'warning', 5000);
            }
        });
    }

    /**
     * 设置性能监控
     */
    setupPerformanceMonitoring() {
        // 监控页面性能
        if (window.performance && window.performance.mark) {
            window.performance.mark('app-init-complete');
        }

        // 监控内存使用
        if (window.performance && window.performance.memory) {
            console.log('内存使用情况:', {
                used: Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                total: Math.round(window.performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                limit: Math.round(window.performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
            });
        }
    }

    // ==================== 报警设置功能方法 ====================

    /**
     * 测试报警声音
     */
    async testAlertSound() {
        try {
            // 使用强制测试方法
            await this.forceTestAlertSound();

            // 同时调用API测试
            if (this.modules.core) {
                const response = await this.modules.core.apiRequest('/alerts/test-sound', {
                    method: 'POST'
                });

                if (response.success) {
                    this.modules.core.showNotification('🔊 声音测试完成', 'success', 2000);
                } else {
                    this.modules.core.showNotification('❌ 声音测试失败', 'error', 3000);
                }
            }
        } catch (error) {
            console.error('测试声音失败:', error);
            if (this.modules.core) {
                this.modules.core.showNotification('❌ 声音测试失败', 'error', 3000);
            }
        }
    }

    /**
     * 强制测试报警声音
     */
    async forceTestAlertSound() {
        console.log('🔊 强制测试报警声音...');

        // 请求音频权限
        await this.requestAudioPermission();

        // 播放测试声音
        await this.playMultipleAlertSounds();

        // 显示测试通知
        if (this.modules.core) {
            this.modules.core.showNotification('🔊 报警声音测试完成', 'info', 3000);
        }
    }

    /**
     * 请求音频权限
     */
    async requestAudioPermission() {
        try {
            // 创建一个静音的音频上下文来获取权限
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // 如果音频上下文被暂停，尝试恢复
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            console.log('🔊 音频权限已获取，音频上下文状态:', audioContext.state);

            // 存储音频上下文供后续使用
            this.audioContext = audioContext;

        } catch (error) {
            console.warn('⚠️ 无法获取音频权限:', error);
            this.soundEnabled = false;
        }
    }

    /**
     * 播放多种报警声音
     */
    async playMultipleAlertSounds() {
        try {
            // 检查是否启用声音
            const soundEnabled = await this.isAlertSoundEnabled();
            if (!soundEnabled || !this.soundEnabled) {
                console.log('🔇 报警声音已禁用');
                return;
            }

            // 获取音量设置
            const volume = await this.getAlertSoundVolume();

            // 方式1: 使用音频上下文播放（主要方式）
            this.playAlertSoundWithVolume(volume);

            // 方式2: 尝试播放HTML5音频（备用方式）
            setTimeout(() => {
                this.playHTMLAudio(volume);
            }, 200);

            // 方式3: 浏览器beep声音（再备用）
            setTimeout(() => {
                this.playBrowserBeep();
            }, 400);

            console.log('🔊 已播放多重报警声音');

        } catch (error) {
            console.warn('播放报警声音失败:', error);
            // 即使音频失败，也要有视觉提示
            this.flashPageForAlert();
        }
    }

    /**
     * 播放HTML5音频
     */
    playHTMLAudio(volume) {
        try {
            // 创建音频数据URL（短蜂鸣声）
            const audioData = this.generateBeepAudioData(volume);
            const audio = new Audio(audioData);
            audio.volume = volume;
            audio.play().catch(error => {
                console.warn('HTML5音频播放失败:', error);
            });
        } catch (error) {
            console.warn('创建HTML5音频失败:', error);
        }
    }

    /**
     * 生成蜂鸣声音频数据
     */
    generateBeepAudioData(volume) {
        try {
            const sampleRate = 44100;
            const duration = 0.3; // 0.3秒
            const frequency = 800; // 800Hz
            const samples = sampleRate * duration;

            const buffer = new ArrayBuffer(44 + samples * 2);
            const view = new DataView(buffer);

            // WAV文件头
            const writeString = (offset, string) => {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            };

            writeString(0, 'RIFF');
            view.setUint32(4, 36 + samples * 2, true);
            writeString(8, 'WAVE');
            writeString(12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            writeString(36, 'data');
            view.setUint32(40, samples * 2, true);

            // 生成音频数据
            for (let i = 0; i < samples; i++) {
                const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * volume * 32767;
                view.setInt16(44 + i * 2, sample, true);
            }

            const blob = new Blob([buffer], { type: 'audio/wav' });
            return URL.createObjectURL(blob);
        } catch (error) {
            console.warn('生成音频数据失败:', error);
            return null;
        }
    }

    /**
     * 播放浏览器蜂鸣声
     */
    playBrowserBeep() {
        try {
            // 尝试使用console.log触发声音（某些浏览器支持）
            console.log('\x07'); // ASCII蜂鸣符

            // 创建短暂的高频振动（移动设备）
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
        } catch (error) {
            console.warn('浏览器蜂鸣失败:', error);
        }
    }

    /**
     * 页面闪烁提示
     */
    flashPageForAlert() {
        try {
            const body = document.body;
            const originalBg = body.style.backgroundColor;

            // 红色闪烁3次
            let flashCount = 0;
            const flashInterval = setInterval(() => {
                if (flashCount % 2 === 0) {
                    body.style.backgroundColor = '#ff4444';
                } else {
                    body.style.backgroundColor = originalBg;
                }

                flashCount++;
                if (flashCount >= 6) {
                    clearInterval(flashInterval);
                    body.style.backgroundColor = originalBg;
                }
            }, 200);

            console.log('⚡ 页面闪烁报警提示');
        } catch (error) {
            console.warn('页面闪烁失败:', error);
        }
    }

    /**
     * 显示醒目的页面通知
     */
    showProminentAlertNotification(alert) {
        try {
            // 🔧 修复：防止多个弹窗叠加，先关闭已存在的报警弹窗
            this.closeAllAlertNotifications();

            // 创建背景遮罩
            const backdrop = document.createElement('div');
            backdrop.className = 'alert-notification-backdrop';
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 9999;
                backdrop-filter: blur(2px);
            `;

            // 点击背景关闭弹窗
            backdrop.addEventListener('click', () => {
                this.closeAllAlertNotifications();
            });

            // 创建大型警告弹窗
            const alertDialog = document.createElement('div');
            alertDialog.className = 'alert-notification-dialog';
            alertDialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(45deg, #ff4444, #ff6666);
                color: white;
                padding: 30px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(255, 68, 68, 0.8);
                z-index: 10000;
                text-align: center;
                font-size: 18px;
                font-weight: bold;
                max-width: 500px;
                min-width: 350px;
                animation: alertSlideIn 0.3s ease-out;
            `;

            // 添加CSS动画
            if (!document.getElementById('alertAnimationStyle')) {
                const style = document.createElement('style');
                style.id = 'alertAnimationStyle';
                style.textContent = `
                    @keyframes alertSlideIn {
                        from { 
                            transform: translate(-50%, -50%) scale(0.7);
                            opacity: 0;
                        }
                        to { 
                            transform: translate(-50%, -50%) scale(1);
                            opacity: 1;
                        }
                    }
                    @keyframes alertSlideOut {
                        from { 
                            transform: translate(-50%, -50%) scale(1);
                            opacity: 1;
                        }
                        to { 
                            transform: translate(-50%, -50%) scale(0.7);
                            opacity: 0;
                        }
                    }
                    .alert-notification-dialog.closing {
                        animation: alertSlideOut 0.2s ease-in forwards;
                    }
                `;
                document.head.appendChild(style);
            }

            alertDialog.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 15px;">🚨</div>
                <div style="font-size: 24px; margin-bottom: 10px;">报警提示</div>
                <div style="font-size: 16px; margin-bottom: 20px; line-height: 1.4;">
                    <strong>${alert.pool_name}</strong><br>
                    ${this.getAlertTypeDisplayName(alert.alert_type)} 
                    ${alert.change_type === 'increase' ? '📈 上升' : '📉 下降'} 
                    <span style="color: #ffeb3b; font-weight: bold;">${alert.change_percent?.toFixed(1) || '0.0'}%</span>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="alert-close-btn" style="
                        background: white;
                        color: #ff4444;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">知道了</button>
                    <button class="alert-details-btn" style="
                        background: rgba(255, 255, 255, 0.2);
                        color: white;
                        border: 1px solid white;
                        padding: 10px 20px;
                        border-radius: 5px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">查看详情</button>
                </div>
                <div style="margin-top: 15px; font-size: 12px; opacity: 0.8;">
                    <span id="autoCloseCountdown">5</span>秒后自动关闭 | 按ESC键关闭
                </div>
            `;

            // 添加按钮事件
            const closeBtn = alertDialog.querySelector('.alert-close-btn');
            const detailsBtn = alertDialog.querySelector('.alert-details-btn');

            closeBtn.addEventListener('click', () => {
                this.closeAlertNotificationWithAnimation(backdrop, alertDialog);
            });

            detailsBtn.addEventListener('click', () => {
                // 切换到报警视图
                this.switchView('alert');
                this.closeAlertNotificationWithAnimation(backdrop, alertDialog);
            });

            // 添加按钮悬停效果
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = '#f5f5f5';
                closeBtn.style.transform = 'scale(1.05)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = 'white';
                closeBtn.style.transform = 'scale(1)';
            });

            detailsBtn.addEventListener('mouseenter', () => {
                detailsBtn.style.background = 'rgba(255, 255, 255, 0.3)';
                detailsBtn.style.transform = 'scale(1.05)';
            });
            detailsBtn.addEventListener('mouseleave', () => {
                detailsBtn.style.background = 'rgba(255, 255, 255, 0.2)';
                detailsBtn.style.transform = 'scale(1)';
            });

            // 添加键盘ESC事件
            const escapeHandler = (event) => {
                if (event.key === 'Escape') {
                    this.closeAlertNotificationWithAnimation(backdrop, alertDialog);
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);

            // 先添加背景，再添加弹窗
            document.body.appendChild(backdrop);
            document.body.appendChild(alertDialog);

            // 倒计时关闭
            let countdown = 5;
            const countdownElement = alertDialog.querySelector('#autoCloseCountdown');
            const countdownInterval = setInterval(() => {
                countdown--;
                if (countdownElement) {
                    countdownElement.textContent = countdown;
                }
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    this.closeAlertNotificationWithAnimation(backdrop, alertDialog);
                    document.removeEventListener('keydown', escapeHandler);
                }
            }, 1000);

            // 存储引用，便于清理
            alertDialog._backdrop = backdrop;
            alertDialog._countdownInterval = countdownInterval;
            alertDialog._escapeHandler = escapeHandler;

            console.log('📢 显示醒目报警通知');
        } catch (error) {
            console.warn('显示醒目通知失败:', error);
        }
    }

    /**
     * 🔧 新增：带动画关闭报警通知
     */
    closeAlertNotificationWithAnimation(backdrop, alertDialog) {
        try {
            // 清理倒计时
            if (alertDialog._countdownInterval) {
                clearInterval(alertDialog._countdownInterval);
            }

            // 移除ESC事件监听器
            if (alertDialog._escapeHandler) {
                document.removeEventListener('keydown', alertDialog._escapeHandler);
            }

            // 添加关闭动画
            alertDialog.classList.add('closing');

            // 动画完成后移除元素
            setTimeout(() => {
                if (backdrop && backdrop.parentElement) {
                    backdrop.remove();
                }
                if (alertDialog && alertDialog.parentElement) {
                    alertDialog.remove();
                }
            }, 200);

        } catch (error) {
            console.warn('关闭报警通知动画失败:', error);
            // 强制移除
            if (backdrop && backdrop.parentElement) {
                backdrop.remove();
            }
            if (alertDialog && alertDialog.parentElement) {
                alertDialog.remove();
            }
        }
    }

    /**
     * 🔧 新增：关闭所有报警通知
     */
    closeAllAlertNotifications() {
        try {
            // 移除所有报警弹窗背景
            const backdrops = document.querySelectorAll('.alert-notification-backdrop');
            backdrops.forEach(backdrop => {
                if (backdrop.parentElement) {
                    backdrop.remove();
                }
            });

            // 移除所有报警弹窗
            const dialogs = document.querySelectorAll('.alert-notification-dialog');
            dialogs.forEach(dialog => {
                // 清理倒计时
                if (dialog._countdownInterval) {
                    clearInterval(dialog._countdownInterval);
                }
                // 移除ESC事件监听器
                if (dialog._escapeHandler) {
                    document.removeEventListener('keydown', dialog._escapeHandler);
                }
                if (dialog.parentElement) {
                    dialog.remove();
                }
            });

            console.log('🧹 已关闭所有报警通知');
        } catch (error) {
            console.warn('关闭所有报警通知失败:', error);
        }
    }

    /**
     * 检查是否启用了报警声音
     */
    async isAlertSoundEnabled() {
        try {
            if (!this.modules.core) return false;

            const response = await this.modules.core.apiRequest('/alerts/config');
            if (response.success && response.data) {
                return response.data.sound_enabled !== false;
            }
            return true; // 默认启用
        } catch (error) {
            console.warn('获取声音设置失败:', error);
            return true;
        }
    }

    /**
     * 获取报警声音音量
     */
    async getAlertSoundVolume() {
        try {
            // 从设置中获取音量，默认70%
            const settings = this.loadUserSettings();
            return (settings.alertSoundVolume || 70) / 100;
        } catch (error) {
            return 0.7; // 默认70%音量
        }
    }

    /**
     * 播放指定音量的报警声音
     */
    playAlertSoundWithVolume(volume) {
        try {
            // 创建音频上下文播放报警音
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // 设置报警音频参数 - 三重提示音
            const frequencies = [880, 660, 880]; // 高-低-高音调
            const duration = 0.2; // 每个音的持续时间

            frequencies.forEach((freq, index) => {
                const startTime = audioContext.currentTime + index * duration;
                const endTime = startTime + duration * 0.8;

                oscillator.frequency.setValueAtTime(freq, startTime);
                gainNode.gain.setValueAtTime(volume * 0.3, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
            });

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + frequencies.length * duration);

            console.log('🔊 播放报警声音，音量:', Math.round(volume * 100) + '%');

        } catch (error) {
            console.warn('⚠️ 无法播放报警声音:', error);
        }
    }

    /**
     * 显示桌面通知
     */
    showAlertNotification(alert) {
        try {
            const title = '🚨 Meteora 报警提示';
            const body = `${alert.pool_name} ${this.getAlertTypeDisplayName(alert.alert_type)} ${alert.change_type === 'increase' ? '上升' : '下降'} ${alert.change_percent?.toFixed(1) || '0.0'}%`;

            // 检查浏览器通知权限
            if ('Notification' in window) {
                if (Notification.permission === 'granted') {
                    new Notification(title, {
                        body: body,
                        icon: '/static/img/logo.png',
                        tag: 'meteora-alert',
                        requireInteraction: false
                    });
                } else if (Notification.permission !== 'denied') {
                    // 请求通知权限
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            new Notification(title, {
                                body: body,
                                icon: '/static/img/logo.png',
                                tag: 'meteora-alert'
                            });
                        }
                    });
                }
            }

            // 同时显示应用内通知
            if (this.modules.core) {
                this.modules.core.showNotification(body, 'warning', 5000);
            }

        } catch (error) {
            console.warn('显示桌面通知失败:', error);
        }
    }

    /**
     * 更新页面标题显示报警
     */
    updatePageTitleWithAlert() {
        try {
            const originalTitle = document.title.replace(/^\[🚨\]\s*/, '');
            document.title = `[🚨] ${originalTitle}`;

            // 5秒后恢复原标题
            setTimeout(() => {
                document.title = originalTitle;
            }, 5000);

        } catch (error) {
            console.warn('更新页面标题失败:', error);
        }
    }

    /**
     * 更新报警计数显示
     */
    updateAlertCountDisplay(count) {
        try {
            // 更新报警视图中的计数
            const countElement = document.getElementById('alertRecordCount');
            if (countElement) {
                countElement.textContent = count;
            }

            // 更新报警按钮上的徽章
            const alertBtn = document.getElementById('alertViewBtn');
            if (alertBtn) {
                let badge = alertBtn.querySelector('.alert-badge');
                if (count > 0) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'badge bg-danger alert-badge';
                        badge.style.fontSize = '10px';
                        badge.style.position = 'absolute';
                        badge.style.top = '-5px';
                        badge.style.right = '-5px';
                        alertBtn.style.position = 'relative';
                        alertBtn.appendChild(badge);
                    }
                    badge.textContent = count > 99 ? '99+' : count;
                } else if (badge) {
                    badge.remove();
                }
            }

        } catch (error) {
            console.warn('更新报警计数显示失败:', error);
        }
    }

    /**
     * 停止报警监控
     */
    stopAlertMonitoring() {
        if (this.alertCheckInterval) {
            clearInterval(this.alertCheckInterval);
            this.alertCheckInterval = null;
            console.log('🚨 报警监控已停止');
        }
    }

    /**
     * 清除报警记录
     */
    async clearAlertRecords() {
        try {
            // 简单确认对话框
            const confirmed = confirm('确定要清除所有报警记录吗？这个操作不能撤销。');
            if (!confirmed) return;

            if (this.modules.core) {
                // 调用API清除记录
                const response = await this.modules.core.apiRequest('/alerts/records', {
                    method: 'DELETE',
                    body: JSON.stringify({ type: 'all' })
                });

                if (response.success) {
                    this.modules.core.showNotification('✅ 报警记录已清除', 'success', 2000);

                    // 重新加载记录
                    this.loadAlertRecords();
                } else {
                    this.modules.core.showNotification(`❌ 清除失败: ${response.error}`, 'error', 3000);
                }
            }
        } catch (error) {
            console.error('清除报警记录失败:', error);
            if (this.modules.core) {
                this.modules.core.showNotification('❌ 清除记录失败', 'error', 3000);
            }
        }
    }

    /**
     * 加载报警配置
     */
    async loadAlertConfiguration() {
        try {
            console.log('🔄 开始加载报警配置...');

            if (!this.modules.core) {
                console.warn('⚠️ 核心模块未加载，无法获取报警配置');
                return;
            }

            const response = await this.modules.core.apiRequest('/alerts/config');
            console.log('📨 API响应:', response);

            if (response.success && response.data) {
                const config = response.data;
                console.log('📋 加载的配置:', config);

                // 更新表单字段
                const fields = {
                    'enableAlertsSystem': config.enabled,
                    'liquidityThreshold': config.liquidity_threshold,
                    'volumeThreshold': config.volume_threshold,
                    'fees24hThreshold': config.fees_24h_threshold,
                    'fees1hThreshold': config.fees_1h_threshold,
                    'soundAlertsEnabled': config.sound_enabled,
                    'alertFilterEnabled': config.filter_enabled,
                    'alertIncreaseOnlyEnabled': config.increase_only_enabled
                };

                let successCount = 0;
                let notFoundCount = 0;

                Object.entries(fields).forEach(([id, value]) => {
                    const element = document.getElementById(id);
                    if (element) {
                        if (element.type === 'checkbox') {
                            element.checked = value;
                        } else {
                            element.value = value;
                        }
                        successCount++;
                        console.log(`✅ 设置字段 ${id}:`, value);
                    } else {
                        notFoundCount++;
                        console.warn(`⚠️ 未找到字段元素: ${id}`);
                    }
                });

                console.log(`✅ 报警配置加载完成: ${successCount}个字段成功, ${notFoundCount}个字段未找到`);

                // 显示加载成功通知
                if (this.modules.core) {
                    this.modules.core.showNotification(`✅ 报警配置已加载 (${successCount}项)`, 'success', 2000);
                }
            } else {
                console.warn('⚠️ API响应无效或无数据:', response);
                // 如果没有配置，使用默认值
                this.loadDefaultAlertConfiguration();
            }
        } catch (error) {
            console.error('❌ 加载报警配置失败:', error);
            if (this.modules.core) {
                this.modules.core.showNotification('❌ 加载报警配置失败: ' + error.message, 'error', 3000);
            }

            // 加载失败时使用默认配置
            this.loadDefaultAlertConfiguration();
        }
    }

    /**
     * 加载默认报警配置
     */
    loadDefaultAlertConfiguration() {
        console.log('🔧 加载默认报警配置...');

        const defaultConfig = {
            'enableAlertsSystem': true,
            'liquidityThreshold': 20.0,
            'volumeThreshold': 20.0,
            'fees24hThreshold': 20.0,
            'fees1hThreshold': 20.0,
            'soundAlertsEnabled': true,
            'alertFilterEnabled': false,
            'alertIncreaseOnlyEnabled': false
        };

        Object.entries(defaultConfig).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
            }
        });

        console.log('✅ 默认报警配置已加载');
    }

    /**
     * 加载报警记录
     */
    async loadAlertRecords() {
        try {
            const recordsList = document.getElementById('alertRecordsList');
            if (!recordsList) return;

            // 显示加载状态
            recordsList.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-accent-cyan" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <p class="mt-2 text-muted">正在加载报警记录...</p>
                </div>
            `;

            if (this.modules.core) {
                const response = await this.modules.core.apiRequest('/alerts/records');

                if (response.success && response.data) {
                    const records = response.data;

                    // 更新记录计数
                    const countElement = document.getElementById('alertRecordCount');
                    if (countElement) {
                        countElement.textContent = records.length;
                    }

                    // 渲染记录列表
                    if (records.length === 0) {
                        recordsList.innerHTML = `
                            <div class="text-center py-5">
                                <i class="fas fa-bell-slash text-muted" style="font-size: 3rem;"></i>
                                <h6 class="mt-3 text-muted">暂无报警记录</h6>
                                <p class="text-muted">当池子数据变化超过阈值时，将显示在这里</p>
                            </div>
                        `;
                    } else {
                        recordsList.innerHTML = records.map(record => `
                            <div class="alert-record-item border-bottom border-secondary py-3">
                                <div class="row align-items-center">
                                    <div class="col-md-3">
                                        <strong class="text-accent-cyan">${record.pool_name || '未知池子'}</strong>
                                        <div class="small text-muted">
                                            ${this.formatPoolAddress(record.pool_address)}
                                        </div>
                                    </div>
                                    <div class="col-md-2">
                                        <span class="badge ${record.change_type === 'increase' ? 'bg-success' : 'bg-danger'}">
                                            ${record.change_type === 'increase' ? '📈 上升' : '📉 下降'}
                                        </span>
                                    </div>
                                    <div class="col-md-2">
                                        <strong class="text-warning">${this.getAlertTypeDisplayName(record.alert_type)}</strong>
                                    </div>
                                    <div class="col-md-2">
                                        <div class="mb-1">
                                            <span class="text-info fw-bold">${record.change_percent ? record.change_percent.toFixed(1) : '0.0'}%</span>
                                        </div>
                                        <div class="small text-muted">
                                            ${this.formatValueChange(record.old_value, record.new_value, record.alert_type)}
                                        </div>
                                        <div class="small text-muted">
                                            阈值: ${record.threshold_percent ? record.threshold_percent.toFixed(1) : '0.0'}%
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <small class="text-primary" style="color: #4fc3f7 !important; font-weight: 500;">${this.formatAlertTime(record.created_at)}</small>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }

                    console.log('✅ 报警记录加载完成，共', records.length, '条');
                } else {
                    throw new Error(response.error || '获取报警记录失败');
                }
            }
        } catch (error) {
            console.error('加载报警记录失败:', error);

            const recordsList = document.getElementById('alertRecordsList');
            if (recordsList) {
                recordsList.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                        <h6 class="mt-3 text-warning">加载失败</h6>
                        <p class="text-muted">${error.message}</p>
                        <button class="btn btn-outline-accent btn-sm" onclick="meteoraApp.loadAlertRecords()">
                            <i class="fas fa-redo"></i> 重试
                        </button>
                    </div>
                `;
            }
        }
    }

    /**
     * 格式化池子地址显示 - 开头...结尾格式，支持点击复制
     */
    formatPoolAddress(address) {
        if (!address) return '未知地址';

        // 生成显示格式：前4位...后4位
        const displayAddress = address.length > 12 ?
            `${address.substring(0, 4)}...${address.substring(address.length - 4)}` :
            address;

        // 生成唯一ID
        const addressId = `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 返回可点击的地址元素
        return `
            <span 
                id="${addressId}"
                class="pool-address-display" 
                data-full-address="${address}"
                onclick="meteoraApp.copyPoolAddress('${address}', '${addressId}')"
                style="
                    cursor: pointer; 
                    color: #64b5f6; 
                    text-decoration: underline;
                    font-family: 'Courier New', monospace;
                    font-size: 11px;
                "
                title="点击复制完整地址: ${address}"
            >${displayAddress}</span>
        `;
    }

    /**
     * 复制池子地址到剪贴板
     */
    async copyPoolAddress(address, elementId) {
        try {
            await navigator.clipboard.writeText(address);

            // 临时改变元素样式表示复制成功
            const element = document.getElementById(elementId);
            if (element) {
                const originalText = element.textContent;
                const originalColor = element.style.color;

                element.textContent = '已复制!';
                element.style.color = '#4caf50';

                setTimeout(() => {
                    element.textContent = originalText;
                    element.style.color = originalColor;
                }, 1500);
            }

            // 显示成功提示
            if (this.modules.core) {
                this.modules.core.showNotification(
                    `✅ 地址已复制: ${address.substring(0, 8)}...`,
                    'success',
                    2000
                );
            }

            console.log('📋 已复制地址:', address);
        } catch (error) {
            console.error('复制地址失败:', error);

            // 如果现代API失败，尝试传统方法
            this.fallbackCopyToClipboard(address);

            if (this.modules.core) {
                this.modules.core.showNotification(
                    '⚠️ 复制可能失败，请手动复制',
                    'warning',
                    3000
                );
            }
        }
    }

    /**
     * 备用复制方法
     */
    fallbackCopyToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            console.log('📋 备用方法复制成功');
        } catch (error) {
            console.error('备用复制方法也失败:', error);
        }
    }

    /**
     * 格式化数值变化显示
     */
    formatValueChange(oldValue, newValue, alertType) {
        try {
            if (newValue == null) {
                return '数值变化: 新值无数据';
            }

            const newVal = parseFloat(newValue);
            if (isNaN(newVal)) {
                return '数值变化: 新值格式错误';
            }

            // 根据报警类型选择合适的格式化方式
            let formattedNew, unit;

            switch (alertType) {
                case 'liquidity':
                    // 流动性 - 以美元格式显示
                    formattedNew = this.formatCurrency(newVal);
                    unit = '';
                    break;

                case 'trade_volume_24h':
                    // 24小时交易量 - 以美元格式显示
                    formattedNew = this.formatCurrency(newVal);
                    unit = '';
                    break;

                case 'fees_24h':
                case 'fees_hour_1':
                    // 手续费 - 以美元格式显示
                    formattedNew = this.formatCurrency(newVal);
                    unit = '';
                    break;

                case 'apy':
                case 'apr':
                    // 年化收益率 - 以百分比显示
                    formattedNew = newVal.toFixed(2);
                    unit = '%';
                    break;

                default:
                    // 默认格式
                    formattedNew = this.formatNumber(newVal);
                    unit = '';
            }

            // 如果没有历史值，显示当前值和变化趋势
            if (oldValue == null || isNaN(parseFloat(oldValue))) {
                const changeIcon = newVal > 0 ? '📈' : (newVal < 0 ? '📉' : '➡️');

                return `
                    <div style="line-height: 1.2;">
                        <span style="color: #888;">当前值:</span> <span style="color: #4caf50;">${formattedNew}${unit}</span> ${changeIcon}<br>
                        <span style="color: #888; font-size: 11px;">首次检测到变化</span>
                    </div>
                `;
            }

            // 有历史值的情况
            const oldVal = parseFloat(oldValue);
            let formattedOld;

            switch (alertType) {
                case 'liquidity':
                case 'trade_volume_24h':
                case 'fees_24h':
                case 'fees_hour_1':
                    formattedOld = this.formatCurrency(oldVal);
                    break;
                case 'apy':
                case 'apr':
                    formattedOld = oldVal.toFixed(2);
                    break;
                default:
                    formattedOld = this.formatNumber(oldVal);
            }

            const changeIcon = newVal > oldVal ? '↗️' : '↘️';

            return `
                <div style="line-height: 1.2;">
                    <span style="color: #888;">从:</span> <span style="color: #ff9800;">${formattedOld}${unit}</span><br>
                    <span style="color: #888;">到:</span> <span style="color: #4caf50;">${formattedNew}${unit}</span> ${changeIcon}
                </div>
            `;

        } catch (error) {
            console.warn('格式化数值变化失败:', error);
            return '数值变化: 解析失败';
        }
    }

    /**
     * 格式化货币显示
     */
    formatCurrency(value) {
        if (value == null || isNaN(value)) return '$0';

        const num = parseFloat(value);

        if (num >= 1000000) {
            return `$${(num / 1000000).toFixed(2)}M`;
        } else if (num >= 1000) {
            return `$${(num / 1000).toFixed(2)}K`;
        } else if (num >= 1) {
            return `$${num.toFixed(2)}`;
        } else {
            return `$${num.toFixed(4)}`;
        }
    }

    /**
     * 格式化数字显示
     */
    formatNumber(value) {
        if (value == null || isNaN(value)) return '0';

        const num = parseFloat(value);

        if (num >= 1000000000) {
            return `${(num / 1000000000).toFixed(2)}B`;
        } else if (num >= 1000000) {
            return `${(num / 1000000).toFixed(2)}M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(2)}K`;
        } else if (num >= 1) {
            return num.toFixed(2);
        } else {
            return num.toFixed(4);
        }
    }

    /**
     * 保存报警配置
     */
    async saveAlertConfiguration() {
        try {
            // 收集表单数据
            const config = {
                enabled: document.getElementById('enableAlertsSystem')?.checked || false,
                liquidity_threshold: parseFloat(document.getElementById('liquidityThreshold')?.value) || 20,
                volume_threshold: parseFloat(document.getElementById('volumeThreshold')?.value) || 20,
                fees_24h_threshold: parseFloat(document.getElementById('fees24hThreshold')?.value) || 20,
                fees_1h_threshold: parseFloat(document.getElementById('fees1hThreshold')?.value) || 20,
                sound_enabled: document.getElementById('soundAlertsEnabled')?.checked || true,
                filter_enabled: document.getElementById('alertFilterEnabled')?.checked || true,
                increase_only_enabled: document.getElementById('alertIncreaseOnlyEnabled')?.checked || true
            };

            if (this.modules.core) {
                const response = await this.modules.core.apiRequest('/alerts/config', {
                    method: 'POST',
                    body: JSON.stringify(config)
                });

                if (response.success) {
                    this.modules.core.showNotification('✅ 报警配置已保存', 'success', 2000);
                    console.log('✅ 报警配置保存成功');
                } else {
                    throw new Error(response.error || '保存配置失败');
                }
            }
        } catch (error) {
            console.error('保存报警配置失败:', error);
            if (this.modules.core) {
                this.modules.core.showNotification('❌ 保存报警配置失败: ' + error.message, 'error', 3000);
            }
        }
    }

    /**
     * 获取报警类型显示名称
     */
    getAlertTypeDisplayName(alertType) {
        const typeMap = {
            'liquidity': '流动性',
            'trade_volume_24h': '24h交易量',
            'fees_24h': '24h手续费',
            'fees_hour_1': '1h手续费',
            'volume': '交易量',
            'fees': '手续费',
            'apy': '年化收益率',
            'change': '价格变化'
        };
        return typeMap[alertType] || alertType;
    }

    /**
     * 格式化本地时间 - 简化版（数据库已存储本地时间）
     */
    formatLocalTime(timestamp) {
        try {
            if (!timestamp) return '未知时间';

            // 数据库现在存储的已经是本地时间，直接解析即可
            const date = new Date(timestamp);

            // 检查日期是否有效
            if (isNaN(date.getTime())) {
                console.warn('无效的时间格式:', timestamp);
                return '时间格式错误';
            }

            // 返回本地时间格式 (YYYY/MM/DD HH:mm:ss)
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');

            return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
        } catch (error) {
            console.warn('时间格式化失败:', error, '原始时间:', timestamp);
            return '时间解析失败';
        }
    }

    /**
     * 格式化报警时间 - 增强版
     */
    formatAlertTime(timestamp) {
        try {
            if (!timestamp) return '未知时间';

            // 使用增强的本地时间格式化
            const formattedTime = this.formatLocalTime(timestamp);

            // 计算时间差，显示相对时间
            const now = new Date();
            const alertTime = new Date(timestamp);

            if (!isNaN(alertTime.getTime())) {
                const timeDiff = now - alertTime;
                const minutes = Math.floor(timeDiff / (1000 * 60));
                const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

                let relativeTime = '';
                if (days > 0) {
                    relativeTime = `${days}天前`;
                } else if (hours > 0) {
                    relativeTime = `${hours}小时前`;
                } else if (minutes > 0) {
                    relativeTime = `${minutes}分钟前`;
                } else {
                    relativeTime = '刚刚';
                }

                return `${formattedTime} (${relativeTime})`;
            }

            return formattedTime;
        } catch (error) {
            console.warn('报警时间格式化失败:', error, '原始时间:', timestamp);
            return this.formatLocalTime(timestamp); // 降级到基础格式化
        }
    }

    // ==================== 报警监控和声音提示功能 ====================

    /**
     * 设置报警监控
     */
    setupAlertMonitoring() {
        // 存储上次检查的报警记录数量和最新报警时间
        this.lastAlertCount = 0;
        this.lastAlertTime = null;
        this.alertCheckInterval = null;
        this.soundEnabled = true; // 默认启用声音

        // 🔧 修复：从本地存储加载上次处理的报警时间，避免重复提醒
        try {
            const lastProcessedTime = localStorage.getItem('meteora_last_alert_time');
            if (lastProcessedTime) {
                this.lastAlertTime = lastProcessedTime;
                console.log('📋 恢复上次处理的报警时间:', this.lastAlertTime);
            }
        } catch (error) {
            console.warn('⚠️ 无法加载上次报警时间:', error);
        }

        // 请求音频权限
        this.requestAudioPermission();

        // 启动报警监控
        this.startAlertMonitoring();

        console.log('🚨 增强版报警监控系统已启动');
    }

    /**
     * 启动报警监控
     */
    startAlertMonitoring() {
        // 清除已有的定时器
        if (this.alertCheckInterval) {
            clearInterval(this.alertCheckInterval);
        }

        // 每10秒检查一次新报警（更频繁）
        this.alertCheckInterval = setInterval(() => {
            this.checkForNewAlerts();
        }, 10000);

        // 立即执行一次检查
        setTimeout(() => {
            this.checkForNewAlerts();
        }, 2000); // 延迟2秒，等待系统初始化完成

        console.log('⏰ 报警监控定时器已启动 (10秒间隔)');
    }

    /**
     * 检查新报警 - 增强版
     */
    async checkForNewAlerts() {
        try {
            if (!this.modules.core) return;

            // 获取最新的报警记录
            const response = await this.modules.core.apiRequest('/alerts/records?limit=20');

            if (response.success && response.data) {
                const alerts = response.data;
                const currentAlertCount = alerts.length;

                // 检查是否有新报警
                let newAlerts = [];

                if (this.lastAlertTime) {
                    // 基于时间检查新报警
                    newAlerts = alerts.filter(alert => {
                        const alertTime = new Date(alert.created_at);
                        const lastTime = new Date(this.lastAlertTime);
                        return alertTime > lastTime;
                    });
                } else {
                    // 🔧 修复：首次检查时不处理已存在的报警，避免页面刷新时重复提醒
                    console.log('📋 首次检查，跳过已存在的报警，仅监控新报警');
                    newAlerts = []; // 首次检查时不提醒任何报警
                }

                // 更新状态
                this.lastAlertCount = currentAlertCount;
                if (alerts.length > 0) {
                    this.lastAlertTime = alerts[0].created_at; // 最新报警的时间

                    // 🔧 修复：保存最新处理时间到本地存储
                    try {
                        localStorage.setItem('meteora_last_alert_time', this.lastAlertTime);
                    } catch (error) {
                        console.warn('⚠️ 无法保存报警时间:', error);
                    }
                }

                // 处理新报警
                if (newAlerts.length > 0) {
                    console.log('🚨 检测到新报警:', newAlerts.length, '条，最新时间:', this.lastAlertTime);
                    await this.handleNewAlerts(newAlerts);
                }

                // 更新报警计数显示
                this.updateAlertCountDisplay(currentAlertCount);

                // 在控制台显示监控状态（降低频率）
                if (currentAlertCount > 0 && Math.random() < 0.1) { // 只有10%的概率显示，减少日志
                    console.log(`📊 报警监控状态: ${currentAlertCount} 条记录，最新: ${this.lastAlertTime}`);
                }
            }
        } catch (error) {
            console.warn('检查新报警失败:', error);
        }
    }

    /**
     * 处理新报警 - 增强版
     */
    async handleNewAlerts(newAlerts) {
        console.log('🚨 处理新报警:', newAlerts.length, '条');

        for (const alert of newAlerts) {
            // 立即播放声音提示（多种方式）
            await this.playMultipleAlertSounds();

            // 显示醒目的页面通知
            this.showProminentAlertNotification(alert);

            // 显示桌面通知
            this.showAlertNotification(alert);

            // 更新页面标题
            this.updatePageTitleWithAlert();

            // 短暂延迟，避免声音重叠
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 如果当前在报警视图，刷新记录列表
        const alertView = document.getElementById('alertView');
        if (alertView && !alertView.classList.contains('d-none')) {
            this.loadAlertRecords();
        }
    }
}

// 创建全局应用实例
window.MeteoraApp = MeteoraApp;

// 等待DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.meteoraApp = new MeteoraApp();

    // 🔧 修复：立即初始化应用
    window.meteoraApp.init().catch(error => {
        console.error('❌ 应用初始化失败:', error);
    });
}); 