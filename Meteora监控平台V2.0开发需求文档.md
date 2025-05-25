# 🚀 Meteora监控平台 V2.0 开发需求文档

## 📋 文档信息

| 项目名称 | Meteora数据监控平台 V2.0 |
|---------|------------------------|
| 文档版本 | 1.0 |
| 创建日期 | 2025-01-23 |
| 最后更新 | 2025-01-23 |
| 文档状态 | 正式版 |

## 🎯 项目概述

### 项目背景
基于已成功验证的Meteora DLMM Production API抓取技术（65秒获取88,300个池子数据），构建一个现代化、高性能、易维护的数据监控平台。

### 核心目标
1. **数据获取**：基于成功的API抓取技术，稳定获取Meteora池子数据
2. **智能筛选**：提供强大的多维度数据筛选功能
3. **实时监控**：支持用户自定义监控条件和智能警报
4. **配置化管理**：双层配置系统，系统级固定，用户级实时调整
5. **数据分析**：适度的图表分析功能，不过度复杂

### 用户范围和扩展性
- **当前阶段**：单用户本地部署，个人独立使用
- **扩展预留**：架构设计预留多用户扩展空间，但暂不实现
- **部署策略**：优先考虑开发简单性，通过性能优化支持后续扩展

### 技术优势
- ✅ 基于验证成功的API技术（65秒获取8.8万数据）
- ✅ 轻量级架构（SQLite + Flask）
- ✅ 模块化设计，便于维护扩展
- ✅ 配置化参数，灵活适应需求变化

## 🏗️ 系统架构设计

### 整体架构图
```
┌─────────────────────────────────────────────────────────────┐
│                    前端展示层 (Frontend)                     │
│  数据筛选 | 实时监控 | 图表展示 | 配置管理 | 警报系统        │
├─────────────────────────────────────────────────────────────┤
│                     Web API层 (Flask)                      │
│    RESTful API | WebSocket | 配置API | 警报API             │
├─────────────────────────────────────────────────────────────┤
│                    业务逻辑层 (Core)                        │
│  数据分析 | 任务调度 | 警报引擎 | 配置管理 | 监控逻辑        │
├─────────────────────────────────────────────────────────────┤
│                   数据访问层 (Database)                     │
│    SQLite | 数据模型 | 查询优化 | 配置存储                  │
├─────────────────────────────────────────────────────────────┤
│                   数据获取层 (API Client)                   │
│    DLMM API | 数据抓取 | 错误处理 | 重试机制                │
└─────────────────────────────────────────────────────────────┘
```

### 项目目录结构
```
meteora-monitor-v2/
├── 📁 core/                          # 🧠 核心业务模块
│   ├── api_client.py                # API数据获取客户端
│   ├── database.py                  # 数据库操作层
│   ├── analyzer.py                  # 数据分析引擎
│   ├── models.py                    # 数据模型定义
│   ├── scheduler.py                 # 任务调度器
│   ├── alert_engine.py              # 警报引擎
│   └── config_manager.py            # 配置管理器
├── 📁 web/                           # 🌐 Web服务层
│   ├── app.py                       # Flask主应用
│   └── routes/                      # API路由模块
│       ├── __init__.py
│       ├── data.py                  # 数据查询API
│       ├── config.py                # 配置管理API
│       ├── alert.py                 # 警报管理API
│       └── websocket.py             # 实时数据推送
├── 📁 frontend/                      # 💻 前端界面
│   ├── index.html                   # 主仪表板页面
│   ├── assets/                      # 静态资源
│   │   ├── css/
│   │   │   ├── main.css             # 主样式文件（Meteora暗色风格）
│   │   │   ├── components.css       # 组件样式
│   │   │   └── themes.css           # 主题配色系统
│   │   ├── js/
│   │   │   ├── main.js              # 主应用逻辑
│   │   │   ├── filters.js           # 筛选器模块
│   │   │   ├── charts.js            # 图表模块
│   │   │   ├── config.js            # 配置管理模块
│   │   │   ├── alerts.js            # 警报模块
│   │   │   └── websocket.js         # 实时数据模块
│   │   ├── fonts/                   # 字体文件
│   │   │   └── inter/               # Inter字体族
│   │   ├── sounds/                  # 声音文件
│   │   │   ├── new_pool.mp3         # 新增池子提醒音
│   │   │   ├── alert.mp3            # 异常波动提醒音
│   │   │   └── update.mp3           # 更新完成提醒音
│   │   └── img/                     # 图片资源
│   │       ├── logo/                # 品牌Logo
│   │       ├── icons/               # 图标资源
│   │       └── backgrounds/         # 背景图片
│   └── components/                  # 可复用组件模板
│       ├── table.html               # 数据表格组件
│       ├── filters.html             # 筛选器组件
│       ├── charts.html              # 图表组件
│       └── config_panel.html        # 配置面板组件
├── 📁 config/                        # ⚙️ 配置管理
│   ├── __init__.py
│   ├── system_config.yaml           # 系统级配置（固定）
│   └── default_user_config.yaml     # 用户配置模板
├── 📁 utils/                         # 🔧 工具模块
│   ├── __init__.py
│   ├── logger.py                    # 日志工具
│   ├── helpers.py                   # 通用工具函数
│   └── validators.py                # 数据验证工具
├── 📁 data/                          # 💾 数据存储
│   ├── meteora.db                   # SQLite数据库
│   └── backups/                     # 数据备份
├── 📁 logs/                          # 📝 日志文件
├── 📁 tests/                         # 🧪 测试文件
├── requirements.txt                 # 依赖列表
├── main.py                          # 🚀 应用入口
└── README.md                        # 项目文档
```

## 💾 数据库设计

### 核心表结构

