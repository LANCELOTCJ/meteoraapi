"""
Meteora监控平台 V2.0 - 数据库管理器
高性能SQLite数据库操作层，支持批量操作和智能查询
"""

import sqlite3
import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from pathlib import Path
import threading

from .models import (
    DATABASE_SCHEMA, DATABASE_INDEXES, SQLITE_OPTIMIZATIONS,
    PoolModel, PoolMetricsModel, UserConfigModel, AlertHistoryModel, SystemStatusModel
)

logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """数据库相关错误"""
    pass


class DatabaseManager:
    """数据库管理器 - 核心数据存储操作"""

    def __init__(self, db_path: str):
        """初始化数据库管理器

        Args:
            db_path: 数据库文件路径

        Raises:
            DatabaseError: 当数据库初始化失败时
        """
        self.db_path = db_path
        self.connection = None
        self._lock = threading.Lock()

        # 确保数据库目录存在
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

        # 初始化数据库
        self._initialize_database()

        logger.info(f"数据库管理器初始化完成: {db_path}")

    def _initialize_database(self):
        """初始化数据库表结构和索引"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()

                # 应用SQLite性能优化
                for pragma in SQLITE_OPTIMIZATIONS:
                    cursor.execute(pragma)

                # 创建数据库表
                for table_name, schema in DATABASE_SCHEMA.items():
                    cursor.execute(schema)
                    logger.debug(f"表 {table_name} 创建/验证完成")

                # 数据库升级：添加新字段（如果不存在）
                try:
                    cursor.execute("PRAGMA table_info(pool_metrics)")
                    columns = [column[1] for column in cursor.fetchall()]

                    # 添加计算字段
                    if 'fee_tvl_ratio' not in columns:
                        cursor.execute(
                            "ALTER TABLE pool_metrics ADD COLUMN fee_tvl_ratio REAL")
                        logger.info("✅ 数据库升级: 添加fee_tvl_ratio字段")
                    if 'estimated_daily_fee_rate' not in columns:
                        cursor.execute(
                            "ALTER TABLE pool_metrics ADD COLUMN estimated_daily_fee_rate REAL")
                        logger.info("✅ 数据库升级: 添加estimated_daily_fee_rate字段")

                    # 添加趋势字段
                    trend_fields = [
                        'liquidity_trend',
                        'trade_volume_24h_trend',
                        'fees_24h_trend',
                        'fees_hour_1_trend'
                    ]
                    for field in trend_fields:
                        if field not in columns:
                            cursor.execute(
                                f"ALTER TABLE pool_metrics ADD COLUMN {field} TEXT")
                            logger.info(f"✅ 数据库升级: 添加{field}字段")

                    # 添加变化幅度字段
                    change_percent_fields = [
                        'liquidity_change_percent',
                        'trade_volume_24h_change_percent',
                        'fees_24h_change_percent',
                        'fees_hour_1_change_percent'
                    ]
                    for field in change_percent_fields:
                        if field not in columns:
                            cursor.execute(
                                f"ALTER TABLE pool_metrics ADD COLUMN {field} REAL")
                            logger.info(f"✅ 数据库升级: 添加{field}字段")

                except Exception as e:
                    logger.warning(f"数据库升级跳过: {e}")

                # 创建索引
                for index_sql in DATABASE_INDEXES:
                    cursor.execute(index_sql)

                conn.commit()
                logger.info("数据库结构初始化完成")

        except Exception as e:
            logger.error(f"数据库初始化失败: {e}")
            raise DatabaseError(f"无法初始化数据库: {e}")

    def _get_connection(self) -> sqlite3.Connection:
        """获取数据库连接"""
        try:
            conn = sqlite3.connect(
                self.db_path,
                timeout=30.0,
                check_same_thread=False
            )
            conn.row_factory = sqlite3.Row  # 支持字典式访问
            return conn

        except Exception as e:
            raise DatabaseError(f"数据库连接失败: {e}")

    # ==================== 池子数据操作 ====================

    def save_pools_batch(self, pools: List[Dict[str, Any]], clear_old_data: bool = True) -> Dict[str, int]:
        """批量保存池子数据 - 正确的趋势计算流程

        流程：新数据 → 对比计算趋势 → 保存带趋势数据 → 删除旧数据 → 保留最新记录

        Args:
            pools: 池子数据列表
            clear_old_data: 是否清除旧数据（默认True）

        Returns:
            Dict[str, int]: 保存统计信息

        Raises:
            DatabaseError: 当保存失败时
        """
        if not pools:
            return {'total': 0, 'saved': 0, 'filtered': 0, 'invalid': 0, 'failed': 0}

        # 统计信息
        stats = {
            'total': len(pools),
            'saved': 0,
            'filtered': 0,  # 被过滤的（TVL和VOL都无数据）
            'invalid': 0,   # 无效数据（缺少地址等）
            'failed': 0     # 保存失败
        }

        try:
            with self._lock:
                with self._get_connection() as conn:
                    cursor = conn.cursor()

                    # 1. 数据验证和筛选
                    valid_pools = []
                    for pool_data in pools:
                        try:
                            # 验证必要字段
                            pool_address = pool_data.get('address')
                            if not pool_address:
                                stats['invalid'] += 1
                                continue

                            # 检查池子是否有活跃数据（TVL或24小时交易量）
                            if not self._has_active_data(pool_data):
                                stats['filtered'] += 1
                                continue

                            valid_pools.append(pool_data)

                        except Exception as e:
                            logger.warning(
                                f"验证池子数据失败: {e}, 地址: {pool_data.get('address', 'unknown')}")
                            stats['invalid'] += 1
                            continue

                    # 2. 对每个池子执行正确的流程：计算趋势 → 保存新数据 → 清理旧数据
                    logger.info(f"🔄 开始处理 {len(valid_pools)} 个有效池子...")

                    for pool_data in valid_pools:
                        try:
                            pool_address = pool_data.get('address')

                            # 2.1 计算趋势（基于现有数据）
                            trends = self._calculate_trends(cursor, pool_data)

                            # 2.2 保存池子基础信息
                            self._save_pool_info(cursor, pool_data)

                            # 2.3 保存带趋势的新指标数据
                            self._save_pool_metrics_with_computed_trends(
                                cursor, pool_data, trends)

                            # 2.4 删除该池子的旧指标数据（保留最新的一条）
                            if clear_old_data:
                                self._cleanup_old_pool_metrics(
                                    cursor, pool_address)

                            stats['saved'] += 1

                        except Exception as e:
                            logger.warning(
                                f"处理池子失败: {e}, 地址: {pool_data.get('address', 'unknown')}")
                            stats['failed'] += 1
                            continue

                    # 3. 全局清理和优化
                    if clear_old_data:
                        # 清理没有对应池子的孤立指标数据
                        cursor.execute("""
                            DELETE FROM pool_metrics 
                            WHERE pool_address NOT IN (SELECT address FROM pools)
                        """)
                        orphaned_count = cursor.rowcount

                        if orphaned_count > 0:
                            logger.info(f"🧹 清理了 {orphaned_count} 条孤立的指标数据")

                        # 执行VACUUM回收空间
                        logger.info("🗜️ 回收数据库空间...")
                        conn.commit()  # 先提交所有操作
                        cursor.execute("VACUUM")
                        logger.info("✅ 数据库空间回收完成")

                    conn.commit()

            # 输出详细的更新概要
            self._log_update_summary(stats)

            return stats

        except Exception as e:
            logger.error(f"批量保存失败: {e}")
            raise DatabaseError(f"批量保存池子数据失败: {e}")

    def _has_active_data(self, pool_data: Dict[str, Any]) -> bool:
        """检查池子是否有活跃数据（TVL或24小时交易量）

        Args:
            pool_data: 池子数据

        Returns:
            bool: 是否有活跃数据
        """
        # 检查TVL（流动性）
        liquidity = pool_data.get('liquidity')
        if liquidity is not None and self._is_positive_number(liquidity):
            return True

        # 检查24小时交易量
        volume_24h = pool_data.get('trade_volume_24h')
        if volume_24h is not None and self._is_positive_number(volume_24h):
            return True

        return False

    def _is_positive_number(self, value) -> bool:
        """检查值是否为正数

        Args:
            value: 要检查的值

        Returns:
            bool: 是否为正数
        """
        try:
            if value is None or value == '' or value == 'null':
                return False

            # 转换为浮点数进行比较
            num_value = float(value)
            return num_value > 0
        except (ValueError, TypeError):
            return False

    def _calculate_fee_tvl_ratio(self, pool_data: Dict[str, Any]) -> Optional[float]:
        """计算24小时手续费/TVL比率

        Args:
            pool_data: 池子数据

        Returns:
            Optional[float]: Fee/TVL比率(%)，如果无法计算则返回None
        """
        try:
            fees_24h = pool_data.get('fees_24h')
            liquidity = pool_data.get('liquidity')

            # 检查数据有效性
            if not self._is_positive_number(fees_24h) or not self._is_positive_number(liquidity):
                return None

            # 计算比率并转换为百分比
            ratio = (float(fees_24h) / float(liquidity)) * 100

            # 保留4位小数，避免精度问题
            return round(ratio, 4)

        except (ValueError, TypeError, ZeroDivisionError):
            return None

    def _calculate_estimated_daily_fee_rate(self, pool_data: Dict[str, Any]) -> Optional[float]:
        """计算1小时费用估算的24小时收益率

        Args:
            pool_data: 池子数据

        Returns:
            Optional[float]: 估算24小时收益率(%)，如果无法计算则返回None
        """
        try:
            fees_hour_1 = pool_data.get('fees_hour_1')
            liquidity = pool_data.get('liquidity')

            # 检查数据有效性
            if not self._is_positive_number(fees_hour_1) or not self._is_positive_number(liquidity):
                return None

            # 计算公式：(1小时费用 * 24) / TVL * 100
            estimated_daily_fee = float(fees_hour_1) * 24
            ratio = (estimated_daily_fee / float(liquidity)) * 100

            # 保留4位小数，避免精度问题
            return round(ratio, 4)

        except (ValueError, TypeError, ZeroDivisionError):
            return None

    def _log_update_summary(self, stats: Dict[str, int]):
        """输出更新概要日志

        Args:
            stats: 统计信息
        """
        logger.info("📊 数据更新概要:")
        logger.info(f"   📥 API获取总数: {stats['total']:,} 个池子")
        logger.info(f"   💾 成功保存: {stats['saved']:,} 个池子")
        logger.info(f"   🔍 活跃池子率: {stats['saved']/stats['total']*100:.1f}%")

        if stats['filtered'] > 0:
            logger.info(f"   🚫 过滤无数据: {stats['filtered']:,} 个池子 (TVL和VOL均为0)")

        if stats['invalid'] > 0:
            logger.info(f"   ⚠️  无效数据: {stats['invalid']:,} 个池子 (缺少地址)")

        if stats['failed'] > 0:
            logger.info(f"   ❌ 保存失败: {stats['failed']:,} 个池子")

        logger.info(f"   ✅ 最终保存: {stats['saved']:,} 个活跃池子到数据库")

    def _save_pool_info(self, cursor: sqlite3.Cursor, pool_data: Dict[str, Any]):
        """保存池子基础信息"""
        from datetime import datetime
        local_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        cursor.execute("""
            INSERT OR REPLACE INTO pools (
                address, name, mint_x, mint_y, bin_step,
                protocol_fee_percentage, base_fee_percentage, max_fee_percentage,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            pool_data.get('address'),
            pool_data.get('name', ''),
            pool_data.get('mint_x'),
            pool_data.get('mint_y'),
            pool_data.get('bin_step'),
            pool_data.get('protocol_fee_percentage'),
            pool_data.get('base_fee_percentage'),
            pool_data.get('max_fee_percentage'),
            local_time,
            local_time
        ))

    def _compare_values(self, old_value, new_value) -> tuple[str, float]:
        """比较两个数值的变化趋势和幅度

        Args:
            old_value: 旧值
            new_value: 新值

        Returns:
            tuple[str, float]: (趋势字符串, 变化幅度百分比)
        """
        # 处理空值情况
        if old_value is None or new_value is None:
            return 'neutral', 0.0

        try:
            old_val = float(old_value)
            new_val = float(new_value)

            # 设置一个极小的阈值来判断变化（避免浮点数精度问题）
            threshold = 1e-10

            # 计算变化幅度百分比
            if old_val == 0:
                # 避免除零错误
                if new_val == 0:
                    return 'neutral', 0.0
                else:
                    # 从0变化到非0，视为100%变化
                    return 'increase' if new_val > 0 else 'decrease', 100.0

            change_percent = ((new_val - old_val) / old_val) * 100

            if new_val > old_val + threshold:
                return 'increase', change_percent
            elif new_val < old_val - threshold:
                return 'decrease', change_percent
            else:
                return 'neutral', 0.0

        except (ValueError, TypeError):
            return 'neutral', 0.0

    def _calculate_trends(self, cursor: sqlite3.Cursor, pool_data: Dict[str, Any]) -> Dict[str, Any]:
        """计算数据变化趋势和幅度

        Args:
            cursor: 数据库游标
            pool_data: 当前池子数据

        Returns:
            Dict[str, Any]: 趋势和变化幅度数据字典
        """
        # 默认趋势为neutral（首次加载）
        result = {
            'liquidity_trend': 'neutral',
            'trade_volume_24h_trend': 'neutral',
            'fees_24h_trend': 'neutral',
            'fees_hour_1_trend': 'neutral',
            'liquidity_change_percent': 0.0,
            'trade_volume_24h_change_percent': 0.0,
            'fees_24h_change_percent': 0.0,
            'fees_hour_1_change_percent': 0.0
        }

        pool_address = pool_data.get('address')
        if not pool_address:
            return result

        # 获取池子的最新一条记录作为基准数据
        cursor.execute("""
            SELECT liquidity, trade_volume_24h, fees_24h, fees_hour_1
            FROM pool_metrics
            WHERE pool_address = ?
            ORDER BY timestamp DESC, id DESC
            LIMIT 1
        """, (pool_address,))

        last_record = cursor.fetchone()
        if not last_record:
            # 没有历史数据，返回默认值
            return result

        # 解包历史数据
        last_liquidity, last_volume_24h, last_fees_24h, last_fees_1h = last_record

        # 获取当前数据
        current_liquidity = pool_data.get('liquidity')
        current_volume_24h = pool_data.get('trade_volume_24h')
        current_fees_24h = pool_data.get('fees_24h')
        current_fees_1h = pool_data.get('fees_hour_1')

        # 计算各字段趋势和变化幅度
        liquidity_trend, liquidity_change = self._compare_values(
            last_liquidity, current_liquidity)
        volume_trend, volume_change = self._compare_values(
            last_volume_24h, current_volume_24h)
        fees_24h_trend, fees_24h_change = self._compare_values(
            last_fees_24h, current_fees_24h)
        fees_1h_trend, fees_1h_change = self._compare_values(
            last_fees_1h, current_fees_1h)

        # 更新结果
        result.update({
            'liquidity_trend': liquidity_trend,
            'trade_volume_24h_trend': volume_trend,
            'fees_24h_trend': fees_24h_trend,
            'fees_hour_1_trend': fees_1h_trend,
            'liquidity_change_percent': liquidity_change,
            'trade_volume_24h_change_percent': volume_change,
            'fees_24h_change_percent': fees_24h_change,
            'fees_hour_1_change_percent': fees_1h_change
        })

        return result

    def _save_pool_metrics_with_computed_trends(self, cursor: sqlite3.Cursor, pool_data: Dict[str, Any], trends: Dict[str, Any]):
        """保存池子指标数据（使用计算好的趋势）"""
        from datetime import datetime
        local_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # 计算 24H Fee/TVL 比率
        fee_tvl_ratio = self._calculate_fee_tvl_ratio(pool_data)

        # 计算 1小时费用估算24小时收益率
        estimated_daily_fee_rate = self._calculate_estimated_daily_fee_rate(
            pool_data)

        # 使用传入的趋势数据
        liquidity_trend = trends.get('liquidity_trend', 'neutral')
        trade_volume_24h_trend = trends.get(
            'trade_volume_24h_trend', 'neutral')
        fees_24h_trend = trends.get('fees_24h_trend', 'neutral')
        fees_hour_1_trend = trends.get('fees_hour_1_trend', 'neutral')

        # 获取变化幅度数据
        liquidity_change_percent = trends.get('liquidity_change_percent', 0.0)
        trade_volume_24h_change_percent = trends.get(
            'trade_volume_24h_change_percent', 0.0)
        fees_24h_change_percent = trends.get('fees_24h_change_percent', 0.0)
        fees_hour_1_change_percent = trends.get(
            'fees_hour_1_change_percent', 0.0)

        cursor.execute("""
            INSERT INTO pool_metrics (
                pool_address, timestamp, liquidity, current_price,
                apr, apy, farm_apr, farm_apy,
                trade_volume_24h, volume_hour_1, volume_hour_12, cumulative_trade_volume,
                fees_24h, fees_hour_1, cumulative_fee_volume,
                fee_tvl_ratio, estimated_daily_fee_rate,
                liquidity_trend, trade_volume_24h_trend, fees_24h_trend, fees_hour_1_trend,
                liquidity_change_percent, trade_volume_24h_change_percent, 
                fees_24h_change_percent, fees_hour_1_change_percent,
                reserve_x_amount, reserve_y_amount,
                raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            pool_data.get('address'),
            local_time,
            pool_data.get('liquidity'),
            pool_data.get('current_price'),
            pool_data.get('apr'),
            pool_data.get('apy'),
            pool_data.get('farm_apr'),
            pool_data.get('farm_apy'),
            pool_data.get('trade_volume_24h'),
            pool_data.get('volume_hour_1'),
            pool_data.get('volume_hour_12'),
            pool_data.get('cumulative_trade_volume'),
            pool_data.get('fees_24h'),
            pool_data.get('fees_hour_1'),
            pool_data.get('cumulative_fee_volume'),
            fee_tvl_ratio,
            estimated_daily_fee_rate,
            liquidity_trend,
            trade_volume_24h_trend,
            fees_24h_trend,
            fees_hour_1_trend,
            liquidity_change_percent,
            trade_volume_24h_change_percent,
            fees_24h_change_percent,
            fees_hour_1_change_percent,
            pool_data.get('reserve_x_amount'),
            pool_data.get('reserve_y_amount'),
            json.dumps(pool_data) if isinstance(pool_data, dict) else None
        ))

    def _cleanup_old_pool_metrics(self, cursor: sqlite3.Cursor, pool_address: str):
        """清理指定池子的旧指标数据，只保留最新的一条记录

        Args:
            cursor: 数据库游标
            pool_address: 池子地址
        """
        try:
            # 删除除最新记录外的所有旧记录
            cursor.execute("""
                DELETE FROM pool_metrics 
                WHERE pool_address = ? 
                AND id NOT IN (
                    SELECT id FROM pool_metrics 
                    WHERE pool_address = ? 
                    ORDER BY timestamp DESC, id DESC 
                    LIMIT 1
                )
            """, (pool_address, pool_address))

            deleted_count = cursor.rowcount
            if deleted_count > 0:
                logger.debug(
                    f"清理池子 {pool_address[:8]}... 的 {deleted_count} 条旧记录")

        except Exception as e:
            logger.warning(f"清理池子 {pool_address} 旧数据失败: {e}")

    # ==================== 查询操作 ====================

    def get_pools_with_filters(self, filters: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], int]:
        """根据筛选条件获取池子列表

        Args:
            filters: 筛选条件字典

        Returns:
            Tuple[List[Dict], int]: (池子数据列表, 总记录数)
        """
        try:
            # 先获取总数
            total_count = self._get_filtered_count(filters)

            # 构建分页查询
            sql, params = self._build_pools_query(filters)

            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()

                # 转换为字典列表
                pools = []
                for row in rows:
                    pool = dict(row)
                    pools.append(pool)

                logger.debug(f"查询到 {len(pools)} 个池子 (总共 {total_count} 个符合条件)")
                return pools, total_count

        except Exception as e:
            logger.error(f"查询池子失败: {e}")
            raise DatabaseError(f"查询池子数据失败: {e}")

    def _get_filtered_count(self, filters: Dict[str, Any]) -> int:
        """获取符合筛选条件的总记录数"""
        try:
            # 构建计数查询（不带分页）
            sql, params = self._build_count_query(filters)

            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                result = cursor.fetchone()
                return result[0] if result else 0

        except Exception as e:
            logger.error(f"获取总数失败: {e}")
            return 0

    def _build_count_query(self, filters: Dict[str, Any]) -> Tuple[str, List]:
        """构建计数查询SQL"""
        # 基础计数查询
        sql = """
            SELECT COUNT(DISTINCT p.address)
            FROM pools p
            LEFT JOIN (
                SELECT pool_address, 
                       liquidity, current_price, apr, apy, farm_apr, farm_apy,
                       trade_volume_24h, volume_hour_1, volume_hour_12, cumulative_trade_volume,
                       fees_24h, fees_hour_1, cumulative_fee_volume,
                       fee_tvl_ratio, estimated_daily_fee_rate,
                       reserve_x_amount, reserve_y_amount, timestamp,
                       ROW_NUMBER() OVER (PARTITION BY pool_address ORDER BY timestamp DESC) as rn
                FROM pool_metrics
            ) m ON p.address = m.pool_address AND m.rn = 1
        """

        conditions = []
        params = []

        # 搜索关键词
        search_keyword = filters.get('search_keyword', '').strip()
        if search_keyword:
            conditions.append("(p.name LIKE ? OR p.address LIKE ?)")
            search_pattern = f"%{search_keyword}%"
            params.extend([search_pattern, search_pattern])

        # 数值范围筛选
        numeric_filters = [
            ('min_liquidity', 'm.liquidity', '>='),
            ('max_liquidity', 'm.liquidity', '<='),
            ('min_apy', 'm.apy', '>='),
            ('max_apy', 'm.apy', '<='),
            ('min_volume_24h', 'm.trade_volume_24h', '>='),
            ('max_volume_24h', 'm.trade_volume_24h', '<='),
            ('min_fee_tvl_ratio', 'm.fee_tvl_ratio', '>='),
            ('max_fee_tvl_ratio', 'm.fee_tvl_ratio', '<='),
            ('min_estimated_daily_fee_rate', 'm.estimated_daily_fee_rate', '>='),
            ('max_estimated_daily_fee_rate', 'm.estimated_daily_fee_rate', '<=')
        ]

        for filter_key, db_field, operator in numeric_filters:
            value = filters.get(filter_key)
            if value is not None:
                conditions.append(f"{db_field} {operator} ?")
                params.append(value)

        # 添加WHERE子句
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)

        return sql, params

    def _build_pools_query(self, filters: Dict[str, Any]) -> Tuple[str, List]:
        """构建池子查询SQL

        Args:
            filters: 筛选条件

        Returns:
            Tuple[str, List]: SQL语句和参数
        """
        # 基础查询：获取最新的指标数据
        sql = """
            SELECT 
                p.address, p.name, p.mint_x, p.mint_y, p.bin_step,
                p.protocol_fee_percentage, p.base_fee_percentage, p.max_fee_percentage,
                m.liquidity, m.current_price,
                m.apr, m.apy, m.farm_apr, m.farm_apy,
                m.trade_volume_24h, m.volume_hour_1, m.volume_hour_12, m.cumulative_trade_volume,
                m.fees_24h, m.fees_hour_1, m.cumulative_fee_volume,
                m.fee_tvl_ratio, m.estimated_daily_fee_rate,
                m.liquidity_trend, m.trade_volume_24h_trend, m.fees_24h_trend, m.fees_hour_1_trend,
                m.reserve_x_amount, m.reserve_y_amount,
                m.timestamp
            FROM pools p
            LEFT JOIN (
                SELECT pool_address, 
                       liquidity, current_price, apr, apy, farm_apr, farm_apy,
                       trade_volume_24h, volume_hour_1, volume_hour_12, cumulative_trade_volume,
                       fees_24h, fees_hour_1, cumulative_fee_volume,
                       fee_tvl_ratio, estimated_daily_fee_rate,
                       liquidity_trend, trade_volume_24h_trend, fees_24h_trend, fees_hour_1_trend,
                       reserve_x_amount, reserve_y_amount, timestamp,
                       ROW_NUMBER() OVER (PARTITION BY pool_address ORDER BY timestamp DESC, id DESC) as rn
                FROM pool_metrics
            ) m ON p.address = m.pool_address AND m.rn = 1
        """

        conditions = []
        params = []

        # 搜索关键词
        search_keyword = filters.get('search_keyword', '').strip()
        if search_keyword:
            conditions.append("(p.name LIKE ? OR p.address LIKE ?)")
            search_pattern = f"%{search_keyword}%"
            params.extend([search_pattern, search_pattern])

        # 数值范围筛选
        numeric_filters = [
            ('min_liquidity', 'm.liquidity', '>='),
            ('max_liquidity', 'm.liquidity', '<='),
            ('min_apy', 'm.apy', '>='),
            ('max_apy', 'm.apy', '<='),
            ('min_volume_24h', 'm.trade_volume_24h', '>='),
            ('max_volume_24h', 'm.trade_volume_24h', '<='),
            ('min_fee_tvl_ratio', 'm.fee_tvl_ratio', '>='),
            ('max_fee_tvl_ratio', 'm.fee_tvl_ratio', '<='),
            ('min_estimated_daily_fee_rate', 'm.estimated_daily_fee_rate', '>='),
            ('max_estimated_daily_fee_rate', 'm.estimated_daily_fee_rate', '<=')
        ]

        for filter_key, db_field, operator in numeric_filters:
            value = filters.get(filter_key)
            if value is not None:
                conditions.append(f"{db_field} {operator} ?")
                params.append(value)

        # 添加WHERE子句
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)

        # 排序
        sort_field = filters.get('sort_field', 'liquidity')
        sort_direction = filters.get('sort_direction', 'DESC')

        # 字段映射
        sort_field_map = {
            'name': 'p.name',
            'address': 'p.address',
            'liquidity': 'm.liquidity',
            'apy': 'm.apy',
            'trade_volume_24h': 'm.trade_volume_24h',
            'fees_24h': 'm.fees_24h',
            'fee_tvl_ratio': 'm.fee_tvl_ratio'
        }

        db_sort_field = sort_field_map.get(sort_field, 'm.liquidity')
        sql += f" ORDER BY {db_sort_field} {sort_direction}"

        # 分页
        limit = filters.get('limit', 100)
        offset = filters.get('offset', 0)
        sql += " LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        return sql, params

    def get_pool_history(self, address: str, days: int = 7) -> List[Dict[str, Any]]:
        """获取池子历史数据

        Args:
            address: 池子地址
            days: 历史天数

        Returns:
            List[Dict]: 历史数据
        """
        try:
            sql = """
                SELECT timestamp, liquidity, apy, trade_volume_24h, fees_24h
                FROM pool_metrics
                WHERE pool_address = ?
                  AND timestamp >= datetime('now', '-{} days')
                ORDER BY timestamp ASC
            """.format(days)

            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, (address,))
                rows = cursor.fetchall()

                history = [dict(row) for row in rows]
                return history

        except Exception as e:
            logger.error(f"获取池子历史失败: {e}")
            return []

    # ==================== 用户配置操作 ====================

    def save_user_config(self, config_type: str, config_name: str,
                         config_data: Dict[str, Any], is_active: bool = False):
        """保存用户配置

        Args:
            config_type: 配置类型
            config_name: 配置名称
            config_data: 配置数据
            is_active: 是否激活
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()

                # 如果设置为激活，先取消其他配置的激活状态
                if is_active:
                    cursor.execute("""
                        UPDATE user_configs 
                        SET is_active = 0 
                        WHERE config_type = ?
                    """, (config_type,))

                # 保存配置
                cursor.execute("""
                    INSERT OR REPLACE INTO user_configs 
                    (config_type, config_name, config_data, is_active, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    config_type,
                    config_name,
                    json.dumps(config_data),
                    is_active
                ))

                conn.commit()

        except Exception as e:
            logger.error(f"保存用户配置失败: {e}")
            raise DatabaseError(f"保存用户配置失败: {e}")

    def get_user_config(self, config_type: str, config_name: str = None) -> Optional[Dict[str, Any]]:
        """获取用户配置

        Args:
            config_type: 配置类型
            config_name: 配置名称（None表示获取激活的配置）

        Returns:
            Dict: 配置数据
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()

                if config_name:
                    # 获取指定名称的最新配置
                    cursor.execute("""
                        SELECT config_data FROM user_configs
                        WHERE config_type = ? AND config_name = ?
                        ORDER BY updated_at DESC LIMIT 1
                    """, (config_type, config_name))
                else:
                    # 先尝试获取激活的配置
                    cursor.execute("""
                        SELECT config_data FROM user_configs
                        WHERE config_type = ? AND is_active = 1
                        ORDER BY updated_at DESC LIMIT 1
                    """, (config_type,))

                row = cursor.fetchone()

                # 如果没有激活的配置，获取最新的配置
                if not row:
                    cursor.execute("""
                        SELECT config_data FROM user_configs
                        WHERE config_type = ?
                        ORDER BY updated_at DESC LIMIT 1
                    """, (config_type,))
                    row = cursor.fetchone()

                if row:
                    return json.loads(row[0])
                return None

        except Exception as e:
            logger.error(f"获取用户配置失败: {e}")
            return None

    # ==================== 系统状态操作 ====================

    def save_system_status(self, status_data: Dict[str, Any]):
        """保存系统状态

        Args:
            status_data: 状态数据
        """
        try:
            from datetime import datetime
            local_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            with self._get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    INSERT INTO system_status (
                        timestamp, total_pools, successful_updates, failed_updates,
                        update_duration, api_response_time, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    local_time,
                    status_data.get('total_pools', 0),
                    status_data.get('successful_updates', 0),
                    status_data.get('failed_updates', 0),
                    status_data.get('update_duration'),
                    status_data.get('api_response_time'),
                    status_data.get('status', 'healthy')
                ))

                conn.commit()

        except Exception as e:
            logger.error(f"保存系统状态失败: {e}")

    def get_statistics(self) -> Dict[str, Any]:
        """获取系统统计信息

        Returns:
            Dict: 统计信息
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()

                # 基础统计
                stats = {}

                # 池子总数
                cursor.execute("SELECT COUNT(*) FROM pools")
                stats['total_pools'] = cursor.fetchone()[0]

                # 最新指标数据时间
                cursor.execute("SELECT MAX(timestamp) FROM pool_metrics")
                latest_time = cursor.fetchone()[0]
                stats['latest_metrics_time'] = latest_time

                # 数据库大小
                cursor.execute("PRAGMA page_count")
                page_count = cursor.fetchone()[0]
                cursor.execute("PRAGMA page_size")
                page_size = cursor.fetchone()[0]
                stats['database_size_mb'] = round(
                    (page_count * page_size) / (1024 * 1024), 2)

                # 最近一次系统状态
                cursor.execute("""
                    SELECT total_pools, successful_updates, failed_updates, 
                           update_duration, status
                    FROM system_status 
                    ORDER BY timestamp DESC LIMIT 1
                """)
                row = cursor.fetchone()
                if row:
                    stats.update({
                        'last_update_pools': row[0],
                        'last_successful_updates': row[1],
                        'last_failed_updates': row[2],
                        'last_update_duration': row[3],
                        'last_status': row[4]
                    })

                return stats

        except Exception as e:
            logger.error(f"获取统计信息失败: {e}")
            return {}

    # ==================== 维护操作 ====================

    def cleanup_old_data(self, days_to_keep: int = 7):
        """清理过期数据

        Args:
            days_to_keep: 保留天数
        """
        try:
            from datetime import datetime, timedelta
            cutoff_date = (
                datetime.now() - timedelta(days=days_to_keep)).strftime('%Y-%m-%d %H:%M:%S')

            with self._get_connection() as conn:
                cursor = conn.cursor()

                # 清理旧的指标数据 - 使用本地时间
                cursor.execute("""
                    DELETE FROM pool_metrics 
                    WHERE timestamp < ?
                """, (cutoff_date,))

                deleted_metrics = cursor.rowcount

                # 清理旧的系统状态 - 使用本地时间
                cursor.execute("""
                    DELETE FROM system_status 
                    WHERE timestamp < ?
                """, (cutoff_date,))

                deleted_status = cursor.rowcount

                conn.commit()

                logger.info(
                    f"数据清理完成: 删除 {deleted_metrics} 条指标数据, {deleted_status} 条状态数据")

        except Exception as e:
            logger.error(f"数据清理失败: {e}")

    def optimize_database(self):
        """优化数据库"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()

                # 更新统计信息
                cursor.execute("ANALYZE")

                # 整理数据库
                cursor.execute("VACUUM")

                conn.commit()

                logger.info("数据库优化完成")

        except Exception as e:
            logger.error(f"数据库优化失败: {e}")

    def get_database_size_info(self) -> Dict[str, Any]:
        """获取数据库大小信息"""
        try:
            from datetime import datetime, timedelta

            info = {}

            with self._get_connection() as conn:
                cursor = conn.cursor()

                # 获取数据库页数和页大小
                cursor.execute("PRAGMA page_count")
                page_count = cursor.fetchone()[0]

                cursor.execute("PRAGMA page_size")
                page_size = cursor.fetchone()[0]

                total_size = page_count * page_size

                info.update({
                    'page_count': page_count,
                    'page_size': page_size,
                    'total_size_bytes': total_size,
                    'total_size_mb': round(total_size / (1024 * 1024), 2)
                })

                # 获取各表的记录数
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row[0] for row in cursor.fetchall()]

                table_counts = {}
                for table in tables:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cursor.fetchone()[0]
                    table_counts[table] = count

                info['table_counts'] = table_counts

                # 检查WAL模式状态
                cursor.execute("PRAGMA journal_mode")
                journal_mode = cursor.fetchone()[0]
                info['journal_mode'] = journal_mode

            return info

        except Exception as e:
            logger.error(f"获取数据库信息失败: {e}")
            return {}

    def clear_old_metrics(self, hours_to_keep: int = 1):
        """清除旧的指标数据，只保留最近N小时的数据

        Args:
            hours_to_keep: 保留最近几小时的数据
        """
        try:
            from datetime import datetime, timedelta
            cutoff_time = (
                datetime.now() - timedelta(hours=hours_to_keep)).strftime('%Y-%m-%d %H:%M:%S')

            with self._get_connection() as conn:
                cursor = conn.cursor()

                # 删除旧数据 - 使用本地时间
                cursor.execute("""
                    DELETE FROM pool_metrics 
                    WHERE timestamp < ?
                """, (cutoff_time,))

                deleted_count = cursor.rowcount

                conn.commit()

                logger.info(
                    f"清除了 {deleted_count} 条旧指标数据 (保留最近{hours_to_keep}小时)")

                return deleted_count

        except Exception as e:
            logger.error(f"清除旧数据失败: {e}")
            return 0

    def close(self):
        """关闭数据库连接"""
        if hasattr(self, 'connection') and self.connection:
            self.connection.close()
            logger.debug("数据库连接已关闭")

    # ==================== 报警系统方法 ====================

    def check_and_save_alerts(self, pools_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """检查并保存报警记录

        Args:
            pools_data: 池子数据（用于获取地址列表，实际趋势数据从数据库获取）

        Returns:
            List[Dict[str, Any]]: 触发的报警记录列表
        """
        try:
            # 获取报警配置
            config_data = self.get_user_config('alerts', 'thresholds')
            if not config_data:
                return []

            # 检查是否启用报警系统
            if not config_data.get('enabled', False):
                return []

            # 获取阈值配置
            thresholds = {
                'liquidity': config_data.get('liquidity_threshold', 20.0),
                'trade_volume_24h': config_data.get('volume_threshold', 20.0),
                'fees_24h': config_data.get('fees_24h_threshold', 20.0),
                'fees_hour_1': config_data.get('fees_1h_threshold', 20.0)
            }

            # 获取过滤选项配置
            filter_enabled = config_data.get('filter_enabled', False)
            increase_only_enabled = config_data.get(
                'increase_only_enabled', False)

            # 如果启用了筛选条件报警，获取用户的当前筛选条件
            user_filter_config = None
            if filter_enabled:
                user_filter_config = self.get_user_config('filters', 'current')
                if user_filter_config:
                    logger.info(f"✅ 启用筛选条件报警，用户筛选条件: {user_filter_config}")
                else:
                    # 🔧 修复：明确提示用户并跳过报警处理
                    logger.warning("⚠️ 启用了筛选条件报警，但未找到用户筛选条件！")
                    logger.warning("📋 请先在前端设置筛选条件，或关闭筛选条件报警功能")
                    logger.warning("🔧 当前跳过报警检查，避免对所有池子进行报警")
                    print("\n" + "="*60)
                    print("⚠️  报警配置提醒")
                    print("="*60)
                    print("当前启用了【筛选条件报警】功能，但系统未找到保存的筛选条件。")
                    print("这可能会导致系统对所有池子进行报警，或无法按预期工作。")
                    print("\n建议操作:")
                    print("1. 打开前端页面，设置具体的筛选条件")
                    print("2. 或者在设置中关闭【筛选条件报警】功能")
                    print("3. 当前报警检查已跳过，等待配置修正")
                    print("="*60 + "\n")
                    return []  # 直接返回空列表，避免错误的报警行为

            triggered_alerts = []

            with self._get_connection() as conn:
                cursor = conn.cursor()

                # 🔧 修复：构建包含筛选条件的SQL查询
                from datetime import datetime, timedelta
                one_hour_ago = (datetime.now() - timedelta(hours=1)
                                ).strftime('%Y-%m-%d %H:%M:%S')

                # 基础查询
                base_sql = """
                    SELECT DISTINCT pm.pool_address, p.name,
                           pm.liquidity, pm.trade_volume_24h, pm.fees_24h, pm.fees_hour_1,
                           pm.liquidity_trend, pm.trade_volume_24h_trend, 
                           pm.fees_24h_trend, pm.fees_hour_1_trend,
                           pm.liquidity_change_percent, pm.trade_volume_24h_change_percent,
                           pm.fees_24h_change_percent, pm.fees_hour_1_change_percent,
                           pm.timestamp
                    FROM pool_metrics pm
                    JOIN pools p ON pm.pool_address = p.address
                    WHERE pm.timestamp > ?
                    AND (pm.liquidity_trend != 'neutral' 
                         OR pm.trade_volume_24h_trend != 'neutral'
                         OR pm.fees_24h_trend != 'neutral' 
                         OR pm.fees_hour_1_trend != 'neutral')
                """

                # 🔧 关键修复：如果启用筛选条件报警，在SQL层面应用筛选条件
                params = [one_hour_ago]
                if filter_enabled and user_filter_config:
                    filter_conditions = []

                    # 应用流动性筛选
                    if 'min_liquidity' in user_filter_config and user_filter_config['min_liquidity'] is not None:
                        filter_conditions.append("pm.liquidity >= ?")
                        params.append(user_filter_config['min_liquidity'])

                    if 'max_liquidity' in user_filter_config and user_filter_config['max_liquidity'] is not None:
                        filter_conditions.append("pm.liquidity <= ?")
                        params.append(user_filter_config['max_liquidity'])

                    # 应用交易量筛选
                    if 'min_volume_24h' in user_filter_config and user_filter_config['min_volume_24h'] is not None:
                        filter_conditions.append("pm.trade_volume_24h >= ?")
                        params.append(user_filter_config['min_volume_24h'])

                    if 'max_volume_24h' in user_filter_config and user_filter_config['max_volume_24h'] is not None:
                        filter_conditions.append("pm.trade_volume_24h <= ?")
                        params.append(user_filter_config['max_volume_24h'])

                    # 应用APY筛选
                    if 'min_apy' in user_filter_config and user_filter_config['min_apy'] is not None:
                        filter_conditions.append("pm.apy >= ?")
                        params.append(user_filter_config['min_apy'])

                    if 'max_apy' in user_filter_config and user_filter_config['max_apy'] is not None:
                        filter_conditions.append("pm.apy <= ?")
                        params.append(user_filter_config['max_apy'])

                    # 🔧 添加费用TVL比率筛选
                    if 'min_fee_tvl_ratio' in user_filter_config and user_filter_config['min_fee_tvl_ratio'] is not None:
                        filter_conditions.append("pm.fee_tvl_ratio >= ?")
                        params.append(user_filter_config['min_fee_tvl_ratio'])

                    if 'max_fee_tvl_ratio' in user_filter_config and user_filter_config['max_fee_tvl_ratio'] is not None:
                        filter_conditions.append("pm.fee_tvl_ratio <= ?")
                        params.append(user_filter_config['max_fee_tvl_ratio'])

                    # 🔧 添加预估日费率筛选
                    if 'min_estimated_daily_fee_rate' in user_filter_config and user_filter_config['min_estimated_daily_fee_rate'] is not None:
                        filter_conditions.append(
                            "pm.estimated_daily_fee_rate >= ?")
                        params.append(
                            user_filter_config['min_estimated_daily_fee_rate'])

                    if 'max_estimated_daily_fee_rate' in user_filter_config and user_filter_config['max_estimated_daily_fee_rate'] is not None:
                        filter_conditions.append(
                            "pm.estimated_daily_fee_rate <= ?")
                        params.append(
                            user_filter_config['max_estimated_daily_fee_rate'])

                    # 应用搜索关键词筛选
                    if 'search_keyword' in user_filter_config and user_filter_config['search_keyword']:
                        keyword = user_filter_config['search_keyword']
                        filter_conditions.append(
                            "(p.name LIKE ? OR p.address LIKE ?)")
                        search_pattern = f"%{keyword}%"
                        params.extend([search_pattern, search_pattern])

                    # 添加筛选条件到SQL
                    if filter_conditions:
                        base_sql += " AND " + " AND ".join(filter_conditions)

                # 应用增量数据筛选（只监控上升趋势）
                if increase_only_enabled:
                    base_sql += """
                        AND (pm.liquidity_trend = 'increase' 
                             OR pm.trade_volume_24h_trend = 'increase'
                             OR pm.fees_24h_trend = 'increase' 
                             OR pm.fees_hour_1_trend = 'increase')
                    """

                base_sql += " ORDER BY pm.timestamp DESC"

                # 执行优化后的查询
                cursor.execute(base_sql, params)
                pool_records = cursor.fetchall()

                # 🔧 详细的筛选统计信息
                logger.info(f"🔍 经过SQL筛选后找到 {len(pool_records)} 条符合条件的池子记录")
                if filter_enabled and user_filter_config:
                    logger.info(f"📋 应用的筛选条件: {user_filter_config}")

                # 🔧 添加趋势统计分析
                if len(pool_records) > 0:
                    # 统计不同趋势的池子数量
                    trend_stats = {
                        'neutral_all': 0,
                        'has_increase': 0,
                        'has_decrease': 0,
                        'has_any_change': 0
                    }

                    processed_pools = set()
                    for row in pool_records:
                        pool_address = row[0]
                        if pool_address in processed_pools:
                            continue
                        processed_pools.add(pool_address)

                        liquidity_trend = row[6]
                        volume_trend = row[7]
                        fees24h_trend = row[8]
                        fees1h_trend = row[9]

                        # 检查是否所有趋势都为neutral
                        all_neutral = (liquidity_trend == 'neutral' and
                                       volume_trend == 'neutral' and
                                       fees24h_trend == 'neutral' and
                                       fees1h_trend == 'neutral')

                        if all_neutral:
                            trend_stats['neutral_all'] += 1
                        else:
                            trend_stats['has_any_change'] += 1

                        # 统计上升趋势
                        if (liquidity_trend == 'increase' or volume_trend == 'increase' or
                                fees24h_trend == 'increase' or fees1h_trend == 'increase'):
                            trend_stats['has_increase'] += 1

                        # 统计下降趋势
                        if (liquidity_trend == 'decrease' or volume_trend == 'decrease' or
                                fees24h_trend == 'decrease' or fees1h_trend == 'decrease'):
                            trend_stats['has_decrease'] += 1

                    # 输出详细统计
                    logger.info(f"📊 趋势统计分析:")
                    logger.info(
                        f"   - 所有趋势为neutral的池子: {trend_stats['neutral_all']} 个")
                    logger.info(
                        f"   - 有任何趋势变化的池子: {trend_stats['has_any_change']} 个")
                    logger.info(
                        f"   - 有上升趋势的池子: {trend_stats['has_increase']} 个")
                    logger.info(
                        f"   - 有下降趋势的池子: {trend_stats['has_decrease']} 个")
                    logger.info(f"   - 独立池子总数: {len(processed_pools)} 个")

                    # 如果启用了增量数据筛选，显示影响
                    if increase_only_enabled:
                        logger.info(f"   - 增量数据筛选启用: 只监控上升趋势，将排除下降和neutral趋势")

                # 处理每个符合条件的池子
                processed_pools = set()  # 避免重复处理同一个池子

                for row in pool_records:
                    pool_address = row[0]

                    # 避免重复处理同一个池子
                    if pool_address in processed_pools:
                        continue
                    processed_pools.add(pool_address)

                    pool_data = {
                        'address': row[0],
                        'name': row[1],
                        'liquidity': row[2],
                        'trade_volume_24h': row[3],
                        'fees_24h': row[4],
                        'fees_hour_1': row[5],
                        'liquidity_trend': row[6],
                        'trade_volume_24h_trend': row[7],
                        'fees_24h_trend': row[8],
                        'fees_hour_1_trend': row[9],
                        'liquidity_change_percent': row[10],
                        'trade_volume_24h_change_percent': row[11],
                        'fees_24h_change_percent': row[12],
                        'fees_hour_1_change_percent': row[13],
                        'timestamp': row[14]
                    }

                    pool_name = pool_data.get('name', '未知池子')

                    # 检查每个指标
                    for field, threshold in thresholds.items():
                        trend_field = f"{field}_trend"
                        change_field = f"{field}_change_percent"

                        trend = pool_data.get(trend_field)
                        change_percent = pool_data.get(change_field, 0.0)

                        # 如果启用了增量数据报警，只监控上升趋势（SQL已筛选，这里再次确认）
                        if increase_only_enabled and trend != 'increase':
                            continue  # 跳过下降或中性趋势

                        # 检查是否超过阈值
                        if trend in ['increase', 'decrease'] and abs(change_percent) >= threshold:
                            # 获取历史值，使用改进的方法
                            old_value = self._get_previous_value(
                                cursor, pool_address, field)
                            new_value = pool_data.get(field)

                            # 如果没有历史值，尝试计算
                            if old_value is None and new_value is not None and change_percent != 0:
                                # 根据变化百分比反推历史值
                                if change_percent == 100:  # 从0变化来的
                                    old_value = 0.0
                                elif change_percent == -100:  # 变为0
                                    old_value = new_value  # 实际上当前值应该是0，old_value应该是原值
                                    new_value = 0.0
                                else:
                                    # 根据变化百分比计算：new_value = old_value * (1 + change_percent/100)
                                    old_value = new_value / \
                                        (1 + change_percent / 100)

                            # 创建报警记录
                            alert_record = {
                                'pool_address': pool_address,
                                'pool_name': pool_name,
                                'alert_type': field,
                                'change_type': trend,
                                'change_percent': change_percent,
                                'threshold_percent': threshold,
                                'old_value': old_value,
                                'new_value': new_value
                            }

                            # 保存到数据库，使用本地时间
                            local_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                            cursor.execute("""
                                INSERT INTO alert_records (
                                    pool_address, pool_name, alert_type, change_type,
                                    change_percent, threshold_percent, old_value, new_value, created_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (
                                alert_record['pool_address'],
                                alert_record['pool_name'],
                                alert_record['alert_type'],
                                alert_record['change_type'],
                                alert_record['change_percent'],
                                alert_record['threshold_percent'],
                                alert_record['old_value'],
                                alert_record['new_value'],
                                local_time  # 明确指定本地时间
                            ))

                            triggered_alerts.append(alert_record)

                conn.commit()

            # 🔧 详细的报警处理总结
            actually_processed_pools = len(processed_pools)
            logger.info(f"🔍 检查报警处理总结:")
            logger.info(f"   - 查询到的记录总数: {len(pool_records)} 条")
            logger.info(f"   - 实际处理的独立池子: {actually_processed_pools} 个")
            logger.info(f"   - 成功触发的报警数: {len(triggered_alerts)} 条")
            logger.info(
                f"   - 平均每个池子报警数: {len(triggered_alerts) / max(actually_processed_pools, 1):.2f}")

            # 与前端数据的对比提示
            if filter_enabled and user_filter_config:
                logger.info(f"💡 数据对比提示:")
                logger.info(f"   - 前端显示池子数: 包括所有符合筛选条件的池子（含neutral趋势）")
                logger.info(f"   - 报警系统池子数: 只包括有趋势变化的池子（排除neutral）")
                logger.info(
                    f"   - 如果前端显示70个，报警处理{actually_processed_pools}个，差异合理")

            logger.info(f"检查报警完成，触发 {len(triggered_alerts)} 条报警")
            return triggered_alerts

        except Exception as e:
            logger.error(f"检查报警失败: {e}")
            return []

    def _get_previous_value(self, cursor: sqlite3.Cursor, pool_address: str, field: str) -> Optional[float]:
        """获取池子指定字段的前一个值（改进版）"""
        try:
            # 方法1: 尝试获取前一条记录（按时间和ID排序）
            cursor.execute(f"""
                SELECT {field}
                FROM pool_metrics
                WHERE pool_address = ?
                ORDER BY timestamp DESC, id DESC
                LIMIT 1, 1
            """, (pool_address,))

            result = cursor.fetchone()
            if result and result[0] is not None:
                return result[0]

            # 方法2: 如果方法1失败，尝试获取稍早时间的记录
            cursor.execute(f"""
                SELECT {field}
                FROM pool_metrics
                WHERE pool_address = ?
                AND timestamp < (
                    SELECT MAX(timestamp) FROM pool_metrics WHERE pool_address = ?
                )
                ORDER BY timestamp DESC, id DESC
                LIMIT 1
            """, (pool_address, pool_address))

            result = cursor.fetchone()
            if result and result[0] is not None:
                return result[0]

            # 方法3: 如果还是没有，返回None表示这是首次记录
            return None

        except Exception as e:
            logger.warning(f"获取历史值失败 {pool_address} {field}: {e}")
            return None

    def get_alert_records(self, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """获取报警记录

        Args:
            filters: 筛选条件（可包含pool_addresses列表）

        Returns:
            List[Dict[str, Any]]: 报警记录列表
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()

                sql = """
                    SELECT * FROM alert_records
                    WHERE 1=1
                """
                params = []

                # 应用筛选条件
                if filters:
                    pool_addresses = filters.get('pool_addresses')
                    if pool_addresses:
                        placeholders = ','.join(['?' for _ in pool_addresses])
                        sql += f" AND pool_address IN ({placeholders})"
                        params.extend(pool_addresses)

                    limit = filters.get('limit', 100)
                    sql += f" ORDER BY created_at DESC LIMIT {limit}"
                else:
                    sql += " ORDER BY created_at DESC LIMIT 100"

                cursor.execute(sql, params)
                rows = cursor.fetchall()

                alerts = []
                for row in rows:
                    alert = dict(row)
                    alerts.append(alert)

                return alerts

        except Exception as e:
            logger.error(f"获取报警记录失败: {e}")
            return []

    def save_alert_thresholds(self, thresholds: Dict[str, float]):
        """保存报警阈值配置

        Args:
            thresholds: 阈值配置字典
        """
        try:
            config_data = {
                'enabled': thresholds.get('enabled', True),
                'liquidity_threshold': thresholds.get('liquidity', 20.0),
                'volume_threshold': thresholds.get('trade_volume_24h', 20.0),
                'fees_24h_threshold': thresholds.get('fees_24h', 20.0),
                'fees_1h_threshold': thresholds.get('fees_hour_1', 20.0)
            }

            self.save_user_config('alerts', 'thresholds', config_data, True)
            logger.info("报警阈值配置已保存")

        except Exception as e:
            logger.error(f"保存报警阈值失败: {e}")

    def _pool_matches_filter(self, pool_data: Dict[str, Any], filter_config: Dict[str, Any]) -> bool:
        """检查池子是否符合用户筛选条件

        Args:
            pool_data: 池子数据
            filter_config: 用户筛选条件

        Returns:
            bool: 是否符合筛选条件
        """
        try:
            pool_name = pool_data.get('name', '未知池子')
            logger.debug(f"检查池子筛选条件: {pool_name}")
            logger.debug(
                f"池子数据: 流动性={pool_data.get('liquidity')}, 交易量={pool_data.get('trade_volume_24h')}")
            logger.debug(f"筛选条件: {filter_config}")

            # 检查流动性范围
            if 'min_liquidity' in filter_config and filter_config['min_liquidity'] is not None:
                pool_liquidity = pool_data.get('liquidity', 0)
                min_liquidity = filter_config['min_liquidity']
                if pool_liquidity < min_liquidity:
                    logger.debug(
                        f"❌ {pool_name} 流动性不符合: {pool_liquidity} < {min_liquidity}")
                    return False

            if 'max_liquidity' in filter_config and filter_config['max_liquidity'] is not None:
                pool_liquidity = pool_data.get('liquidity', 0)
                max_liquidity = filter_config['max_liquidity']
                if pool_liquidity > max_liquidity:
                    logger.debug(
                        f"❌ {pool_name} 流动性不符合: {pool_liquidity} > {max_liquidity}")
                    return False

            # 检查交易量范围
            if 'min_volume_24h' in filter_config and filter_config['min_volume_24h'] is not None:
                pool_volume = pool_data.get('trade_volume_24h', 0)
                min_volume = filter_config['min_volume_24h']
                if pool_volume < min_volume:
                    logger.debug(
                        f"❌ {pool_name} 交易量不符合: {pool_volume} < {min_volume}")
                    return False

            if 'max_volume_24h' in filter_config and filter_config['max_volume_24h'] is not None:
                pool_volume = pool_data.get('trade_volume_24h', 0)
                max_volume = filter_config['max_volume_24h']
                if pool_volume > max_volume:
                    logger.debug(
                        f"❌ {pool_name} 交易量不符合: {pool_volume} > {max_volume}")
                    return False

            # 检查APY范围
            if 'min_apy' in filter_config and filter_config['min_apy'] is not None:
                pool_apy = pool_data.get('apy', 0)
                min_apy = filter_config['min_apy']
                if pool_apy < min_apy:
                    logger.debug(
                        f"❌ {pool_name} APY不符合: {pool_apy} < {min_apy}")
                    return False

            if 'max_apy' in filter_config and filter_config['max_apy'] is not None:
                pool_apy = pool_data.get('apy', 0)
                max_apy = filter_config['max_apy']
                if pool_apy > max_apy:
                    logger.debug(
                        f"❌ {pool_name} APY不符合: {pool_apy} > {max_apy}")
                    return False

            # 检查搜索关键词
            if 'search_keyword' in filter_config and filter_config['search_keyword']:
                keyword = filter_config['search_keyword'].lower()
                pool_name_lower = pool_data.get('name', '').lower()
                pool_address_lower = pool_data.get('address', '').lower()
                if keyword not in pool_name_lower and keyword not in pool_address_lower:
                    logger.debug(
                        f"❌ {pool_name} 关键词不符合: '{keyword}' 不在 '{pool_name_lower}' 或 '{pool_address_lower}' 中")
                    return False

            logger.debug(f"✅ {pool_name} 符合所有筛选条件")
            return True

        except Exception as e:
            logger.warning(f"筛选条件匹配失败: {e}")
            return True  # 如果匹配失败，默认包含该池子
