from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 应用配置
    APP_NAME: str = "智能教学平台"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # PostgreSQL数据库配置
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/education_db"
    # 异步数据库URL（用于asyncpg）
    ASYNC_DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/education_db"
    
    # 向量数据库配置（知识库）
    VECTOR_DB_PATH: str = "./data/chroma_db"
    PGVECTOR_ENABLED: bool = False  # 是否使用pgvector扩展
    
    # 安全配置
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS配置
    CORS_ORIGINS: list = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"

settings = Settings()
