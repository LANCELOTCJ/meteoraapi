"""
Meteora监控平台 V2.0 - Flask主应用
提供Web界面和API服务
"""

from flask import Flask, render_template, jsonify, request, send_from_directory, render_template_string
from flask_cors import CORS
import logging
from datetime import datetime, timedelta
from typing import Dict, Any
import os

logger = logging.getLogger(__name__)


def create_app(config_manager=None, db_manager=None, api_client=None, data_updater=None, websocket_server=None):
    """创建Flask应用

    Args:
        config_manager: 配置管理器
        db_manager: 数据库管理器
        api_client: API客户端
        data_updater: 数据更新器
        websocket_server: WebSocket服务器

    Returns:
        Flask: Flask应用实例
    """
    app = Flask(__name__,
                template_folder='templates',
                static_folder='static')

    # 启用CORS
    CORS(app)

    # 存储组件引用
    app.config_manager = config_manager
    app.db_manager = db_manager
    app.api_client = api_client
    app.data_updater = data_updater
    app.websocket_server = websocket_server  # 🔧 添加WebSocket服务器引用

    # 配置Flask
    app.config['SECRET_KEY'] = 'meteora-monitor-v2-secret-key'
    app.config['JSON_AS_ASCII'] = False

    # 注册路由
    register_routes(app)

    logger.info("Flask应用创建完成")
    return app


