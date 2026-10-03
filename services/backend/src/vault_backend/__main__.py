import asyncio
import os
import sys

import uvicorn

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

uvicorn.run(
    "vault_backend.api:app",
    host=os.environ.get("VAULT_BIND_HOST", "127.0.0.1"),
    port=int(os.environ.get("VAULT_PORT", "8000")),
    workers=1,
)
