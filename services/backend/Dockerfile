FROM python:3.13.16-slim-bookworm
WORKDIR /app
RUN pip install --no-cache-dir uv==0.12.22
COPY services/backend/pyproject.toml services/backend/uv.lock ./
COPY services/backend/src ./src
RUN uv sync --frozen --no-dev --no-managed-python
COPY services/backend/alembic.ini ./
COPY services/backend/migrations ./migrations
COPY content/courses ./content/courses
RUN groupadd --gid 10001 vault && useradd --uid 10001 --gid vault --no-create-home vault
USER vault
ENV VAULT_BIND_HOST=0.0.0.0
ENV VAULT_COURSE_CATALOG_PATH=/app/content/courses/catalog.json
EXPOSE 8000
CMD [".venv/bin/python", "-m", "vault_backend"]
