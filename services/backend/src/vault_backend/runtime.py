import asyncio
import sys

from uvicorn.loops.auto import auto_loop_factory


def loop_factory() -> asyncio.AbstractEventLoop:
    # Uvicorn 0.36+ creates its own loop and ignores the old Windows policy.
    # A custom Uvicorn factory returns the loop instance, not another factory.
    # psycopg async connections require Selector rather than Proactor on Windows.
    if sys.platform == "win32":
        return asyncio.SelectorEventLoop()
    return auto_loop_factory(use_subprocess=False)()