#### 1. pools 表 (池子基础信息)
```sql
CREATE TABLE pools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT UNIQUE NOT NULL,           -- 池子地址
    name TEXT NOT NULL,                     -- 池子名称
    mint_x TEXT,                           -- X代币地址
    mint_y TEXT,                           -- Y代币地址
    bin_step INTEGER,                      -- 价格精度
    protocol_fee_percentage REAL,          -- 协议费率
    base_fee_percentage REAL,              -- 基础费率
    max_fee_percentage REAL,               -- 最大费率
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. pool_metrics 表 (池子指标数据)
```sql
CREATE TABLE pool_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_address TEXT NOT NULL,            -- 关联池子地址
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 流动性数据
    liquidity REAL,                        -- 流动性
    current_price REAL,                    -- 当前价格
    
    -- 收益数据
    apr REAL,                              -- 年化收益率
    apy REAL,                              -- 复合年化收益率
    farm_apr REAL,                         -- 挖矿APR
    farm_apy REAL,                         -- 挖矿APY
    
    -- 交易量数据
    trade_volume_24h REAL,                 -- 24小时交易量
    volume_hour_1 REAL,                    -- 1小时交易量
    volume_hour_12 REAL,                   -- 12小时交易量
    cumulative_trade_volume REAL,          -- 累积交易量
    
    -- 手续费数据
    fees_24h REAL,                         -- 24小时手续费
    fees_hour_1 REAL,                      -- 1小时手续费
    cumulative_fee_volume REAL,            -- 累积手续费
    
    -- 储备数据
    reserve_x_amount BIGINT,               -- X代币储备
    reserve_y_amount BIGINT,               -- Y代币储备
    
    -- 原始数据
    raw_data TEXT,                         -- JSON格式原始数据
    
    FOREIGN KEY (pool_address) REFERENCES pools (address)
);
```

#### 3. user_configs 表 (用户配置)
```sql
CREATE TABLE user_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_type TEXT NOT NULL,             -- 配置类型：filter/alert/display
    config_name TEXT NOT NULL,             -- 配置名称
    config_data TEXT NOT NULL,             -- JSON格式配置数据
    is_active BOOLEAN DEFAULT 0,           -- 是否激活
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. alert_history 表 (警报历史)
```sql
CREATE TABLE alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT NOT NULL,              -- 警报类型：new_pool/value_change
    pool_address TEXT,                     -- 相关池子地址
    message TEXT NOT NULL,                 -- 警报消息
    alert_data TEXT,                       -- JSON格式警报数据
    is_read BOOLEAN DEFAULT 0,             -- 是否已读
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. system_status 表 (系统状态)
```sql
CREATE TABLE system_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_pools INTEGER,                    -- 总池子数
    successful_updates INTEGER,             -- 成功更新数
    failed_updates INTEGER,                 -- 失败更新数
    update_duration REAL,                  -- 更新耗时(秒)
    api_response_time REAL,                -- API响应时间
    status TEXT DEFAULT 'healthy'          -- 系统状态
);
```

### 索引优化
```sql
-- 性能优化索引
CREATE INDEX idx_pools_address ON pools(address);
CREATE INDEX idx_metrics_pool_timestamp ON pool_metrics(pool_address, timestamp);
CREATE INDEX idx_metrics_timestamp ON pool_metrics(timestamp);
CREATE INDEX idx_metrics_liquidity ON pool_metrics(liquidity);
CREATE INDEX idx_metrics_volume ON pool_metrics(trade_volume_24h);
CREATE INDEX idx_metrics_apy ON pool_metrics(apy);
CREATE INDEX idx_configs_type_active ON user_configs(config_type, is_active);
CREATE INDEX idx_alerts_type_read ON alert_history(alert_type, is_read);

-- 复合索引优化（针对常用查询）
CREATE INDEX idx_metrics_pool_time_desc ON pool_metrics(pool_address, timestamp DESC);
CREATE INDEX idx_metrics_liquidity_time ON pool_metrics(liquidity DESC, timestamp DESC);
CREATE INDEX idx_metrics_apy_time ON pool_metrics(apy DESC, timestamp DESC);
```

### SQLite性能优化配置
```sql
-- 应用启动时执行的SQLite优化配置
PRAGMA journal_mode = WAL;           -- 写前日志模式，提升并发性能
PRAGMA synchronous = NORMAL;         -- 平衡性能和安全性
PRAGMA cache_size = 10000;           -- 增加缓存页面数
PRAGMA temp_store = MEMORY;          -- 临时表存储在内存中
PRAGMA mmap_size = 268435456;        -- 256MB内存映射
PRAGMA optimize;                     -- 自动优化统计信息
```

### 数据清理和维护策略
```sql
-- 定期执行的维护任务
-- 1. 删除7天前的历史数据
DELETE FROM pool_metrics WHERE timestamp < datetime('now', '-7 days');

-- 2. 压缩数据库空间
VACUUM;

-- 3. 更新统计信息
ANALYZE;

-- 4. 重建索引（如有必要）
REINDEX;
```

## ⚙️ 配置系统设计

### 双层配置架构

#### 1. 系统级配置 (config/system_config.yaml)
```yaml
# 系统级配置 - 启动时加载，需要重启才能生效
system:
  # 数据采集配置
  data_collection:
    # 更新策略配置（用户可根据实测效果调整）
    full_update_interval_minutes: 5      # 全量更新间隔（分钟）
    incremental_update_seconds: 30       # 增量更新间隔（秒）
    enable_incremental_update: true      # 是否启用增量更新
    api_timeout_seconds: 30              # API请求超时时间
    max_retry_attempts: 3                # 最大重试次数
    batch_size: 1000                     # 每次请求的数据量
    
    # 智能更新策略
    adaptive_update: false               # 是否启用自适应更新（根据活跃度调整频率）
    max_update_interval_minutes: 30     # 最大更新间隔
    min_update_interval_seconds: 10     # 最小更新间隔
    
  # 数据库配置
  database:
    path: "data/meteora.db"              # 数据库文件路径
    backup_interval_hours: 24            # 备份间隔（小时）
    data_retention_days: 7               # 数据保留天数
    
    # 性能优化配置
    enable_wal_mode: true                # 启用WAL模式提升并发性能
    cache_size_mb: 256                   # SQLite缓存大小（MB）
    auto_vacuum: true                    # 自动清理空间
    enable_query_optimization: true     # 启用查询优化
    
    # 扩展预留配置（暂不启用）
    future_extensions:
      postgresql_support: false         # PostgreSQL支持预留
      redis_cache: false                # Redis缓存预留
      multi_user_support: false         # 多用户支持预留
    
  # 服务器配置
  server:
    host: "0.0.0.0"                      # 服务器地址
    port: 5000                           # 服务器端口
    debug: false                         # 调试模式
    
  # 日志配置
  logging:
    level: "INFO"                        # 日志级别
    file_path: "logs/app.log"            # 日志文件路径
    max_file_size_mb: 100                # 单个日志文件最大大小
    backup_count: 5                      # 日志文件备份数量

# API配置
api:
  meteora:
    base_url: "https://dlmm-api.meteora.ag"
    endpoints:
      all_pairs: "/pair/all_with_pagination"
    headers:
      user_agent: "Meteora-Monitor-V2/1.0"
      accept: "application/json"
```

#### 2. 用户级配置模板 (config/default_user_config.yaml)
```yaml
# 用户级配置模板 - 前端可实时修改
filters:
  # 默认筛选条件
  default:
    min_liquidity: null
    max_liquidity: null
    min_apy: null
    max_apy: null
    min_volume_24h: null
    max_volume_24h: null
    search_keyword: ""
    sort_field: "liquidity"
    sort_direction: "DESC"
    limit: 100
    
  # 预设筛选组合
  presets:
    - name: "高收益池"
      min_apy: 50
      min_liquidity: 100000
    - name: "大流动性池"
      min_liquidity: 1000000
    - name: "活跃交易池"
      min_volume_24h: 100000

