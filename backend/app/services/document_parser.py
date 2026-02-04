"""
Word文档解析服务
用于解析上传的Word文档，提取问卷题目
支持三种题型：选择题、判断题、解答题
支持灵活格式，无需严格格式要求，自动识别题目类型并排序
"""
from docx import Document
from typing import List, Dict, Any
import re


class DocumentParser:
    """Word文档解析器 - 支持灵活格式的智能解析"""
    
    @staticmethod
    def _is_question_indicator(text: str) -> bool:
        """
        判断是否是题目标识
        支持多种格式：
        - 1. 1、1） 1)
        - 第1题、题目1、问题1
        - 一、二、三、（但排除"一、单选题"这样的章节标题）
        """
        text = text.strip()
        if not text:
            return False
            
        # 排除章节标题（如：一、单选题、二、多选题等）
        section_keywords = ['单选题', '多选题', '判断题', '简答题', '问答题', '填空题', '选择题', '解答题']
        if any(keyword in text for keyword in section_keywords):
            return False
        
        patterns = [
            r'^\d+[.、）)\s]',  # 1. 1、 1) 1）或1后接空格
            r'^第\s*\d+\s*[题问]',  # 第1题、第1问
            r'^[题问题目]\s*\d+',  # 题1、问1、题目1
            r'^问题\s*\d+[.、：:]',  # 问题4. 问题4：
            r'^题目\s*\d+[.、：:]',  # 题目6： 题目6.
            r'^[一二三四五六七八九十]+[、.）)\s]',  # 一、二、三、
            r'^\(\d+\)',  # (1)
            r'^[\(（]\d+[\)）]',  # (1) （1）
        ]
        return any(re.match(pattern, text) for pattern in patterns)
    
    @staticmethod
    def _is_option_indicator(text: str) -> bool:
        """
        判断是否是选项标识
        支持多种格式：
        - A. A、 A） A)
        - (A) [A]
        - a. a、
        """
        patterns = [
            r'^[A-Za-z][.、）)\]]\s*',  # A. A、 A)
            r'^[\(（\[]\s*[A-Za-z]\s*[\)）\]]\s*',  # (A) [A]
        ]
        return any(re.match(pattern, text.strip()) for pattern in patterns)
    
    @staticmethod
    def _extract_question_text(text: str) -> str:
        """提取纯净的题目文本，移除题号"""
        # 移除各种题号格式
        patterns = [
            r'^\d+[.、）)]\s*',  # 1. 1、 1) 1）
            r'^第\s*\d+\s*[题问][：:：]\s*',  # 第1题： 第1题:
            r'^第\s*\d+\s*[题问]\s+',  # 第1题 (后接空格)
            r'^[题问]\s*\d+[：:]\s*',  # 题1： 问1:
            r'^问题\s*\d+[.、：:]\s*',  # 问题4. 问题4：
            r'^题目\s*\d+[.、：:]\s*',  # 题目6： 题目6.
            r'^[一二三四五六七八九十]+[、.）)]\s*',  # 一、 二、
        ]
        for pattern in patterns:
            text = re.sub(pattern, '', text.strip())
        return text.strip()
    
    @staticmethod
    def _extract_option_text(text: str) -> tuple:
        """提取选项标签和文本"""
        text = text.strip()
        
        # 尝试各种选项格式
        patterns = [
            (r'^([A-Za-z])[.、）)\]]\s*(.+)', 1, 2),  # A. 或 A、
            (r'^[\(（\[]\s*([A-Za-z])\s*[\)）\]]\s*(.+)', 1, 2),  # (A) 或 [A]
        ]
        
        for pattern, label_idx, text_idx in patterns:
            match = re.match(pattern, text)
            if match:
                return match.group(label_idx).upper(), match.group(text_idx).strip()
        
        # 如果不匹配任何格式，可能是纯文本选项（对/错）
        return None, text
    
    @staticmethod
    def _detect_question_type(question_text: str, options: List[Dict]) -> str:
        """
        智能检测题目类型
        
        Args:
            question_text: 问题文本
            options: 选项列表
            
        Returns:
            题目类型: single_choice(单选), multiple_choice(多选), judgment(判断), text(解答)
        """
        question_lower = question_text.lower()
        
        # 优先检测题目中的类型关键词
        if any(kw in question_text for kw in ['(多选)', '（多选）', '[多选]', '多项选择', '不定项']):
            return "multiple_choice"
        
        if any(kw in question_text for kw in ['(判断)', '（判断）', '[判断]', '判断题']):
            return "judgment"
        
        if any(kw in question_text for kw in ['(简答)', '（简答）', '[简答]', '简答题', '(问答)', '（问答）', '问答题']):
            return "text"
        
        # 如果有选项
        if len(options) > 0:
            # 检查是否为判断题（选项只有"对/错"、"正确/错误"、"√/×"等）
            if len(options) == 2:
                texts = [opt['text'].strip().lower() for opt in options]
                judgment_keywords = [
                    ['对', '错'], ['正确', '错误'], ['√', '×'], 
                    ['true', 'false'], ['t', 'f'], ['yes', 'no'],
                    ['对', '×'], ['√', '错'], ['是', '否']
                ]
                for keywords in judgment_keywords:
                    # 检查是否都包含判断关键词
                    if all(any(kw in text for kw in keywords) for text in texts):
                        return "judgment"
            
            # 多选题检测（题目中包含"多选"、"不定项"等关键词）
            multi_keywords = ['多选', '不定项', '多项', '选择正确的', '选择所有', '下列哪些', '以下哪些']
            if any(keyword in question_text for keyword in multi_keywords):
                return "multiple_choice"
            
            # 默认为单选题
            return "single_choice"
        
        # 无选项的题目
        # 判断题检测：题目末尾有（）或包含判断关键词
        if re.search(r'[（(]\s*[）)]$', question_text) or \
           any(keyword in question_text for keyword in ['判断', '是否正确', '是否错误', '对还是错', '正确吗', '错误吗']):
            return "judgment"
        
        # 默认为解答题
        return "text"
    
    @staticmethod
    def _extract_answer(text: str) -> tuple:
        """
        从文本中提取答案
        支持格式：
        - 答案：A （选择题/判断题）
        - 答案：ABC （多选题）
        - 答案：这是文本答案 （解答题）
        
        Returns:
            (is_answer_line, answer_content)
        """
        text = text.strip()
        
        # 答案关键词模式 - 增强匹配，捕获所有内容
        patterns = [
            r'^答案[：:]\s*(.+)',
            r'^正确答案[：:]\s*(.+)',
            r'^\[答案\]\s*(.+)',
            r'^（答案）\s*(.+)',
            r'^\(答案\)\s*(.+)',
            r'^\【答案\】\s*(.+)',
            r'^answer\s*[：:]\s*(.+)',
        ]
        
        for pattern in patterns:
            match = re.match(pattern, text, re.IGNORECASE)
            if match:
                answer_str = match.group(1).strip()
                
                # 判断是否是选择题答案（只包含字母和分隔符）
                if re.match(r'^[A-Za-z,、，\s]+$', answer_str):
                    # 清理答案字符串，移除空格和分隔符
                    answer_str = re.sub(r'[,、，\s]+', '', answer_str).upper()
                    return True, answer_str
                else:
                    # 解答题的文本答案，保持原样
                    return True, answer_str
        
        return False, None
    
    @staticmethod
    def _extract_score(text: str) -> tuple:
        """
        从文本中提取分数
        支持格式：
        - 分数：5
        - (分数：5)
        - [分数]5
        - 5分
        - score: 5
        
        Returns:
            (is_score_line, score_value)
        """
        text = text.strip()
        
        # 分数模式 - 增强匹配
        patterns = [
            r'^分数[：:]\s*(\d+(?:\.\d+)?)',
            r'^\[分数\]\s*(\d+(?:\.\d+)?)',
            r'^（分数[：:]?\s*(\d+(?:\.\d+)?)',
            r'^\(分数[：:]?\s*(\d+(?:\.\d+)?)',
            r'^【分数】\s*(\d+(?:\.\d+)?)',
            r'^(\d+(?:\.\d+)?)分$',
            r'^score\s*[：:]\s*(\d+(?:\.\d+)?)',
        ]
        
        for pattern in patterns:
            match = re.match(pattern, text, re.IGNORECASE)
            if match:
                score = float(match.group(1))
                return True, score
        
        return False, None
    
    @staticmethod
    def _extract_explanation(text: str) -> tuple:
        """
        从文本中识别并提取解析（答案解析）内容
        支持格式：
        - 解析：xxx
        - 答案解析：xxx
        - 【解析】xxx
        - （解析）xxx
        
        Returns:
            (is_explanation_line, explanation_content)
        """
        text = text.strip()
        patterns = [
            r'^解析[：:]\s*(.+)',
            r'^答案解析[：:]\s*(.+)',
            r'^【解析】\s*(.+)',
            r'^（解析）\s*(.+)',
            r'^\(解析\)\s*(.+)',
            r'^\[解析\]\s*(.+)',
        ]
        for pattern in patterns:
            match = re.match(pattern, text)
            if match:
                return True, match.group(1).strip()
        return False, None
    
    
    @staticmethod
    def parse_word(file_path: str) -> List[Dict[str, Any]]:
        """
        智能解析Word文档，提取问题
        
        特性：
        - 支持多种格式的题号（1. 1、 第1题 等）
        - 支持多种格式的选项（A. (A) 等）
        - 自动识别题目类型
        - 自动按类型排序（选择题->判断题->解答题）
        - 不要求严格格式
        
        Args:
            file_path: Word文档路径
            
        Returns:
            问题列表，自动按类型排序
        """
        try:
            doc = Document(file_path)
            questions = []
            
            current_question = None
            current_options = []
            current_answer = None
            current_score = 5.0  # 默认分数
            current_explanation = None  # 当前题目的解析（可为多行）
            collecting_explanation = False  # 是否正在收集解析多行
            option_counter = 0
            seen_answer_or_score = False  # 标记是否已经看到答案或分数（用于防止继续收集选项）
            
            for para in doc.paragraphs:
                text = para.text.strip()
                if not text:
                    continue
                
                # 检测答案行
                is_answer, answer_content = DocumentParser._extract_answer(text)
                if is_answer:
                    collecting_explanation = False
                    current_answer = answer_content
                    seen_answer_or_score = True  # 标记已经遇到答案，后续不再收集选项
                    continue
                
                # 检测分数行
                is_score, score_value = DocumentParser._extract_score(text)
                if is_score:
                    collecting_explanation = False
                    current_score = score_value
                    seen_answer_or_score = True  # 标记已经遇到分数，后续不再收集选项
                    continue
                
                # 检测解析行（答案解析，可选；支持多行直到下一题/答案/分数）
                is_explanation, explanation_content = DocumentParser._extract_explanation(text)
                if is_explanation and current_question:
                    current_explanation = explanation_content if explanation_content else ""
                    collecting_explanation = True
                    continue
                if collecting_explanation and current_question:
                    # 多行解析：当前行不是题目标识、选项，则追加到解析
                    _is_q = DocumentParser._is_question_indicator(text)
                    _is_opt = DocumentParser._is_option_indicator(text)
                    if not _is_q and not _is_opt:
                        current_explanation = (current_explanation or "") + "\n" + text
                        continue
                    collecting_explanation = False
                    # 否则 fall through 让下面按题目/选项处理
                
                # 检测是否是新题目
                is_question = DocumentParser._is_question_indicator(text)
                is_option = DocumentParser._is_option_indicator(text)
                
                if is_question:
                    # 保存上一个问题
                    if current_question:
                        question_type = DocumentParser._detect_question_type(
                            current_question, current_options
                        )
                        
                        # 如果是判断题但没有选项，自动添加对/错选项
                        if question_type == "judgment" and len(current_options) == 0:
                            current_options = [
                                {"label": "A", "text": "对"},
                                {"label": "B", "text": "错"}
                            ]
                        
                        # 处理答案格式
                        correct_answer = None
                        if current_answer:
                            if question_type == "multiple_choice":
                                # 多选题：答案是字母列表 ["A", "B"]
                                correct_answer = list(current_answer)
                            elif question_type in ["single_choice", "judgment"]:
                                # 单选题/判断题：答案是单个字母 "A"
                                correct_answer = current_answer[0] if current_answer else None
                            else:
                                # 解答题：答案是文本
                                correct_answer = current_answer
                        
                        expl = (current_explanation or "").strip() or None
                        questions.append({
                            "question": current_question,
                            "options": current_options,
                            "type": question_type,
                            "required": True,
                            "answer": correct_answer,
                            "score": current_score,
                            "explanation": expl
                        })
                    
                    # 开始新问题，重置所有状态
                    current_question = DocumentParser._extract_question_text(text)
                    current_options = []
                    current_answer = None
                    current_score = 5.0
                    current_explanation = None
                    collecting_explanation = False
                    option_counter = 0
                    seen_answer_or_score = False  # 重置标记
                    continue
                
                # 检测选项 - 只有在未遇到答案/分数时才收集选项
                if is_option and current_question and not seen_answer_or_score:
                    label, option_text = DocumentParser._extract_option_text(text)
                    
                    # 如果提取到标签就用，否则自动生成
                    if not label:
                        label = chr(65 + option_counter)
                    
                    current_options.append({
                        "label": label,
                        "text": option_text
                    })
                    option_counter += 1
                    continue
                
                # 检测判断题选项（直接是"对"/"错"等，没有A.B.标记）- 只有在未遇到答案/分数时才收集
                if current_question and not is_question and not seen_answer_or_score:
                    judgment_match = re.match(r'^(对|错|正确|错误|√|×|T|F|true|false|是|否)$', text, re.IGNORECASE)
                    if judgment_match and len(current_options) < 2:
                        label = chr(65 + option_counter)
                        current_options.append({
                            "label": label,
                            "text": judgment_match.group(1)
                        })
                        option_counter += 1
                        continue
                
                # 如果不是题目也不是选项，可能是问题的延续（多行题目）
                # 但如果已经遇到答案/分数，就不再追加了
                if current_question and not is_question and not is_option and not seen_answer_or_score:
                    # 如果已经有选项了，就不再追加到问题中
                    if len(current_options) == 0:
                        current_question += " " + text
            
            # 添加最后一个问题
            if current_question:
                question_type = DocumentParser._detect_question_type(
                    current_question, current_options
                )
                
                # 如果是判断题但没有选项，自动添加对/错选项
                if question_type == "judgment" and len(current_options) == 0:
                    current_options = [
                        {"label": "A", "text": "对"},
                        {"label": "B", "text": "错"}
                    ]
                
                # 处理答案格式
                correct_answer = None
                if current_answer:
                    if question_type == "multiple_choice":
                        correct_answer = list(current_answer)
                    elif question_type in ["single_choice", "judgment"]:
                        correct_answer = current_answer[0] if current_answer else None
                    else:
                        correct_answer = current_answer
                
                expl_last = (current_explanation or "").strip() or None
                questions.append({
                    "question": current_question,
                    "options": current_options,
                    "type": question_type,
                    "required": True,
                    "answer": correct_answer,
                    "score": current_score,
                    "explanation": expl_last
                })
            
            # 自动排序：单选题 -> 多选题 -> 判断题 -> 解答题
            type_order = {
                "single_choice": 1,
                "multiple_choice": 2,
                "judgment": 3,
                "text": 4
            }
            
            questions.sort(key=lambda q: type_order.get(q.get("type", "text"), 4))
            
            # 重新分配ID
            for idx, q in enumerate(questions, 1):
                q["id"] = f"q_{idx}"
            
            return questions
            
        except Exception as e:
            raise Exception(f"Word文档解析失败: {str(e)}")
    
    @staticmethod
    def validate_questions(questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        验证解析的问题格式
        
        Returns:
            验证结果，包含 is_valid 和 errors
        """
        errors = []
        warnings = []
        
        if not questions:
            errors.append("未找到任何问题")
        
        type_counts = {
            "single_choice": 0,
            "multiple_choice": 0,
            "judgment": 0,
            "text": 0
        }
        
        for i, q in enumerate(questions, 1):
            question_type = q.get("type", "text")
            type_counts[question_type] = type_counts.get(question_type, 0) + 1
            
            if not q.get("question"):
                errors.append(f"第{i}题缺少问题内容")
            
            # 选择题验证
            if question_type in ["single_choice", "multiple_choice"]:
                if len(q.get("options", [])) < 2:
                    errors.append(f"第{i}题选择题选项少于2个")
                elif len(q.get("options", [])) > 10:
                    warnings.append(f"第{i}题选项过多（{len(q['options'])}个），建议不超过10个")
            
            # 判断题验证
            elif question_type == "judgment":
                if len(q.get("options", [])) != 2:
                    warnings.append(f"第{i}题判断题应该有2个选项（对/错）")
            
            # 解答题验证
            elif question_type == "text":
                if len(q.get("options", [])) > 0:
                    warnings.append(f"第{i}题解答题不应该有选项")
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "question_count": len(questions),
            "type_statistics": type_counts
        }


# 创建全局实例
doc_parser = DocumentParser()
