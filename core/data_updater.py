#!/usr/bin/env python3
"""
独立数据更新服务
解决WebSocket服务器失败导致数据不更新的问题
"""

import threading
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class DataUpdater:
    """独立的数据更新服务"""

    def __init__(self, api_client, db_manager, config_manager, websocket_server=None):
        """初始化数据更新器"""
        self.api_client = api_client
        self.db_manager = db_manager
        self.config_manager = config_manager
        self.websocket_server = websocket_server  # 新增WebSocket服务器引用

        # 更新配置
        self.update_interval = 300  # 5分钟更新间隔
        self.full_update_interval = 1800  # 30分钟全量更新间隔（恢复原来的频率）

        # 控制状态
        self.is_running = False
        self.update_thread = None
        self.last_full_update = None

        # 统计信息
        self.stats = {
            'total_updates': 0,
            'successful_updates': 0,
            'failed_updates': 0,
            'last_update_time': None,
            'last_update_duration': 0,
            'last_pools_count': 0
        }

        logger.info("数据更新器初始化完成")

    def start(self):
        """启动数据更新服务"""
        if self.is_running:
            logger.warning("数据更新服务已在运行")
            return

        logger.info("🔄 启动数据更新服务...")
        self.is_running = True

        # 启动更新线程
        self.update_thread = threading.Thread(
            target=self._update_loop, daemon=True)
        self.update_thread.start()

        logger.info("✅ 数据更新服务已启动")

    def stop(self):
        """停止数据更新服务"""
        logger.info("停止数据更新服务...")
        self.is_running = False

        if self.update_thread:
            self.update_thread.join(timeout=10)

        logger.info("数据更新服务已停止")

    def _update_loop(self):
        """数据更新主循环"""
        logger.info("数据更新循环启动")

        while self.is_running:
            try:
                # 检查是否需要全量更新
                if self._should_do_full_update():
                    self._do_full_update()
                else:
                    self._do_incremental_update()

                # 等待下次更新
                for _ in range(self.update_interval):
                    if not self.is_running:
                        break
                    time.sleep(1)

            except Exception as e:
                logger.error(f"数据更新循环错误: {e}")
                self.stats['failed_updates'] += 1
                # 出错后短暂等待
                time.sleep(30)

        logger.info("数据更新循环结束")

    def _should_do_full_update(self) -> bool:
        """判断是否需要进行全量更新"""
        if self.last_full_update is None:
            return True

        time_since_last = datetime.now() - self.last_full_update
        return time_since_last.total_seconds() >= self.full_update_interval

    def _do_full_update(self):
        """执行全量数据更新"""
        logger.info("🔄 开始全量数据更新...")
        start_time = datetime.now()

        try:
            # 检查API健康状态
            if not self.api_client.check_api_health():
                logger.warning("API健康检查失败，跳过此次更新")
                return

            # 获取所有池子数据
            pools = self.api_client.fetch_all_pools()

            if pools:
                # 始终清空旧数据重建，避免数据累积（这是正确的做法）
                save_stats = self.db_manager.save_pools_batch(
                    pools, clear_old_data=True)

                # 检查报警（基于保存的数据中的趋势和变化幅度）
                triggered_alerts = self.db_manager.check_and_save_alerts(pools)
                if triggered_alerts:
                    self._process_alerts(triggered_alerts)

                # 清理过期的报警记录和系统状态
                self._cleanup_old_data()

                # 更新统计信息
                duration = (datetime.now() - start_time).total_seconds()
                self.stats.update({
                    'total_updates': self.stats['total_updates'] + 1,
                    'successful_updates': self.stats['successful_updates'] + 1,
                    'last_update_time': start_time.isoformat(),
                    'last_update_duration': duration,
                    'last_pools_count': save_stats['saved'],
                    'last_total_pools': save_stats['total'],
                    'last_filtered_pools': save_stats['filtered'],
                    'last_alerts_count': len(triggered_alerts)
                })

                self.last_full_update = start_time

                logger.info(
                    f"✅ 全量更新完成: {save_stats['saved']}/{save_stats['total']} 个池子，耗时: {duration:.2f}秒")

                # 记录系统状态
                self.db_manager.save_system_status({
                    'update_type': 'full',
                    'total_pools': save_stats['total'],
                    'successful_updates': save_stats['saved'],
                    'failed_updates': save_stats['failed'],
                    'filtered_pools': save_stats['filtered'],
                    'update_duration': duration,
                    'status': 'healthy'
                })

            else:
                logger.warning("全量更新未获取到数据")
                self.stats['failed_updates'] += 1

        except Exception as e:
            logger.error(f"全量更新失败: {e}")
            self.stats['failed_updates'] += 1

            # 记录错误状态
            self.db_manager.save_system_status({
                'update_type': 'full',
                'total_pools': 0,
                'successful_updates': 0,
                'failed_updates': 1,
                'error': str(e),
                'status': 'error'
            })

    def _do_incremental_update(self):
        """执行增量数据更新（获取最新数据）"""
        logger.info("🔄 开始增量数据更新...")
        start_time = datetime.now()

        try:
            # 检查API健康状态
            if not self.api_client.check_api_health():
                logger.debug("API健康检查失败，跳过增量更新")
                return

            # 获取所有池子数据（增量更新改为全量获取，确保数据完整性）
            pools = self.api_client.fetch_all_pools()

            if pools:
                # 增量更新也清空旧数据，避免数据累积（关键修改）
                save_stats = self.db_manager.save_pools_batch(
                    pools, clear_old_data=True)

                # 检查报警（基于保存的数据中的趋势和变化幅度）
                triggered_alerts = self.db_manager.check_and_save_alerts(pools)
                if triggered_alerts:
                    self._process_alerts(triggered_alerts)

                # 更新统计信息
                duration = (datetime.now() - start_time).total_seconds()
                self.stats.update({
                    'total_updates': self.stats['total_updates'] + 1,
                    'successful_updates': self.stats['successful_updates'] + 1,
                    'last_update_time': start_time.isoformat(),
                    'last_update_duration': duration,
                    'last_pools_count': save_stats['saved'],
                    'last_total_pools': save_stats['total'],
                    'last_filtered_pools': save_stats['filtered'],
                    'last_alerts_count': len(triggered_alerts)
                })

                logger.info(
                    f"✅ 增量更新完成: {save_stats['saved']}/{save_stats['total']} 个池子，耗时: {duration:.2f}秒")

            else:
                logger.debug("增量更新未获取到数据")

        except Exception as e:
            logger.warning(f"增量更新失败: {e}")
            # 增量更新失败不算严重错误，只记录警告

    def _cleanup_old_data(self):
        """清理过期数据"""
        try:
            logger.info("🧹 开始清理过期数据...")

            # 清理过期的报警记录（保留3天）
            cutoff_date = datetime.now() - timedelta(days=3)

            with self.db_manager._get_connection() as conn:
                cursor = conn.cursor()

                # 清理过期的报警记录
                cursor.execute("""
                    DELETE FROM alert_records 
                    WHERE created_at < ?
                """, (cutoff_date.isoformat(),))
                deleted_alerts = cursor.rowcount

                # 清理过期的报警历史
                cursor.execute("""
                    DELETE FROM alert_history 
                    WHERE created_at < ? AND is_read = 1
                """, (cutoff_date.isoformat(),))
                deleted_history = cursor.rowcount

                # 清理过期的系统状态（保留7天）
                status_cutoff = datetime.now() - timedelta(days=7)
                cursor.execute("""
                    DELETE FROM system_status 
                    WHERE timestamp < ?
                """, (status_cutoff.isoformat(),))
                deleted_status = cursor.rowcount

                # 清理过期的用户配置（保留重复的报警配置）
                cursor.execute("""
                    DELETE FROM user_configs 
                    WHERE config_type = 'alerts' 
                    AND config_name = 'thresholds'
                    AND id NOT IN (
                        SELECT MAX(id) FROM user_configs 
                        WHERE config_type = 'alerts' 
                        AND config_name = 'thresholds'
                        GROUP BY config_data
                    )
                """)
                deleted_configs = cursor.rowcount

                conn.commit()

                if deleted_alerts > 0 or deleted_history > 0 or deleted_status > 0 or deleted_configs > 0:
                    logger.info(f"✅ 数据清理完成:")
                    logger.info(f"   删除过期报警记录: {deleted_alerts} 条")
                    logger.info(f"   删除过期报警历史: {deleted_history} 条")
                    logger.info(f"   删除过期系统状态: {deleted_status} 条")
                    logger.info(f"   删除重复配置: {deleted_configs} 条")

        except Exception as e:
            logger.warning(f"清理过期数据失败: {e}")

    def force_update(self) -> Dict[str, Any]:
        """强制执行一次数据更新"""
        logger.info("🔄 执行强制数据更新...")

        try:
            self._do_full_update()
            return {
                'success': True,
                'message': '强制更新完成',
                'stats': self.get_stats()
            }
        except Exception as e:
            logger.error(f"强制更新失败: {e}")
            return {
                'success': False,
                'error': str(e),
                'stats': self.get_stats()
            }

    def get_stats(self) -> Dict[str, Any]:
        """获取更新统计信息"""
        return {
            'is_running': self.is_running,
            'last_full_update': self.last_full_update.isoformat() if self.last_full_update else None,
            'next_full_update': (self.last_full_update + timedelta(seconds=self.full_update_interval)).isoformat() if self.last_full_update else None,
            'update_interval_minutes': self.update_interval // 60,
            'full_update_interval_minutes': self.full_update_interval // 60,
            **self.stats
        }

    def set_update_interval(self, minutes: int):
        """设置更新间隔"""
        if 1 <= minutes <= 60:
            self.update_interval = minutes * 60
            logger.info(f"更新间隔已设置为: {minutes} 分钟")
        else:
            logger.warning(f"无效的更新间隔: {minutes} 分钟，应在1-60分钟之间")

    def set_full_update_interval(self, minutes: int):
        """设置全量更新间隔"""
        if 10 <= minutes <= 1440:  # 10分钟到24小时
            self.full_update_interval = minutes * 60
            logger.info(f"全量更新间隔已设置为: {minutes} 分钟")
        else:
            logger.warning(f"无效的全量更新间隔: {minutes} 分钟，应在10-1440分钟之间")

    def _process_alerts(self, alerts: List[Dict[str, Any]]):
        """处理触发的报警

        Args:
            alerts: 触发的报警记录列表
        """
        if not alerts:
            return

        logger.info(f"🚨 触发 {len(alerts)} 条报警")

        # 获取报警配置
        alert_config = self.db_manager.get_user_config('alerts', 'thresholds')
        if not alert_config:
            return

        config_data = alert_config.get('config_data', {})

        # 检查是否启用声音提醒
        if config_data.get('sound_enabled', True):
            self._play_alert_sound()

        # 记录报警到日志并发送WebSocket通知
        for alert in alerts:
            from core.models import AlertRecordModel
            alert_model = AlertRecordModel(alert)
            message = alert_model.get_alert_message()
            logger.warning(f"🚨 报警: {message}")

            # 🔧 新增：通过WebSocket发送报警通知给前端
            self._send_alert_notification(alert_model)

    def _send_alert_notification(self, alert_model: 'AlertRecordModel'):
        """通过WebSocket发送报警通知给前端"""
        try:
            if not self.websocket_server:
                logger.debug("WebSocket服务器未初始化，跳过报警通知")
                return

            # 构建报警消息
            alert_message = {
                'type': 'new_alert',
                'data': alert_model.to_dict(),
                'timestamp': datetime.now().isoformat(),
                'message': alert_model.get_alert_message()
            }

            # 异步发送给所有订阅alerts的客户端
            import asyncio

            async def send_alert():
                await self.websocket_server.broadcast_message(alert_message, 'alerts')
                logger.debug(f"📡 已通过WebSocket发送报警通知: {alert_model.pool_name}")

            # 在新的事件循环中发送（因为我们在同步线程中）
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(send_alert())
                loop.close()
            except Exception as e:
                logger.warning(f"WebSocket发送报警通知失败: {e}")

        except Exception as e:
            logger.warning(f"发送报警通知失败: {e}")

    def _play_alert_sound(self):
        """播放报警声音"""
        try:
            # 这里可以实现声音播放逻辑
            # 为了保持简洁，暂时只记录日志
            logger.info("🔊 播放报警声音")

            # 实际实现时可以使用类似以下的代码：
            # import pygame
            # pygame.mixer.init()
            # pygame.mixer.music.load("alert.mp3")
            # pygame.mixer.music.play()

        except Exception as e:
            logger.warning(f"播放报警声音失败: {e}")