# 警报配置
alerts:
  # 阈值设置
  thresholds:
    apy_change_percent: 20               # APY变化阈值（百分比）
    liquidity_change_percent: 15         # 流动性变化阈值（百分比）
    volume_change_percent: 30            # 交易量变化阈值（百分比）
    
  # 警报类型开关
  types:
    new_pool_alert: true                 # 新池子警报
    apy_change_alert: true               # APY变化警报
    liquidity_change_alert: true         # 流动性变化警报
    volume_change_alert: false           # 交易量变化警报
    
  # 声音设置
  sound:
    enabled: true                        # 声音开关
    volume: 0.7                          # 音量（0-1）
    new_pool_sound: "new_pool.mp3"       # 新池子提醒音
    alert_sound: "alert.mp3"             # 异常警报音
    update_sound: "update.mp3"           # 更新完成音

# 显示配置
display:
  # 表格设置
  table:
    default_columns:                     # 默认显示列
      - "name"
      - "address"
      - "liquidity"
      - "apy"
      - "trade_volume_24h"
      - "fees_24h"
    rows_per_page: 100                   # 每页显示行数
    auto_refresh_seconds: 30             # 自动刷新间隔
    
    # 自动更新详细配置
    auto_update:
      enabled: true                      # 启用前端自动更新
      refresh_interval_seconds: 30       # 数据自动刷新间隔
      background_update: true            # 后台更新（无需用户手动刷新网页）
      update_animation: true             # 数据更新时的视觉提示
      pause_on_user_interaction: true    # 用户操作时暂停自动更新
      resume_delay_seconds: 5            # 用户操作结束后恢复更新的延迟

    # 趋势指示器设置
    trends:
      enabled: true                      # 趋势功能总开关
      default_period: "24h"              # 默认对比时间段
      enabled_fields:                    # 启用趋势显示的字段
        - "liquidity"
        - "apy"
        - "trade_volume_24h"
      change_threshold: 2.0              # 变化阈值（百分比，小于此值显示平行箭头）

  # 字段配置方案
  column_configs:
    - name: "默认视图"
      columns: ["name", "address", "liquidity", "apy", "trade_volume_24h", "fees_24h"]
      is_default: true
    - name: "交易员视图"  
      columns: ["name", "liquidity", "volume_hour_1", "volume_hour_12", "trade_volume_24h", "fees_24h"]
    - name: "投资者视图"
      columns: ["name", "liquidity", "apr", "apy", "farm_apr", "farm_apy"]
    - name: "技术分析视图"
      columns: ["name", "current_price", "reserve_x_amount", "reserve_y_amount", "bin_step"]
      
  # 图表设置
  charts:
    enabled_charts:                      # 启用的图表
      - "top_liquidity"
      - "top_apy"
      - "volume_trend"
    refresh_interval_seconds: 60         # 图表刷新间隔
    
  # 界面设置
  ui:
    theme: "dark"                        # 主题：dark(默认)/light - 模仿meteora暗色风格
    language: "zh-CN"                    # 语言
    timezone: "Asia/Shanghai"            # 时区
    
    # UI设计风格配置
    design:
      style: "meteora_inspired"          # 设计风格：模仿meteora官网风格
      color_scheme: "dark_professional"  # 配色方案：专业暗色调
      font_size: "compact"               # 字体大小：compact(紧凑)/normal/large
      data_density: "high"               # 数据密度：高密度显示更多信息
      animation_level: "subtle"          # 动画级别：subtle(微妙)/normal/rich

# 监控配置
monitoring:
  # 监控开关
  enabled: false                         # 监控总开关
  
  # 监控的筛选条件
  filter_config: null                    # JSON格式的筛选条件
  
  # 检查间隔
  check_interval_seconds: 60             # 监控检查间隔
```

## 🎯 功能需求详细说明

### 1. 数据获取模块

#### 1.1 API客户端 (core/api_client.py)
**功能要求：**
- 基于已验证成功的`meteora_data_scraper.py`重构
- 保持65秒获取88,300个池子的性能
- 支持分页获取，自动处理所有页面
- 完善的错误处理和重试机制
- 支持增量更新（只获取变化的数据）

**技术规范：**
```python
class MeteoraAPIClient:
    def __init__(self, config: dict):
        """初始化API客户端"""
        
    def fetch_all_pools(self) -> List[Dict]:
        """获取所有池子数据 - 核心方法"""
        
    def fetch_pools_incremental(self, last_update: datetime) -> List[Dict]:
        """增量获取更新的池子数据"""
        
    def fetch_pool_details(self, address: str) -> Dict:
        """获取单个池子详细信息"""
        
    def check_api_health(self) -> bool:
        """检查API健康状态"""
        
    def get_api_stats(self) -> Dict:
        """获取API统计信息"""
```

**注意事项：**
- 必须保持与原成功脚本相同的请求参数和头信息
- 实现请求频率控制，避免被API限制
- 所有网络请求必须有超时设置
- 记录详细的请求日志用于调试

#### 1.2 数据存储 (core/database.py)
**功能要求：**
- 批量高效存储池子数据
- 支持数据去重和更新
- 自动清理过期数据（7天前）
- 提供高性能的查询接口
- 支持事务处理确保数据一致性

**技术规范：**
```python
class DatabaseManager:
    def __init__(self, db_path: str):
        """初始化数据库管理器"""
        
    def save_pools_batch(self, pools: List[Dict]) -> int:
        """批量保存池子数据"""
        
    def get_pools_with_filters(self, filters: Dict) -> List[Dict]:
        """根据筛选条件获取池子"""
        
    def get_pool_history(self, address: str, days: int) -> List[Dict]:
        """获取池子历史数据"""
        
    def cleanup_old_data(self, days: int) -> int:
        """清理过期数据"""
        
    def get_statistics(self) -> Dict:
        """获取数据库统计信息"""
