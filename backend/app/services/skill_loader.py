"""技能加载服务 - 参考chat-skills的设计，支持动态Skill生成"""

import os
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Skill:
    """技能数据结构"""
    name: str
    description: str
    full_path: Path
    content: str
    is_dynamic: bool = False  # 是否为动态生成的Skill
    created_at: Optional[str] = None  # 创建时间
    use_count: int = 0  # 使用次数


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
                skill.use_count += 1
                return skill
        return None

    def get_skill_names(self) -> List[str]:
        """获取所有技能名称列表"""
        return [skill.name for skill in self.skills]
    
    def create_dynamic_skill(
        self, 
        name: str, 
        description: str, 
        content: str,
        save_to_file: bool = True
    ) -> Skill:
        """
        创建动态Skill
        
        当用户的问题不匹配现有Skill时，可以动态生成一个临时Skill
        如果save_to_file=True，会将Skill保存为文件以便后续复用
        
        Args:
            name: Skill名称
            description: Skill描述
            content: Skill完整内容（System Prompt）
            save_to_file: 是否保存到文件
            
        Returns:
            创建的Skill对象
        """
        # 创建动态Skill目录
        dynamic_dir = self.skills_dir / "dynamic"
        dynamic_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成文件名
        safe_name = name.replace(" ", "_").replace("/", "_").lower()
        file_name = f"dynamic_{safe_name}.md"
        file_path = dynamic_dir / file_name
        
        # 构建Skill内容
        skill_content = f"""# {name}

{description}

## 生成时间
{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 指导原则
{content}
"""
        
        # 保存到文件
        if save_to_file:
            try:
                file_path.write_text(skill_content, encoding="utf-8")
                print(f"✅ 动态Skill已保存: {file_path}")
            except Exception as e:
                print(f"⚠️ 保存动态Skill失败: {e}")
        
        # 创建Skill对象
        skill = Skill(
            name=name,
            description=description,
            full_path=file_path,
            content=skill_content,
            is_dynamic=True,
            created_at=datetime.now().isoformat(),
            use_count=1
        )
        
        # 添加到技能列表
        self.skills.append(skill)
        
        return skill
    
    def delete_dynamic_skill(self, skill: Skill) -> bool:
        """
        删除动态生成的Skill文件
        
        Args:
            skill: 要删除的Skill对象
            
        Returns:
            是否删除成功
        """
        if not skill or not skill.is_dynamic:
            return False
        
        try:
            if skill.full_path and skill.full_path.exists():
                skill.full_path.unlink()
                print(f"🗑️ 已删除动态Skill文件: {skill.full_path}")
                
                # 从skills列表中移除
                if skill in self.skills:
                    self.skills.remove(skill)
                
                return True
        except Exception as e:
            print(f"⚠️ 删除动态Skill失败: {e}")
        
        return False
    
    def load_dynamic_skills(self):
        """加载已保存的动态Skill"""
        dynamic_dir = self.skills_dir / "dynamic"
        if not dynamic_dir.exists():
            return
        
        for file_path in dynamic_dir.glob("dynamic_*.md"):
            try:
                skill = self._parse_skill(file_path)
                if skill:
                    skill.is_dynamic = True
                    # 避免重复添加
                    if not any(s.name == skill.name for s in self.skills):
                        self.skills.append(skill)
            except Exception as e:
                print(f"加载动态Skill失败 {file_path}: {e}")
    
    def get_skill_for_intent(self, intent: str, question: str) -> Optional[Skill]:
        """
        根据意图和问题内容智能匹配Skill
        
        优先匹配已有Skill，如果没有合适的则返回None（由调用方决定是否生成动态Skill）
        
        Args:
            intent: 识别的意图类型
            question: 用户问题
            
        Returns:
            匹配的Skill或None
        """
        # 意图到Skill名称的映射
        intent_skill_map = {
            "concept_question": ["概念讲解专家", "Concept Explanation"],
            "code_analysis": ["代码分析专家", "Code Analysis"],
            "problem_solving": ["智能问答专家", "QA Expert"],
            "learning_advice": ["学习计划生成", "Learning Plan Generation"],
            "essay_grading": ["作文批改专家", "Essay Grading"],
            "survey_generation": ["问卷生成专家", "Survey Generation Ai"],
            "general_chat": ["智能问答专家", "QA Expert"],
        }
        
        # 尝试根据意图获取Skill
        skill_names = intent_skill_map.get(intent, ["智能问答专家"])
        
        for skill_name in skill_names:
            skill = self.get_skill_by_name(skill_name)
            if skill:
                return skill
        
        # 尝试通过关键词匹配
        question_lower = question.lower()
        
        # 关键词匹配规则
        keyword_skill_map = {
            ("作文", "批改", "评分", "essay", "grading"): "作文批改专家",
            ("学习计划", "学习路径", "怎么学", "如何学习"): "学习计划生成",
            ("代码", "程序", "bug", "调试", "code"): "代码分析专家",
            ("概念", "什么是", "定义", "原理"): "概念讲解专家",
            ("问卷", "调查", "survey"): "问卷生成专家",
        }
        
        for keywords, skill_name in keyword_skill_map.items():
            if any(kw in question_lower for kw in keywords):
                skill = self.get_skill_by_name(skill_name)
                if skill:
                    return skill
        
        return None
    
    def get_all_skills_summary(self) -> str:
        """获取所有Skill的摘要（用于AI判断）"""
        summaries = []
        for skill in self.skills:
            summaries.append(f"- {skill.name}: {skill.description}")
        return "\n".join(summaries)
