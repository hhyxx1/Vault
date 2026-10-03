from typing import Any


class ApiError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        *,
        retryable: bool = False,
        details: dict[str, Any] | None = None,
    ):
        self.status, self.code, self.message = status, code, message
        self.retryable, self.details = retryable, details or {}
        super().__init__(code)