```

### 2. 筛选功能模块

#### 2.1 筛选器设计
**功能要求：**
- 支持多维度筛选：流动性、APY、交易量、手续费、池子名称
- 范围筛选：最小值、最大值设置
- 文本搜索：池子名称模糊匹配
- 排序功能：支持所有数值字段的升序/降序排序
- 筛选组合：用户可保存和管理多个筛选组合

**前端界面要求：**

#### A. 筛选功能界面（控制显示哪些池子）
- 使用滑块组件进行范围选择
- 实时显示筛选结果数量
- 筛选条件可视化标签显示
- 一键清除所有筛选条件
- 预设筛选快捷按钮

#### B. 字段选择功能界面（控制显示哪些列）
- **字段选择器**：多选下拉框或复选框列表，包含所有可用字段
- **字段分类**：按类型分组显示（基础信息、流动性数据、收益数据、交易数据、手续费数据）
- **字段搜索**：支持字段名称的快速搜索定位
- **拖拽排序**：用户可以拖拽调整字段显示顺序
- **列宽调整**：支持手动调整每列的显示宽度
- **字段配置保存**：用户可以保存自定义的字段配置方案

#### C. 可选择显示的字段列表
**基础信息类：**
- name (池子名称) - 默认显示
- address (池子地址)
- mint_x (X代币地址)
- mint_y (Y代币地址)
- bin_step (价格精度)

**流动性数据类：**
- liquidity (流动性) - 默认显示
- current_price (当前价格)
- reserve_x_amount (X代币储备)
- reserve_y_amount (Y代币储备)

**收益数据类：**
- apr (年化收益率)
- apy (复合年化收益率) - 默认显示
- farm_apr (挖矿APR)
- farm_apy (挖矿APY)

**交易数据类：**
- trade_volume_24h (24小时交易量) - 默认显示
- volume_hour_1 (1小时交易量)
- volume_hour_12 (12小时交易量)
- cumulative_trade_volume (累积交易量)

**手续费数据类：**
- fees_24h (24小时手续费) - 默认显示
- fees_hour_1 (1小时手续费)
- cumulative_fee_volume (累积手续费)

**费率数据类：**
- protocol_fee_percentage (协议费率)
- base_fee_percentage (基础费率)
- max_fee_percentage (最大费率)

#### D. 字段配置管理
- **默认配置**：系统提供的标准字段显示方案
- **自定义配置**：用户可以创建和保存多个字段配置方案
- **配置命名**：如"交易员视图"、"投资者视图"、"技术分析视图"等
- **快速切换**：在界面上提供配置方案的快速切换按钮
- **配置导入导出**：支持配置方案的备份和分享

#### E. 表格展示增强功能
- **动态列显示**：根据用户选择的字段动态生成表格列
- **列排序**：点击列头进行排序，支持多列排序
- **列固定**：重要列（如池子名称）可以固定在左侧
- **数据格式化**：根据数据类型自动格式化显示（货币、百分比、时间等）
- **空值处理**：对于空值或无效数据的友好显示

#### F. 表格行显示详细设计
- **一行一池子**：每行显示一个池子的完整信息
- **用户选择字段**：只显示用户在字段配置中选择的列
- **行样式**：鼠标悬停高亮，选中行突出显示
- **行高自适应**：根据内容自动调整行高

#### G. 趋势指示器功能
- **趋势时间选择**：用户可选择对比时间段（1小时、6小时、24小时、3天、7天）
- **趋势箭头显示**：
  - ↗️ 绿色上升箭头：数值上涨
  - ↘️ 红色下降箭头：数值下跌  
  - ➡️ 灰色平行箭头：数值基本无变化（±2%以内）
- **变化百分比**：箭头旁边显示具体的变化百分比
- **趋势字段**：支持对以下字段显示趋势
  - 流动性 (liquidity)
  - APY (apy)
  - 24小时交易量 (trade_volume_24h)
  - 24小时手续费 (fees_24h)
  - 价格 (current_price)
- **趋势配置**：用户可以选择在哪些字段列显示趋势指示器
- **颜色编码**：
  - 绿色系：正向变化（上涨、增长）
  - 红色系：负向变化（下跌、减少）
  - 灰色系：微小变化或无变化

#### H. 详细分析界面交互
- **点击行跳转**：点击表格行中的池子名称跳转到详细分析页面
- **新窗口打开**：支持Ctrl+点击在新标签页打开详情
- **面包屑导航**：详情页面提供返回列表的导航
- **详情页面内容**：
  - 池子基本信息卡片
  - 多指标趋势图表（TVL、交易量、手续费、APY）
  - 历史数据表格
  - 相关池子推荐
  - 风险评估信息

#### I. 表格性能优化
- **虚拟滚动**：处理大量数据时使用虚拟滚动技术
- **分页加载**：支持分页或无限滚动加载
- **数据缓存**：缓存已加载的数据减少重复请求
- **增量更新**：只更新变化的数据行，避免全表刷新

#### J. 自动更新用户体验
- **无刷新更新**：前端自动获取最新数据，无需用户手动刷新网页
- **实时数据推送**：通过WebSocket接收服务器推送的数据更新
- **更新状态提示**：
  - 数据更新时显示加载指示器
  - 显示最后更新时间和下次更新倒计时
  - 更新完成后短暂高亮新变化的数据
- **智能暂停机制**：
  - 用户正在操作表格时暂停自动更新（避免干扰）
  - 用户操作结束后自动恢复更新
  - 用户可以手动暂停/恢复自动更新
- **网络状态处理**：
  - 检测网络连接状态
  - 网络中断时显示离线提示
  - 网络恢复时自动重新连接和更新数据
- **性能优化**：
  - 只更新变化的数据行，保持用户当前滚动位置

### 3. 监控警报模块

#### 3.1 警报引擎 (core/alert_engine.py)
**功能要求：**
- 实时监控用户设置的筛选条件
- 检测新增符合条件的池子
- 检测现有池子的数值异常变化
- 支持多种警报阈值设置
- 警报去重，避免频繁提醒

**技术规范：**
```python
class AlertEngine:
    def __init__(self, db_manager: DatabaseManager):
        """初始化警报引擎"""
        
    def check_new_pools(self, filter_config: Dict) -> List[Dict]:
        """检查新增的符合条件的池子"""
        
    def check_value_changes(self, pools: List[str], thresholds: Dict) -> List[Dict]:
        """检查池子数值变化"""
        
    def trigger_alert(self, alert_type: str, data: Dict):
        """触发警报"""
        
    def get_alert_history(self, limit: int = 50) -> List[Dict]:
        """获取警报历史"""
```

#### 3.2 声音警报系统
**功能要求：**
- 支持不同类型的提醒音
- 可调节音量大小
- 支持声音开关控制
- 浏览器通知 + 声音提醒组合

**声音文件规范：**
- 格式：MP3
- 时长：0.2-0.5秒
- 音质：清晰不刺耳
- 文件大小：< 50KB

**声音类型：**
- `new_pool.mp3`：新增池子提醒（温和的"叮咚"声）
- `alert.mp3`：异常波动提醒（三声短促"叮叮叮"）
- `update.mp3`：更新完成提醒（单声"叮"）

### 4. 配置管理模块

#### 4.1 配置管理器 (core/config_manager.py)
**功能要求：**
- 加载和解析YAML系统配置
- 管理用户级配置的CRUD操作
- 配置变更的实时生效
- 配置验证和默认值处理
- 配置的导入导出功能

**技术规范：**
```python
class ConfigManager:
    def __init__(self, system_config_path: str):
        """初始化配置管理器"""
        
    def load_system_config(self) -> Dict:
        """加载系统配置"""
        
    def get_user_config(self, config_type: str, config_name: str) -> Dict:
        """获取用户配置"""
        
    def save_user_config(self, config_type: str, config_name: str, config_data: Dict):
        """保存用户配置"""
        
    def apply_config_changes(self, config_type: str, config_data: Dict):
        """应用配置变更"""
