from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config.settings import settings
import os

# 设置环境变量强制UTF-8编码，解决PostgreSQL路径中文问题
os.environ['PGCLIENTENCODING'] = 'UTF8'
os.environ.setdefault('LANG', 'en_US.UTF-8')
os.environ.setdefault('LC_ALL', 'en_US.UTF-8')

# 创建数据库引擎
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=settings.DEBUG,
    connect_args={
        'client_encoding': 'utf8',
        'options': '-c client_encoding=utf8'
    }
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基类
Base = declarative_base()

# 依赖注入：获取数据库会话
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
