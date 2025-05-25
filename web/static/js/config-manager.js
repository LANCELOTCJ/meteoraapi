/**
 * Meteora监控平台 V2.0 - 字段配置管理器
 * 处理表格列配置、字段显示/隐藏、拖拽排序等功能
 */

class ConfigManager {
    constructor() {
        this.fieldConfigs = {
            default: {
                name: '默认视图',
                fields: ['name', 'address', 'bin_step', 'liquidity', 'trade_volume_24h', 'fees_24h', 'fees_hour_1', 'fee_tvl_ratio', 'estimated_daily_fee_rate']
            },
            trader: {
                name: '交易员视图',
                fields: ['name', 'liquidity', 'trade_volume_24h', 'current_price', 'price_change_24h', 'bin_step']
            },
            investor: {
                name: '投资者视图',
                fields: ['name', 'liquidity', 'fees_24h', 'fees_hour_1', 'fee_tvl_ratio', 'estimated_daily_fee_rate', 'apy', 'last_updated']
            },
            technical: {
                name: '技术分析视图',
                fields: ['name', 'address', 'bin_step', 'active_bin_id', 'bins_count', 'last_updated']
            },
            custom: {
                name: '自定义配置',
                fields: []
            }
        };

        this.currentConfig = 'default';
        this.customFields = [];

        this.init();
    }

    /**
     * 初始化配置管理器
     */
    init() {
        this.setupEventListeners();
        this.loadFieldsList();
        this.loadSavedConfig();

        console.log('⚙️ 字段配置管理器初始化完成');
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 配置方案选择器
        const columnPresets = document.getElementById('columnPresets');
        if (columnPresets) {
            columnPresets.addEventListener('change', this.handlePresetChange.bind(this));
        }

        // 重置按钮
        const resetColumns = document.getElementById('resetColumns');
        if (resetColumns) {
            resetColumns.addEventListener('click', this.resetToDefault.bind(this));
        }

        // 监听表格管理器变化
        if (window.meteora) {
            window.meteora.on('fieldsUpdated', this.handleFieldsUpdated.bind(this));
        }
    }

    /**
     * 加载字段列表
     */
    loadFieldsList() {
        const fieldList = document.getElementById('fieldList');
        if (!fieldList) return;

        // 获取可用字段（从表格管理器）
        const availableFields = window.tableManager ?
            window.tableManager.availableFields :
            this.getDefaultFields();

        fieldList.innerHTML = '';

        Object.entries(availableFields).forEach(([key, field]) => {
            const fieldItem = this.createFieldItem(key, field);
            fieldList.appendChild(fieldItem);
        });

        // 使字段列表可拖拽排序
        this.enableDragAndDrop(fieldList);
    }

    /**
     * 创建字段项
     */
    createFieldItem(key, field) {
        const item = document.createElement('div');
        item.className = 'field-item';
        item.dataset.field = key;
        item.draggable = true;

        const isVisible = this.isFieldVisible(key);

        item.innerHTML = `
            <input type="checkbox" class="field-checkbox" ${isVisible ? 'checked' : ''}>
            <span class="field-name">${field.label}</span>
            <span class="field-type">${field.type}</span>
            <i class="fas fa-grip-vertical field-drag-handle"></i>
        `;

        // 添加复选框事件
        const checkbox = item.querySelector('.field-checkbox');
        checkbox.addEventListener('change', () => {
            this.toggleField(key, checkbox.checked);
        });

        return item;
    }

