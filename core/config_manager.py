"""
Meteora监控平台 V2.0 - 配置管理器
支持双层配置系统：系统级配置（YAML固定）+ 用户级配置（数据库实时）
"""

import yaml
import os
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class ConfigError(Exception):
    """配置错误"""
    pass


class ConfigManager:
    """配置管理器 - 管理系统和用户配置"""

    def __init__(self, system_config_path: str, db_manager=None):
        """初始化配置管理器

        Args:
            system_config_path: 系统配置文件路径
            db_manager: 数据库管理器实例（用户配置存储）
        """
        self.system_config_path = system_config_path
        self.db_manager = db_manager
        self.system_config = {}
        self.user_config_cache = {}

        self.load_system_config()
        logger.info("配置管理器初始化完成")

    def load_system_config(self) -> Dict[str, Any]:
        """加载系统配置文件

        Returns:
            Dict: 系统配置数据

        Raises:
            ConfigError: 当配置文件无效时
        """
        try:
            if not os.path.exists(self.system_config_path):
                raise ConfigError(f"系统配置文件不存在: {self.system_config_path}")

            with open(self.system_config_path, 'r', encoding='utf-8') as file:
                self.system_config = yaml.safe_load(file)

            # 验证系统配置结构
            self._validate_system_config()

            logger.info(f"系统配置加载成功: {self.system_config_path}")
            return self.system_config

        except yaml.YAMLError as e:
            raise ConfigError(f"系统配置文件格式错误: {e}")
        except Exception as e:
            raise ConfigError(f"加载系统配置失败: {e}")

    def _validate_system_config(self):
        """验证系统配置结构"""
        required_sections = ['system', 'api']

        for section in required_sections:
            if section not in self.system_config:
                raise ConfigError(f"系统配置缺少必需章节: {section}")

        # 验证关键配置项
        required_system_keys = [
            'data_collection', 'database', 'server', 'logging'
        ]

        for key in required_system_keys:
            if key not in self.system_config['system']:
                raise ConfigError(f"系统配置缺少必需项: system.{key}")

        logger.debug("系统配置验证通过")

    def get_system_config(self) -> Dict[str, Any]:
        """获取系统配置

        Returns:
            Dict: 系统配置数据
        """
        return self.system_config

    def get_system_value(self, key_path: str, default=None) -> Any:
        """获取系统配置值

        Args:
            key_path: 配置键路径，如 'system.data_collection.api_timeout_seconds'
            default: 默认值

        Returns:
            Any: 配置值
        """
        try:
            keys = key_path.split('.')
            value = self.system_config

            for key in keys:
                value = value[key]

            return value

        except KeyError:
            logger.warning(f"系统配置键不存在: {key_path}，使用默认值: {default}")
            return default

    # ==================== 用户配置管理 ====================

    def get_user_config(self, config_type: str, config_name: str = None) -> Optional[Dict[str, Any]]:
        """获取用户配置

        Args:
            config_type: 配置类型 (filter/alert/display/columns)
            config_name: 配置名称（可选，不提供则获取激活的配置）

        Returns:
            Dict: 配置数据，如果没有则返回None
        """
        if not self.db_manager:
            logger.warning("数据库管理器未设置，无法获取用户配置")
            return None

        try:
            cache_key = f"{config_type}.{config_name or 'active'}"

            # 检查缓存
            if cache_key in self.user_config_cache:
                cache_time = self.user_config_cache[cache_key].get(
                    '_cache_time')
                if cache_time and (datetime.now() - cache_time).seconds < 60:  # 1分钟缓存
                    return self.user_config_cache[cache_key]['data']

            # 从数据库获取
            config_data = self.db_manager.get_user_config(
                config_type, config_name)

            # 更新缓存
            self.user_config_cache[cache_key] = {
                'data': config_data,
                '_cache_time': datetime.now()
            }

            return config_data

        except Exception as e:
            logger.error(f"获取用户配置失败: {e}")
            return None

    def save_user_config(self, config_type: str, config_name: str, config_data: Dict[str, Any], is_active: bool = False):
        """保存用户配置

        Args:
            config_type: 配置类型
            config_name: 配置名称
            config_data: 配置数据
            is_active: 是否设为激活配置
        """
        if not self.db_manager:
            raise ConfigError("数据库管理器未设置，无法保存用户配置")

        try:
            # 验证配置数据
            self._validate_user_config(config_type, config_data)

            # 保存到数据库
            self.db_manager.save_user_config(
                config_type, config_name, config_data, is_active)

            # 清除相关缓存
            cache_key = f"{config_type}.{config_name}"
            if cache_key in self.user_config_cache:
                del self.user_config_cache[cache_key]

            # 如果是激活配置，也清除active缓存
            if is_active:
                active_cache_key = f"{config_type}.active"
                if active_cache_key in self.user_config_cache:
                    del self.user_config_cache[active_cache_key]

            logger.info(f"保存用户配置成功: {config_type}.{config_name}")

        except Exception as e:
            logger.error(f"保存用户配置失败: {e}")
            raise

    def _validate_user_config(self, config_type: str, config_data: Dict[str, Any]):
        """验证用户配置数据

        Args:
            config_type: 配置类型
            config_data: 配置数据

        Raises:
            ConfigError: 当配置数据无效时
        """
        if not isinstance(config_data, dict):
            raise ConfigError("配置数据必须是字典格式")

        # 根据配置类型进行特定验证
        if config_type == 'filter':
            self._validate_filter_config(config_data)
        elif config_type == 'alert':
            self._validate_alert_config(config_data)
        elif config_type == 'display':
            self._validate_display_config(config_data)
        elif config_type == 'columns':
            self._validate_columns_config(config_data)
        else:
            logger.warning(f"未知的配置类型: {config_type}")

    def _validate_filter_config(self, config_data: Dict[str, Any]):
        """验证筛选配置"""
        # 验证数值范围
        numeric_fields = ['min_liquidity', 'max_liquidity',
                          'min_apy', 'max_apy', 'min_volume_24h', 'max_volume_24h']

        for field in numeric_fields:
            if field in config_data and config_data[field] is not None:
                try:
                    float(config_data[field])
                except (ValueError, TypeError):
                    raise ConfigError(f"筛选配置 {field} 必须是数值")

        # 验证排序字段
        valid_sort_fields = ['liquidity', 'apy',
                             'trade_volume_24h', 'fees_24h', 'name', 'address']
        sort_field = config_data.get('sort_field')
        if sort_field and sort_field not in valid_sort_fields:
            raise ConfigError(f"排序字段无效: {sort_field}")

        # 验证排序方向
        sort_direction = config_data.get('sort_direction')
        if sort_direction and sort_direction not in ['ASC', 'DESC']:
            raise ConfigError(f"排序方向无效: {sort_direction}")

    def _validate_alert_config(self, config_data: Dict[str, Any]):
        """验证警报配置"""
        # 验证阈值
        if 'thresholds' in config_data:
            thresholds = config_data['thresholds']
            for key, value in thresholds.items():
                if value is not None:
                    try:
                        threshold_value = float(value)
                        if threshold_value < 0 or threshold_value > 1000:
                            raise ConfigError(f"警报阈值 {key} 超出合理范围 (0-1000)")
                    except (ValueError, TypeError):
                        raise ConfigError(f"警报阈值 {key} 必须是数值")

        # 验证声音设置
        if 'sound' in config_data:
            sound_config = config_data['sound']
            volume = sound_config.get('volume')
            if volume is not None:
                try:
                    volume_value = float(volume)
                    if volume_value < 0 or volume_value > 1:
                        raise ConfigError("音量必须在 0-1 范围内")
                except (ValueError, TypeError):
                    raise ConfigError("音量必须是数值")

    def _validate_display_config(self, config_data: Dict[str, Any]):
        """验证显示配置"""
        # 验证行数限制
        rows_per_page = config_data.get('rows_per_page')
        if rows_per_page is not None:
            try:
                rows_value = int(rows_per_page)
                if rows_value < 10 or rows_value > 1000:
                    raise ConfigError("每页行数必须在 10-1000 范围内")
            except (ValueError, TypeError):
                raise ConfigError("每页行数必须是整数")

        # 验证刷新间隔
        refresh_seconds = config_data.get('auto_refresh_seconds')
        if refresh_seconds is not None:
            try:
                refresh_value = int(refresh_seconds)
                if refresh_value < 10 or refresh_value > 600:
                    raise ConfigError("刷新间隔必须在 10-600 秒范围内")
            except (ValueError, TypeError):
                raise ConfigError("刷新间隔必须是整数")

    def _validate_columns_config(self, config_data: Dict[str, Any]):
        """验证字段配置"""
        if 'columns' not in config_data:
            raise ConfigError("字段配置必须包含 columns 字段")

        columns = config_data['columns']
        if not isinstance(columns, list):
            raise ConfigError("columns 必须是列表格式")

        # 验证字段名称
        valid_columns = [
            'name', 'address', 'mint_x', 'mint_y', 'bin_step',
            'liquidity', 'current_price', 'reserve_x_amount', 'reserve_y_amount',
            'apr', 'apy', 'farm_apr', 'farm_apy',
            'trade_volume_24h', 'volume_hour_1', 'volume_hour_12', 'cumulative_trade_volume',
            'fees_24h', 'fees_hour_1', 'cumulative_fee_volume',
            'protocol_fee_percentage', 'base_fee_percentage', 'max_fee_percentage'
        ]

        for column in columns:
            if column not in valid_columns:
                raise ConfigError(f"无效的字段名称: {column}")

    # ==================== 配置应用和生效 ====================

    def apply_config_changes(self, config_type: str, config_data: Dict[str, Any]):
        """应用配置变更，实时生效

        Args:
            config_type: 配置类型
            config_data: 配置数据
        """
        try:
            # 保存为当前激活配置
            self.save_user_config(config_type, 'current',
                                  config_data, is_active=True)

            # 触发配置变更事件（如果有订阅者）
            self._notify_config_change(config_type, config_data)

            logger.info(f"配置变更已应用: {config_type}")

        except Exception as e:
            logger.error(f"应用配置变更失败: {e}")
            raise

    def _notify_config_change(self, config_type: str, config_data: Dict[str, Any]):
        """通知配置变更（预留接口）

        Args:
            config_type: 配置类型
            config_data: 配置数据
        """
        # TODO: 实现WebSocket通知或事件系统
        logger.debug(f"配置变更通知: {config_type}")

    # ==================== 配置导入导出 ====================

    def export_user_configs(self, config_types: List[str] = None) -> Dict[str, Any]:
        """导出用户配置

        Args:
            config_types: 要导出的配置类型列表，None表示导出全部

        Returns:
            Dict: 导出的配置数据
        """
        if not self.db_manager:
            raise ConfigError("数据库管理器未设置")

        export_types = config_types or [
            'filter', 'alert', 'display', 'columns']
        export_data = {
            'export_time': datetime.now().isoformat(),
            'version': '2.0.0',
            'configs': {}
        }

        try:
            for config_type in export_types:
                # 获取该类型的激活配置
                config_data = self.get_user_config(config_type)
                if config_data:
                    export_data['configs'][config_type] = config_data

            logger.info(f"导出用户配置成功: {list(export_data['configs'].keys())}")
            return export_data

        except Exception as e:
            logger.error(f"导出用户配置失败: {e}")
            raise

    def import_user_configs(self, import_data: Dict[str, Any], overwrite: bool = False):
        """导入用户配置

        Args:
            import_data: 导入的配置数据
            overwrite: 是否覆盖现有配置
        """
        if not self.db_manager:
            raise ConfigError("数据库管理器未设置")

        try:
            # 验证导入数据格式
            if 'configs' not in import_data:
                raise ConfigError("导入数据格式错误，缺少 configs 字段")

            configs = import_data['configs']
            imported_count = 0

            for config_type, config_data in configs.items():
                # 验证配置数据
                self._validate_user_config(config_type, config_data)

                # 检查是否已存在
                existing_config = self.get_user_config(config_type)
                if existing_config and not overwrite:
                    logger.warning(f"配置 {config_type} 已存在，跳过导入")
                    continue

                # 导入配置
                self.save_user_config(
                    config_type, 'imported', config_data, is_active=True)
                imported_count += 1

            logger.info(f"导入用户配置成功: {imported_count} 个配置")

        except Exception as e:
            logger.error(f"导入用户配置失败: {e}")
            raise

    # ==================== 默认配置加载 ====================

    def load_default_user_configs(self, default_config_path: str):
        """加载默认用户配置

        Args:
            default_config_path: 默认配置文件路径
        """
        try:
            if not os.path.exists(default_config_path):
                logger.warning(f"默认用户配置文件不存在: {default_config_path}")
                return

            with open(default_config_path, 'r', encoding='utf-8') as file:
                default_configs = yaml.safe_load(file)

            # 为每个配置类型加载默认配置
            for config_type, config_data in default_configs.items():
                if config_type in ['filters', 'alerts', 'display', 'monitoring']:
                    # 转换配置类型名称
                    actual_type = config_type.rstrip('s')  # 去掉复数s

                    # 检查是否已有用户配置
                    existing_config = self.get_user_config(actual_type)
                    if not existing_config:
                        self.save_user_config(
                            actual_type, 'default', config_data, is_active=True)
                        logger.info(f"加载默认配置: {actual_type}")

        except Exception as e:
            logger.error(f"加载默认用户配置失败: {e}")
            raise
