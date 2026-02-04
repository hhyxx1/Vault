from datetime import datetime

def get_current_time() -> str:
    """获取当前系统时间"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
