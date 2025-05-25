/**
 * Meteora监控平台 V2.0 - 表格管理器
 * 处理数据表格的显示、排序、分页等功能
 */

class TableManager {
    constructor() {
        this.currentData = [];
        this.sortConfig = { field: 'liquidity', direction: 'DESC' };
        this.currentPage = 1;
        this.pageSize = 100;
        this.totalPages = 1;
        this.selectedRows = new Set();
        this.savedTableContent = null; // 保存表格内容用于视图切换

        // 🔧 新增：报警池子追踪
        this.alertedPools = new Set(); // 存储报警的池子地址

        // 字段配置
        this.availableFields = {
            'name': { label: '池子名称', type: 'text', sortable: true, width: '200px' },
            'address': { label: '池子地址', type: 'address', sortable: false, width: '120px' },
            'bin_step': { label: '价格范围', type: 'number', sortable: true, width: '80px' },
            'liquidity': { label: '流动性 (TVL)', type: 'currency', sortable: true, width: '120px' },
            'fee_tvl_ratio': { label: '24Hfee/tvl %', type: 'percentage', sortable: true, width: '110px' },
            'apy': { label: 'APY % (日化)', type: 'percentage', sortable: true, width: '100px' },
            'apr': { label: 'APR % (日化)', type: 'percentage', sortable: true, width: '100px' },
            'trade_volume_24h': { label: '24h交易量', type: 'currency', sortable: true, width: '120px' },
            'fees_24h': { label: '24h手续费', type: 'currency', sortable: true, width: '120px' },
            'fees_hour_1': { label: '1h手续费', type: 'currency', sortable: true, width: '120px' },
            'estimated_daily_fee_rate': { label: '1H估算日收益率%', type: 'percentage', sortable: true, width: '140px' },
            'current_price': { label: '当前价格', type: 'currency', sortable: true, width: '100px' },
            'price_change_24h': { label: '24h价格变化', type: 'percentage', sortable: true, width: '120px' },
            'active_bin_id': { label: '活跃Bin ID', type: 'number', sortable: true, width: '100px' },
            'bins_count': { label: 'Bin数量', type: 'number', sortable: true, width: '80px' },
            'last_updated': { label: '最后更新', type: 'datetime', sortable: true, width: '140px' }
        };

        this.visibleFields = ['name', 'address', 'bin_step', 'liquidity', 'trade_volume_24h', 'fees_24h', 'fees_hour_1', 'fee_tvl_ratio', 'estimated_daily_fee_rate', 'apy', 'apr', 'price_change_24h'];

        this.init();
    }

    /**
     * 初始化表格管理器
     */
    init() {
        this.setupEventListeners();
        this.setupTable();
        this.setupPagination();

        console.log('📋 表格管理器初始化完成');
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 刷新按钮
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', this.handleRefresh.bind(this));
        }

        // 导出按钮
        const exportCSV = document.getElementById('exportCSV');
        const exportJSON = document.getElementById('exportJSON');

        if (exportCSV) {
            exportCSV.addEventListener('click', () => this.exportData('csv'));
        }
        if (exportJSON) {
            exportJSON.addEventListener('click', () => this.exportData('json'));
        }

        // 页面大小选择器
        const pageSize = document.getElementById('pageSize');
        if (pageSize) {
            pageSize.addEventListener('change', this.handlePageSizeChange.bind(this));
        }

        // 视图切换
        const tableView = document.getElementById('tableView');
        const chartView = document.getElementById('chartView');

        if (tableView) {
            tableView.addEventListener('click', () => this.switchView('table'));
        }
        if (chartView) {
            chartView.addEventListener('click', () => this.switchView('chart'));
        }

        // 监听筛选器事件
        if (window.meteora) {
            window.meteora.on('filtersApplied', this.handleFiltersApplied.bind(this));
            window.meteora.on('dataRefreshStart', this.showLoading.bind(this));
        }

