#!/usr/bin/env python3
"""
Meteora监控平台 V2.0 - 主应用入口
整合所有核心模块，启动监控平台
"""

from web.app import create_app
from web.websocket import create_websocket_server
from core.config_manager import ConfigManager
from core.api_client import MeteoraAPIClient
from core.database import DatabaseManager
from core.data_updater import DataUpdater
import os
import sys
import logging
import signal
import asyncio
import threading
from datetime import datetime
from pathlib import Path
import time

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))


# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/app.log', encoding='utf-8')
    ]
)

logger = logging.getLogger(__name__)


class MeteoraMonitor:
    """Meteora监控平台主应用类"""

    def __init__(self):
        """初始化监控平台"""
        self.config_manager = None
        self.db_manager = None
        self.api_client = None
        self.data_updater = None
        self.flask_app = None
        self.websocket_server = None
        self.websocket_thread = None
        self.is_running = False

        # 确保必要目录存在
        self._ensure_directories()

        logger.info("🚀 Meteora监控平台 V2.0 启动中...")

    def _ensure_directories(self):
        """确保必要的目录存在"""
        directories = ['logs', 'data', 'data/backups']
        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)

    def initialize(self):
        """初始化所有组件"""
        try:
            # 1. 初始化配置管理器
            logger.info("📋 初始化配置管理器...")
            self.config_manager = ConfigManager(
                system_config_path='config/system_config.yaml'
            )

            # 2. 初始化数据库管理器
            logger.info("💾 初始化数据库管理器...")
            db_path = self.config_manager.get_system_value(
                'system.database.path',
                'data/meteora.db'
            )
            self.db_manager = DatabaseManager(db_path)

            # 将数据库管理器传递给配置管理器
            self.config_manager.db_manager = self.db_manager

            # 3. 加载默认用户配置
            logger.info("⚙️ 加载默认用户配置...")
            self.config_manager.load_default_user_configs(
                'config/default_user_config.yaml'
            )

            # 4. 初始化API客户端
            logger.info("🌐 初始化API客户端...")
            system_config = self.config_manager.get_system_config()
            self.api_client = MeteoraAPIClient(system_config)

            # 5. 初始化WebSocket服务器（先于DataUpdater）
            logger.info("📡 初始化WebSocket服务器...")
            self.websocket_server = create_websocket_server(
                db_manager=self.db_manager,
                api_client=self.api_client,
                config_manager=self.config_manager
            )

            # 6. 初始化数据更新器（传递WebSocket服务器）
            logger.info("🔄 初始化数据更新器...")
            self.data_updater = DataUpdater(
                api_client=self.api_client,
                db_manager=self.db_manager,
                config_manager=self.config_manager,
                websocket_server=self.websocket_server  # 传递WebSocket服务器实例
            )

            # 7. 创建Flask应用
            logger.info("🖥️ 创建Web应用...")
            self.flask_app = create_app(
                config_manager=self.config_manager,
                db_manager=self.db_manager,
                api_client=self.api_client,
                data_updater=self.data_updater,
                websocket_server=self.websocket_server  # 🔧 传递WebSocket服务器
            )

            logger.info("✅ 所有组件初始化完成")

        except Exception as e:
            logger.error(f"❌ 初始化失败: {e}")
            raise

    def start_initial_data_fetch(self):
        """启动时进行首次数据获取"""
        logger.info("🔄 开始首次数据获取...")

        try:
            # 检查API健康状态
            if not self.api_client.check_api_health():
                logger.warning("⚠️ API健康检查失败，但继续启动")
                return

            # 获取所有池子数据
            start_time = datetime.now()
            pools = self.api_client.fetch_all_pools()

            if pools:
                # 保存到数据库（保留历史数据用于趋势计算）
                save_stats = self.db_manager.save_pools_batch(
                    pools, clear_old_data=False)

                # 记录系统状态
                elapsed_time = (datetime.now() - start_time).total_seconds()
                self.db_manager.save_system_status({
                    'total_pools': save_stats['total'],
                    'successful_updates': save_stats['saved'],
                    'failed_updates': save_stats['failed'],
                    'filtered_pools': save_stats['filtered'],
                    'update_duration': elapsed_time,
                    'status': 'healthy'
                })

                logger.info(
                    f"✅ 首次数据获取完成: {save_stats['saved']}/{save_stats['total']} 个池子，耗时: {elapsed_time:.2f}秒")
            else:
                logger.warning("⚠️ 未获取到任何池子数据")

        except Exception as e:
            logger.error(f"❌ 首次数据获取失败: {e}")
            # 记录失败状态
            self.db_manager.save_system_status({
                'total_pools': 0,
                'successful_updates': 0,
                'failed_updates': 1,
                'status': 'error'
            })

    def start_websocket_server(self):
        """启动WebSocket服务器在独立线程中"""
        def run_websocket():
            try:
                # 获取WebSocket配置
                ws_host = self.config_manager.get_system_value(
                    'system.websocket.host', 'localhost')
                ws_port = self.config_manager.get_system_value(
                    'system.websocket.port', 8765)

                logger.info(f"📡 启动WebSocket服务器: ws://{ws_host}:{ws_port}")

                # 创建新的事件循环
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

                # 启动WebSocket服务器
                async def start_ws_server():
                    start_server = self.websocket_server.start_server(
                        ws_host, ws_port)
                    server = await start_server
                    logger.info(f"✅ WebSocket服务器已启动在 {ws_host}:{ws_port}")
                    await server.wait_closed()

                # 运行服务器直到完成
                loop.run_until_complete(start_ws_server())

            except Exception as e:
                logger.error(f"❌ WebSocket服务器启动失败: {e}")

        # 在独立线程中运行WebSocket服务器
        self.websocket_thread = threading.Thread(
            target=run_websocket, daemon=True)
        self.websocket_thread.start()

        # 给WebSocket服务器一点启动时间
        time.sleep(0.5)

    def run(self):
        """运行监控平台"""
        try:
            # 初始化组件
            self.initialize()

            # 启动WebSocket服务器
            self.start_websocket_server()

            # 首次数据获取
            self.start_initial_data_fetch()

            # 启动数据更新服务
            logger.info("🔄 启动数据更新服务...")
            self.data_updater.start()

            # 启动Web服务器
            self.is_running = True

            # 获取服务器配置
            host = self.config_manager.get_system_value(
                'system.server.host', '0.0.0.0')
            port = self.config_manager.get_system_value(
                'system.server.port', 5000)
            debug = self.config_manager.get_system_value(
                'system.server.debug', False)

            logger.info(f"🌟 Meteora监控平台启动成功!")
            logger.info(f"🌐 Web服务器: http://localhost:{port}")
            logger.info(f"📡 WebSocket服务器: ws://localhost:8765")
            logger.info(
                f"⏰ 启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info("按 Ctrl+C 停止服务器")

            # 启动Flask应用
            self.flask_app.run(
                host=host,
                port=port,
                debug=debug,
                threaded=True
            )

        except KeyboardInterrupt:
            logger.info("👋 收到停止信号，正在关闭...")
            self.shutdown()
        except Exception as e:
            logger.error(f"❌ 运行时错误: {e}")
            self.shutdown()
            raise

    def shutdown(self):
        """关闭监控平台"""
        self.is_running = False

        try:
            # 停止WebSocket服务器
            if self.websocket_server:
                logger.info("📡 关闭WebSocket服务器...")
                self.websocket_server.stop_server()

            if self.websocket_thread and self.websocket_thread.is_alive():
                logger.info("⏳ 等待WebSocket线程结束...")
                self.websocket_thread.join(timeout=5)

            # 数据库优化和清理
            if self.db_manager:
                logger.info("🧹 数据库优化中...")
                self.db_manager.optimize_database()

            logger.info("✅ Meteora监控平台已关闭")

        except Exception as e:
            logger.error(f"⚠️ 关闭时出现错误: {e}")


def signal_handler(signum, frame):
    """信号处理器"""
    logger.info(f"收到信号 {signum}，正在关闭...")
    sys.exit(0)


def main():
    """主函数"""
    # 注册信号处理器
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        # 创建并运行监控平台
        monitor = MeteoraMonitor()
        monitor.run()

    except Exception as e:
        logger.error(f"💥 启动失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
