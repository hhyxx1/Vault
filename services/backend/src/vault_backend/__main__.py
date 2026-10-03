import os

import uvicorn

uvicorn.run(
    "vault_backend.api:app",
    host=os.environ.get("VAULT_BIND_HOST", "127.0.0.1"),
    port=int(os.environ.get("VAULT_PORT", "8000")),
    workers=1,
    loop="vault_backend.runtime:loop_factory",
)
