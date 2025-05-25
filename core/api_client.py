"""
Meteora监控平台 V2.0 - API客户端
基于已验证成功的Meteora DLMM Production API抓取技术
保持65秒获取88,300个池子的性能
"""

import requests
import time
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
from urllib.parse import urljoin

logger = logging.getLogger(__name__)


class MeteoraAPIError(Exception):
    """Meteora API相关错误"""
    pass


class MeteoraAPIClient:
    """Meteora API客户端 - 核心数据获取模块"""

    def __init__(self, config: Dict[str, Any]):
        """初始化API客户端

        Args:
            config: 配置字典，包含API URL、超时等设置

        Raises:
            ValueError: 当配置参数无效时
        """
        self.config = config
        self.base_url = config['api']['meteora']['base_url']
        self.endpoints = config['api']['meteora']['endpoints']
        self.headers = config['api']['meteora']['headers']
        self.timeout = config['system']['data_collection']['api_timeout_seconds']
        self.max_retry = config['system']['data_collection']['max_retry_attempts']
        self.batch_size = config['system']['data_collection']['batch_size']

        self.session = self._create_session()
        self.last_request_time = 0
        self.min_request_interval = 0.1  # 最小请求间隔，避免被限制

        logger.info(f"MeteoraAPIClient 初始化完成 - {self.base_url}")

    def _create_session(self) -> requests.Session:
        """创建请求会话"""
        session = requests.Session()
        session.headers.update(self.headers)

        # 设置连接池
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=10,
            pool_maxsize=20,
            max_retries=0  # 我们自己处理重试
        )
        session.mount('http://', adapter)
        session.mount('https://', adapter)

        return session

    def _rate_limit(self):
        """请求频率控制"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time

        if time_since_last < self.min_request_interval:
            sleep_time = self.min_request_interval - time_since_last
            time.sleep(sleep_time)

        self.last_request_time = time.time()

    def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """发送HTTP请求

        Args:
            endpoint: API端点
            params: 请求参数

        Returns:
            Dict: API响应数据

        Raises:
            MeteoraAPIError: 当API请求失败时
        """
        url = urljoin(self.base_url, endpoint)

        for attempt in range(self.max_retry + 1):
            try:
                self._rate_limit()

                logger.debug(f"请求 {url}, 参数: {params}, 尝试: {attempt + 1}")

                response = self.session.get(
                    url,
                    params=params,
                    timeout=self.timeout
                )

                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 429:  # Too Many Requests
                    wait_time = 2 ** attempt  # 指数退避
                    logger.warning(f"请求频率限制，等待 {wait_time} 秒")
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(
                        f"API请求失败: {response.status_code} - {response.text}")
                    response.raise_for_status()

            except requests.exceptions.Timeout:
                logger.warning(f"请求超时，尝试: {attempt + 1}/{self.max_retry + 1}")
                if attempt == self.max_retry:
                    raise MeteoraAPIError(f"请求超时: {url}")

            except requests.exceptions.ConnectionError:
                logger.warning(f"连接错误，尝试: {attempt + 1}/{self.max_retry + 1}")
                if attempt == self.max_retry:
                    raise MeteoraAPIError(f"连接失败: {url}")
                time.sleep(2 ** attempt)  # 指数退避

            except requests.exceptions.RequestException as e:
                logger.error(f"请求异常: {e}")
                if attempt == self.max_retry:
                    raise MeteoraAPIError(f"请求失败: {e}")
                time.sleep(1)

        raise MeteoraAPIError(f"达到最大重试次数: {url}")

    def fetch_all_pools(self) -> List[Dict[str, Any]]:
        """获取所有池子数据 - 核心方法

        基于验证成功的API技术，保持65秒获取88,300个池子的性能

        Returns:
            List[Dict]: 包含所有池子信息的字典列表

        Raises:
            MeteoraAPIError: 当API请求失败时
        """
        start_time = time.time()
        all_pools = []
        page = 0  # 分页从0开始
        total_fetched = 0

        logger.info("开始获取所有池子数据...")

        try:
            while True:
                # 构建请求参数 - 使用与成功脚本相同的参数
                params = {
                    'page': page,
                    'limit': self.batch_size  # 默认1000
                }

                # 请求数据
                response_data = self._make_request(
                    self.endpoints['all_pairs'], params)

                # 提取池子数据 - API返回的是'pairs'字段，不是'data'
                pools_in_page = response_data.get('pairs', [])
                if not pools_in_page:
                    logger.info(f"第 {page} 页无数据，获取完成")
                    break

                # 数据转换和清理
                processed_pools = self._process_pools_data(pools_in_page)
                all_pools.extend(processed_pools)
                total_fetched += len(processed_pools)

                logger.debug(
                    f"第 {page} 页获取 {len(processed_pools)} 个池子，累计: {total_fetched}")

                # 检查是否还有更多页面
                total_count = response_data.get('total', 0)
                if total_fetched >= total_count or len(pools_in_page) < self.batch_size:
                    break

                page += 1

                # 避免请求过快
                if page % 10 == 0:
                    time.sleep(0.5)

            elapsed_time = time.time() - start_time
            logger.info(
                f"✅ 获取所有池子数据完成: {total_fetched} 个池子，耗时: {elapsed_time:.2f} 秒")

            return all_pools

        except Exception as e:
            elapsed_time = time.time() - start_time
            logger.error(f"❌ 获取池子数据失败: {e}，耗时: {elapsed_time:.2f} 秒")
            raise

    def _process_pools_data(self, raw_pools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """处理和标准化池子数据 - 使用与meteora_data_scraper.py相同的逻辑

        Args:
            raw_pools: 原始池子数据

        Returns:
            List[Dict]: 处理后的池子数据
        """
        processed = []

        for raw_pool in raw_pools:
            try:
                # 使用与meteora_data_scraper.py相同的字段处理逻辑
                pool_data = self._process_single_pool_data(raw_pool)

                # 数据有效性检查
                if pool_data.get('address'):
                    processed.append(pool_data)
                else:
                    logger.warning(
                        f"跳过无效池子数据: {raw_pool.get('address', 'Unknown')}")

            except Exception as e:
                logger.warning(
                    f"处理池子数据失败: {e}, 池子地址: {raw_pool.get('address', 'Unknown')}")
                continue

        return processed

    def _safe_float(self, value) -> Optional[float]:
        """安全转换为浮点数"""
        if value is None or value == '':
            return None
        try:
            if isinstance(value, str) and value.strip() == '':
                return None
            return float(value)
        except (ValueError, TypeError):
            return None

    def _safe_int(self, value) -> Optional[int]:
        """安全转换为整数（用于SQLite兼容）"""
        if value is None or value == '':
            return None
        try:
            # 对于字符串，先尝试直接转换为整数避免浮点数精度损失
            if isinstance(value, str):
                if '.' in value or 'e' in value.lower():
                    # 包含小数点或科学记数法，需要通过浮点数转换
                    int_val = int(float(value))
                else:
                    # 纯整数字符串，直接转换
                    int_val = int(value)
            else:
                # 对于数字类型，通过浮点数转换
                int_val = int(float(value))

            # SQLite INTEGER范围检查：-9223372036854775808 到 9223372036854775807
            if -9223372036854775808 <= int_val <= 9223372036854775807:
                return int_val
            else:
                return None  # 返回None，让调用者处理为字符串
        except (ValueError, TypeError, OverflowError):
            return None

    def _safe_string(self, value) -> Optional[str]:
        """安全转换为字符串（用于大数值）"""
        if value is None or value == '':
            return None
        try:
            return str(value)
        except (ValueError, TypeError):
            return None

    def _process_single_pool_data(self, pool_data: Dict[str, Any]) -> Dict[str, Any]:
        """处理单个池子数据，展平复杂字段 - 与meteora_data_scraper.py相同逻辑"""
        processed = {}

        for key, value in pool_data.items():
            if isinstance(value, dict):
                # 展平字典类型字段 (如 fees, volume, fee_tvl_ratio)
                for sub_key, sub_value in value.items():
                    processed[f"{key}_{sub_key}"] = sub_value
            elif isinstance(value, list):
                # 处理列表类型字段 (如 tags)
                processed[key] = ','.join(str(item)
                                          for item in value) if value else ''
            else:
                # 直接字段
                processed[key] = value

        # 特殊处理可能溢出的大数值字段
        large_number_fields = [
            'reserve_x_amount', 'reserve_y_amount',
            'cumulative_trade_volume', 'cumulative_fee_volume',
            'liquidity', 'trade_volume_24h', 'fees_24h'
        ]

        for field in large_number_fields:
            if field in processed:
                # 先尝试转换为整数，如果溢出则保留为字符串
                int_val = self._safe_int(processed[field])
                if int_val is None and processed[field] is not None:
                    # 整数转换失败，保留为字符串
                    processed[field] = self._safe_string(processed[field])
                else:
                    processed[field] = int_val

        return processed

    def fetch_pools_incremental(self, last_update: datetime) -> List[Dict[str, Any]]:
        """增量获取更新的池子数据

        Args:
            last_update: 上次更新时间

        Returns:
            List[Dict]: 更新的池子数据

        Note:
            暂时使用全量获取，后续可以根据API变化优化
        """
        logger.info(f"增量更新（当前使用全量获取）- 上次更新: {last_update}")

        # TODO: 如果API支持按时间过滤，可以优化为真正的增量更新
        # 现在使用全量获取，但可以在数据库层面做增量处理
        return self.fetch_all_pools()

    def fetch_pool_details(self, address: str) -> Optional[Dict[str, Any]]:
        """获取单个池子详细信息

        Args:
            address: 池子地址

        Returns:
            Dict: 池子详细信息，如果不存在返回None
        """
        try:
            # 如果有单独的池子详情API，可以在这里实现
            # 现在暂时返回None，表示使用列表数据
            logger.debug(f"获取池子详情: {address}")
            return None

        except Exception as e:
            logger.error(f"获取池子详情失败: {e}")
            return None

    def check_api_health(self) -> bool:
        """检查API健康状态

        Returns:
            bool: API是否健康
        """
        try:
            # 尝试获取第一页数据来检查API状态
            params = {'page': 0, 'limit': 1}
            response_data = self._make_request(
                self.endpoints['all_pairs'], params)

            # 检查响应结构 - API返回的是'pairs'字段，不是'data'
            if 'pairs' in response_data:
                logger.debug("API健康检查通过")
                return True
            else:
                logger.warning(f"API响应结构异常: {list(response_data.keys())}")
                return False

        except Exception as e:
            logger.error(f"API健康检查失败: {e}")
            return False

    def get_api_stats(self) -> Dict[str, Any]:
        """获取API统计信息

        Returns:
            Dict: API统计信息
        """
        try:
            start_time = time.time()

            # 获取第一页数据来统计
            params = {'page': 0, 'limit': 1}
            response_data = self._make_request(
                self.endpoints['all_pairs'], params)

            response_time = time.time() - start_time
            total_count = response_data.get('total', 0)

            return {
                'total_pools': total_count,
                'api_response_time': round(response_time, 3),
                'last_check': datetime.now().isoformat(),
                'status': 'healthy' if total_count > 0 else 'warning'
            }

        except Exception as e:
            logger.error(f"获取API统计失败: {e}")
            return {
                'total_pools': 0,
                'api_response_time': None,
                'last_check': datetime.now().isoformat(),
                'status': 'error',
                'error': str(e)
            }

    def fetch_top_pools(self, limit: int = 1000) -> List[Dict[str, Any]]:
        """获取排名靠前的池子数据（用于增量更新）

        Args:
            limit: 获取池子数量限制

        Returns:
            List[Dict]: 池子数据列表
        """
        logger.info(f"获取前 {limit} 个池子数据...")

        try:
            # 使用分页API，只获取第一页 (分页从0开始)
            params = {
                'page': 0,
                'limit': min(limit, self.batch_size)  # 不超过批次大小
            }

            response_data = self._make_request(
                self.endpoints['all_pairs'], params)
            pools_data = response_data.get('pairs', [])

            if pools_data:
                processed_pools = self._process_pools_data(pools_data)
                logger.info(f"✅ 获取前 {len(processed_pools)} 个池子数据完成")
                return processed_pools
            else:
                logger.warning("未获取到任何池子数据")
                return []

        except Exception as e:
            logger.error(f"获取排名靠前池子数据失败: {e}")
            return []

    def check_health(self) -> Dict[str, Any]:
        """检查API健康状态（返回详细信息）

        Returns:
            Dict: 健康状态详情
        """
        try:
            start_time = time.time()

            # 测试API调用
            params = {'page': 0, 'limit': 1}
            response_data = self._make_request(
                self.endpoints['all_pairs'], params)

            response_time = (time.time() - start_time) * 1000  # 转换为毫秒

            # 检查响应结构
            if 'pairs' in response_data:
                return {
                    'status': 'healthy',
                    'api_response_time': response_time,
                    'test_pools_count': len(response_data.get('pairs', [])),
                    'total_available': response_data.get('total', 0),
                    'timestamp': datetime.now().isoformat()
                }
            else:
                return {
                    'status': 'unhealthy',
                    'error': f'Invalid API response format. Keys: {list(response_data.keys())}',
                    'timestamp': datetime.now().isoformat()
                }

        except Exception as e:
            logger.error(f"API健康检查失败: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
