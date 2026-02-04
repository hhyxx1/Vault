"""技能加载服务 - 参考chat-skills的设计"""

import os
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass


@dataclass
class Skill:
    """技能数据结构"""
    name: str
    description: str
    full_path: Path
    content: str


class SkillLoader:
    """技能加载器 - 加载并解析技能Markdown文件"""

    def __init__(self, skills_dir: Optional[Path] = None):
        """
        初始化技能加载器
        
        Args:
            skills_dir: 技能文件目录路径
        """
        if skills_dir is None:
            # 默认使用backend/skills目录
            backend_dir = Path(__file__).parent.parent.parent
            skills_dir = backend_dir / "skills"
        
        self.skills_dir = Path(skills_dir)
        self.skills: List[Skill] = []

    def load_skills(self) -> List[Skill]:
        """扫描目录并加载所有技能"""
        if not self.skills_dir.exists():
            print(f"警告: 技能目录不存在: {self.skills_dir}")
            return []

        self.skills = []

        # 遍历目录查找.md文件
        for file_path in self.skills_dir.glob("*.md"):
            try:
                skill = self._parse_skill(file_path)
                if skill:
                    self.skills.append(skill)
            except Exception as e:
                print(f"警告: 解析技能文件失败 {file_path}: {e}")

        return self.skills

    def _parse_skill(self, skill_path: Path) -> Optional[Skill]:
        """解析单个技能Markdown文件"""
        try:
            content = skill_path.read_text(encoding="utf-8")
        except Exception as e:
            print(f"读取文件错误 {skill_path}: {e}")
            return None

        # 提取名称（从标题或文件名）
        name = self._extract_name(content, skill_path)
        
        # 提取描述
        description = self._extract_description(content)

        return Skill(
            name=name,
            description=description,
            full_path=skill_path,
            content=content
        )

    def _extract_name(self, content: str, skill_path: Path) -> str:
        """从内容或文件名提取技能名称"""
        lines = content.split("\n")
        for line in lines[:5]:
            if line.startswith("# "):
                return line[2:].strip()
        
        # 回退使用文件名
        return skill_path.stem.replace("_", " ").title()

    def _extract_description(self, content: str, max_lines: int = 2) -> str:
        """提取技能描述（标题后的前几行）"""
        lines = content.split("\n")
        desc_lines = []
        started = False

        for line in lines:
            line = line.strip()
            
            if not started:
                if line.startswith("#") or not line:
                    continue
                started = True
            
            if started and line.startswith("#"):
                break
            
            if line:
                desc_lines.append(line)
                if len(desc_lines) >= max_lines:
                    break

        description = " ".join(desc_lines)
        if len(description) > 200:
            description = description[:197] + "..."
        
        return description

    def get_skill_by_name(self, name: str) -> Optional[Skill]:
        """根据名称获取技能（不区分大小写）"""
        name_lower = name.lower()
        for skill in self.skills:
            if skill.name.lower() == name_lower:
                return skill
        return None

    def get_skill_names(self) -> List[str]:
        """获取所有技能名称列表"""
        return [skill.name for skill in self.skills]
