/**
 * Meteora监控平台 V2.0 - 便捷筛选器管理模块
 * 提供简单易用的筛选功能
 */

class FilterManager {
    constructor() {
        // 本地存储键名
        this.storageKey = 'meteora_filters';

        // 从本地存储加载筛选器状态，如果没有则使用默认值
        this.filters = this.loadFiltersFromStorage() || {
            search: '',
            liquidityMin: null,
            liquidityMax: null,
            apyMin: null,
            apyMax: null,
            volumeMin: null,
            volumeMax: null,
            feeTvlRatioMin: null,
            feeTvlRatioMax: null,
            estimatedDailyFeeRateMin: null,
            estimatedDailyFeeRateMax: null,
            preset: ''
        };

        // 快速筛选预设 - 更实用的配置
        this.quickFilters = {
            all: {
                name: '全部池子',
                icon: 'fas fa-list',
                filters: {}
            },
            high_tvl: {
                name: '大池子',
                icon: 'fas fa-coins',
                filters: { liquidityMin: 1000000 }, // TVL > 1M
                description: 'TVL > 1M'
            },
            super_high_tvl: {
                name: '超大池子',
                icon: 'fas fa-gem',
                filters: { liquidityMin: 10000000 }, // TVL > 10M
                description: 'TVL > 10M'
            },
            high_apy: {
                name: '高收益',
                icon: 'fas fa-percentage',
                filters: { apyMin: 10 }, // APY > 10%
                description: 'APY > 10%'
            },
            super_high_apy: {
                name: '超高收益',
                icon: 'fas fa-fire',
                filters: { apyMin: 50 }, // APY > 50%
                description: 'APY > 50%'
            },
            active_trading: {
                name: '活跃交易',
                icon: 'fas fa-chart-line',
                filters: { volumeMin: 100000 }, // 24h量 > 100K
                description: '24h量 > 100K'
            },
            stable_pairs: {
                name: '稳定币对',
                icon: 'fas fa-balance-scale',
                filters: { search: 'USDC' },
                description: '包含USDC'
            },
            sol_pairs: {
                name: 'SOL交易对',
                icon: 'fab fa-solar-panel',
                filters: { search: 'SOL' },
                description: '包含SOL'
            }
        };

        this.activeFilters = new Set();
        this.currentQuickFilter = 'all';
        this.debouncedApplyFilters = null;

        this.init();
    }

