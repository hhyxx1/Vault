FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 使用TUNA镜像源
RUN echo 'deb https://mirrors.tuna.tsinghua.edu.cn/debian/ trixie main contrib non-free' > /etc/apt/sources.list && \
    echo 'deb https://mirrors.tuna.tsinghua.edu.cn/debian/ trixie-updates main contrib non-free' >> /etc/apt/sources.list && \
    echo 'deb https://mirrors.tuna.tsinghua.edu.cn/debian-security/ trixie-security main contrib non-free' >> /etc/apt/sources.list

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 使用TUNA镜像源安装Python依赖
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 复制requirements.txt
COPY backend/requirements.txt /app/requirements.txt

# 安装完整后端依赖（包含 ChromaDB 与 sentence-transformers）
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app

EXPOSE 8000

# 使用单worker减少内存占用
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "*"]