def register_routes(app):
    """注册所有路由"""

    @app.route('/')
    def index():
        """主页 - 数据监控仪表板"""
        return render_template('index.html')

    @app.route('/debug')
    def debug_modules():
        """调试页面 - 检查JavaScript模块加载"""
        return render_template_string("""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>模块加载调试</title>
    <style>
        body { font-family: Arial; margin: 20px; background: #1a1a1a; color: #fff; }
        .status { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .success { background: #2d5a27; }
        .error { background: #5a2727; }
        .info { background: #27435a; }
        .warning { background: #5a5a27; }
    </style>
</head>
<body>
    <h1>Meteora 模块加载调试</h1>
    <div id="status"></div>

    <!-- 加载JavaScript模块 -->
    <script src="{{ url_for('static', filename='js/meteora-core.js') }}"></script>
    <script src="{{ url_for('static', filename='js/filters.js') }}"></script>
    <script src="{{ url_for('static', filename='js/table-manager.js') }}"></script>
    <script src="{{ url_for('static', filename='js/config-manager.js') }}"></script>
    <script src="{{ url_for('static', filename='js/chart-manager.js') }}"></script>
    <script src="{{ url_for('static', filename='js/websocket-client.js') }}"></script>

    <script>
        function addStatus(message, type = 'info') {
            const div = document.createElement('div');
            div.className = `status ${type}`;
            div.textContent = message;
            document.getElementById('status').appendChild(div);
        }

        function checkModule(name, obj) {
            if (obj) {
                addStatus(`✅ ${name} 模块已加载`, 'success');
                return true;
            } else {
                addStatus(`❌ ${name} 模块未加载`, 'error');
                return false;
            }
        }

        // 监听脚本加载错误
        window.addEventListener('error', function(e) {
            if (e.filename) {
                addStatus(`❌ 脚本加载错误: ${e.filename} - ${e.message}`, 'error');
            }
        });

        // 等待一段时间确保所有脚本都加载完成
        setTimeout(() => {
            addStatus('开始检查模块加载状态...', 'info');

            const modules = [
                ['meteora', window.meteora],
                ['filterManager', window.filterManager],
                ['tableManager', window.tableManager],
                ['configManager', window.configManager],
                ['chartManager', window.chartManager],
                ['websocketClient', window.websocketClient]
            ];

            let loadedCount = 0;
            modules.forEach(([name, obj]) => {
                if (checkModule(name, obj)) {
                    loadedCount++;
                }
            });

            addStatus(`总计: ${loadedCount}/${modules.length} 个模块已加载`, loadedCount === modules.length ? 'success' : 'warning');

            // 检查必需模块
            const requiredModules = ['meteora', 'filterManager', 'tableManager', 'configManager'];
            const loadedRequired = requiredModules.filter(module => window[module]);

            addStatus(`应用所需模块: ${loadedRequired.length}/${requiredModules.length}`,
                loadedRequired.length === requiredModules.length ? 'success' : 'error');

            if (loadedRequired.length === requiredModules.length) {
                addStatus('✅ 所有必需模块已加载，应用可以初始化', 'success');

                // 测试API连接
                fetch('/api/health')
                    .then(response => response.json())
                    .then(data => {
                        addStatus(`✅ API健康检查通过: ${data.status}`, 'success');
                    })
                    .catch(error => {
                        addStatus(`❌ API连接失败: ${error.message}`, 'error');
                    });

                // 测试数据加载
                fetch('/api/pools?limit=1')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && data.total > 0) {
                            addStatus(`✅ 数据加载正常: ${data.total} 个池子`, 'success');
                        } else {
                            addStatus('⚠️ 数据为空或加载失败', 'warning');
                        }
                    })
                    .catch(error => {
                        addStatus(`❌ 数据加载失败: ${error.message}`, 'error');
                    });

            } else {
                const missing = requiredModules.filter(module => !window[module]);
                addStatus(`❌ 缺少模块: ${missing.join(', ')}`, 'error');
            }

        }, 2000);
    </script>
</body>
</html>
        """)

    @app.route('/api/health')
    def health_check():
        """健康检查接口"""
        try:
            # 检查各组件状态
            status = {
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'components': {
                    'database': 'healthy' if app.db_manager else 'error',
                    'api_client': 'healthy' if app.api_client else 'error',
                    'config': 'healthy' if app.config_manager else 'error'
                }
            }

            # 检查API连接
            if app.api_client:
                api_healthy = app.api_client.check_api_health()
                status['components']['meteora_api'] = 'healthy' if api_healthy else 'warning'

            # 检查数据库连接
            if app.db_manager:
                try:
                    stats = app.db_manager.get_statistics()
                    status['stats'] = stats
                except Exception as e:
                    status['components']['database'] = 'error'
                    status['database_error'] = str(e)

            return jsonify(status)

        except Exception as e:
            logger.error(f"健康检查失败: {e}")
            return jsonify({
                'status': 'error',
                'timestamp': datetime.now().isoformat(),
                'error': str(e)
            }), 500

    @app.route('/api/pools')
    def get_pools():
        """获取池子列表数据"""
        try:
            # 获取查询参数
            filters = {
                'search_keyword': request.args.get('search', ''),
                'min_liquidity': _safe_float(request.args.get('min_liquidity')),
                'max_liquidity': _safe_float(request.args.get('max_liquidity')),
                'min_apy': _safe_float(request.args.get('min_apy')),
                'max_apy': _safe_float(request.args.get('max_apy')),
                'min_volume_24h': _safe_float(request.args.get('min_volume_24h')),
                'max_volume_24h': _safe_float(request.args.get('max_volume_24h')),
                'min_fee_tvl_ratio': _safe_float(request.args.get('min_fee_tvl_ratio')),
                'max_fee_tvl_ratio': _safe_float(request.args.get('max_fee_tvl_ratio')),
                'min_estimated_daily_fee_rate': _safe_float(request.args.get('min_estimated_daily_fee_rate')),
                'max_estimated_daily_fee_rate': _safe_float(request.args.get('max_estimated_daily_fee_rate')),
                'sort_field': request.args.get('sort', 'liquidity'),
                'sort_direction': request.args.get('dir', 'DESC'),
                'limit': int(request.args.get('limit', 100)),
                'offset': int(request.args.get('offset', 0))
            }

            # 从数据库获取数据
            pools, total_count = app.db_manager.get_pools_with_filters(filters)

            # 获取字段配置
            fields = request.args.get('fields')
            if fields:
                field_list = fields.split(',')
                # 过滤字段
                filtered_pools = []
                for pool in pools:
                    filtered_pool = {k: v for k,
                                     v in pool.items() if k in field_list}
                    filtered_pools.append(filtered_pool)
                pools = filtered_pools

            # 返回响应
            response = {
                'success': True,
                'data': pools,
                'total': total_count,  # 符合条件的总记录数
                'current_page': (filters['offset'] // filters['limit']) + 1,
                'page_size': filters['limit'],
                'total_pages': (total_count + filters['limit'] - 1) // filters['limit'],
                'timestamp': datetime.now().isoformat(),
                'filters_applied': filters
            }

            return jsonify(response)

        except Exception as e:
            logger.error(f"获取池子数据失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

    @app.route('/api/pools/<address>')
    def get_pool_detail(address):
        """获取单个池子详情"""
        try:
            # 获取池子基础信息（从最新指标数据中获取）
            filters = {'search_keyword': address, 'limit': 1}
            pools, _ = app.db_manager.get_pools_with_filters(filters)

            if not pools:
                return jsonify({
                    'success': False,
                    'error': '池子不存在',
                    'timestamp': datetime.now().isoformat()
                }), 404

            pool = pools[0]

            # 获取历史数据
            days = int(request.args.get('days', 7))
            history = app.db_manager.get_pool_history(address, days)

            response = {
                'success': True,
                'data': {
                    'pool': pool,
                    'history': history
                },
                'timestamp': datetime.now().isoformat()
            }

            return jsonify(response)

        except Exception as e:
            logger.error(f"获取池子详情失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

    @app.route('/api/fields')
    def get_available_fields():
        """获取所有可用字段列表"""
        fields = {
            'basic_info': {
                'name': '池子名称',
                'address': '池子地址',
                'mint_x': 'X代币地址',
                'mint_y': 'Y代币地址',
                'bin_step': '价格精度'
            },
            'liquidity': {
                'liquidity': '流动性',
                'current_price': '当前价格',
                'reserve_x_amount': 'X代币储备',
                'reserve_y_amount': 'Y代币储备'
            },
            'yield': {
                'apr': '年化收益率',
                'apy': '复合年化收益率',
                'farm_apr': '挖矿APR',
                'farm_apy': '挖矿APY'
            },
            'volume': {
                'trade_volume_24h': '24小时交易量',
                'volume_hour_1': '1小时交易量',
                'volume_hour_12': '12小时交易量',
                'cumulative_trade_volume': '累积交易量'
            },
            'fees': {
                'fees_24h': '24小时手续费',
                'fees_hour_1': '1小时手续费',
                'estimated_daily_fee_rate': '1H估算日收益率%',
                'cumulative_fee_volume': '累积手续费'
            },
            'fee_rates': {
                'protocol_fee_percentage': '协议费率',
                'base_fee_percentage': '基础费率',
                'max_fee_percentage': '最大费率'
            }
        }

        return jsonify({
            'success': True,
            'data': fields,
            'timestamp': datetime.now().isoformat()
        })

    @app.route('/api/system/stats')
    def get_system_stats():
        """获取系统统计信息"""
        try:
            stats = app.db_manager.get_statistics()

            # 添加API统计
            if app.api_client:
                api_stats = app.api_client.get_api_stats()
                stats.update(api_stats)

            return jsonify({
                'success': True,
                'data': stats,
                'timestamp': datetime.now().isoformat()
            })

        except Exception as e:
            logger.error(f"获取系统统计失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

    @app.route('/api/system/update', methods=['POST'])
    def trigger_manual_update():
        """手动触发数据更新"""
        try:
            if not app.data_updater:
                return jsonify({
                    'success': False,
                    'error': '数据更新器未初始化'
                }), 500

            # 使用数据更新器进行强制更新
            result = app.data_updater.force_update()
            return jsonify(result)

        except Exception as e:
            logger.error(f"手动更新失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

    @app.route('/api/system/updater/status')
    def get_updater_status():
        """获取数据更新器状态"""
        try:
            if not app.data_updater:
                return jsonify({
                    'success': False,
                    'error': '数据更新器未初始化'
                }), 500

            stats = app.data_updater.get_stats()
            return jsonify({
                'success': True,
                'data': stats,
                'timestamp': datetime.now().isoformat()
            })

        except Exception as e:
            logger.error(f"获取更新器状态失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

    # ==================== 报警系统API ====================

    @app.route('/api/alerts/records')
    def get_alert_records():
        """获取报警记录"""
        try:
            # 获取筛选参数
            pool_addresses = request.args.get('pool_addresses')
            limit = int(request.args.get('limit', 100))

            filters = {'limit': limit}

            # 处理池子地址筛选
            if pool_addresses:
                if pool_addresses.strip():
                    addresses_list = [
                        addr.strip() for addr in pool_addresses.split(',') if addr.strip()]
                    if addresses_list:
                        filters['pool_addresses'] = addresses_list

            # 获取报警记录
            alerts = app.db_manager.get_alert_records(filters)

            return jsonify({
                'success': True,
                'data': alerts,
                'total': len(alerts),
                'timestamp': datetime.now().isoformat()
            })

        except Exception as e:
            logger.error(f"获取报警记录失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

    @app.route('/api/alerts/config', methods=['GET'])
    def get_alert_config():
        """获取报警配置"""
        try:
            config = app.db_manager.get_user_config('alerts', 'thresholds')

            if config:
                # config 直接就是配置数据，不需要再获取 config_data
                return jsonify({
                    'success': True,
                    'data': config,
                    'timestamp': datetime.now().isoformat()
                })
            else:
                # 返回默认配置
                default_config = {
                    'enabled': False,
                    'liquidity_threshold': 20.0,
                    'volume_threshold': 20.0,
                    'fees_24h_threshold': 20.0,
                    'fees_1h_threshold': 20.0,
                    'sound_enabled': True,
                    'filter_enabled': False,
                    'increase_only_enabled': False
                }
                return jsonify({
                    'success': True,
                    'data': default_config,
                    'timestamp': datetime.now().isoformat()
                })

        except Exception as e:
            logger.error(f"获取报警配置失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

    @app.route('/api/alerts/config', methods=['POST'])
    def save_alert_config():
        """保存报警配置"""
        try:
            data = request.get_json()

            if not data:
                return jsonify({
                    'success': False,
                    'error': '无效的请求数据'
                }), 400

            # 验证配置数据
            config = {
                'enabled': bool(data.get('enabled', False)),
                'liquidity_threshold': _safe_float(data.get('liquidity_threshold', 20.0)) or 20.0,
                'volume_threshold': _safe_float(data.get('volume_threshold', 20.0)) or 20.0,
                'fees_24h_threshold': _safe_float(data.get('fees_24h_threshold', 20.0)) or 20.0,
                'fees_1h_threshold': _safe_float(data.get('fees_1h_threshold', 20.0)) or 20.0,
                'sound_enabled': bool(data.get('sound_enabled', True)),
                'filter_enabled': bool(data.get('filter_enabled', False)),
                'increase_only_enabled': bool(data.get('increase_only_enabled', False))
            }

            # 保存配置
            app.db_manager.save_user_config(
                'alerts', 'thresholds', config, True)

            return jsonify({
                'success': True,
                'message': '报警配置已保存',
                'data': config,
                'timestamp': datetime.now().isoformat()
            })

        except Exception as e:
            logger.error(f"保存报警配置失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

    @app.route('/api/alerts/test-sound', methods=['POST'])
    def test_alert_sound():
        """测试报警声音"""
        try:
            # 这里可以实现声音测试逻辑
            logger.info("🔊 测试报警声音")

            return jsonify({
                'success': True,
                'message': '声音测试完成',
                'timestamp': datetime.now().isoformat()
            })

        except Exception as e:
            logger.error(f"测试声音失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

    @app.route('/api/alerts/records', methods=['DELETE'])
    def clear_alert_records():
        """清除报警记录"""
        try:
            # 获取请求参数
            data = request.get_json() if request.is_json else {}
            clear_type = data.get('type', 'all')  # all/old/read
            days = int(data.get('days', 3))  # 清除N天前的数据

            deleted_count = 0

            with app.db_manager._get_connection() as conn:
                cursor = conn.cursor()

                if clear_type == 'all':
                    # 清除所有报警记录
                    cursor.execute("DELETE FROM alert_records")
                    deleted_count = cursor.rowcount

                    # 同时清除报警历史
                    cursor.execute("DELETE FROM alert_history")
                    deleted_count += cursor.rowcount

                elif clear_type == 'old':
                    # 清除指定天数前的记录
                    cutoff_date = datetime.now() - timedelta(days=days)

                    cursor.execute("""
                        DELETE FROM alert_records
                        WHERE created_at < ?
                    """, (cutoff_date.isoformat(),))
                    deleted_count = cursor.rowcount

                    cursor.execute("""
                        DELETE FROM alert_history
                        WHERE created_at < ?
                    """, (cutoff_date.isoformat(),))
                    deleted_count += cursor.rowcount

                elif clear_type == 'read':
                    # 只清除已读的报警历史
                    cursor.execute("""
                        DELETE FROM alert_history
                        WHERE is_read = 1
                    """)
                    deleted_count = cursor.rowcount

                conn.commit()

            logger.info(f"清除报警记录: 类型={clear_type}, 删除数量={deleted_count}")

            return jsonify({
                'success': True,
                'message': f'成功清除 {deleted_count} 条记录',
                'deleted_count': deleted_count,
                'clear_type': clear_type,
                'timestamp': datetime.now().isoformat()
            })

        except Exception as e:
            logger.error(f"清除报警记录失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

    @app.route('/test-main-page')
    def test_main_page():
        """测试主页面JavaScript执行"""
        return render_template_string("""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>主页面JavaScript测试</title>
    <link href="{{ url_for('static', filename='css/meteora-style.css') }}" rel="stylesheet">
    <style>
        body { background: #1a1a1a; color: #fff; font-family: Arial, sans-serif; padding: 20px; }
        .test-section { margin: 20px 0; padding: 20px; border: 1px solid #333; border-radius: 8px; }
        .test-item { margin: 10px 0; padding: 10px; background: #2a2a2a; border-radius: 4px; }
        .log { background: #1a1a1a; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto; }
    </style>
</head>
<body>
    <h1>🔧 主页面JavaScript测试</h1>

    <div class="test-section">
        <h2>模块加载检查</h2>
        <div id="moduleStatus"></div>
    </div>

    <div class="test-section">
        <h2>TableManager测试</h2>
        <button onclick="testTableManager()">测试TableManager</button>
        <div id="tableManagerResult"></div>
    </div>

    <div class="test-section">
        <h2>控制台日志</h2>
        <div id="consoleLog" class="log"></div>
    </div>

    <!-- 加载主页面的所有JavaScript模块 -->
    <script src="{{ url_for('static', filename='js/meteora-core.js') }}"></script>
    <script src="{{ url_for('static', filename='js/filters.js') }}"></script>
    <script src="{{ url_for('static', filename='js/table-manager.js') }}"></script>
    <script src="{{ url_for('static', filename='js/config-manager.js') }}"></script>
    <script src="{{ url_for('static', filename='js/chart-manager.js') }}"></script>
    <script src="{{ url_for('static', filename='js/websocket-client.js') }}"></script>
    <script src="{{ url_for('static', filename='js/app.js') }}"></script>

    <script>
        // 捕获控制台日志
        const originalLog = console.log;
        const logDiv = document.getElementById('consoleLog');

        console.log = function(...args) {
            originalLog.apply(console, args);
            const logEntry = document.createElement('div');
            logEntry.textContent = args.join(' ');
            logEntry.style.marginBottom = '2px';
            logDiv.appendChild(logEntry);
            logDiv.scrollTop = logDiv.scrollHeight;
        };

        function checkModules() {
            const statusDiv = document.getElementById('moduleStatus');
            statusDiv.innerHTML = '';

            const modules = [
                ['meteora', window.meteora],
                ['filterManager', window.filterManager],
                ['tableManager', window.tableManager],
                ['configManager', window.configManager],
                ['chartManager', window.chartManager],
                ['websocketClient', window.websocketClient],
                ['MeteoraApp', window.MeteoraApp]
            ];

            let loadedCount = 0;
            modules.forEach(([name, obj]) => {
                const status = obj ? '✅ 已加载' : '❌ 未加载';
                const item = document.createElement('div');
                item.className = 'test-item';
                item.textContent = `${name}: ${status}`;
                statusDiv.appendChild(item);
                if (obj) loadedCount++;
            });

            const summary = document.createElement('div');
            summary.className = 'test-item';
            summary.textContent = `总计: ${loadedCount}/${modules.length} 个模块已加载`;
            statusDiv.appendChild(summary);

            return loadedCount === modules.length;
        }

        async function testTableManager() {
            const resultDiv = document.getElementById('tableManagerResult');
            resultDiv.innerHTML = '<p>正在测试TableManager...</p>';

            try {
                if (!window.tableManager) {
                    resultDiv.innerHTML = '<p style="color: red;">❌ tableManager未初始化</p>';
                    return;
                }

                // 测试getTrendStyleClass方法
                const testData = {
                    liquidity_trend: 'increase',
                    trade_volume_24h_trend: 'decrease',
                    fees_24h_trend: 'neutral',
                    fees_hour_1_trend: 'increase'
                };

                let html = '<h4>✅ TableManager已加载</h4>';
                html += '<h5>趋势样式测试:</h5>';

                const fields = ['liquidity', 'trade_volume_24h', 'fees_24h', 'fees_hour_1'];
                fields.forEach(field => {
                    const trendClass = window.tableManager.getTrendStyleClass(field, testData);
                    const trendValue = testData[field + '_trend'];
                    html += `<div class="test-item">${field}: <span class="${trendClass}">${trendValue}</span> → ${trendClass}</div>`;
                });

                // 测试API数据
                html += '<h5>API数据测试:</h5>';
                try {
                    const response = await fetch('/api/pools?limit=2');
                    const data = await response.json();

                    if (data.success && data.data.length > 0) {
                        html += '<div class="test-item">✅ API数据正常</div>';
                        data.data.forEach((pool, index) => {
                            html += `<div class="test-item">池子 ${index + 1}: ${pool.name || pool.address.substring(0, 8)}... - 趋势字段: ${pool.liquidity_trend}, ${pool.trade_volume_24h_trend}, ${pool.fees_24h_trend}, ${pool.fees_hour_1_trend}</div>`;
                        });
                    } else {
                        html += '<div class="test-item" style="color: orange;">⚠️ API数据为空</div>';
                    }
                } catch (error) {
                    html += `<div class="test-item" style="color: red;">❌ API错误: ${error.message}</div>`;
                }

                resultDiv.innerHTML = html;
            } catch (error) {
                resultDiv.innerHTML = `<p style="color: red;">❌ 测试错误: ${error.message}</p>`;
            }
        }

        // 页面加载完成后检查
        window.addEventListener('load', () => {
            setTimeout(() => {
                console.log('开始检查模块状态...');
                checkModules();
            }, 3000); // 等待3秒确保所有模块都加载完成
        });
    </script>
</body>
</html>
        """)

    @app.route('/test-trends')
    def test_trends():
        """测试趋势颜色功能"""
        return render_template_string("""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>趋势颜色测试</title>
    <link href="{{ url_for('static', filename='css/meteora-style.css') }}" rel="stylesheet">
    <style>
        body { background: #1a1a1a; color: #fff; font-family: Arial, sans-serif; padding: 20px; }
        .test-section { margin: 20px 0; padding: 20px; border: 1px solid #333; border-radius: 8px; }
        .test-item { margin: 10px 0; padding: 10px; background: #2a2a2a; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>🎨 Meteora 趋势颜色测试</h1>

    <div class="test-section">
        <h2>CSS 样式直接测试</h2>
        <div class="test-item">
            <span class="trend-increase">上升趋势 (绿色)</span> |
            <span class="trend-decrease">下降趋势 (红色)</span> |
            <span>中性趋势 (默认)</span>
        </div>
    </div>

    <div class="test-section">
        <h2>真实API数据测试</h2>
        <button onclick="loadRealData()">加载真实数据</button>
        <div id="realDataResult"></div>
    </div>

    <script>
        async function loadRealData() {
            const resultDiv = document.getElementById('realDataResult');
            resultDiv.innerHTML = '<p>正在加载...</p>';

            try {
                const response = await fetch('/api/pools?limit=5');
                const data = await response.json();

                if (data.success && data.data.length > 0) {
                    let html = '<table class="table table-dark table-hover meteora-table"><thead><tr><th>池子</th><th>流动性</th><th>交易量</th><th>24H费用</th><th>1H费用</th></tr></thead><tbody>';

                    data.data.forEach(pool => {
                        const getTrendClass = (trend) => {
                            switch(trend) {
                                case 'increase': return 'trend-increase';
                                case 'decrease': return 'trend-decrease';
                                default: return '';
                            }
                        };

                        html += `<tr>
                            <td>${pool.name || pool.address.substring(0, 8)}...</td>
                            <td><span class="cell-number ${getTrendClass(pool.liquidity_trend)}">$${pool.liquidity.toLocaleString()}</span></td>
                            <td><span class="cell-number ${getTrendClass(pool.trade_volume_24h_trend)}">$${pool.trade_volume_24h.toLocaleString()}</span></td>
                            <td><span class="cell-number ${getTrendClass(pool.fees_24h_trend)}">$${pool.fees_24h.toLocaleString()}</span></td>
                            <td><span class="cell-number ${getTrendClass(pool.fees_hour_1_trend)}">$${pool.fees_hour_1.toLocaleString()}</span></td>
                        </tr>`;
                    });

                    html += '</tbody></table>';
                    html += '<h3>趋势字段原始数据：</h3>';
                    data.data.forEach(pool => {
                        html += `<div class="test-item">
                            <strong>${pool.name || pool.address.substring(0, 8)}...</strong><br>
                            liquidity_trend: ${pool.liquidity_trend} |
                            trade_volume_24h_trend: ${pool.trade_volume_24h_trend} |
                            fees_24h_trend: ${pool.fees_24h_trend} |
                            fees_hour_1_trend: ${pool.fees_hour_1_trend}
                        </div>`;
                    });

                    resultDiv.innerHTML = html;
                } else {
                    resultDiv.innerHTML = '<p style="color: red;">无数据</p>';
                }
            } catch (error) {
                resultDiv.innerHTML = `<p style="color: red;">错误: ${error.message}</p>`;
            }
        }
    </script>
</body>
</html>
        """)

    @app.route('/test-blinking')
    def test_blinking():
        """测试池子闪烁功能页面"""
        return render_template('test_blinking.html')

    # ==================== 用户筛选条件管理 ====================

    @app.route('/api/filters/current', methods=['GET'])
    def get_current_filter():
        """获取用户当前筛选条件"""
        try:
            config = app.db_manager.get_user_config('filters', 'current')
            if config:
                return jsonify({
                    'success': True,
                    'data': config,
                    'timestamp': datetime.now().isoformat()
                })
            else:
                return jsonify({
                    'success': True,
                    'data': None,
                    'message': '未找到当前筛选条件',
                    'timestamp': datetime.now().isoformat()
                })
        except Exception as e:
            logger.error(f"获取当前筛选条件失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

    @app.route('/api/filters/current', methods=['POST'])
    def save_current_filter():
        """保存用户当前筛选条件"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({
                    'success': False,
                    'error': '无效的请求数据'
                }), 400

            # 保存筛选条件配置
            app.db_manager.save_user_config('filters', 'current', data, True)

            return jsonify({
                'success': True,
                'message': '筛选条件已保存',
                'data': data,
                'timestamp': datetime.now().isoformat()
            })

        except Exception as e:
            logger.error(f"保存筛选条件失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500

    # ==================== 测试API端点 ====================

    @app.route('/api/test/trigger-alert', methods=['POST'])
    def trigger_test_alert():
        """触发测试报警 - 直接通过WebSocket发送，不使用数据库"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({
                    'success': False,
                    'error': '无效的请求数据'
                }), 400

            # 验证必需字段
            required_fields = ['pool_address', 'pool_name',
                               'alert_type', 'change_type', 'change_percent']
            for field in required_fields:
                if field not in data:
                    return jsonify({
                        'success': False,
                        'error': f'缺少必需字段: {field}'
                    }), 400

            # 🔧 直接构建测试报警消息，不使用数据库
            alert_data = {
                'pool_address': data['pool_address'],
                'pool_name': data['pool_name'],
                'alert_type': data['alert_type'],
                'change_type': data['change_type'],
                'change_percent': float(data['change_percent']),
                'threshold_percent': float(data.get('threshold_percent', 20.0)),
                'old_value': float(data.get('old_value', 1000.0)),
                'new_value': float(data.get('new_value', 1500.0)),
                'created_at': datetime.now().isoformat()
            }

            # 构建WebSocket消息
            alert_message = {
                'type': 'new_alert',
                'data': alert_data,
                'timestamp': datetime.now().isoformat(),
                'message': f"{alert_data['pool_name']} {alert_data['alert_type']} {alert_data['change_type']} {abs(alert_data['change_percent']):.1f}%"
            }

            # 通过WebSocket发送报警通知
            if hasattr(app, 'websocket_server') and app.websocket_server:
                try:
                    import asyncio

                    # 异步发送给所有订阅alerts的客户端
                    async def send_alert():
                        await app.websocket_server.broadcast_message(alert_message, 'alerts')
                        logger.info(
                            f"📡 已通过WebSocket发送测试报警通知: {alert_data['pool_name']}")

                    # 在新的事件循环中发送
                    try:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        loop.run_until_complete(send_alert())
                        loop.close()

                        logger.info(f"🧪 测试报警触发成功: {alert_data['pool_name']}")

                    except Exception as e:
                        logger.warning(f"WebSocket发送测试报警失败: {e}")
                        return jsonify({
                            'success': False,
                            'error': f'WebSocket发送失败: {str(e)}',
                            'timestamp': datetime.now().isoformat()
                        }), 500

                except Exception as e:
                    logger.warning(f"发送测试报警通知失败: {e}")
                    return jsonify({
                        'success': False,
                        'error': f'发送报警失败: {str(e)}',
                        'timestamp': datetime.now().isoformat()
                    }), 500
            else:
                return jsonify({
                    'success': False,
                    'error': 'WebSocket服务器未初始化',
                    'timestamp': datetime.now().isoformat()
                }), 500

            return jsonify({
                'success': True,
                'message': f'测试报警已触发: {alert_data["pool_name"]}',
                'data': {
                    'pool_name': alert_data['pool_name'],
                    'pool_address': alert_data['pool_address'],
                    'alert_type': alert_data['alert_type'],
                    'change_type': alert_data['change_type'],
                    'change_percent': alert_data['change_percent']
                },
                'timestamp': datetime.now().isoformat()
            })

        except Exception as e:
            logger.error(f"触发测试报警失败: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500


def _safe_float(value):
    """安全转换为浮点数"""
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None