```

#### 4.2 前端配置界面
**功能要求：**
- 设置面板：筛选、警报、显示、监控四大类配置
- 实时预览：配置修改立即在界面上体现
- 配置验证：输入值的合法性检查
- 配置重置：恢复默认配置功能
- 配置导出：支持配置的备份和分享

### 5. 数据分析模块

#### 5.1 图表展示
**功能要求：**
- TOP10排行榜：流动性、APY、交易量柱状图
- 趋势分析：选中池子的多指标7天变化折线图
  - 支持TVL（流动性）趋势图
  - 支持24h交易量趋势图  
  - 支持24h手续费趋势图
  - 支持APY变化趋势图
  - 支持多指标同时展示对比
  - 可切换时间范围（1天、3天、7天）
- 分布分析：APY区间分布饼图
- 统计卡片：总池数、平均APY、总流动性等关键指标

**技术规范：**
- 使用Chart.js 4.0实现
- 支持图表的交互操作（点击、悬停）
- 图表数据自动刷新
- 响应式设计，适配不同屏幕尺寸
- 多指标趋势图具体要求：
  - 支持多条折线同时显示（不同颜色区分）
  - 双Y轴设计（左轴：数值类指标，右轴：百分比类指标）
  - 指标开关按钮（用户可选择显示/隐藏特定指标）
  - 时间范围切换器（1天/3天/7天）
  - 数据点悬停显示详细信息
  - 图例可点击切换显示状态

#### 5.2 数据导出
**功能要求：**
- CSV导出：当前筛选结果导出为CSV文件
- JSON导出：完整数据的JSON格式导出
- 自定义导出：用户选择导出字段和格式
- 批量导出：支持历史数据的批量导出

### 6. 任务调度模块

#### 6.1 调度器 (core/scheduler.py)
**功能要求：**
- 定时数据更新：基于配置的更新间隔
- 智能更新策略：全量更新 + 增量更新组合
- 数据清理任务：自动清理过期数据
- 系统监控任务：定期检查系统健康状态
- 备份任务：定期备份数据库

**更新策略说明：**
- **全量更新**：定期获取所有池子的完整数据，确保数据完整性
- **增量更新**：高频获取活跃池子的最新数据，提供近实时体验
- **数据实时性**：前端显示的是最新获取的数据，时间戳反映实际获取时间
- **用户可配置**：更新频率完全由用户根据实测效果自定义调整

**技术规范：**
```python
class TaskScheduler:
    def __init__(self, config: Dict, db_manager: DatabaseManager):
        """初始化任务调度器"""
        
    def start_full_update_job(self):
        """启动全量数据更新任务"""
        
    def start_incremental_update_job(self):
        """启动增量数据更新任务"""
        
    def start_cleanup_job(self):
        """启动数据清理任务"""
        
    def start_monitoring_job(self):
        """启动监控任务"""
        
    def adjust_update_frequency(self, pool_activity: Dict):
        """根据池子活跃度调整更新频率"""
        
    def get_job_status(self) -> Dict:
        """获取任务状态"""
```

## 🌐 Web API设计

### RESTful API端点规范

#### 数据查询API
```
GET /api/pools                         # 获取池子列表
  参数：
    - search: 搜索关键词
    - min_liquidity: 最小流动性
    - max_liquidity: 最大流动性
    - min_apy: 最小APY
    - max_apy: 最大APY
    - sort: 排序字段
    - dir: 排序方向 (ASC/DESC)
    - limit: 返回数量限制
    - offset: 偏移量
    - fields: 返回字段列表，逗号分隔 (可选，默认返回所有字段)
    - include_trends: 是否包含趋势数据 (true/false)
    - trend_period: 趋势对比时间段 (1h/6h/24h/3d/7d)

GET /api/pools/{address}               # 获取池子详情
GET /api/pools/{address}/history       # 获取池子历史数据
  参数：
    - days: 历史天数 (默认7天)
    - interval: 数据间隔 (hour/day)
    - metrics: 指标类型 (liquidity,volume,fees,apy) 支持多选，逗号分隔

GET /api/fields                        # 获取所有可用字段列表
  返回：字段名称、显示名称、数据类型、分类等信息
```

#### 配置管理API
```
GET /api/config/{type}                 # 获取配置
POST /api/config/{type}                # 保存配置
PUT /api/config/{type}/{name}          # 更新配置
DELETE /api/config/{type}/{name}       # 删除配置

配置类型 (type):
  - filter: 筛选配置
  - alert: 警报配置
  - display: 显示配置
  - monitoring: 监控配置
  - columns: 字段配置 (新增)

GET /api/config/columns                # 获取所有字段配置方案
POST /api/config/columns               # 创建新的字段配置方案
PUT /api/config/columns/{name}         # 更新字段配置方案
DELETE /api/config/columns/{name}      # 删除字段配置方案
```

#### 警报管理API
```
GET /api/alerts                        # 获取警报历史
POST /api/alerts/mark-read             # 标记警报为已读
DELETE /api/alerts/{id}                # 删除警报
GET /api/alerts/stats                  # 获取警报统计
```

#### 系统管理API
```
GET /api/system/status                 # 获取系统状态
GET /api/system/health                 # 健康检查
POST /api/system/update                # 手动触发数据更新
GET /api/system/stats                  # 获取系统统计信息
```

#### 数据导出API
```
GET /api/export/csv                    # CSV导出
GET /api/export/json                   # JSON导出
POST /api/export/custom                # 自定义导出
```

### WebSocket事件规范

#### 客户端 → 服务器
```
{
  "type": "subscribe_monitoring",      # 订阅监控
  "data": {
    "filter_config": {...}             # 筛选配置
  }
}

{
  "type": "unsubscribe_monitoring"     # 取消订阅监控
}

{
  "type": "config_update",             # 配置更新
  "data": {
    "config_type": "alert",
    "config_data": {...}
  }
}
```

#### 服务器 → 客户端
```
{
  "type": "data_update",               # 数据更新
  "data": {
    "pools": [...],                    # 更新的池子数据
    "timestamp": "2025-01-23T10:30:00Z",
    "update_type": "full"              # full: 全量更新, incremental: 增量更新
  }
}

{
  "type": "auto_refresh",              # 自动刷新通知
  "data": {
    "next_update_in": 25,              # 下次更新倒计时（秒）
    "last_update": "2025-01-23T10:30:00Z",
    "status": "healthy"                # 系统状态
  }
}

{
  "type": "new_pool_alert",            # 新池子警报
  "data": {
    "pool": {...},                     # 池子信息
    "filter_name": "高收益池"
  }
}

{
  "type": "value_change_alert",        # 数值变化警报
  "data": {
    "pool_address": "...",
    "field": "apy",
    "old_value": 45.2,
    "new_value": 67.8,
    "change_percent": 50.0
  }
}