    /**
     * 启用拖拽排序
     */
    enableDragAndDrop(container) {
        let draggedItem = null;

        container.addEventListener('dragstart', (e) => {
            draggedItem = e.target.closest('.field-item');
            if (draggedItem) {
                draggedItem.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        container.addEventListener('dragend', (e) => {
            if (draggedItem) {
                draggedItem.classList.remove('dragging');
                draggedItem = null;
            }
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const afterElement = this.getDragAfterElement(container, e.clientY);
            if (afterElement == null) {
                container.appendChild(draggedItem);
            } else {
                container.insertBefore(draggedItem, afterElement);
            }
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            this.updateFieldOrder();
        });
    }

    /**
     * 获取拖拽后的元素位置
     */
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.field-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * 检查字段是否可见
     */
    isFieldVisible(fieldKey) {
        if (this.currentConfig === 'custom') {
            return this.customFields.includes(fieldKey);
        } else {
            const config = this.fieldConfigs[this.currentConfig];
            return config ? config.fields.includes(fieldKey) : false;
        }
    }

    /**
     * 切换字段显示状态
     */
    toggleField(fieldKey, visible) {
        if (this.currentConfig !== 'custom') {
            // 切换到自定义配置
            this.switchToCustom();
        }

        if (visible) {
            if (!this.customFields.includes(fieldKey)) {
                this.customFields.push(fieldKey);
            }
        } else {
            this.customFields = this.customFields.filter(f => f !== fieldKey);
        }

        this.applyFieldChanges();
        this.saveConfig();
    }

    /**
     * 处理预设方案变化
     */
    handlePresetChange(event) {
        const preset = event.target.value;
        this.applyPreset(preset);
    }

    /**
     * 应用预设方案
     */
    applyPreset(preset) {
        if (!this.fieldConfigs[preset]) return;

        this.currentConfig = preset;

        // 更新字段复选框状态
        this.updateFieldCheckboxes();

        // 应用字段变化
        this.applyFieldChanges();

        // 保存配置
        this.saveConfig();

        // 显示通知
        if (window.meteora) {
            window.meteora.showNotification(
                `已应用配置方案: ${this.fieldConfigs[preset].name}`,
                'info',
                2000
            );
        }
    }

    /**
     * 切换到自定义配置
     */
    switchToCustom() {
        // 保存当前可见字段到自定义配置
        this.customFields = this.getCurrentVisibleFields();
        this.currentConfig = 'custom';

        // 更新UI
        const columnPresets = document.getElementById('columnPresets');
        if (columnPresets) {
            columnPresets.value = 'custom';
        }
    }

    /**
     * 获取当前可见字段
     */
    getCurrentVisibleFields() {
        if (window.tableManager) {
            return window.tableManager.getVisibleFields();
        } else {
            return this.fieldConfigs.default.fields;
        }
    }

    /**
     * 更新字段复选框状态
     */
    updateFieldCheckboxes() {
        const fieldItems = document.querySelectorAll('.field-item');

        fieldItems.forEach(item => {
            const fieldKey = item.dataset.field;
            const checkbox = item.querySelector('.field-checkbox');
            const isVisible = this.isFieldVisible(fieldKey);

            if (checkbox) {
                checkbox.checked = isVisible;
            }
        });
    }

    /**
     * 更新字段顺序
     */
    updateFieldOrder() {
        const fieldItems = document.querySelectorAll('.field-item');
        const newOrder = Array.from(fieldItems).map(item => item.dataset.field);

        if (this.currentConfig !== 'custom') {
            this.switchToCustom();
        }

        // 重新排序自定义字段
        this.customFields = newOrder.filter(field => this.customFields.includes(field));

        this.applyFieldChanges();
        this.saveConfig();
    }

    /**
     * 应用字段变化
     */
    applyFieldChanges() {
        const visibleFields = this.getVisibleFields();

        // 更新表格管理器
        if (window.tableManager) {
            window.tableManager.setVisibleFields(visibleFields);
        }

        // 触发事件
        if (window.meteora) {
            window.meteora.emit('fieldsChanged', visibleFields);
        }
    }

    /**
     * 获取可见字段列表
     */
    getVisibleFields() {
        if (this.currentConfig === 'custom') {
            return this.customFields;
        } else {
            const config = this.fieldConfigs[this.currentConfig];
            return config ? config.fields : this.fieldConfigs.default.fields;
        }
    }

    /**
     * 重置到默认配置
     */
    resetToDefault() {
        this.applyPreset('default');

        if (window.meteora) {
            window.meteora.showNotification('已重置为默认配置', 'info', 2000);
        }
    }

    /**
     * 保存配置
     */
    saveConfig() {
        try {
            const config = {
                currentConfig: this.currentConfig,
                customFields: this.customFields,
                timestamp: new Date().toISOString()
            };

            localStorage.setItem('meteora_field_config', JSON.stringify(config));
        } catch (error) {
            console.error('保存字段配置失败:', error);
        }
    }

    /**
     * 加载保存的配置
     */
    loadSavedConfig() {
        try {
            const saved = localStorage.getItem('meteora_field_config');
            if (saved) {
                const config = JSON.parse(saved);
                this.currentConfig = config.currentConfig || 'default';
                this.customFields = config.customFields || [];

                // 更新UI
                const columnPresets = document.getElementById('columnPresets');
                if (columnPresets) {
                    columnPresets.value = this.currentConfig;
                }

                this.updateFieldCheckboxes();
                this.applyFieldChanges();
            }
        } catch (error) {
            console.warn('加载字段配置失败:', error);
        }
    }

    /**
     * 处理字段更新事件
     */
    handleFieldsUpdated(fields) {
        this.loadFieldsList();
    }

    /**
     * 导出配置
     */
    exportConfig() {
        const config = {
            fieldConfigs: this.fieldConfigs,
            currentConfig: this.currentConfig,
            customFields: this.customFields,
            exportTime: new Date().toISOString()
        };

        if (window.meteora) {
            window.meteora.exportData(config, 'meteora-field-config', 'json');
        }
    }

    /**
     * 导入配置
     */
    importConfig(configData) {
        try {
            if (configData.fieldConfigs) {
                this.fieldConfigs = { ...this.fieldConfigs, ...configData.fieldConfigs };
            }

            if (configData.currentConfig) {
                this.currentConfig = configData.currentConfig;
            }

            if (configData.customFields) {
                this.customFields = configData.customFields;
            }

            this.updateFieldCheckboxes();
            this.applyFieldChanges();
            this.saveConfig();

            if (window.meteora) {
                window.meteora.showNotification('配置导入成功', 'success');
            }

        } catch (error) {
            console.error('导入配置失败:', error);
            if (window.meteora) {
                window.meteora.showNotification('配置导入失败', 'error');
            }
        }
    }

    /**
     * 获取默认字段（备用）
     */
    getDefaultFields() {
        return {
            'name': { label: '池子名称', type: 'text', sortable: true, width: '200px' },
            'address': { label: '池子地址', type: 'address', sortable: false, width: '120px' },
            'liquidity': { label: '流动性 (TVL)', type: 'currency', sortable: true, width: '120px' },
            'apy': { label: 'APY %', type: 'percentage', sortable: true, width: '100px' },
            'trade_volume_24h': { label: '24h交易量', type: 'currency', sortable: true, width: '120px' },
            'fees_24h': { label: '24h手续费', type: 'currency', sortable: true, width: '120px' },
            'current_price': { label: '当前价格', type: 'currency', sortable: true, width: '100px' },
            'price_change_24h': { label: '24h价格变化', type: 'percentage', sortable: true, width: '120px' },
            'bin_step': { label: '价格精度', type: 'number', sortable: true, width: '80px' },
            'active_bin_id': { label: '活跃Bin ID', type: 'number', sortable: true, width: '100px' },
            'bins_count': { label: 'Bin数量', type: 'number', sortable: true, width: '80px' },
            'last_updated': { label: '最后更新', type: 'datetime', sortable: true, width: '140px' }
        };
    }

    /**
     * 获取当前配置
     */
    getCurrentConfig() {
        return {
            name: this.currentConfig,
            fields: this.getVisibleFields()
        };
    }
}

// 创建全局实例
window.ConfigManager = ConfigManager;

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.configManager = new ConfigManager();
}); 