    /**
     * 初始化筛选器
     */
    init() {
        this.setupEventListeners();
        this.createQuickFilters();
        this.setupAdvancedFilters();

        // 恢复保存的筛选器状态到UI
        this.restoreFiltersToUI();

        console.log('🔍 便捷筛选器初始化完成');
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 搜索框 - 实时搜索
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            // 防抖处理
            let searchTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    this.filters.search = e.target.value.trim();
                    this.currentQuickFilter = 'custom';
                    this.updateQuickFilterButtons();
                    this.applyFilters();
                }, 500); // 500ms延迟
            });
        }

        // 高级筛选输入框
        this.setupAdvancedInputs();

        // 应用筛选器按钮
        const applyFilters = document.getElementById('applyFilters');
        if (applyFilters) {
            applyFilters.addEventListener('click', this.handleApplyFiltersClick.bind(this));
        }

        // 清除筛选器按钮
        const clearFilters = document.getElementById('clearFilters');
        if (clearFilters) {
            clearFilters.addEventListener('click', this.clearAllFilters.bind(this));
        }

        // 空状态下的清除筛选按钮
        const clearFilters2 = document.getElementById('clearFiltersBtn2');
        if (clearFilters2) {
            clearFilters2.addEventListener('click', this.clearAllFilters.bind(this));
        }

        // 预设筛选器选择
        const filterPresets = document.getElementById('filterPresets');
        if (filterPresets) {
            filterPresets.addEventListener('change', this.handlePresetChange.bind(this));
        }

        console.log('🎯 筛选器事件监听器设置完成');
    }

    /**
     * 设置高级筛选输入框
     */
    setupAdvancedInputs() {
        const inputs = [
            { id: 'minLiquidity', key: 'liquidityMin' },
            { id: 'maxLiquidity', key: 'liquidityMax' },
            { id: 'minApy', key: 'apyMin' },
            { id: 'maxApy', key: 'apyMax' },
            { id: 'minVolume', key: 'volumeMin' },
            { id: 'maxVolume', key: 'volumeMax' },
            { id: 'minFeeTvlRatio', key: 'feeTvlRatioMin' },
            { id: 'maxFeeTvlRatio', key: 'feeTvlRatioMax' },
            { id: 'minEstimatedDailyFeeRate', key: 'estimatedDailyFeeRateMin' },
            { id: 'maxEstimatedDailyFeeRate', key: 'estimatedDailyFeeRateMax' }
        ];

        inputs.forEach(({ id, key }) => {
            const input = document.getElementById(id);
            if (input) {
                let inputTimer;
                input.addEventListener('input', (e) => {
                    clearTimeout(inputTimer);
                    inputTimer = setTimeout(() => {
                        const value = parseFloat(e.target.value);
                        this.filters[key] = isNaN(value) ? null : value;
                        this.currentQuickFilter = 'custom';
                        this.updateQuickFilterButtons();
                        this.applyFilters();
                    }, 800); // 800ms延迟，给用户足够时间输入
                });
            }
        });
    }

    /**
     * 创建快速筛选按钮
     */
    createQuickFilters() {
        // 使用现有的HTML结构，不创建新的容器
        const existingContainer = document.getElementById('quickFilters');
        if (existingContainer) {
            // 使用现有的快速筛选容器
            this.setupExistingQuickFilters();
        } else {
            // 如果不存在，则创建（向后兼容）
            this.createNewQuickFilters();
        }
    }

    /**
     * 设置现有的快速筛选按钮
     */
    setupExistingQuickFilters() {
        const container = document.getElementById('quickFilters');
        if (!container) return;

        // 为现有的快速筛选按钮添加事件监听器
        const existingButtons = container.querySelectorAll('.quick-filter-btn');
        existingButtons.forEach(button => {
            const filterKey = button.dataset.filter;
            if (filterKey && this.quickFilters[filterKey]) {
                button.addEventListener('click', () => this.applyQuickFilter(filterKey));
            }
        });

        console.log('🔍 使用现有的快速筛选结构');
    }

    /**
     * 创建新的快速筛选容器（向后兼容）
     */
    createNewQuickFilters() {
        const filterPanel = document.querySelector('.filter-panel .panel-body');
        if (!filterPanel) return;

        // 创建快速筛选容器
        const quickFiltersContainer = document.createElement('div');
        quickFiltersContainer.className = 'quick-filters-section';
        quickFiltersContainer.innerHTML = `
            <div class="filter-section">
                <label class="filter-label">快速筛选</label>
                <div class="quick-filters-grid" id="quickFiltersGrid">
                    <!-- 快速筛选按钮将在这里生成 -->
                </div>
            </div>
        `;

        // 插入到搜索框之前
        const searchSection = filterPanel.querySelector('.filter-section');
        filterPanel.insertBefore(quickFiltersContainer, searchSection);

        // 生成快速筛选按钮
        this.renderQuickFilterButtons();
    }

    /**
     * 渲染快速筛选按钮
     */
    renderQuickFilterButtons() {
        // 尝试使用现有的容器，如果不存在则使用动态创建的
        let container = document.getElementById('quickFilters');
        if (!container) {
            container = document.getElementById('quickFiltersGrid');
        }

        if (!container) return;

        // 只有在动态创建的容器中才清除内容并重新生成
        if (container.id === 'quickFiltersGrid') {
            container.innerHTML = '';

            Object.entries(this.quickFilters).forEach(([key, config]) => {
                const button = document.createElement('button');
                button.className = `quick-filter-btn ${this.currentQuickFilter === key ? 'active' : ''}`;
                button.dataset.filter = key;

                button.innerHTML = `
                    <i class="${config.icon}"></i>
                    <span class="filter-name">${config.name}</span>
                    ${config.description ? `<small class="filter-desc">${config.description}</small>` : ''}
                `;

                button.addEventListener('click', () => this.applyQuickFilter(key));
                container.appendChild(button);
            });
        } else {
            // 对于现有的HTML结构，只更新按钮状态
            this.updateQuickFilterButtons();
        }
    }

    /**
     * 应用快速筛选
     */
    applyQuickFilter(filterKey) {
        const config = this.quickFilters[filterKey];
        if (!config) return;

        // 清除现有筛选器
        this.clearAllFilters(false);

        // 应用快速筛选
        if (filterKey !== 'all') {
            Object.assign(this.filters, config.filters);
        }

        this.currentQuickFilter = filterKey;
        this.updateQuickFilterButtons();
        this.updateAdvancedInputs();
        this.applyFilters();

        // 显示通知
        if (window.meteora) {
            window.meteora.showNotification(`已应用筛选: ${config.name}`, 'info', 2000);
        }

        console.log(`🔍 应用快速筛选: ${config.name}`, config.filters);
    }

    /**
     * 更新快速筛选按钮状态
     */
    updateQuickFilterButtons() {
        const buttons = document.querySelectorAll('.quick-filter-btn');
        buttons.forEach(button => {
            const filterKey = button.dataset.filter;
            button.classList.toggle('active', this.currentQuickFilter === filterKey);
        });
    }

    /**
     * 更新高级筛选输入框的值
     */
    updateAdvancedInputs() {
        const inputMap = [
            { id: 'minLiquidity', key: 'liquidityMin' },
            { id: 'maxLiquidity', key: 'liquidityMax' },
            { id: 'minApy', key: 'apyMin' },
            { id: 'maxApy', key: 'apyMax' },
            { id: 'minVolume', key: 'volumeMin' },
            { id: 'maxVolume', key: 'volumeMax' },
            { id: 'minFeeTvlRatio', key: 'feeTvlRatioMin' },
            { id: 'maxFeeTvlRatio', key: 'feeTvlRatioMax' }
        ];

        inputMap.forEach(({ id, key }) => {
            const input = document.getElementById(id);
            if (input) {
                input.value = this.filters[key] || '';
            }
        });

        // 更新搜索框
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = this.filters.search || '';
        }
    }

    /**
     * 设置高级筛选面板
     */
    setupAdvancedFilters() {
        // 移除复杂的滑块，只保留简单的数字输入框
        const sliders = document.querySelectorAll('.range-slider');
        sliders.forEach(slider => {
            slider.style.display = 'none';
        });

        // 为范围输入框添加提示
        const liquidityInputs = document.querySelectorAll('#minLiquidity, #maxLiquidity');
        liquidityInputs.forEach(input => {
            input.setAttribute('placeholder', input.id.includes('min') ? '最小TVL (如: 1000000)' : '最大TVL');
        });

        const apyInputs = document.querySelectorAll('#minApy, #maxApy');
        apyInputs.forEach(input => {
            input.setAttribute('placeholder', input.id.includes('min') ? '最小APY% (如: 10)' : '最大APY%');
        });

        const volumeInputs = document.querySelectorAll('#minVolume, #maxVolume');
        volumeInputs.forEach(input => {
            input.setAttribute('placeholder', input.id.includes('min') ? '最小24h量 (如: 100000)' : '最大24h量');
        });

        const feeTvlInputs = document.querySelectorAll('#minFeeTvlRatio, #maxFeeTvlRatio');
        feeTvlInputs.forEach(input => {
            input.setAttribute('placeholder', input.id.includes('min') ? '最小Fee/TVL% (如: 0.5)' : '最大Fee/TVL%');
        });
    }

    /**
     * 处理预设筛选器变化
     */
    handlePresetChange(event) {
        const presetKey = event.target.value;
        if (!presetKey) return;

        // 映射到快速筛选
        const presetMap = {
            'high_apy': 'high_apy',
            'high_liquidity': 'high_tvl',
            'active_trading': 'active_trading'
        };

        const quickFilterKey = presetMap[presetKey];
        if (quickFilterKey) {
            this.applyQuickFilter(quickFilterKey);
        }

        // 重置选择器
        event.target.value = '';
    }

    /**
     * 处理应用筛选按钮点击
     */
    handleApplyFiltersClick() {
        // 收集当前输入框的值
        this.collectCurrentFilters();

        // 保存并应用筛选器
        this.saveFiltersToStorage();
        this.applyFilters();

        // 显示成功提示
        if (window.meteora) {
            const activeCount = this.getActiveFiltersCount();
            const message = activeCount > 0
                ? `✅ 已应用 ${activeCount} 个筛选条件并保存`
                : '✅ 筛选器已重置';
            window.meteora.showNotification(message, 'success', 3000);
        }

        console.log('🎯 用户手动应用筛选器');
    }

    /**
     * 收集当前输入框的值到筛选器对象
     */
    collectCurrentFilters() {
        const inputMap = [
            { id: 'searchInput', key: 'search', type: 'string' },
            { id: 'minLiquidity', key: 'liquidityMin', type: 'number' },
            { id: 'maxLiquidity', key: 'liquidityMax', type: 'number' },
            { id: 'minApy', key: 'apyMin', type: 'number' },
            { id: 'maxApy', key: 'apyMax', type: 'number' },
            { id: 'minVolume', key: 'volumeMin', type: 'number' },
            { id: 'maxVolume', key: 'volumeMax', type: 'number' },
            { id: 'minFeeTvlRatio', key: 'feeTvlRatioMin', type: 'number' },
            { id: 'maxFeeTvlRatio', key: 'feeTvlRatioMax', type: 'number' }
        ];

        inputMap.forEach(({ id, key, type }) => {
            const input = document.getElementById(id);
            if (input) {
                if (type === 'string') {
                    this.filters[key] = input.value.trim() || '';
                } else if (type === 'number') {
                    const value = parseFloat(input.value);
                    this.filters[key] = isNaN(value) ? null : value;
                }
            }
        });

        // 更新快速筛选状态
        this.currentQuickFilter = this.getActiveFiltersCount() > 0 ? 'custom' : 'all';
    }

    /**
     * 应用筛选器
     */
    applyFilters() {
        // 保存筛选器状态到本地存储
        this.saveFiltersToStorage();

        // 防抖处理
        if (this.debouncedApplyFilters) {
            clearTimeout(this.debouncedApplyFilters);
        }

        this.debouncedApplyFilters = setTimeout(() => {
            this._performApplyFilters();
        }, 300);
    }

    /**
     * 执行筛选器应用（内部方法）
     */
    _performApplyFilters() {
        // 构建筛选参数
        const filterParams = this.buildFilterParams();

        // 🔧 关键修复：更新全局状态，确保表格管理器能够获取筛选参数
        if (window.meteora) {
            window.meteora.state.currentFilters = filterParams;
        }

        // 保存当前筛选条件到后端（用于报警筛选）
        this.saveCurrentFilterToBackend(filterParams);

        // 触发筛选事件
        if (window.meteora && window.meteora.emit) {
            window.meteora.emit('filtersApplied', filterParams);
        } else {
            // 备用事件触发
            const event = new CustomEvent('filtersApplied', { detail: filterParams });
            document.dispatchEvent(event);
        }

        console.log('🎯 筛选器已应用:', filterParams);
    }

    /**
     * 构建筛选参数 - 修复参数映射
     */
    buildFilterParams() {
        const params = {};

        // 参数映射：前端字段名 -> API参数名
        const paramMap = {
            search: 'search',
            liquidityMin: 'min_liquidity',
            liquidityMax: 'max_liquidity',
            apyMin: 'min_apy',
            apyMax: 'max_apy',
            volumeMin: 'min_volume_24h',
            volumeMax: 'max_volume_24h',
            feeTvlRatioMin: 'min_fee_tvl_ratio',
            feeTvlRatioMax: 'max_fee_tvl_ratio',
            estimatedDailyFeeRateMin: 'min_estimated_daily_fee_rate',
            estimatedDailyFeeRateMax: 'max_estimated_daily_fee_rate'
        };

        Object.entries(this.filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                const apiKey = paramMap[key];
                if (apiKey) {
                    params[apiKey] = value;
                }
            }
        });

        return params;
    }

    /**
     * 获取排序参数
     */
    getSortParams() {
        const sortField = document.getElementById('sortField');
        const sortDirection = document.getElementById('sortDirection');

        return {
            sort: sortField ? sortField.value : 'liquidity',
            dir: sortDirection ? sortDirection.value : 'DESC'
        };
    }

    /**
     * 清除所有筛选器
     */
    clearAllFilters(notify = true) {
        // 重置筛选器对象
        Object.keys(this.filters).forEach(key => {
            this.filters[key] = key === 'search' ? '' : null;
        });

        // 重置快速筛选
        this.currentQuickFilter = 'all';
        this.updateQuickFilterButtons();

        // 重置UI
        this.updateAdvancedInputs();

        // 重置预设选择器
        const presetsSelect = document.getElementById('filterPresets');
        if (presetsSelect) {
            presetsSelect.value = '';
        }

        // 清除本地存储
        this.clearFiltersFromStorage();

        this.applyFilters();

        if (notify && window.meteora) {
            window.meteora.showNotification('已清除所有筛选器', 'info', 2000);
        }

        console.log('🔄 筛选器已清除');
    }

    /**
     * 事件发射器
     */
    emit(event, data) {
        if (window.meteora) {
            window.meteora.emit(event, data);
        } else {
            // 简单的事件分发
            const customEvent = new CustomEvent(event, { detail: data });
            document.dispatchEvent(customEvent);
        }
    }

    /**
     * 获取当前筛选器状态
     */
    getFilters() {
        return { ...this.filters };
    }

    /**
     * 设置筛选器
     */
    setFilters(filters) {
        this.filters = { ...this.filters, ...filters };
        this.currentQuickFilter = 'custom';
        this.updateQuickFilterButtons();
        this.updateAdvancedInputs();
        this.applyFilters();
    }

    /**
     * 获取活跃筛选器数量
     */
    getActiveFiltersCount() {
        return Object.values(this.filters).filter(value =>
            value !== null && value !== undefined && value !== ''
        ).length;
    }

    /**
     * 保存筛选器状态到本地存储
     */
    saveFiltersToStorage() {
        try {
            const filtersData = {
                filters: this.filters,
                currentQuickFilter: this.currentQuickFilter,
                timestamp: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(filtersData));
            console.log('💾 筛选器状态已保存到本地存储');
        } catch (error) {
            console.warn('⚠️ 保存筛选器状态失败:', error);
        }
    }

    /**
     * 从本地存储加载筛选器状态
     */
    loadFiltersFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);

                // 检查数据是否过期（24小时）
                const maxAge = 24 * 60 * 60 * 1000; // 24小时
                if (data.timestamp && (Date.now() - data.timestamp) > maxAge) {
                    console.log('📅 筛选器状态已过期，使用默认值');
                    localStorage.removeItem(this.storageKey);
                    return null;
                }

                if (data.filters) {
                    this.currentQuickFilter = data.currentQuickFilter || 'custom';
                    console.log('🔄 从本地存储恢复筛选器状态');
                    return data.filters;
                }
            }
        } catch (error) {
            console.warn('⚠️ 加载筛选器状态失败:', error);
        }
        return null;
    }

    /**
     * 清除本地存储的筛选器状态
     */
    clearFiltersFromStorage() {
        try {
            localStorage.removeItem(this.storageKey);
            console.log('🗑️ 已清除本地存储的筛选器状态');
        } catch (error) {
            console.warn('⚠️ 清除筛选器状态失败:', error);
        }
    }

    /**
     * 恢复筛选器状态到UI界面
     */
    restoreFiltersToUI() {
        // 恢复高级筛选输入框的值
        this.updateAdvancedInputs();

        // 恢复快速筛选按钮状态
        this.updateQuickFilterButtons();

        // 如果有保存的筛选器，自动应用
        if (this.getActiveFiltersCount() > 0) {
            setTimeout(() => {
                this.applyFilters();
                console.log('🎯 已自动应用保存的筛选器');
            }, 100);
        }
    }

    /**
     * 保存当前筛选条件到后端（用于报警筛选）
     */
    async saveCurrentFilterToBackend(filterParams) {
        try {
            // 如果没有筛选条件，不保存
            if (!filterParams || Object.keys(filterParams).length === 0) {
                return;
            }

            // 调用后端API保存筛选条件
            const response = await fetch('/api/filters/current', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(filterParams)
            });

            const data = await response.json();
            if (data.success) {
                console.log('✅ 当前筛选条件已保存到后端，可用于报警筛选');
            } else {
                console.warn('⚠️ 保存筛选条件失败:', data.error);
            }

        } catch (error) {
            console.warn('⚠️ 保存筛选条件到后端失败:', error);
        }
    }
}

// 创建全局实例
window.FilterManager = FilterManager;

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.filterManager = new FilterManager();
}); 