{
  "type": "system_status",             # 系统状态更新
  "data": {
    "status": "healthy",
    "last_update": "2025-01-23T10:30:00Z",
    "total_pools": 88300
  }
}
```

## 🎨 前端技术规范

### 技术栈选择
- **HTML5 + CSS3**：现代化的标记和样式
- **Bootstrap 5.3**：响应式UI框架基础（自定义暗色主题）
- **原生JavaScript (ES6+)**：避免框架复杂性
- **Chart.js 4.0**：图表可视化库（暗色主题配置）
- **Web Audio API**：声音播放
- **WebSocket API**：实时通信
- **LocalStorage API**：本地数据存储

### UI设计系统
- **设计风格**：模仿Meteora官网的现代化暗色调设计
- **字体系统**：Inter字体族，支持多种字重和尺寸
- **配色方案**：深黑蓝基调，青蓝色品牌强调色，专业的数据可视化配色
- **布局密度**：高密度紧凑布局，适合大量数据展示
- **交互反馈**：微妙的动画和视觉反馈，提升用户体验
- **响应式设计**：支持大屏显示器的宽屏布局（最大1920px）

### 字体配置策略
- **数据表格**：使用12px小字体，紧凑行高1.2
- **表头标题**：使用11px极小字体，大写字母，增加字母间距
- **按钮文字**：使用12px字体，适中字重
- **标题文字**：使用16-18px字体，突出层级
- **辅助文字**：使用11px字体，降低视觉权重

### 组件化设计

#### 主要组件
```javascript
// 筛选器组件
class FilterComponent {
    constructor(container, config) {}
    render() {}
    getFilterData() {}
    setFilterData(data) {}
    onFilterChange(callback) {}
}

// 数据表格组件
class DataTableComponent {
    constructor(container, config) {}
    render(data) {}
    updateData(data) {}
    onRowClick(callback) {}
    
    // 自动更新功能
    startAutoRefresh(intervalSeconds) {}
    stopAutoRefresh() {}
    pauseAutoRefresh() {}
    resumeAutoRefresh() {}
    onDataUpdate(callback) {}
    showUpdateIndicator() {}
    
    // 趋势指示器功能
    renderTrendIndicator(field, currentValue, previousValue) {}
    setTrendPeriod(period) {}
    toggleTrendColumn(field, enabled) {}
    
    // 详情界面跳转
    onCellClick(poolAddress, callback) {}
    openDetailPage(poolAddress, newTab = false) {}
}

// 图表组件
class ChartComponent {
    constructor(container, type, config) {}
    render(data) {}
    updateData(data) {}
    destroy() {}
    
    // 多指标趋势图专用方法
    renderTrendChart(poolAddress, metrics, timeRange) {}
    toggleMetric(metric, enabled) {}
    changeTimeRange(days) {}
}

// 配置面板组件
class ConfigPanelComponent {
    constructor(container, configType) {}
    render() {}
    getConfigData() {}
    setConfigData(data) {}
    onConfigChange(callback) {}
}

// 警报组件
class AlertComponent {
    constructor(container) {}
    showAlert(type, message, data) {}
    playSound(soundType) {}
    showNotification(title, message) {}
}
```

### 样式规范

#### CSS组织结构
```css
/* main.css - 主样式文件 */
:root {
    /* Meteora风格暗色调配色方案 */
    --bg-primary: #0a0b0f;              /* 主背景色 - 深黑蓝 */
    --bg-secondary: #1a1b23;            /* 次要背景色 - 深灰蓝 */
    --bg-tertiary: #2a2d35;             /* 第三背景色 - 中灰蓝 */
    --bg-hover: #3a3d45;                /* 悬停背景色 */
    
    /* 文字颜色 */
    --text-primary: #ffffff;             /* 主要文字 - 纯白 */
    --text-secondary: #b0b3b8;           /* 次要文字 - 浅灰 */
    --text-muted: #8a8d92;              /* 辅助文字 - 深灰 */
    --text-disabled: #5a5d62;           /* 禁用文字 */
    
    /* Meteora品牌色系 */
    --accent-primary: #00d4ff;           /* 主品牌色 - 青蓝 */
    --accent-secondary: #7c3aed;         /* 次品牌色 - 紫色 */
    --accent-tertiary: #06ffa5;         /* 第三品牌色 - 青绿 */
    
    /* 功能色彩 */
    --success-color: #10b981;            /* 成功/上涨 - 绿色 */
    --danger-color: #ef4444;             /* 危险/下跌 - 红色 */
    --warning-color: #f59e0b;            /* 警告 - 橙色 */
    --info-color: #3b82f6;              /* 信息 - 蓝色 */
    
    /* 边框和分割线 */
    --border-primary: #3a3d45;           /* 主要边框 */
    --border-secondary: #2a2d35;         /* 次要边框 */
    --border-accent: #00d4ff33;          /* 强调边框（带透明度） */
    
    /* 阴影效果 */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
    --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.3);
    --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.4);
    --shadow-glow: 0 0 20px rgba(0, 212, 255, 0.2);
    
    /* 字体配置 - 紧凑型数据展示 */
    --font-size-xs: 11px;                /* 极小字体 - 数据密集区域 */
    --font-size-sm: 12px;                /* 小字体 - 表格数据 */
    --font-size-base: 14px;              /* 基础字体 */
    --font-size-lg: 16px;                /* 大字体 - 标题 */
    --font-size-xl: 18px;                /* 超大字体 - 主标题 */
    
    --line-height-tight: 1.2;            /* 紧凑行高 */
    --line-height-normal: 1.4;           /* 标准行高 */
    
    /* 间距配置 - 紧凑布局 */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 12px;
    --spacing-lg: 16px;
    --spacing-xl: 24px;
    
    /* 圆角配置 */
    --border-radius-sm: 4px;
    --border-radius-md: 8px;
    --border-radius-lg: 12px;
    --border-radius-xl: 16px;
}

/* 全局样式 - Meteora风格 */
body {
    background: linear-gradient(135deg, var(--bg-primary) 0%, #0f1419 100%);
    color: var(--text-primary);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: var(--font-size-base);
    line-height: var(--line-height-normal);
    margin: 0;
    padding: 0;
    min-height: 100vh;
}

.container {
    max-width: 1920px;
    margin: 0 auto;
    padding: var(--spacing-lg);
    background: rgba(26, 27, 35, 0.6);
    backdrop-filter: blur(10px);
    border-radius: var(--border-radius-lg);
    border: 1px solid var(--border-primary);
}

/* 组件样式 - 现代化设计 */
.card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-md);
    transition: all 0.3s ease;
}

.card:hover {
    border-color: var(--border-accent);
    box-shadow: var(--shadow-glow);
    transform: translateY(-2px);
}

/* 筛选面板 - 紧凑设计 */
.filter-panel {
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    border: 1px solid var(--border-primary);
}

.filter-panel .form-control {
    background: var(--bg-primary);
    border: 1px solid var(--border-secondary);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
}

.filter-panel .form-control:focus {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.2);
    outline: none;
}

/* 数据表格 - 高密度设计 */
.data-table {
    background: var(--bg-secondary);
    border-radius: var(--border-radius-md);
    overflow: hidden;
    border: 1px solid var(--border-primary);
}

