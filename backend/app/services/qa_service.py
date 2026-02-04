from typing import List, Optional, Dict, Any
import json
import uuid
import os
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.qa import QARecord

class QAService:
    """问答服务 - 基于 DeepSeek API（临时使用模拟数据）"""
    
    def __init__(self):
        # DeepSeek API配置
        self.api_key = "sk-11fe906e92c84e0f95c9f04ae6ed1565"
        self.base_url = "https://api.deepseek.com/v1"
        self.model_name = "deepseek-chat"
        
        # 尝试初始化OpenAI客户端（兼容DeepSeek）
        try:
            from openai import OpenAI
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )
            self.client_available = True
        except Exception as e:
            print(f"⚠️  无法初始化OpenAI客户端: {e}")
            self.client_available = False
    
    async def create_qa_record(
        self, 
        db: Session, 
        student_id: str, 
        question: str, 
        answer: str,
        course_id: Optional[str] = None,
        sources: Optional[List[Dict]] = None
    ) -> QARecord:
        """
        创建问答记录
        """
        try:
            # 转换 sources 为 JSON 格式
            knowledge_sources = sources if sources else []
            
            db_record = QARecord(
                student_id=student_id,
                course_id=course_id,
                question=question,
                answer=answer,
                answer_type="ai",
                knowledge_sources=knowledge_sources,
                # 其他字段使用默认值
            )
            db.add(db_record)
            db.commit()
            db.refresh(db_record)
            return db_record
        except Exception as e:
            print(f"创建问答记录失败: {e}")
            db.rollback()
            return None
    
    async def get_student_history(
        self, 
        db: Session, 
        student_id: str, 
        limit: int = 20
    ) -> List[QARecord]:
        """
        获取学生的问答历史
        """
        return db.query(QARecord)\
            .filter(QARecord.student_id == student_id)\
            .order_by(desc(QARecord.created_at))\
            .limit(limit)\
            .all()
    
    async def get_ai_answer(
        self, 
        question: str, 
        course_id: Optional[str] = None, 
        history: List[dict] = None
    ) -> Dict[str, Any]:
        """
        调用 DeepSeek API 获取答案
        """
        try:
            # 如果OpenAI客户端可用，尝试调用DeepSeek API
            if self.client_available:
                try:
                    # 1. 准备系统提示词
                    system_prompt = (
                        "你是一个智能教学助手。你的目标是帮助学生解答问题。\n"
                        "1. 回答要亲切、准确、有条理。\n"
                        "2. 请基于你的知识回答问题。\n"
                        "3. 如果问题涉及编程、数学或其他技术问题，请提供详细的解释和示例。\n"
                    )
                    
                    # 2. 准备对话历史
                    messages = [{"role": "system", "content": system_prompt}]
                    
                    # 添加历史对话
                    if history:
                        for msg in history:
                            messages.append({
                                "role": msg['role'],
                                "content": msg['content']
                            })
                    
                    # 添加当前问题
                    messages.append({
                        "role": "user",
                        "content": question
                    })
                    
                    # 3. 调用 DeepSeek API
                    response = self.client.chat.completions.create(
                        model=self.model_name,
                        messages=messages,
                        temperature=0.7,
                        max_tokens=2000
                    )
                    
                    # 4. 提取答案
                    answer = response.choices[0].message.content

                    return {
                        "answer": answer,
                        "sources": []
                    }
                except Exception as e:
                    print(f"调用DeepSeek API失败: {e}")
                    # 如果API调用失败，使用模拟数据
                    return self._get_mock_answer(question)
            else:
                # 如果OpenAI客户端不可用，使用模拟数据
                return self._get_mock_answer(question)
            
        except Exception as e:
            print(f"AI 回答生成失败: {e}")
            import traceback
            traceback.print_exc()
            return {
                "answer": "抱歉，我现在无法回答您的问题，请稍后再试。",
                "sources": []
            }
    
    def _get_mock_answer(self, question: str) -> Dict[str, Any]:
        """
        生成模拟答案
        """
        # 根据问题内容生成不同的回答
        question_lower = question.lower()
        
        if "python" in question_lower:
            answer = (
                "Python是一种高级编程语言，由Guido van Rossum于1991年首次发布。\n\n"
                "Python的特点包括：\n"
                "1. 语法简洁易读\n"
                "2. 支持多种编程范式（面向对象、函数式、过程式）\n"
                "3. 丰富的标准库和第三方库\n"
                "4. 跨平台支持\n\n"
                "Python广泛应用于Web开发、数据分析、人工智能、自动化脚本等领域。\n\n"
                "示例代码：\n"
                "```python\n"
                "print('Hello, World!')\n"
                "```"
            )
        elif "java" in question_lower:
            answer = (
                "Java是一种面向对象的编程语言，由Sun Microsystems（现为Oracle）于1995年发布。\n\n"
                "Java的特点包括：\n"
                "1. 跨平台（一次编写，到处运行）\n"
                "2. 面向对象\n"
                "3. 自动内存管理（垃圾回收）\n"
                "4. 强大的生态系统\n\n"
                "Java广泛应用于企业级应用、Android开发、大数据处理等领域。\n\n"
                "示例代码：\n"
                "```java\n"
                "public class HelloWorld {\n"
                "    public static void main(String[] args) {\n"
                "        System.out.println(\"Hello, World!\");\n"
                "    }\n"
                "}\n"
                "```"
            )
        elif "javascript" in question_lower:
            answer = (
                "JavaScript是一种脚本语言，最初由Netscape的Brendan Eich于1995年创建。\n\n"
                "JavaScript的特点包括：\n"
                "1. 动态类型\n"
                "2. 事件驱动\n"
                "3. 函数式编程支持\n"
                "4. 广泛的浏览器支持\n\n"
                "JavaScript主要用于Web前端开发，也可以用于后端（Node.js）和移动应用开发。\n\n"
                "示例代码：\n"
                "```javascript\n"
                "console.log('Hello, World!');\n"
                "```"
            )
        else:
            answer = (
                f"感谢您的问题：\"{question}\"\n\n"
                "我是一个智能教学助手，可以帮助您解答各种问题，包括：\n"
                "1. 编程语言（Python、Java、JavaScript等）\n"
                "2. 算法和数据结构\n"
                "3. 软件开发\n"
                "4. 其他技术问题\n\n"
                "请提供更多详细信息，我会尽力为您提供准确的答案。"
            )
        
        return {
            "answer": answer,
            "sources": []
        }

qa_service = QAService()