"""
工具函数模块
"""

def generate_id(prefix: str = "") -> str:
    """
    生成唯一ID
    """
    import uuid
    unique_id = str(uuid.uuid4())
    return f"{prefix}{unique_id}" if prefix else unique_id

def validate_email(email: str) -> bool:
    """
    验证邮箱格式
    """
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))