.data-table table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
    line-height: var(--line-height-tight);
}

.data-table th {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--border-primary);
    text-align: left;
    position: sticky;
    top: 0;
    z-index: 10;
}

.data-table td {
    padding: var(--spacing-xs) var(--spacing-md);
    border-bottom: 1px solid var(--border-secondary);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
}

.data-table tr:hover {
    background: var(--bg-hover);
    cursor: pointer;
}

.data-table tr:hover td {
    color: var(--accent-primary);
}

/* 趋势指示器 */
.trend-indicator {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-xs);
    font-weight: 500;
}

.trend-up { color: var(--success-color); }
.trend-down { color: var(--danger-color); }
.trend-neutral { color: var(--text-muted); }

/* 图表容器 */
.chart-container {
    background: var(--bg-secondary);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-lg);
    border: 1px solid var(--border-primary);
    position: relative;
}

.chart-container::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
    border-radius: var(--border-radius-md) var(--border-radius-md) 0 0;
}

/* 配置面板 */
.config-panel {
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-lg);
    border: 1px solid var(--border-primary);
}

.config-panel .section-title {
    color: var(--accent-primary);
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-bottom: var(--spacing-md);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
}

/* 警报提示 */
.alert-toast {
    background: var(--bg-tertiary);
    border: 1px solid var(--accent-primary);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-md);
    box-shadow: var(--shadow-glow);
    backdrop-filter: blur(10px);
}

/* 按钮样式 - Meteora风格 */
.btn-primary {
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    border: none;
    color: var(--text-primary);
    font-weight: 500;
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: var(--border-radius-sm);
    transition: all 0.3s ease;
    font-size: var(--font-size-sm);
}

.btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
    filter: brightness(1.1);
}

/* 状态指示器 */
.status-indicator {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-xs);
    padding: 2px var(--spacing-xs);
    border-radius: var(--border-radius-sm);
    background: var(--bg-tertiary);
}

.status-healthy { color: var(--success-color); }
.status-warning { color: var(--warning-color); }
.status-error { color: var(--danger-color); }

/* 工具类 */
.loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl);
    color: var(--text-secondary);
}

.loading .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-primary);
    border-top: 2px solid var(--accent-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.error {
    color: var(--danger-color);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--border-radius-sm);
    padding: var(--spacing-sm);
}

.success {
    color: var(--success-color);
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: var(--border-radius-sm);
    padding: var(--spacing-sm);
}

/* 响应式设计 */
@media (max-width: 1200px) {
    .container { padding: var(--spacing-md); }
    .data-table td { font-size: var(--font-size-xs); }
    .data-table th { font-size: 10px; }
}

/* 滚动条样式 */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: var(--bg-primary);
}

::-webkit-scrollbar-thumb {
    background: var(--border-primary);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--accent-primary);
}
```

### JavaScript模块规范

#### 模块组织
```javascript
// main.js - 主应用入口
const App = {
    init() {
        this.initComponents();
        this.bindEvents();
        this.loadInitialData();
        this.startAutoUpdate();
    },
    
    initComponents() {
        this.filterComponent = new FilterComponent('#filter-panel');
        this.tableComponent = new DataTableComponent('#data-table');
        this.chartComponent = new ChartComponent('#charts');
        this.configComponent = new ConfigPanelComponent('#config-panel');
        this.alertComponent = new AlertComponent('#alerts');
        this.websocketClient = new WebSocketClient();
    },
    
    startAutoUpdate() {
        // 启动自动更新机制
        this.websocketClient.connect();
        this.websocketClient.onDataUpdate((data) => {
            this.updateAllComponents(data);
        });
        
        // 定时器备用方案（WebSocket断开时）
        this.fallbackTimer = setInterval(() => {
            if (!this.websocketClient.isConnected()) {
                this.loadLatestData();
            }
        }, 30000);
    },
    
    updateAllComponents(data) {
        this.tableComponent.updateData(data.pools);
        this.chartComponent.updateData(data);
        this.showUpdateIndicator();
    }
};

// WebSocket客户端管理
class WebSocketClient {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }
    
    connect() {
        this.ws = new WebSocket('ws://localhost:5000/ws');
        this.setupEventListeners();
    }
    
    onDataUpdate(callback) {
        this.dataUpdateCallback = callback;
    }
    
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
    
    setupEventListeners() {
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'data_update' && this.dataUpdateCallback) {
                this.dataUpdateCallback(data);
            }
        };
        
        this.ws.onclose = () => {
            this.attemptReconnect();
        };
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                this.connect();
                this.reconnectAttempts++;
            }, 5000);
        }
    }
}

// 模块导出规范
window.App = App;
```

## 🔧 开发规范和注意事项

### 代码规范

#### Python代码规范
- 遵循PEP 8编码规范
- 使用类型提示 (Type Hints)
- 函数和类必须有详细的文档字符串
- 异常处理必须具体明确
- 日志记录使用统一的格式

```python
# 示例代码规范
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class MeteoraAPIClient:
    """Meteora API客户端
    
    用于获取Meteora DLMM池子数据的API客户端。
    基于已验证成功的API抓取技术。
    """
    
    def __init__(self, config: Dict[str, Any]) -> None:
        """初始化API客户端
        
        Args:
            config: 配置字典，包含API URL、超时等设置
            
        Raises:
            ValueError: 当配置参数无效时
        """
        self.config = config
        self.session = self._create_session()
        logger.info("MeteoraAPIClient initialized")
    
    def fetch_all_pools(self) -> List[Dict[str, Any]]:
        """获取所有池子数据
        
        Returns:
            包含所有池子信息的字典列表
            
        Raises:
            APIError: 当API请求失败时
            TimeoutError: 当请求超时时
        """
        try:
            # 实现逻辑
            pass
        except Exception as e:
            logger.error(f"Failed to fetch pools: {e}")
            raise
```

#### JavaScript代码规范
- 使用ES6+语法
- 采用模块化设计
- 异步操作使用async/await
- 错误处理必须完善
- 注释清晰详细

```javascript
/**
 * 数据表格组件
 * 负责显示和管理池子数据表格
 */
class DataTableComponent {
    /**
     * 构造函数
     * @param {string} container - 容器选择器
     * @param {Object} config - 配置对象
     */
    constructor(container, config = {}) {
        this.container = document.querySelector(container);
        this.config = { ...this.defaultConfig, ...config };
        this.data = [];
        this.init();
    }
    
    /**
     * 异步加载数据
     * @param {Object} filters - 筛选条件
     * @returns {Promise<Array>} 池子数据数组
     */
    async loadData(filters = {}) {
        try {
            const response = await fetch('/api/pools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filters)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Failed to load data:', error);
            throw error;
        }
    }
}
```

### 错误处理规范

#### 后端错误处理
```python
# 自定义异常类
class MeteoraAPIError(Exception):
    """Meteora API相关错误"""
    pass

