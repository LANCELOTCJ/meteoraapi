#!/usr/bin/env python3
"""
数据库清理脚本
删除所有数据并压缩数据库文件，解决数据库体积过大的问题
"""

from core.database import DatabaseManager
import os
import sys
import sqlite3
import shutil
from datetime import datetime
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_database_size(db_path: str) -> tuple:
    """获取数据库文件大小信息"""
    main_db = Path(db_path)
    wal_file = Path(f"{db_path}-wal")
    shm_file = Path(f"{db_path}-shm")

    sizes = {}
    total_size = 0

    if main_db.exists():
        size = main_db.stat().st_size
        sizes['main'] = size
        total_size += size

    if wal_file.exists():
        size = wal_file.stat().st_size
        sizes['wal'] = size
        total_size += size

    if shm_file.exists():
        size = shm_file.stat().st_size
        sizes['shm'] = size
        total_size += size

    return sizes, total_size


def format_size(size_bytes: int) -> str:
    """格式化文件大小"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def backup_database(db_path: str) -> str:
    """备份数据库"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{db_path}.backup_{timestamp}"

    if os.path.exists(db_path):
        shutil.copy2(db_path, backup_path)
        print(f"✅ 数据库已备份到: {backup_path}")
        return backup_path
    else:
        print(f"⚠️  数据库文件不存在: {db_path}")
        return ""


def get_table_stats(db_path: str) -> dict:
    """获取表的记录统计"""
    stats = {}

    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()

            # 获取所有表名
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]

            for table in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                stats[table] = count

            # 获取pool_metrics表的日期范围
            if 'pool_metrics' in tables:
                cursor.execute(
                    "SELECT MIN(timestamp), MAX(timestamp) FROM pool_metrics")
                result = cursor.fetchone()
                if result[0] and result[1]:
                    stats['metrics_date_range'] = f"{result[0]} ~ {result[1]}"

                    # 计算天数差
                    try:
                        from datetime import datetime
                        start_date = datetime.fromisoformat(
                            result[0].replace('Z', '+00:00'))
                        end_date = datetime.fromisoformat(
                            result[1].replace('Z', '+00:00'))
                        days_diff = (end_date - start_date).days
                        stats['metrics_days_span'] = days_diff
                    except:
                        pass

    except Exception as e:
        print(f"❌ 获取表统计失败: {e}")

    return stats


def cleanup_database():
    """清理数据库的主函数"""
    print("🗑️  数据库清理工具")
    print("=" * 80)

    # 数据库路径
    db_paths = [
        'data/meteora.db',
        'data/meteora_monitor.db'
    ]

    for db_path in db_paths:
        if not os.path.exists(db_path):
            print(f"⚠️  数据库文件不存在: {db_path}")
            continue

        print(f"\n📁 处理数据库: {db_path}")
        print("-" * 50)

        # 1. 显示当前状态
        print("1️⃣ 当前数据库状态:")
        sizes, total_size = get_database_size(db_path)

        print(f"   主数据库: {format_size(sizes.get('main', 0))}")
        if 'wal' in sizes:
            print(f"   WAL文件: {format_size(sizes['wal'])}")
        if 'shm' in sizes:
            print(f"   SHM文件: {format_size(sizes['shm'])}")
        print(f"   总大小: {format_size(total_size)}")

        # 获取表统计
        stats = get_table_stats(db_path)
        if stats:
            print(f"\n📊 表记录统计:")
            for table, count in stats.items():
                if table not in ['metrics_date_range', 'metrics_days_span']:
                    print(f"   {table}: {count:,} 条记录")

            if 'metrics_date_range' in stats:
                print(f"   指标数据时间范围: {stats['metrics_date_range']}")
            if 'metrics_days_span' in stats:
                print(f"   数据跨度: {stats['metrics_days_span']} 天")

        # 2. 询问用户确认
        print(f"\n⚠️  即将清理数据库: {db_path}")
        print("   这将删除所有数据（池子信息、指标数据、历史记录等）")

        confirm = input("   确认清理？(输入 'YES' 确认): ").strip()
        if confirm != 'YES':
            print("   ❌ 取消清理")
            continue

        # 3. 备份数据库
        print("\n2️⃣ 备份数据库...")
        backup_path = backup_database(db_path)

        # 4. 清理数据
        print("\n3️⃣ 清理数据...")
        try:
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()

                # 获取所有表名
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row[0] for row in cursor.fetchall()]

                # 删除所有表的数据
                for table in tables:
                    cursor.execute(f"DELETE FROM {table}")
                    print(f"   ✅ 清理表: {table}")

                # 重置自增ID
                cursor.execute("DELETE FROM sqlite_sequence")

                conn.commit()
                print("   ✅ 数据清理完成")

        except Exception as e:
            print(f"   ❌ 数据清理失败: {e}")
            continue

        # 5. 压缩数据库
        print("\n4️⃣ 压缩数据库...")
        try:
            with sqlite3.connect(db_path) as conn:
                # 执行VACUUM命令压缩数据库
                conn.execute("VACUUM")
                print("   ✅ 数据库压缩完成")

        except Exception as e:
            print(f"   ❌ 数据库压缩失败: {e}")

        # 6. 删除WAL和SHM文件
        print("\n5️⃣ 清理相关文件...")
        wal_file = f"{db_path}-wal"
        shm_file = f"{db_path}-shm"

        for file_path in [wal_file, shm_file]:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    print(f"   ✅ 删除文件: {file_path}")
                except Exception as e:
                    print(f"   ❌ 删除文件失败 {file_path}: {e}")

        # 7. 显示清理后状态
        print("\n6️⃣ 清理后状态:")
        sizes_after, total_size_after = get_database_size(db_path)

        print(f"   主数据库: {format_size(sizes_after.get('main', 0))}")
        print(f"   总大小: {format_size(total_size_after)}")

        space_saved = total_size - total_size_after
        if space_saved > 0:
            reduction_percent = (space_saved / total_size) * 100
            print(
                f"   💾 节省空间: {format_size(space_saved)} ({reduction_percent:.1f}%)")

        print(f"\n✅ 数据库 {db_path} 清理完成！")

    print(f"\n🎉 所有数据库清理完成！")
    print(f"建议重启应用程序以确保最佳性能。")


if __name__ == "__main__":
    cleanup_database()