        // 键盘事件
        document.addEventListener('keydown', this.handleKeyboardEvents.bind(this));
    }

    /**
     * 设置表格结构
     */
    setupTable() {
        const table = document.getElementById('poolsTable');
        if (!table) return;

        // 创建表头
        this.createTableHeader();

        // 创建表体
        this.createTableBody();
    }

    /**
     * 创建表格头部
     */
    createTableHeader() {
        const thead = document.querySelector('#poolsTable thead');
        if (!thead) return;

        const headerRow = document.createElement('tr');

        // 添加选择列
        const selectHeader = document.createElement('th');
        selectHeader.innerHTML = `
            <input type="checkbox" id="selectAll" class="form-check-input">
        `;
        selectHeader.style.width = '40px';
        headerRow.appendChild(selectHeader);

        // 添加数据列
        this.visibleFields.forEach(fieldKey => {
            const field = this.availableFields[fieldKey];
            if (!field) return;

            const th = document.createElement('th');
            th.dataset.field = fieldKey;
            th.style.width = field.width;

            if (field.sortable) {
                th.className = 'sortable-header';
                th.innerHTML = `
                    ${field.label}
                    <i class="fas fa-sort sort-icon"></i>
                `;
                th.addEventListener('click', () => this.handleSort(fieldKey));
            } else {
                th.textContent = field.label;
            }

            headerRow.appendChild(th);
        });

        thead.innerHTML = '';
        thead.appendChild(headerRow);

        // 设置全选事件
        const selectAll = document.getElementById('selectAll');
        if (selectAll) {
            selectAll.addEventListener('change', this.handleSelectAll.bind(this));
        }
    }

    /**
     * 创建表格主体
     */
    createTableBody() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (this.currentData.length === 0) {
            this.showEmptyState();
            return;
        }

        this.currentData.forEach((row, index) => {
            const tr = this.createTableRow(row, index);
            tbody.appendChild(tr);
        });

        // 🔧 恢复报警池子的样式
        this.refreshAlertedPoolsDisplay();

        this.updateTableStats();
    }

    /**
     * 检查是否为APR字段
     */
    isAPRField(rowData, type) {
        // 检查当前处理的字段是否是APR相关字段
        const currentField = this.getCurrentFieldKey();
        return currentField && (currentField === 'apr' || currentField.includes('apr'));
    }

    /**
     * 获取当前正在处理的字段key（这是一个简化的实现）
     */
    getCurrentFieldKey() {
        // 这里需要在创建表格行时传递字段信息
        return this._currentFieldKey || null;
    }

    /**
     * 复制地址到剪贴板
     */
    async copyAddressToClipboard(address) {
        try {
            if (window.meteora) {
                await window.meteora.copyToClipboard(address);
            } else {
                // 备用方法
                await navigator.clipboard.writeText(address);
                this.showNotification('地址已复制到剪贴板', 'success');
            }
        } catch (error) {
            console.error('复制地址失败:', error);
            this.showNotification('复制失败，请手动复制', 'error');
        }
    }

    /**
     * 显示通知（如果window.meteora不可用的备用方法）
     */
    showNotification(message, type) {
        if (window.meteora) {
            window.meteora.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * 创建表格行
     */
    createTableRow(rowData, index) {
        const tr = document.createElement('tr');
        tr.dataset.address = rowData.address;
        tr.className = 'table-row';

        // 🔧 检查是否为报警池子，添加特殊样式
        if (this.alertedPools.has(rowData.address)) {
            tr.classList.add('alert-pool-row');
        }

        // 选择框列
        const selectCell = document.createElement('td');
        selectCell.innerHTML = `
            <input type="checkbox" class="form-check-input row-select" value="${rowData.address}">
        `;
        tr.appendChild(selectCell);

        // 数据列
        this.visibleFields.forEach(fieldKey => {
            const td = document.createElement('td');
            const field = this.availableFields[fieldKey];
            let value = rowData[fieldKey];

            // 计算fee_tvl_ratio字段
            if (fieldKey === 'fee_tvl_ratio') {
                const fees24h = parseFloat(rowData.fees_24h) || 0;
                const liquidity = parseFloat(rowData.liquidity) || 0;
                value = liquidity > 0 ? (fees24h / liquidity) * 100 : 0;
            }

            // 计算estimated_daily_fee_rate字段
            if (fieldKey === 'estimated_daily_fee_rate') {
                const fees1h = parseFloat(rowData.fees_hour_1) || 0;
                const liquidity = parseFloat(rowData.liquidity) || 0;
                value = liquidity > 0 ? (fees1h * 24 / liquidity) * 100 : 0;
            }

            td.className = `cell-${field.type}`;
            // 设置当前字段key供格式化函数使用
            this._currentFieldKey = fieldKey;
            td.innerHTML = this.formatCellValue(value, field.type, rowData);

            tr.appendChild(td);
        });

        // 添加事件监听器
        tr.addEventListener('click', (e) => {
            // 检查是否点击了地址元素
            if (e.target.classList.contains('clickable-address')) {
                e.stopPropagation();
                const address = e.target.dataset.address;
                this.copyAddressToClipboard(address);
                return;
            }

            if (e.target.type !== 'checkbox') {
                this.handleRowClick(rowData, tr);
            }
        });

        tr.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, rowData);
        });

        return tr;
    }

    /**
     * 获取趋势样式类
     */
    getTrendStyleClass(fieldKey, rowData) {
        if (!rowData) return '';

        // 趋势字段映射
        const trendFieldMap = {
            'liquidity': 'liquidity_trend',
            'trade_volume_24h': 'trade_volume_24h_trend',
            'fees_24h': 'fees_24h_trend',
            'fees_hour_1': 'fees_hour_1_trend'
        };

        const trendField = trendFieldMap[fieldKey];
        if (!trendField || !rowData[trendField]) {
            // 调试日志
            if (fieldKey && trendField) {
                console.log(`🔍 趋势字段调试: ${fieldKey} -> ${trendField}, 值: ${rowData[trendField]}`);
            }
            return ''; // 没有趋势数据，返回默认样式
        }

        const trendValue = rowData[trendField];
        let styleClass = '';

        switch (trendValue) {
            case 'increase':
                styleClass = 'trend-increase'; // 绿色
                break;
            case 'decrease':
                styleClass = 'trend-decrease'; // 红色
                break;
            case 'neutral':
            default:
                styleClass = ''; // 白色（默认）
                break;
        }

        // 调试日志
        console.log(`🎨 趋势样式: ${fieldKey} -> ${trendField} = ${trendValue} -> ${styleClass}`);

        return styleClass;
    }

    /**
     * 格式化单元格值
     */
    formatCellValue(value, type, rowData) {
        if (value === null || value === undefined) {
            return '<span class="text-muted">-</span>';
        }

        // 获取当前字段的趋势样式
        const trendClass = this.getTrendStyleClass(this._currentFieldKey, rowData);

        switch (type) {
            case 'currency':
                const formatted = window.meteora ? window.meteora.formatCurrency(value) : `$${value}`;
                return `<span class="cell-number ${trendClass}">${formatted}</span>`;

            case 'percentage':
                // 特殊处理APR字段 - 除以365显示日化收益
                let displayValue = value;
                if (rowData && type === 'percentage' &&
                    (rowData.fieldType === 'apr' || this.isAPRField(rowData, type))) {
                    displayValue = value / 365;
                }
                const percent = window.meteora ? window.meteora.formatPercentage(displayValue) : `${displayValue}%`;
                const className = value > 0 ? 'cell-positive' : value < 0 ? 'cell-negative' : 'cell-neutral';
                return `<span class="cell-percentage ${className} ${trendClass}">${percent}</span>`;

            case 'number':
                const number = window.meteora ? window.meteora.formatNumber(value) : value;
                return `<span class="cell-number ${trendClass}">${number}</span>`;

            case 'address':
                const shortAddr = window.meteora ? window.meteora.formatAddress(value) : value;
                return `<span class="cell-address clickable-address" 
                            title="点击复制完整地址: ${value}" 
                            data-address="${value}">${shortAddr}</span>`;

            case 'text':
                // 🔧 特殊处理池子名称，为报警池子添加呼吸灯效果
                let nameClass = 'cell-pool-name';
                if (this.alertedPools.has(rowData.address)) {
                    nameClass += ' alert-pool-name';
                }

                if (value.length > 30) {
                    return `<span class="${nameClass}" title="${value}">${value.substring(0, 30)}...</span>`;
                }
                return `<span class="${nameClass}">${value}</span>`;

            case 'datetime':
                const time = window.meteora ? window.meteora.formatTime(new Date(value)) : value;
                return `<span class="text-muted">${time}</span>`;

            default:
                return value;
        }
    }

    /**
     * 处理排序
     */
    handleSort(field) {
        if (this.sortConfig.field === field) {
            // 切换排序方向
            this.sortConfig.direction = this.sortConfig.direction === 'ASC' ? 'DESC' : 'ASC';
        } else {
            // 新字段，默认降序
            this.sortConfig.field = field;
            this.sortConfig.direction = 'DESC';
        }

        // 更新UI
        this.updateSortIndicators();

        // 更新核心状态
        if (window.meteora) {
            window.meteora.state.sortConfig = this.sortConfig;
        }

        // 重新获取数据
        this.loadData();
    }

    /**
     * 更新排序指示器
     */
    updateSortIndicators() {
        // 清除所有排序指示器
        document.querySelectorAll('.sortable-header').forEach(header => {
            header.classList.remove('sorted');
            const icon = header.querySelector('.sort-icon');
            if (icon) {
                icon.className = 'fas fa-sort sort-icon';
            }
        });

        // 设置当前排序字段的指示器
        const currentHeader = document.querySelector(`[data-field="${this.sortConfig.field}"]`);
        if (currentHeader) {
            currentHeader.classList.add('sorted');
            const icon = currentHeader.querySelector('.sort-icon');
            if (icon) {
                icon.className = `fas fa-sort-${this.sortConfig.direction === 'ASC' ? 'up' : 'down'} sort-icon`;
            }
        }
    }

    /**
     * 处理行点击
     */
    handleRowClick(rowData, tr) {
        // 切换行选择状态
        const checkbox = tr.querySelector('.row-select');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            this.handleRowSelect(checkbox);
        }

        // 显示详情（可选）
        console.log('选中池子:', rowData);
    }

    /**
     * 处理行选择
     */
    handleRowSelect(checkbox) {
        const address = checkbox.value;
        const row = checkbox.closest('tr');

        if (checkbox.checked) {
            this.selectedRows.add(address);
            row.classList.add('selected');
        } else {
            this.selectedRows.delete(address);
            row.classList.remove('selected');
        }

        this.updateSelectAllState();
    }

    /**
     * 处理全选
     */
    handleSelectAll(event) {
        const checked = event.target.checked;
        const checkboxes = document.querySelectorAll('.row-select');

        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            this.handleRowSelect(checkbox);
        });
    }

    /**
     * 更新全选状态
     */
    updateSelectAllState() {
        const selectAll = document.getElementById('selectAll');
        const checkboxes = document.querySelectorAll('.row-select');
        const checkedCount = document.querySelectorAll('.row-select:checked').length;

        if (selectAll) {
            selectAll.checked = checkedCount === checkboxes.length && checkboxes.length > 0;
            selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
        }
    }

    /**
     * 显示上下文菜单
     */
    showContextMenu(event, rowData) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <button class="context-menu-item" data-action="copy-address">
                <i class="fas fa-copy me-2"></i>复制地址
            </button>
            <button class="context-menu-item" data-action="view-detail">
                <i class="fas fa-eye me-2"></i>查看详情
            </button>
            <div class="context-menu-divider"></div>
            <button class="context-menu-item" data-action="open-solana">
                <i class="fas fa-external-link-alt me-2"></i>在Solana Explorer查看
            </button>
        `;

        // 定位菜单
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';

        // 添加到页面
        document.body.appendChild(menu);

        // 添加事件监听器
        menu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            this.handleContextMenuAction(action, rowData);
            menu.remove();
        });

        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            });
        }, 0);
    }

    /**
     * 处理上下文菜单动作
     */
    handleContextMenuAction(action, rowData) {
        switch (action) {
            case 'copy-address':
                if (window.meteora) {
                    window.meteora.copyToClipboard(rowData.address);
                }
                break;

            case 'view-detail':
                this.showPoolDetail(rowData);
                break;

            case 'open-solana':
                window.open(`https://explorer.solana.com/address/${rowData.address}`, '_blank');
                break;
        }
    }

    /**
     * 显示池子详情
     */
    showPoolDetail(rowData) {
        console.log('显示池子详情:', rowData);
        // 这里可以实现详情弹窗或跳转
    }

    /**
     * 设置分页
     */
    setupPagination() {
        // 分页逻辑暂时简化，后续可以扩展
        this.updatePagination();
    }

    /**
     * 更新分页
     */
    updatePagination() {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;

        pagination.innerHTML = '';

        if (this.totalPages <= 1) return;

        // 创建分页按钮
        const maxVisible = 5;
        const start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        const end = Math.min(this.totalPages, start + maxVisible - 1);

        // 上一页
        if (this.currentPage > 1) {
            pagination.appendChild(this.createPageButton('上一页', this.currentPage - 1));
        }

        // 页码
        for (let i = start; i <= end; i++) {
            pagination.appendChild(this.createPageButton(i, i, i === this.currentPage));
        }

        // 下一页
        if (this.currentPage < this.totalPages) {
            pagination.appendChild(this.createPageButton('下一页', this.currentPage + 1));
        }
    }

    /**
     * 创建分页按钮
     */
    createPageButton(text, page, active = false) {
        const li = document.createElement('li');
        li.className = `page-item ${active ? 'active' : ''}`;

        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.textContent = text;

        a.addEventListener('click', (e) => {
            e.preventDefault();
            if (!active) {
                this.changePage(page);
            }
        });

        li.appendChild(a);
        return li;
    }

    /**
     * 改变页面
     */
    changePage(page) {
        this.currentPage = page;
        this.loadData();
    }

    /**
     * 处理页面大小变化
     */
    handlePageSizeChange(event) {
        this.pageSize = parseInt(event.target.value);
        this.currentPage = 1;
        this.loadData();
    }

    /**
     * 处理刷新
     */
    handleRefresh() {
        this.loadData(true);
    }

    /**
     * 处理筛选器应用
     */
    handleFiltersApplied(filters) {
        this.currentPage = 1;
        this.loadData();
    }

    /**
     * 处理键盘事件
     */
    handleKeyboardEvents(event) {
        // Ctrl+A: 全选
        if ((event.ctrlKey || event.metaKey) && event.key === 'a' && !event.target.matches('input, textarea')) {
            event.preventDefault();
            const selectAll = document.getElementById('selectAll');
            if (selectAll) {
                selectAll.checked = true;
                selectAll.dispatchEvent(new Event('change'));
            }
        }
    }

    /**
     * 加载数据
     */
    async loadData(force = false) {
        this.showLoading();

        try {
            // 构建请求参数
            const params = this.buildRequestParams();

            // 获取数据
            const response = await window.meteora.apiRequest(`/pools?${params}`);

            if (response.success) {
                this.currentData = response.data;

                // 使用后端返回的分页信息
                const totalRecords = response.total || 0;
                this.totalPages = response.total_pages || Math.ceil(totalRecords / this.pageSize);
                this.currentPage = response.current_page || this.currentPage;

                this.updatePagination();
                this.createTableBody();
                this.hideLoading();

                // 更新统计
                if (window.meteora) {
                    window.meteora.updateStats({
                        total: totalRecords,
                        filtered: totalRecords,
                        current_page: this.currentPage,
                        total_pages: this.totalPages,
                        page_size: response.page_size || this.pageSize
                    });
                }

                // 更新显示计数
                this.updateDisplayCount(totalRecords);

            } else {
                throw new Error(response.error || '数据加载失败');
            }

        } catch (error) {
            console.error('数据加载失败:', error);
            this.showError(error.message);

            if (window.meteora) {
                window.meteora.showNotification('数据加载失败: ' + error.message, 'error');
            }
        }
    }

    /**
     * 构建请求参数
     */
    buildRequestParams() {
        const params = new URLSearchParams();

        // 分页参数
        params.append('limit', this.pageSize);
        params.append('offset', (this.currentPage - 1) * this.pageSize);

        // 排序参数
        params.append('sort', this.sortConfig.field);
        params.append('dir', this.sortConfig.direction);

        // 字段参数 - 包含可见字段和趋势字段
        const requestFields = [...this.visibleFields];

        // 添加趋势字段，确保能获取趋势数据
        const trendFields = ['liquidity_trend', 'trade_volume_24h_trend', 'fees_24h_trend', 'fees_hour_1_trend'];
        trendFields.forEach(field => {
            if (!requestFields.includes(field)) {
                requestFields.push(field);
            }
        });

        params.append('fields', requestFields.join(','));

        // 筛选参数
        if (window.meteora && window.meteora.state.currentFilters) {
            Object.entries(window.meteora.state.currentFilters).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    params.append(key, value);
                }
            });
        }

        return params.toString();
    }

    /**
     * 显示加载状态 - 使用顶部进度条而不是覆盖界面
     */
    showLoading() {
        // 创建或显示顶部进度条
        let progressBar = document.getElementById('tableLoadingProgress');
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.id = 'tableLoadingProgress';
            progressBar.className = 'table-loading-progress';
            progressBar.innerHTML = `
                <div class="progress-bar-container">
                    <div class="progress-bar"></div>
                </div>
                <div class="loading-text">
                    <i class="fas fa-sync fa-spin"></i> 数据加载中...
                </div>
            `;

            // 插入到表格容器前面
            const tableContainer = document.getElementById('tableContainer');
            if (tableContainer && tableContainer.parentNode) {
                tableContainer.parentNode.insertBefore(progressBar, tableContainer);
            }
        }

        progressBar.style.display = 'block';

        // 隐藏空状态
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.classList.add('d-none');
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const progressBar = document.getElementById('tableLoadingProgress');
        if (progressBar) {
            progressBar.style.display = 'none';
        }
    }

    /**
     * 显示空状态
     */
    showEmptyState() {
        const overlay = document.getElementById('loadingOverlay');
        const emptyState = document.getElementById('emptyState');

        if (overlay) overlay.style.display = 'none';
        if (emptyState) emptyState.classList.remove('d-none');
    }

    /**
     * 显示错误
     */
    showError(message) {
        this.hideLoading();
        console.error('表格错误:', message);
    }

    /**
     * 更新表格统计
     */
    updateTableStats() {
        const displayCount = document.getElementById('displayCount');
        if (displayCount) {
            displayCount.textContent = this.currentData.length;
        }
    }

    /**
     * 更新显示计数
     */
    updateDisplayCount(totalRecords) {
        const displayCount = document.getElementById('displayCount');
        const totalCount = document.getElementById('totalCount');

        if (displayCount) {
            const startRecord = ((this.currentPage - 1) * this.pageSize) + 1;
            const endRecord = Math.min(this.currentPage * this.pageSize, totalRecords);
            displayCount.textContent = `${startRecord}-${endRecord}`;
        }

        if (totalCount) {
            totalCount.textContent = totalRecords;
        }
    }

    /**
     * 切换视图
     */
    switchView(view) {
        const tableViewBtn = document.getElementById('tableView');
        const chartViewBtn = document.getElementById('chartView');
        const tableContainer = document.getElementById('tableContainer');

        if (view === 'table') {
            tableViewBtn?.classList.add('active');
            chartViewBtn?.classList.remove('active');

            // 恢复表格视图
            this.restoreTableView();
        } else {
            tableViewBtn?.classList.remove('active');
            chartViewBtn?.classList.add('active');

            // 保存当前表格内容，然后显示图表占位符
            this.saveTableContent();
            this.showChartPlaceholder();
        }
    }

    /**
     * 保存表格内容
     */
    saveTableContent() {
        const tableContainer = document.getElementById('tableContainer');
        if (!tableContainer) return;

        // 保存原始表格内容
        this.savedTableContent = tableContainer.innerHTML;
    }

    /**
     * 恢复表格视图
     */
    restoreTableView() {
        const tableContainer = document.getElementById('tableContainer');
        if (!tableContainer) return;

        // 恢复表格容器的显示
        tableContainer.style.display = 'flex';

        // 如果有保存的内容，直接恢复
        if (this.savedTableContent) {
            tableContainer.innerHTML = this.savedTableContent;
        } else {
            // 如果没有保存的内容，检查是否需要重新创建表格结构
            const tableWrapper = tableContainer.querySelector('.table-wrapper');
            if (!tableWrapper) {
                // 表格结构被清空了，重新创建
                this.recreateTableStructure();
                // 重新创建表格内容
                this.createTableHeader();
                this.createTableBody();
            }
        }
    }

    /**
     * 重新创建表格结构
     */
    recreateTableStructure() {
        const tableContainer = document.getElementById('tableContainer');
        if (!tableContainer) return;

        // 清空容器并重新创建表格结构
        tableContainer.innerHTML = `
            <div class="table-wrapper">
                <table class="table table-dark table-hover meteora-table" id="poolsTable">
                    <thead class="table-header">
                        <!-- 表头将通过JavaScript动态生成 -->
                    </thead>
                    <tbody id="tableBody">
                        <!-- 数据将通过JavaScript动态生成 -->
                    </tbody>
                </table>
            </div>

            <!-- 加载指示器 -->
            <div class="loading-overlay" id="loadingOverlay">
                <div class="loading-spinner">
                    <div class="spinner-border text-accent-cyan" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <p class="loading-text mt-2">正在获取数据...</p>
                </div>
            </div>

            <!-- 空数据状态 -->
            <div class="empty-state d-none" id="emptyState">
                <div class="empty-icon">
                    <i class="fas fa-search text-muted"></i>
                </div>
                <h5 class="empty-title">未找到匹配的池子</h5>
                <p class="empty-message">尝试调整筛选条件或清除筛选器</p>
                <button class="btn btn-outline-accent btn-sm" id="clearFiltersBtn2">
                    <i class="fas fa-times me-1"></i>清除筛选器
                </button>
            </div>
        `;
    }

    /**
     * 显示图表占位符
     */
    showChartPlaceholder() {
        const tableContainer = document.getElementById('tableContainer');
        if (!tableContainer) return;

        const placeholder = document.createElement('div');
        placeholder.className = 'chart-placeholder';
        placeholder.innerHTML = `
            <div class="chart-placeholder-icon">
                <i class="fas fa-chart-bar"></i>
            </div>
            <div class="chart-placeholder-text">图表视图</div>
            <div class="chart-placeholder-subtext">图表功能将在后续版本中实现</div>
        `;

        // 清空容器并显示占位符
        tableContainer.innerHTML = '';
        tableContainer.appendChild(placeholder);
        tableContainer.style.display = 'flex';
    }

    /**
     * 导出数据
     */
    exportData(format) {
        if (this.currentData.length === 0) {
            if (window.meteora) {
                window.meteora.showNotification('没有数据可导出', 'warning');
            }
            return;
        }

        const filename = `meteora-pools-${new Date().toISOString().split('T')[0]}`;

        if (window.meteora) {
            window.meteora.exportData(this.currentData, filename, format);
        }
    }

    /**
     * 获取选中的行
     */
    getSelectedRows() {
        return Array.from(this.selectedRows);
    }

    /**
     * 设置可见字段
     */
    setVisibleFields(fields) {
        this.visibleFields = fields;
        this.createTableHeader();
        this.createTableBody();
    }

    /**
     * 获取可见字段
     */
    getVisibleFields() {
        return this.visibleFields;
    }

    // 🔧 新增：报警池子管理方法

    /**
     * 标记池子为报警状态
     * @param {string} poolAddress - 池子地址
     */
    markPoolAsAlerted(poolAddress) {
        this.alertedPools.add(poolAddress);
        console.log(`🚨 标记报警池子: ${poolAddress}`);

        // 🔧 增强：立即更新表格中对应行的样式
        const success = this.updatePoolAlertStyle(poolAddress, true);

        if (success) {
            console.log(`✅ 池子 ${poolAddress} 报警样式应用成功`);
        } else {
            console.warn(`⚠️ 池子 ${poolAddress} 报警样式应用失败 - 可能表格中没有该池子`);
        }
    }

    /**
     * 移除池子的报警标记
     * @param {string} poolAddress - 池子地址
     */
    unmarkPoolAsAlerted(poolAddress) {
        this.alertedPools.delete(poolAddress);
        console.log(`🔕 移除报警标记: ${poolAddress}`);

        // 更新表格中对应行的样式
        this.updatePoolAlertStyle(poolAddress, false);
    }

    /**
     * 检查池子是否为报警状态
     * @param {string} poolAddress - 池子地址
     * @returns {boolean} - 是否为报警状态
     */
    isPoolAlerted(poolAddress) {
        return this.alertedPools.has(poolAddress);
    }

    /**
     * 更新池子在表格中的报警样式
     * @param {string} poolAddress - 池子地址
     * @param {boolean} isAlerted - 是否为报警状态
     * @returns {boolean} - 是否成功更新样式
     */
    updatePoolAlertStyle(poolAddress, isAlerted) {
        const row = document.querySelector(`tr[data-address="${poolAddress}"]`);
        if (!row) {
            console.debug(`🔍 未找到池子行: ${poolAddress}`);
            return false;
        }

        console.log(`🎨 更新池子 ${poolAddress} 的样式，报警状态: ${isAlerted}`);

        if (isAlerted) {
            row.classList.add('alert-pool-row');
            console.log(`📌 添加alert-pool-row类到行: ${poolAddress}`);

            // 更新池子名称的样式
            const nameCell = row.querySelector('.cell-pool-name');
            if (nameCell) {
                nameCell.classList.add('alert-pool-name');
                console.log(`📌 添加alert-pool-name类到池子名称: ${poolAddress}`);

                // 🔧 强制检查动画是否应用
                const computedStyle = window.getComputedStyle(nameCell);
                const animation = computedStyle.animation || computedStyle.webkitAnimation;
                if (animation && animation !== 'none') {
                    console.log(`✅ 池子 ${poolAddress} 动画已应用: ${animation}`);
                } else {
                    console.warn(`⚠️ 池子 ${poolAddress} 动画未应用，检查CSS`);
                }
            } else {
                console.warn(`⚠️ 未找到池子名称单元格: ${poolAddress}`);
            }
        } else {
            row.classList.remove('alert-pool-row');

            // 移除池子名称的报警样式
            const nameCell = row.querySelector('.cell-pool-name');
            if (nameCell) {
                nameCell.classList.remove('alert-pool-name');
                console.log(`🔄 移除池子 ${poolAddress} 的报警样式`);
            }
        }

        return true;
    }

    /**
     * 获取所有报警池子
     * @returns {Array} - 报警池子地址数组
     */
    getAlertedPools() {
        return Array.from(this.alertedPools);
    }

    /**
     * 清空所有报警池子标记
     */
    clearAllAlertedPools() {
        const alertedPools = Array.from(this.alertedPools);
        this.alertedPools.clear();

        // 移除所有报警样式
        alertedPools.forEach(poolAddress => {
            this.updatePoolAlertStyle(poolAddress, false);
        });

        console.log('🧹 已清空所有报警池子标记');
    }

    /**
     * 刷新报警池子的显示状态
     * （用于表格重新渲染后恢复报警样式）
     */
    refreshAlertedPoolsDisplay() {
        this.alertedPools.forEach(poolAddress => {
            this.updatePoolAlertStyle(poolAddress, true);
        });
    }
}

// 创建全局实例
window.TableManager = TableManager;

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.tableManager = new TableManager();
}); 