class DatabaseError(Exception):
    """数据库操作错误"""
    pass

class ConfigError(Exception):
    """配置错误"""
    pass

# 错误处理装饰器
def handle_api_errors(func):
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except requests.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise MeteoraAPIError(f"API请求失败: {e}")
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise
    return wrapper
```

#### 前端错误处理
```javascript
// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    App.showErrorMessage('系统发生错误，请刷新页面重试');
});

// API请求错误处理
class APIClient {
    static async request(url, options = {}) {
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'TypeError') {
                throw new Error('网络连接失败，请检查网络设置');
            }
            throw error;
        }
    }
}
```

### 性能优化要求

#### 数据库优化
- 所有查询必须使用索引
- 批量操作优于单条操作
- 定期分析查询性能
- 实现查询结果缓存

#### 前端优化
- 图片和静态资源压缩
- JavaScript代码分块加载
- 实现虚拟滚动处理大数据量
- 使用防抖和节流优化用户交互

#### API优化
- 实现请求缓存机制
- 支持数据分页和限制
- 使用压缩传输
- 实现请求去重

### 安全要求

#### 输入验证
- 所有用户输入必须验证
- SQL注入防护
- XSS攻击防护
- CSRF保护

#### 数据安全
- 敏感配置加密存储
- API密钥安全管理
- 用户数据隐私保护
- 定期安全审计

### 测试要求

#### 单元测试
- 核心业务逻辑100%覆盖
- API客户端测试
- 数据库操作测试
- 配置管理测试

#### 集成测试
- API端点测试
- WebSocket通信测试
- 前后端集成测试
- 警报系统测试

#### 性能测试
- 数据获取性能测试
- 数据库查询性能测试
- 并发访问测试
- 内存使用测试

## 📋 开发里程碑

### Phase 1: 核心基础 (第1-3天)
**目标：** 建立项目基础架构和核心数据获取功能

**任务清单：**
- [ ] 创建项目目录结构
- [ ] 配置开发环境和依赖
- [ ] 实现API客户端（基于成功脚本）
- [ ] 设计和创建数据库表结构
- [ ] 实现基础的数据存储功能
- [ ] 创建Flask应用基础框架
- [ ] 实现基本的数据查询API
- [ ] 创建简单的前端数据展示页面

**验收标准：**
- ✅ 能够成功获取88,300个池子数据（基于用户配置的时间间隔）
- ✅ 数据正确存储到SQLite数据库
- ✅ 基础Web界面能够显示池子列表
- ✅ 基本的筛选功能正常工作
- ✅ 全量更新和增量更新策略正常运行

### Phase 2: 筛选和配置 (第4-6天)
**目标：** 完善筛选功能和配置管理系统

**任务清单：**
- [ ] 实现高级筛选器组件
- [ ] 开发筛选组合管理功能
- [ ] 实现配置管理系统（双层配置）
- [ ] 创建前端配置界面
- [ ] 实现配置的实时生效机制
- [ ] 添加数据排序和分页功能
- [ ] 优化查询性能和索引

**验收标准：**
- ✅ 多维度筛选功能完整可用
- ✅ 筛选组合保存和管理正常
- ✅ 配置修改能够实时生效
- ✅ 查询响应时间 < 1秒

### Phase 3: 监控和警报 (第7-8天)
**目标：** 实现监控和警报系统

**任务清单：**
- [ ] 开发警报引擎
- [ ] 实现新池子检测功能
- [ ] 实现数值变化检测功能
- [ ] 集成声音警报系统
- [ ] 实现浏览器通知功能
- [ ] 创建警报历史管理
- [ ] 实现WebSocket实时通信

**验收标准：**
- ✅ 新增池子能够及时检测和提醒
- ✅ 数值异常变化能够准确警报
- ✅ 声音提醒功能正常工作
- ✅ 警报历史记录完整

### Phase 4: 分析和优化 (第9-10天)
**目标：** 完善数据分析功能、UI美化和系统优化

**任务清单：**
- [ ] 实现图表展示功能（暗色主题配置）
- [ ] 开发数据导出功能
- [ ] 实现任务调度系统
- [ ] 添加系统监控功能
- [ ] UI设计美化和Meteora风格优化
- [ ] 字体和布局紧凑化调整
- [ ] 色彩系统和视觉反馈完善
- [ ] 响应式设计和大屏适配
- [ ] 性能优化和错误处理完善
- [ ] 用户体验优化（动画、交互反馈）
- [ ] 文档和部署指南

**验收标准：**
- ✅ 图表展示功能完整（暗色主题）
- ✅ 数据导出功能正常
- ✅ 定期更新任务稳定运行
- ✅ 系统整体性能达标
- ✅ UI界面美观，符合Meteora风格暗色调设计
- ✅ 大量数据展示时界面清晰易读
- ✅ 字体紧凑，节省屏幕空间

## 🚀 部署和运维

### 开发环境配置
```bash
# 1. 创建虚拟环境
python -m venv meteora-env
source meteora-env/bin/activate  # Linux/Mac
# meteora-env\Scripts\activate   # Windows

# 2. 安装依赖
pip install -r requirements.txt

# 3. 初始化配置
cp config/system_config.yaml.example config/system_config.yaml
cp config/default_user_config.yaml.example config/default_user_config.yaml

# 4. 初始化数据库
python -c "from core.database import DatabaseManager; DatabaseManager().init_database()"

# 5. 启动开发服务器
python main.py
```

### 生产环境部署
```bash
# 使用gunicorn部署
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 --timeout 120 main:app

# 使用systemd服务
sudo cp deploy/meteora-monitor.service /etc/systemd/system/
sudo systemctl enable meteora-monitor
sudo systemctl start meteora-monitor
```

### 监控和维护
- 定期检查日志文件
- 监控数据库大小和性能
- 备份重要配置和数据
- 定期更新依赖包
- 监控API响应时间和成功率

## 📚 附录

### 依赖包清单 (requirements.txt)
```txt
# Web框架
Flask==2.3.3
Flask-CORS==4.0.0
Flask-SocketIO==5.3.6

# 数据处理
pandas==2.1.1
requests==2.31.0
PyYAML==6.0.1

# 任务调度
APScheduler==3.10.4

# 数据库
# sqlite3 (Python内置)

# 开发工具
pytest==7.4.2
pytest-cov==4.1.0

# 前端资源 (CDN或本地引入)
# Bootstrap 5.3 - 暗色主题定制
# Chart.js 4.0 - 暗色主题配置
# Inter字体族 - Google Fonts或本地文件

# 生产部署 (可选)
gunicorn==21.2.0
```

### 配置文件示例
详见上文配置系统设计部分的YAML配置示例。

### API文档
详见上文Web API设计部分的接口规范。

---

**文档结束**

此文档将作为Meteora监控平台V2.0开发的完整指导手册，所有开发工作都应严格按照此文档执行。如有疑问或需要修改，请及时更新此文档并通知相关开发人员。 