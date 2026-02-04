from typing import List, Callable
from app.skills.math_skills import multiply, add
from app.skills.general_skills import get_current_time

# 手动注册所有可用技能函数
AVAILABLE_SKILLS: List[Callable] = [
    multiply,
    add,
    get_current_time
]
