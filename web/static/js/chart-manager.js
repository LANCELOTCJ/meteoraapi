/**
 * Meteora监控平台 V2.0 - 图表管理器
 * 处理各种数据可视化和图表展示
 */

class ChartManager {
    constructor() {
        this.charts = {};
        this.chartContainer = null;
        this.isChartView = false;
        this.currentChartType = 'overview';

        // 图表配置
        this.chartConfig = {
            theme: 'dark',
            animation: true,
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#b0b3b8'
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: '#3a3d45'
                    },
                    ticks: {
                        color: '#b0b3b8'
                    }
                },
                y: {
                    grid: {
                        color: '#3a3d45'
                    },
                    ticks: {
                        color: '#b0b3b8'
                    }
                }
            }
        };

        this.init();
    }

    /**
     * 初始化图表管理器
     */
    init() {
        this.setupChartContainer();
        this.setupEventListeners();
        this.loadChartLibrary();

        console.log('📊 图表管理器初始化完成');
    }

    /**
     * 设置图表容器
     */
    setupChartContainer() {
        // 创建图表容器
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            this.chartContainer = document.createElement('div');
            this.chartContainer.className = 'chart-container d-none';
            this.chartContainer.innerHTML = `
                <div class="chart-header">
                    <div class="chart-controls">
                        <div class="btn-group me-3">
                            <button class="btn btn-outline-accent btn-sm chart-type-btn active" data-type="overview">
                                <i class="fas fa-chart-pie"></i> 概览
                            </button>
                            <button class="btn btn-outline-accent btn-sm chart-type-btn" data-type="liquidity">
                                <i class="fas fa-chart-bar"></i> 流动性分布
                            </button>
                            <button class="btn btn-outline-accent btn-sm chart-type-btn" data-type="apy">
                                <i class="fas fa-chart-line"></i> APY趋势
                            </button>
                            <button class="btn btn-outline-accent btn-sm chart-type-btn" data-type="volume">
                                <i class="fas fa-chart-area"></i> 交易量分析
                            </button>
                        </div>
                        
                        <div class="chart-options">
                            <select class="form-select form-select-sm meteora-select me-2" id="chartTimeRange">
                                <option value="1h">1小时</option>
                                <option value="24h" selected>24小时</option>
                                <option value="7d">7天</option>
                                <option value="30d">30天</option>
                            </select>
                            
                            <button class="btn btn-outline-accent btn-sm" id="exportChart">
                                <i class="fas fa-download"></i> 导出
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="chart-content">
                    <div class="chart-grid">
                        <!-- 主图表区域 -->
                        <div class="main-chart-area">
                            <canvas id="mainChart"></canvas>
                        </div>
                        
                        <!-- 副图表区域 -->
                        <div class="side-charts">
                            <div class="chart-card">
                                <h6 class="chart-title">Top 10 池子</h6>
                                <canvas id="topPoolsChart"></canvas>
                            </div>
                            
                            <div class="chart-card">
                                <h6 class="chart-title">APY分布</h6>
                                <canvas id="apyDistributionChart"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 统计卡片 -->
                    <div class="stats-cards">
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-coins text-accent-cyan"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="totalLiquidity">$0</div>
                                <div class="stat-label">总流动性</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-percentage text-accent-green"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="avgApy">0%</div>
                                <div class="stat-label">平均APY</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-exchange-alt text-accent-purple"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="totalVolume">$0</div>
                                <div class="stat-label">24h交易量</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-layer-group text-accent-orange"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="activePools">0</div>
                                <div class="stat-label">活跃池子</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // 插入到表格容器之前
            const tableContainer = document.getElementById('tableContainer');
            if (tableContainer) {
                mainContent.insertBefore(this.chartContainer, tableContainer);
            }
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 图表类型切换
        document.addEventListener('click', (event) => {
            if (event.target.closest('.chart-type-btn')) {
                const btn = event.target.closest('.chart-type-btn');
                const chartType = btn.dataset.type;
                this.switchChartType(chartType);
            }
        });

        // 视图切换
        const chartViewBtn = document.getElementById('chartView');
        if (chartViewBtn) {
            chartViewBtn.addEventListener('click', () => {
                this.toggleChartView();
            });
        }

        const tableViewBtn = document.getElementById('tableView');
        if (tableViewBtn) {
            tableViewBtn.addEventListener('click', () => {
                this.showTableView();
            });
        }

        // 时间范围切换
        const timeRangeSelect = document.getElementById('chartTimeRange');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', (event) => {
                this.updateTimeRange(event.target.value);
            });
        }

        // 导出图表
        const exportBtn = document.getElementById('exportChart');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportCurrentChart();
            });
        }

        // 监听数据更新
        if (window.meteora) {
            window.meteora.on('dataUpdated', this.handleDataUpdate.bind(this));
        }
    }

    /**
     * 加载Chart.js库
     */
    async loadChartLibrary() {
        if (typeof Chart !== 'undefined') {
            this.initializeCharts();
            return;
        }

        try {
            // 动态加载Chart.js
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
            script.onload = () => {
                this.initializeCharts();
            };
            document.head.appendChild(script);

        } catch (error) {
            console.error('加载Chart.js库失败:', error);
        }
    }

    /**
     * 初始化所有图表
     */
    initializeCharts() {
        this.createMainChart();
        this.createTopPoolsChart();
        this.createApyDistributionChart();

        console.log('📈 所有图表初始化完成');
    }

    /**
     * 创建主图表
     */
    createMainChart() {
        const ctx = document.getElementById('mainChart');
        if (!ctx) return;

        this.charts.main = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '流动性趋势',
                    data: [],
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                ...this.chartConfig,
                plugins: {
                    ...this.chartConfig.plugins,
                    title: {
                        display: true,
                        text: '流动性总览',
                        color: '#ffffff'
                    }
                }
            }
        });
    }

    /**
     * 创建Top池子图表
     */
    createTopPoolsChart() {
        const ctx = document.getElementById('topPoolsChart');
        if (!ctx) return;

        this.charts.topPools = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#00d4ff', '#06ffa5', '#7c3aed', '#ff6b35',
                        '#f59e0b', '#ef4444', '#10b981', '#8b5cf6',
                        '#06b6d4', '#84cc16'
                    ],
                    borderWidth: 2,
                    borderColor: '#1a1b23'
                }]
            },
            options: {
                ...this.chartConfig,
                plugins: {
                    ...this.chartConfig.plugins,
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#b0b3b8',
                            padding: 10,
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * 创建APY分布图表
     */
    createApyDistributionChart() {
        const ctx = document.getElementById('apyDistributionChart');
        if (!ctx) return;

        this.charts.apyDistribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['0-10%', '10-50%', '50-100%', '100-500%', '500%+'],
                datasets: [{
                    label: '池子数量',
                    data: [],
                    backgroundColor: '#06ffa5',
                    borderColor: '#04d484',
                    borderWidth: 1
                }]
            },
            options: {
                ...this.chartConfig,
                scales: {
                    ...this.chartConfig.scales,
                    y: {
                        ...this.chartConfig.scales.y,
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * 切换图表类型
     */
    switchChartType(chartType) {
        // 更新按钮状态
        document.querySelectorAll('.chart-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-type="${chartType}"]`).classList.add('active');

        this.currentChartType = chartType;

        // 根据类型更新主图表
        switch (chartType) {
            case 'overview':
                this.updateOverviewChart();
                break;
            case 'liquidity':
                this.updateLiquidityChart();
                break;
            case 'apy':
                this.updateApyChart();
                break;
            case 'volume':
                this.updateVolumeChart();
                break;
        }
    }

    /**
     * 更新概览图表
     */
    updateOverviewChart() {
        if (!this.charts.main) return;

        // 这里会使用实际数据
        const mockData = this.generateMockTimeSeriesData();

        this.charts.main.data.labels = mockData.labels;
        this.charts.main.data.datasets[0].data = mockData.values;
        this.charts.main.data.datasets[0].label = '流动性趋势';
        this.charts.main.data.datasets[0].borderColor = '#00d4ff';

        this.charts.main.options.plugins.title.text = '流动性总览';
        this.charts.main.update();
    }

    /**
     * 更新流动性图表
     */
    updateLiquidityChart() {
        if (!this.charts.main) return;

        const mockData = this.generateMockTimeSeriesData();

        this.charts.main.data.labels = mockData.labels;
        this.charts.main.data.datasets[0].data = mockData.values;
        this.charts.main.data.datasets[0].label = '流动性分布';
        this.charts.main.data.datasets[0].borderColor = '#06ffa5';

        this.charts.main.options.plugins.title.text = '流动性分布分析';
        this.charts.main.update();
    }

    /**
     * 更新APY图表
     */
    updateApyChart() {
        if (!this.charts.main) return;

        const mockData = this.generateMockTimeSeriesData('apy');

        this.charts.main.data.labels = mockData.labels;
        this.charts.main.data.datasets[0].data = mockData.values;
        this.charts.main.data.datasets[0].label = 'APY趋势';
        this.charts.main.data.datasets[0].borderColor = '#7c3aed';

        this.charts.main.options.plugins.title.text = 'APY趋势分析';
        this.charts.main.update();
    }

    /**
     * 更新交易量图表
     */
    updateVolumeChart() {
        if (!this.charts.main) return;

        const mockData = this.generateMockTimeSeriesData('volume');

        this.charts.main.data.labels = mockData.labels;
        this.charts.main.data.datasets[0].data = mockData.values;
        this.charts.main.data.datasets[0].label = '交易量';
        this.charts.main.data.datasets[0].borderColor = '#ff6b35';

        this.charts.main.options.plugins.title.text = '交易量分析';
        this.charts.main.update();
    }

    /**
     * 切换到图表视图
     */
    toggleChartView() {
        this.isChartView = true;

        // 隐藏表格，显示图表
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            tableContainer.classList.add('d-none');
        }

        if (this.chartContainer) {
            this.chartContainer.classList.remove('d-none');
        }

        // 更新按钮状态
        document.getElementById('tableView')?.classList.remove('active');
        document.getElementById('chartView')?.classList.add('active');

        // 刷新图表数据
        this.updateChartsWithCurrentData();

        console.log('📊 切换到图表视图');
    }

    /**
     * 切换到表格视图
     */
    showTableView() {
        this.isChartView = false;

        // 显示表格，隐藏图表
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            tableContainer.classList.remove('d-none');
        }

        if (this.chartContainer) {
            this.chartContainer.classList.add('d-none');
        }

        // 更新按钮状态
        document.getElementById('chartView')?.classList.remove('active');
        document.getElementById('tableView')?.classList.add('active');

        console.log('📋 切换到表格视图');
    }

    /**
     * 更新时间范围
     */
    updateTimeRange(timeRange) {
        console.log(`更新时间范围: ${timeRange}`);

        // 根据时间范围重新获取数据并更新图表
        this.updateChartsWithCurrentData(timeRange);
    }

    /**
     * 使用当前数据更新图表
     */
    updateChartsWithCurrentData(timeRange = '24h') {
        if (!this.isChartView) return;

        // 获取当前表格数据
        const currentData = window.tableManager?.getCurrentData() || [];

        // 更新统计卡片
        this.updateStatCards(currentData);

        // 更新Top池子图表
        this.updateTopPoolsData(currentData);

        // 更新APY分布图表
        this.updateApyDistributionData(currentData);

        // 更新主图表
        this.switchChartType(this.currentChartType);
    }

    /**
     * 更新统计卡片
     */
    updateStatCards(data) {
        if (!data.length) return;

        const totalLiquidity = data.reduce((sum, pool) => sum + (pool.liquidity || 0), 0);
        const avgApy = data.reduce((sum, pool) => sum + (pool.apy || 0), 0) / data.length;
        const totalVolume = data.reduce((sum, pool) => sum + (pool.trade_volume_24h || 0), 0);
        const activePools = data.filter(pool => (pool.trade_volume_24h || 0) > 1000).length;

        // 格式化并显示数据
        const totalLiquidityEl = document.getElementById('totalLiquidity');
        if (totalLiquidityEl && window.meteora) {
            totalLiquidityEl.textContent = window.meteora.formatCurrency(totalLiquidity);
        }

        const avgApyEl = document.getElementById('avgApy');
        if (avgApyEl && window.meteora) {
            avgApyEl.textContent = window.meteora.formatPercentage(avgApy);
        }

        const totalVolumeEl = document.getElementById('totalVolume');
        if (totalVolumeEl && window.meteora) {
            totalVolumeEl.textContent = window.meteora.formatCurrency(totalVolume);
        }

        const activePoolsEl = document.getElementById('activePools');
        if (activePoolsEl) {
            activePoolsEl.textContent = activePools.toString();
        }
    }

    /**
     * 更新Top池子图表数据
     */
    updateTopPoolsData(data) {
        if (!this.charts.topPools || !data.length) return;

        const topPools = data
            .sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0))
            .slice(0, 10);

        const labels = topPools.map(pool => pool.name || 'Unknown Pool');
        const values = topPools.map(pool => pool.liquidity || 0);

        this.charts.topPools.data.labels = labels;
        this.charts.topPools.data.datasets[0].data = values;
        this.charts.topPools.update();
    }

    /**
     * 更新APY分布图表数据
     */
    updateApyDistributionData(data) {
        if (!this.charts.apyDistribution || !data.length) return;

        const ranges = [
            { min: 0, max: 10, count: 0 },
            { min: 10, max: 50, count: 0 },
            { min: 50, max: 100, count: 0 },
            { min: 100, max: 500, count: 0 },
            { min: 500, max: Infinity, count: 0 }
        ];

        data.forEach(pool => {
            const apy = pool.apy || 0;
            for (let range of ranges) {
                if (apy >= range.min && apy < range.max) {
                    range.count++;
                    break;
                }
            }
        });

        this.charts.apyDistribution.data.datasets[0].data = ranges.map(r => r.count);
        this.charts.apyDistribution.update();
    }

    /**
     * 导出当前图表
     */
    exportCurrentChart() {
        if (!this.charts.main) return;

        try {
            const url = this.charts.main.toBase64Image();
            const link = document.createElement('a');
            link.download = `meteora-chart-${this.currentChartType}-${new Date().toISOString().slice(0, 10)}.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (window.meteora) {
                window.meteora.showNotification('图表已导出', 'success', 2000);
            }

        } catch (error) {
            console.error('导出图表失败:', error);
            if (window.meteora) {
                window.meteora.showNotification('导出图表失败', 'error', 3000);
            }
        }
    }

    /**
     * 处理数据更新
     */
    handleDataUpdate(data) {
        if (this.isChartView) {
            this.updateChartsWithCurrentData();
        }
    }

    /**
     * 生成模拟时间序列数据（用于开发测试）
     */
    generateMockTimeSeriesData(type = 'liquidity') {
        const labels = [];
        const values = [];
        const now = new Date();

        for (let i = 23; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 60 * 60 * 1000);
            labels.push(time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));

            let baseValue, variance;
            switch (type) {
                case 'apy':
                    baseValue = 45;
                    variance = 15;
                    break;
                case 'volume':
                    baseValue = 1200000;
                    variance = 400000;
                    break;
                default: // liquidity
                    baseValue = 8500000;
                    variance = 2000000;
                    break;
            }

            values.push(baseValue + (Math.random() - 0.5) * variance);
        }

        return { labels, values };
    }

    /**
     * 销毁所有图表
     */
    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};

        console.log('📊 图表管理器已销毁');
    }
}

// 创建全局实例
window.ChartManager = ChartManager;

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.chartManager = new ChartManager();
}); 