"""
AI服务 - 统一的AI调用接口
支持DeepSeek API
"""

from openai import OpenAI, AsyncOpenAI
from typing import Optional
import asyncio
import time
import httpx


class AIService:
    """AI服务 - 统一的AI调用接口"""
    
    def __init__(self):
        """初始化AI服务"""
        # DeepSeek API配置
        self.api_key = "sk-11fe906e92c84e0f95c9f04ae6ed1565"
        self.base_url = "https://api.deepseek.com/v1"
        self.model_name = "deepseek-chat"
        self.max_retries = 3  # 最大重试次数
        self.retry_delay = 2  # 重试延迟(秒)
        
        # 超时配置：连接5秒，读取25秒
        api_timeout = httpx.Timeout(30.0, connect=5.0, read=25.0)
        
        # 初始化OpenAI客户端（兼容DeepSeek）
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=api_timeout
        )
        
        # 初始化异步客户端
        self.async_client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=api_timeout
        )
    
    async def generate_content(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 4000,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None
    ) -> str:
        """
        生成AI内容
        
        Args:
            prompt: 提示文本
            temperature: 温度参数（0-1）
            max_tokens: 最大token数
            timeout: 单次请求超时秒数（None则使用客户端默认值）
            max_retries: 最大重试次数（None则使用默认值）
            
        Returns:
            AI生成的文本
        """
        extra_kwargs = {}
        if timeout is not None:
            extra_kwargs["timeout"] = httpx.Timeout(timeout, connect=10.0)
        
        retries = max_retries if max_retries is not None else self.max_retries
        for attempt in range(retries):
            try:
                response = await self.async_client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "user", "content": prompt}
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **extra_kwargs
                )
                
                return response.choices[0].message.content
                
            except Exception as e:
                if attempt < retries - 1:
                    print(f"⚠️ AI调用失败,第{attempt + 1}次重试: {e}")
                    await asyncio.sleep(self.retry_delay)
                else:
                    raise Exception(f"调用DeepSeek API失败(已重试{retries}次): {str(e)}")
    
    async def chat(
        self,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 4000,
        timeout: Optional[float] = None
    ) -> str:
        """
        对话模式
        
        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}]
            temperature: 温度参数（0-1）
            max_tokens: 最大token数
            timeout: 单次请求超时秒数（None则使用客户端默认值）
            
        Returns:
            AI生成的文本
        """
        extra_kwargs = {}
        if timeout is not None:
            extra_kwargs["timeout"] = httpx.Timeout(timeout, connect=10.0)
        
        for attempt in range(self.max_retries):
            try:
                response = await self.async_client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **extra_kwargs
                )
                
                return response.choices[0].message.content
                
            except Exception as e:
                if attempt < self.max_retries - 1:
                    print(f"⚠️ AI调用失败,第{attempt + 1}次重试: {e}")
                    await asyncio.sleep(self.retry_delay)
                else:
                    raise Exception(f"调用DeepSeek API失败(已重试{self.max_retries}次): {str(e)}")


# 创建全局实例
ai_service = AIService()


# 便捷函数
async def get_ai_response(prompt: str, temperature: float = 0.7, max_tokens: int = 4000, timeout: Optional[float] = None, max_retries: Optional[int] = None) -> str:
    """
    便捷函数：获取AI响应
    
    Args:
        prompt: 提示文本
        temperature: 温度参数
        max_tokens: 最大token数
        timeout: 单次请求超时秒数（None则使用客户端默认值）
        max_retries: 最大重试次数（None则使用默认值）
        
    Returns:
        AI生成的文本
    """
    return await ai_service.generate_content(prompt, temperature, max_tokens, timeout, max_retries)
