"""
Meteora监控平台 V2.0 - WebSocket实时数据推送
提供实时池子数据更新和系统状态推送
"""

import asyncio
import json
import logging
from typing import Dict, Set, List, Any
from datetime import datetime, timedelta
import websockets
from websockets.exceptions import ConnectionClosed
import threading
import time

logger = logging.getLogger(__name__)


class WebSocketServer:
    """WebSocket服务器，处理实时数据推送"""

    def __init__(self, db_manager, api_client, config_manager):
        """初始化WebSocket服务器"""
        self.db_manager = db_manager
        self.api_client = api_client
        self.config_manager = config_manager

        # 连接管理
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.client_subscriptions: Dict[str, Dict] = {}

        # 数据更新配置
        self.update_interval = 30  # 30秒更新间隔
        self.is_running = False
        self.update_thread = None

        # 数据缓存
        self.latest_pools_data = None
        self.latest_system_status = None
        self.last_update_time = None

        logger.info("WebSocket服务器初始化完成")

    async def register_client(self, websocket, path):
        """注册新客户端连接"""
        client_id = f"client_{id(websocket)}"
        self.clients.add(websocket)
        self.client_subscriptions[client_id] = {
            'websocket': websocket,
            'subscriptions': ['pools', 'system'],  # 默认订阅
            'filters': {},
            'last_ping': datetime.now()
        }

        logger.info(f"客户端连接: {client_id}, 当前连接数: {len(self.clients)}")

        # 发送欢迎消息
        await self.send_to_client(websocket, {
            'type': 'welcome',
            'client_id': client_id,
            'timestamp': datetime.now().isoformat(),
            'available_subscriptions': ['pools', 'system', 'pool_detail', 'alerts']
        })

        # 发送最新数据
        if self.latest_pools_data:
            await self.send_to_client(websocket, {
                'type': 'pools_update',
                'data': self.latest_pools_data,
                'timestamp': self.last_update_time.isoformat()
            })

    async def unregister_client(self, websocket):
        """注销客户端连接"""
        self.clients.discard(websocket)

        # 删除订阅信息
        client_id = None
        for cid, info in self.client_subscriptions.items():
            if info['websocket'] == websocket:
                client_id = cid
                break

        if client_id:
            del self.client_subscriptions[client_id]
            logger.info(f"客户端断开: {client_id}, 当前连接数: {len(self.clients)}")

    async def handle_client_message(self, websocket, message):
        """处理客户端消息"""
        try:
            data = json.loads(message)
            message_type = data.get('type')

            if message_type == 'subscribe':
                await self.handle_subscription(websocket, data)
            elif message_type == 'unsubscribe':
                await self.handle_unsubscription(websocket, data)
            elif message_type == 'set_filters':
                await self.handle_filter_update(websocket, data)
            elif message_type == 'ping':
                await self.handle_ping(websocket, data)
            elif message_type == 'request_data':
                await self.handle_data_request(websocket, data)
            else:
                await self.send_to_client(websocket, {
                    'type': 'error',
                    'message': f'未知消息类型: {message_type}'
                })

        except json.JSONDecodeError:
            await self.send_to_client(websocket, {
                'type': 'error',
                'message': '消息格式错误'
            })
        except Exception as e:
            logger.error(f"处理客户端消息失败: {e}")
            await self.send_to_client(websocket, {
                'type': 'error',
                'message': f'服务器错误: {str(e)}'
            })

    async def handle_subscription(self, websocket, data):
        """处理订阅请求"""
        client_id = self.get_client_id(websocket)
        if not client_id:
            return

        subscription_type = data.get('subscription')
        if subscription_type in ['pools', 'system', 'pool_detail', 'alerts']:
            self.client_subscriptions[client_id]['subscriptions'].append(
                subscription_type)

            await self.send_to_client(websocket, {
                'type': 'subscription_success',
                'subscription': subscription_type,
                'message': f'已订阅 {subscription_type}'
            })

            logger.info(f"客户端 {client_id} 订阅了 {subscription_type}")

    async def handle_unsubscription(self, websocket, data):
        """处理取消订阅请求"""
        client_id = self.get_client_id(websocket)
        if not client_id:
            return

        subscription_type = data.get('subscription')
        subscriptions = self.client_subscriptions[client_id]['subscriptions']

        if subscription_type in subscriptions:
            subscriptions.remove(subscription_type)

            await self.send_to_client(websocket, {
                'type': 'unsubscription_success',
                'subscription': subscription_type,
                'message': f'已取消订阅 {subscription_type}'
            })

    async def handle_filter_update(self, websocket, data):
        """处理筛选器更新"""
        client_id = self.get_client_id(websocket)
        if not client_id:
            return

        filters = data.get('filters', {})
        self.client_subscriptions[client_id]['filters'] = filters

        # 根据新筛选器发送数据
        if 'pools' in self.client_subscriptions[client_id]['subscriptions']:
            filtered_data = await self.apply_filters(self.latest_pools_data, filters)
            await self.send_to_client(websocket, {
                'type': 'pools_update',
                'data': filtered_data,
                'timestamp': datetime.now().isoformat(),
                'filters_applied': filters
            })

    async def handle_ping(self, websocket, data):
        """处理心跳检测"""
        client_id = self.get_client_id(websocket)
        if client_id:
            self.client_subscriptions[client_id]['last_ping'] = datetime.now()

        await self.send_to_client(websocket, {
            'type': 'pong',
            'timestamp': datetime.now().isoformat()
        })

    async def handle_data_request(self, websocket, data):
        """处理数据请求"""
        request_type = data.get('request_type')

        if request_type == 'pool_detail':
            address = data.get('address')
            if address:
                pool_detail = await self.get_pool_detail(address)
                await self.send_to_client(websocket, {
                    'type': 'pool_detail',
                    'address': address,
                    'data': pool_detail,
                    'timestamp': datetime.now().isoformat()
                })

    async def send_to_client(self, websocket, message):
        """发送消息给单个客户端"""
        try:
            await websocket.send(json.dumps(message, ensure_ascii=False))
        except ConnectionClosed:
            await self.unregister_client(websocket)
        except Exception as e:
            logger.error(f"发送消息失败: {e}")

    async def broadcast_message(self, message, subscription_filter=None):
        """广播消息给所有符合条件的客户端"""
        if not self.clients:
            return

        disconnected_clients = []

        for websocket in self.clients.copy():
            try:
                # 检查订阅过滤器
                if subscription_filter:
                    client_id = self.get_client_id(websocket)
                    if client_id:
                        subscriptions = self.client_subscriptions[client_id]['subscriptions']
                        if subscription_filter not in subscriptions:
                            continue

                await websocket.send(json.dumps(message, ensure_ascii=False))

            except ConnectionClosed:
                disconnected_clients.append(websocket)
            except Exception as e:
                logger.error(f"广播消息失败: {e}")
                disconnected_clients.append(websocket)

        # 清理断开的连接
        for websocket in disconnected_clients:
            await self.unregister_client(websocket)

    def get_client_id(self, websocket):
        """获取客户端ID"""
        for client_id, info in self.client_subscriptions.items():
            if info['websocket'] == websocket:
                return client_id
        return None

    async def apply_filters(self, data, filters):
        """应用筛选器到数据"""
        if not data or not filters:
            return data

        # 这里实现筛选逻辑
        # 暂时返回原数据，后续会根据filters进行过滤
        return data

    async def get_pool_detail(self, address):
        """获取池子详细信息"""
        try:
            # 从数据库获取详细信息
            filters = {'search_keyword': address, 'limit': 1}
            pools = self.db_manager.get_pools_with_filters(filters)

            if pools:
                pool = pools[0]
                # 获取历史数据
                history = self.db_manager.get_pool_history(address, 7)

                return {
                    'pool': pool,
                    'history': history
                }

            return None

        except Exception as e:
            logger.error(f"获取池子详情失败: {e}")
            return None

    def start_data_updater(self):
        """启动数据更新线程"""
        self.is_running = True
        self.update_thread = threading.Thread(target=self._data_updater_loop)
        self.update_thread.daemon = True
        self.update_thread.start()
        logger.info("数据更新线程已启动")

    def stop_data_updater(self):
        """停止数据更新线程"""
        self.is_running = False
        if self.update_thread:
            self.update_thread.join(timeout=5)
        logger.info("数据更新线程已停止")

    def _data_updater_loop(self):
        """数据更新循环"""
        while self.is_running:
            try:
                # 更新池子数据
                self._update_pools_data()

                # 更新系统状态
                self._update_system_status()

                # 等待下次更新
                time.sleep(self.update_interval)

            except Exception as e:
                logger.error(f"数据更新循环错误: {e}")
                time.sleep(5)  # 错误时短暂等待

    def _update_pools_data(self):
        """更新池子数据"""
        try:
            # 获取最新数据
            filters = {'limit': 1000, 'sort_field': 'liquidity',
                       'sort_direction': 'DESC'}
            pools = self.db_manager.get_pools_with_filters(filters)

            if pools:
                self.latest_pools_data = pools
                self.last_update_time = datetime.now()

                # 如果有客户端连接，则广播更新（避免无用的协程）
                if self.clients:
                    # 记录更新而不是实际广播，避免在线程中处理协程
                    logger.debug(f"池子数据已更新: {len(pools)} 个池子")

        except Exception as e:
            logger.error(f"更新池子数据失败: {e}")

    def _update_system_status(self):
        """更新系统状态"""
        try:
            stats = self.db_manager.get_statistics()
            self.latest_system_status = {
                'status': 'healthy',
                'stats': stats,
                'connected_clients': len(self.clients),
                'timestamp': datetime.now().isoformat()
            }

            # 如果有客户端连接，则记录状态更新
            if self.clients:
                logger.debug(f"系统状态已更新，连接客户端数: {len(self.clients)}")

        except Exception as e:
            logger.error(f"更新系统状态失败: {e}")

    async def websocket_handler(self, websocket):
        """WebSocket连接处理器"""
        path = websocket.path if hasattr(websocket, 'path') else '/'
        await self.register_client(websocket, path)

        try:
            async for message in websocket:
                await self.handle_client_message(websocket, message)
        except ConnectionClosed:
            pass
        except Exception as e:
            logger.error(f"WebSocket处理错误: {e}")
        finally:
            await self.unregister_client(websocket)

    def start_server(self, host='localhost', port=8765):
        """启动WebSocket服务器"""
        try:
            # 启动数据更新器
            self.start_data_updater()

            # 启动WebSocket服务器
            start_server = websockets.serve(
                self.websocket_handler,
                host,
                port,
                ping_interval=30,
                ping_timeout=10
            )

            logger.info(f"WebSocket服务器启动: ws://{host}:{port}")
            return start_server

        except Exception as e:
            logger.error(f"启动WebSocket服务器失败: {e}")
            raise

    def stop_server(self):
        """停止WebSocket服务器"""
        self.stop_data_updater()
        logger.info("WebSocket服务器已停止")


# 全局WebSocket服务器实例
websocket_server = None


def create_websocket_server(db_manager, api_client, config_manager):
    """创建WebSocket服务器实例"""
    global websocket_server
    websocket_server = WebSocketServer(db_manager, api_client, config_manager)
    return websocket_server


def get_websocket_server():
    """获取WebSocket服务器实例"""
    return websocket_server
