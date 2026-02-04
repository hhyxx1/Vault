"""技能加载服务 - 参考chat-skills的设计"""

import os
from pathlib import Path
from typing import List, Optional, Callable, Dict, Any, Tuple
from dataclasses import dataclass
import re
import ast
import chromadb
from chromadb.utils import embedding_functions

CHROMADB_AVAILABLE = False

try:
    CHROMADB_AVAILABLE = True
except ImportError:
    print("⚠️  警告: 无法导入 chromadb，技能语义检索功能将受限")


@dataclass
class Skill:
    """技能数据结构"""
    name: str
    description: str
    full_path: Path
    content: str

@dataclass
class GeneratedSkill:
    """运行时生成技能"""
    name: str
    description: str
    fn: Callable


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
        self._embed_model = None
        self._skill_embeddings: Dict[str, List[float]] = {}

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

    def _ensure_embed_model(self):
        """确保有可用的嵌入模型"""
        if not CHROMADB_AVAILABLE:
            print("⚠️  chromadb 不可用，跳过嵌入模型初始化")
            return
        if self._embed_model:
            return
        try:
            self._embed_model = embedding_functions.DefaultEmbeddingFunction()
            print("✅ chromadb默认嵌入模型初始化成功")
        except Exception as e:
            print(f"⚠️  初始化嵌入模型失败: {e}")
            self._embed_model = None

    def build_skill_embeddings(self):
        """为当前技能集构建向量表示，用于语义检索"""
        if not CHROMADB_AVAILABLE:
            print("⚠️  chromadb 不可用，跳过技能向量构建")
            return
        try:
            self._ensure_embed_model()
            if self._embed_model is None:
                print("⚠️  嵌入模型初始化失败，跳过技能向量构建")
                return
            texts = [f"{s.name}\n{s.description}" for s in self.skills]
            if not texts:
                return
            embeddings = self._embed_model(texts)
            for s, v in zip(self.skills, embeddings):
                self._skill_embeddings[s.name] = v
            print(f"✅ 成功构建 {len(self.skills)} 个技能的向量表示")
        except Exception as e:
            print(f"⚠️  构建技能向量失败: {e}")
            print("💡 技能语义检索功能将不可用，但其他功能正常")
            self._skill_embeddings = {}

    @staticmethod
    def _cosine(a: List[float], b: List[float]) -> float:
        """余弦相似度（无numpy实现）"""
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        na = sum(x * x for x in a) ** 0.5
        nb = sum(y * y for y in b) ** 0.5
        if na == 0 or nb == 0:
            return 0.0
        return dot / (na * nb)

    def search_skills(self, query: str, top_k: int = 3, threshold: float = 0.35) -> List[Tuple[Skill, float]]:
        """基于语义的技能检索"""
        if not CHROMADB_AVAILABLE:
            print("⚠️  chromadb 不可用，返回空技能搜索结果")
            return []
        if not self.skills:
            return []
        if not self._skill_embeddings:
            try:
                self.build_skill_embeddings()
            except Exception as e:
                print(f"⚠️  构建技能向量失败，跳过语义检索: {e}")
                return []
        
        try:
            self._ensure_embed_model()
            if self._embed_model is None:
                print("⚠️  嵌入模型未初始化，跳过语义检索")
                return []
            qv = self._embed_model([query])[0]
            scored: List[Tuple[Skill, float]] = []
            for s in self.skills:
                sv = self._skill_embeddings.get(s.name)
                if not sv:
                    continue
                sim = self._cosine(sv, qv)
                if sim >= threshold:
                    scored.append((s, sim))
            scored.sort(key=lambda x: x[1], reverse=True)
            return scored[:top_k]
        except Exception as e:
            print(f"⚠️  技能语义检索失败: {e}")
            return []

    # ---------------- 运行时技能生成 ----------------
    def generate_runtime_skill(self, question: str) -> Optional[GeneratedSkill]:
        """
        动态判断是否需要生成技能，并返回一个安全的运行时技能
        当前支持场景示例：
        - 数学计算/百分比：提取题目中的算式并安全计算
        """
        q = question.strip()
        # 简单启发式：包含运算符或“计算/百分比/求”
        if re.search(r"[+\-*/()%]", q) or re.search(r"(计算|求|百分比|比例)", q):
            def _safe_eval(expr: str) -> float:
                # 将百分比替换为 /100
                expr = re.sub(r"(\d+(?:\.\d+)?)%", r"(\1/100)", expr)
                # 仅允许数字、括号与基本运算符
                if not re.fullmatch(r"[0-9\.\s\+\-\*\/\(\)\/]+", expr):
                    raise ValueError("非法字符")
                node = ast.parse(expr, mode="eval")
                def _eval(n):
                    if isinstance(n, ast.Expression):
                        return _eval(n.body)
                    if isinstance(n, ast.BinOp):
                        left = _eval(n.left)
                        right = _eval(n.right)
                        if isinstance(n.op, ast.Add): return left + right
                        if isinstance(n.op, ast.Sub): return left - right
                        if isinstance(n.op, ast.Mult): return left * right
                        if isinstance(n.op, ast.Div): return left / right
                        raise ValueError("不支持的运算符")
                    if isinstance(n, ast.UnaryOp):
                        val = _eval(n.operand)
                        if isinstance(n.op, ast.UAdd): return +val
                        if isinstance(n.op, ast.USub): return -val
                        raise ValueError("不支持的一元运算")
                    if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
                        return float(n.value)
                    if isinstance(n, ast.Num):
                        return float(n.n)
                    if isinstance(n, ast.Call):
                        raise ValueError("不允许函数调用")
                    if isinstance(n, ast.Name):
                        raise ValueError("不允许变量名")
                    raise ValueError("不支持的表达式")
                return _eval(node)

            # 从问题中提取可能的算式（选最长的一段）
            candidates = re.findall(r"[0-9\.\s\+\-\*\/\(\)%]+", q)
            expr = max(candidates, key=len) if candidates else ""
            def auto_math_calculator(text: str = "") -> float:
                target = expr or text
                return _safe_eval(target)

            return GeneratedSkill(
                name="AutoMathCalculator",
                description="自动从问题中提取算式并进行安全计算，支持百分比",
                fn=auto_math_calculator
            )

        return None
