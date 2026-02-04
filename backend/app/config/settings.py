from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # 应用配置
    APP_NAME: str = "智能教学平台"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # PostgreSQL数据库配置
    DATABASE_URL: str = "postgresql+psycopg://postgres:123456@localhost:5432/app_project"
    # 异步数据库URL（用于asyncpg）
    ASYNC_DATABASE_URL: str = "postgresql+asyncpg://postgres:123456@localhost:5432/app_project"
    
    # 向量数据库配置（知识库）
    VECTOR_DB_PATH: str = "./data/chroma_db"
    PGVECTOR_ENABLED: bool = False  # 是否使用pgvector扩展
    
    # AI功能配置
    ENABLE_AI_FEATURES: bool = False  # 是否启用AI功能，如果遇到llama-index兼容性问题，可设为False
    
    # 安全配置
    SECRET_KEY: str = "your-secret-key-here-change-in-production-please-change-this-to-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # Token有效期：60分钟
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
