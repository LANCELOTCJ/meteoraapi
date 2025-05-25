"""
Meteora监控平台 V2.0 - 数据模型定义
定义所有数据库表的结构和字段
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
import sqlite3
import json


class PoolModel:
    """池子基础信息模型"""

    def __init__(self, data: Dict[str, Any]):
        self.id: Optional[int] = data.get('id')
        self.address: str = data['address']
        self.name: str = data['name']
        self.mint_x: Optional[str] = data.get('mint_x')
        self.mint_y: Optional[str] = data.get('mint_y')
        self.bin_step: Optional[int] = data.get('bin_step')
        self.protocol_fee_percentage: Optional[float] = data.get(
            'protocol_fee_percentage')
        self.base_fee_percentage: Optional[float] = data.get(
            'base_fee_percentage')
        self.max_fee_percentage: Optional[float] = data.get(
            'max_fee_percentage')
        self.created_at: Optional[datetime] = data.get('created_at')
        self.updated_at: Optional[datetime] = data.get('updated_at')

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'id': self.id,
            'address': self.address,
            'name': self.name,
            'mint_x': self.mint_x,
            'mint_y': self.mint_y,
            'bin_step': self.bin_step,
            'protocol_fee_percentage': self.protocol_fee_percentage,
            'base_fee_percentage': self.base_fee_percentage,
            'max_fee_percentage': self.max_fee_percentage,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class PoolMetricsModel:
    """池子指标数据模型"""

    def __init__(self, data: Dict[str, Any]):
        self.id: Optional[int] = data.get('id')
        self.pool_address: str = data['pool_address']
        self.timestamp: Optional[datetime] = data.get('timestamp')

        # 流动性数据
        self.liquidity: Optional[float] = data.get('liquidity')
        self.current_price: Optional[float] = data.get('current_price')

        # 收益数据
        self.apr: Optional[float] = data.get('apr')
        self.apy: Optional[float] = data.get('apy')
        self.farm_apr: Optional[float] = data.get('farm_apr')
        self.farm_apy: Optional[float] = data.get('farm_apy')

        # 交易量数据
        self.trade_volume_24h: Optional[float] = data.get('trade_volume_24h')
        self.volume_hour_1: Optional[float] = data.get('volume_hour_1')
        self.volume_hour_12: Optional[float] = data.get('volume_hour_12')
        self.cumulative_trade_volume: Optional[float] = data.get(
            'cumulative_trade_volume')

        # 手续费数据
        self.fees_24h: Optional[float] = data.get('fees_24h')
        self.fees_hour_1: Optional[float] = data.get('fees_hour_1')
        self.cumulative_fee_volume: Optional[float] = data.get(
            'cumulative_fee_volume')

        # 计算字段
        self.fee_tvl_ratio: Optional[float] = data.get('fee_tvl_ratio')
        self.estimated_daily_fee_rate: Optional[float] = data.get(
            'estimated_daily_fee_rate')

        # 趋势数据字段
        self.liquidity_trend: Optional[str] = data.get('liquidity_trend')
        self.trade_volume_24h_trend: Optional[str] = data.get(
            'trade_volume_24h_trend')
        self.fees_24h_trend: Optional[str] = data.get('fees_24h_trend')
        self.fees_hour_1_trend: Optional[str] = data.get('fees_hour_1_trend')

        # 变化幅度字段
        self.liquidity_change_percent: Optional[float] = data.get(
            'liquidity_change_percent')
        self.trade_volume_24h_change_percent: Optional[float] = data.get(
            'trade_volume_24h_change_percent')
        self.fees_24h_change_percent: Optional[float] = data.get(
            'fees_24h_change_percent')
        self.fees_hour_1_change_percent: Optional[float] = data.get(
            'fees_hour_1_change_percent')

        # 储备数据
        self.reserve_x_amount: Optional[int] = data.get('reserve_x_amount')
        self.reserve_y_amount: Optional[int] = data.get('reserve_y_amount')

        # 原始数据
        self.raw_data: Optional[str] = data.get('raw_data')

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'id': self.id,
            'pool_address': self.pool_address,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'liquidity': self.liquidity,
            'current_price': self.current_price,
            'apr': self.apr,
            'apy': self.apy,
            'farm_apr': self.farm_apr,
            'farm_apy': self.farm_apy,
            'trade_volume_24h': self.trade_volume_24h,
            'volume_hour_1': self.volume_hour_1,
            'volume_hour_12': self.volume_hour_12,
            'cumulative_trade_volume': self.cumulative_trade_volume,
            'fees_24h': self.fees_24h,
            'fees_hour_1': self.fees_hour_1,
            'cumulative_fee_volume': self.cumulative_fee_volume,
            'fee_tvl_ratio': self.fee_tvl_ratio,
            'estimated_daily_fee_rate': self.estimated_daily_fee_rate,
            'liquidity_trend': self.liquidity_trend,
            'trade_volume_24h_trend': self.trade_volume_24h_trend,
            'fees_24h_trend': self.fees_24h_trend,
            'fees_hour_1_trend': self.fees_hour_1_trend,
            'liquidity_change_percent': self.liquidity_change_percent,
            'trade_volume_24h_change_percent': self.trade_volume_24h_change_percent,
            'fees_24h_change_percent': self.fees_24h_change_percent,
            'fees_hour_1_change_percent': self.fees_hour_1_change_percent,
            'reserve_x_amount': self.reserve_x_amount,
            'reserve_y_amount': self.reserve_y_amount,
            'raw_data': self.raw_data
        }


class UserConfigModel:
    """用户配置模型"""

    def __init__(self, data: Dict[str, Any]):
        self.id: Optional[int] = data.get('id')
        # filter/alert/display/columns
        self.config_type: str = data['config_type']
        self.config_name: str = data['config_name']
        self.config_data: Dict[str, Any] = data['config_data'] if isinstance(
            data['config_data'], dict) else json.loads(data['config_data'])
        self.is_active: bool = data.get('is_active', False)
        self.created_at: Optional[datetime] = data.get('created_at')
        self.updated_at: Optional[datetime] = data.get('updated_at')

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'id': self.id,
            'config_type': self.config_type,
            'config_name': self.config_name,
            'config_data': self.config_data,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class AlertHistoryModel:
    """警报历史模型"""

    def __init__(self, data: Dict[str, Any]):
        self.id: Optional[int] = data.get('id')
        self.alert_type: str = data['alert_type']  # new_pool/value_change
        self.pool_address: Optional[str] = data.get('pool_address')
        self.message: str = data['message']
        self.alert_data: Optional[Dict[str, Any]] = data.get('alert_data')
        if isinstance(self.alert_data, str):
            self.alert_data = json.loads(self.alert_data)
        self.is_read: bool = data.get('is_read', False)
        self.created_at: Optional[datetime] = data.get('created_at')

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'id': self.id,
            'alert_type': self.alert_type,
            'pool_address': self.pool_address,
            'message': self.message,
            'alert_data': self.alert_data,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class AlertRecordModel:
    """报警记录模型"""

    def __init__(self, data: Dict[str, Any]):
        self.id: Optional[int] = data.get('id')
        self.pool_address: str = data['pool_address']
        self.pool_name: str = data['pool_name']
        # liquidity/trade_volume_24h/fees_24h/fees_hour_1
        self.alert_type: str = data['alert_type']
        self.change_type: str = data['change_type']  # increase/decrease
        self.change_percent: float = data['change_percent']
        self.threshold_percent: float = data['threshold_percent']
        self.old_value: Optional[float] = data.get('old_value')
        self.new_value: Optional[float] = data.get('new_value')
        self.created_at: Optional[datetime] = data.get('created_at')

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'id': self.id,
            'pool_address': self.pool_address,
            'pool_name': self.pool_name,
            'alert_type': self.alert_type,
            'change_type': self.change_type,
            'change_percent': self.change_percent,
            'threshold_percent': self.threshold_percent,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def get_alert_message(self) -> str:
        """生成报警消息"""
        field_names = {
            'liquidity': '流动性',
            'trade_volume_24h': '24h交易量',
            'fees_24h': '24h手续费',
            'fees_hour_1': '1h手续费'
        }

        field_name = field_names.get(self.alert_type, self.alert_type)
        change_text = "上升" if self.change_type == "increase" else "下降"

        return f"{self.pool_name} {field_name}{change_text} {abs(self.change_percent):.1f}% (阈值: {self.threshold_percent:.1f}%)"


class SystemStatusModel:
    """系统状态模型"""

    def __init__(self, data: Dict[str, Any]):
        self.id: Optional[int] = data.get('id')
        self.timestamp: Optional[datetime] = data.get('timestamp')
        self.total_pools: int = data.get('total_pools', 0)
        self.successful_updates: int = data.get('successful_updates', 0)
        self.failed_updates: int = data.get('failed_updates', 0)
        self.update_duration: Optional[float] = data.get('update_duration')
        self.api_response_time: Optional[float] = data.get('api_response_time')
        self.status: str = data.get('status', 'healthy')

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'total_pools': self.total_pools,
            'successful_updates': self.successful_updates,
            'failed_updates': self.failed_updates,
            'update_duration': self.update_duration,
            'api_response_time': self.api_response_time,
            'status': self.status
        }


# 数据库表结构定义
DATABASE_SCHEMA = {
    'pools': """
        CREATE TABLE IF NOT EXISTS pools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            mint_x TEXT,
            mint_y TEXT,
            bin_step INTEGER,
            protocol_fee_percentage REAL,
            base_fee_percentage REAL,
            max_fee_percentage REAL,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
        );
    """,

    'pool_metrics': """
        CREATE TABLE IF NOT EXISTS pool_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pool_address TEXT NOT NULL,
            timestamp TIMESTAMP,
            
            -- 流动性数据
            liquidity REAL,
            current_price REAL,
            
            -- 收益数据
            apr REAL,
            apy REAL,
            farm_apr REAL,
            farm_apy REAL,
            
            -- 交易量数据
            trade_volume_24h REAL,
            volume_hour_1 REAL,
            volume_hour_12 REAL,
            cumulative_trade_volume REAL,
            
            -- 手续费数据
            fees_24h REAL,
            fees_hour_1 REAL,
            cumulative_fee_volume REAL,
            
            -- 计算字段
            fee_tvl_ratio REAL,  -- 24小时手续费/TVL比率 (%)
            estimated_daily_fee_rate REAL,  -- 1小时费用估算24小时收益率 (%)
            
            -- 趋势数据字段（变化方向指示）
            liquidity_trend TEXT,          -- 流动性变化趋势: increase/decrease/neutral
            trade_volume_24h_trend TEXT,   -- 24h交易量变化趋势: increase/decrease/neutral  
            fees_24h_trend TEXT,           -- 24h手续费变化趋势: increase/decrease/neutral
            fees_hour_1_trend TEXT,        -- 1h手续费变化趋势: increase/decrease/neutral
            
            -- 变化幅度字段（百分比）
            liquidity_change_percent REAL,          -- 流动性变化幅度 (%)
            trade_volume_24h_change_percent REAL,   -- 24h交易量变化幅度 (%)
            fees_24h_change_percent REAL,           -- 24h手续费变化幅度 (%)
            fees_hour_1_change_percent REAL,        -- 1h手续费变化幅度 (%)
            
            -- 储备数据（使用TEXT存储大整数）
            reserve_x_amount TEXT,
            reserve_y_amount TEXT,
            
            -- 原始数据
            raw_data TEXT,
            
            FOREIGN KEY (pool_address) REFERENCES pools (address)
        );
    """,

    'user_configs': """
        CREATE TABLE IF NOT EXISTS user_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_type TEXT NOT NULL,
            config_name TEXT NOT NULL,
            config_data TEXT NOT NULL,
            is_active BOOLEAN DEFAULT 0,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
        );
    """,

    'alert_history': """
        CREATE TABLE IF NOT EXISTS alert_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type TEXT NOT NULL,
            pool_address TEXT,
            message TEXT NOT NULL,
            alert_data TEXT,
            is_read BOOLEAN DEFAULT 0,
            created_at TIMESTAMP
        );
    """,

    'alert_records': """
        CREATE TABLE IF NOT EXISTS alert_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pool_address TEXT NOT NULL,
            pool_name TEXT NOT NULL,
            alert_type TEXT NOT NULL,         -- liquidity/trade_volume_24h/fees_24h/fees_hour_1
            change_type TEXT NOT NULL,        -- increase/decrease
            change_percent REAL NOT NULL,     -- 变化幅度百分比
            threshold_percent REAL NOT NULL, -- 用户设定的阈值
            old_value REAL,                  -- 变化前的值
            new_value REAL,                  -- 变化后的值
            created_at TIMESTAMP,
            
            FOREIGN KEY (pool_address) REFERENCES pools (address)
        );
    """,

    'system_status': """
        CREATE TABLE IF NOT EXISTS system_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TIMESTAMP,
            total_pools INTEGER,
            successful_updates INTEGER,
            failed_updates INTEGER,
            update_duration REAL,
            api_response_time REAL,
            status TEXT DEFAULT 'healthy'
        );
    """
}

# 性能优化索引
DATABASE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_pools_address ON pools(address);",
    "CREATE INDEX IF NOT EXISTS idx_metrics_pool_timestamp ON pool_metrics(pool_address, timestamp);",
    "CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON pool_metrics(timestamp);",
    "CREATE INDEX IF NOT EXISTS idx_metrics_liquidity ON pool_metrics(liquidity);",
    "CREATE INDEX IF NOT EXISTS idx_metrics_volume ON pool_metrics(trade_volume_24h);",
    "CREATE INDEX IF NOT EXISTS idx_metrics_apy ON pool_metrics(apy);",
    "CREATE INDEX IF NOT EXISTS idx_metrics_fee_tvl_ratio ON pool_metrics(fee_tvl_ratio);",
    "CREATE INDEX IF NOT EXISTS idx_configs_type_active ON user_configs(config_type, is_active);",
    "CREATE INDEX IF NOT EXISTS idx_alerts_type_read ON alert_history(alert_type, is_read);",
    "CREATE INDEX IF NOT EXISTS idx_alert_records_pool ON alert_records(pool_address);",
    "CREATE INDEX IF NOT EXISTS idx_alert_records_time ON alert_records(created_at DESC);",
    "CREATE INDEX IF NOT EXISTS idx_alert_records_type ON alert_records(alert_type);",

    # 复合索引优化
    "CREATE INDEX IF NOT EXISTS idx_metrics_pool_time_desc ON pool_metrics(pool_address, timestamp DESC);",
    "CREATE INDEX IF NOT EXISTS idx_metrics_liquidity_time ON pool_metrics(liquidity DESC, timestamp DESC);",
    "CREATE INDEX IF NOT EXISTS idx_metrics_apy_time ON pool_metrics(apy DESC, timestamp DESC);"
]

# SQLite性能优化配置
SQLITE_OPTIMIZATIONS = [
    "PRAGMA journal_mode = WAL;",           # 写前日志模式，提升并发性能
    "PRAGMA synchronous = NORMAL;",         # 平衡性能和安全性
    "PRAGMA cache_size = 10000;",           # 增加缓存页面数
    "PRAGMA temp_store = MEMORY;",          # 临时表存储在内存中
    "PRAGMA mmap_size = 268435456;",        # 256MB内存映射
    "PRAGMA optimize;"                      # 自动优化统计信息
]
