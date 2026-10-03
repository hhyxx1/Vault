from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from vault_backend.config import Settings
from vault_backend.content import CourseRepository
from vault_backend.guests import GuestLeaseStore
from vault_backend.schemas import TraceSubmission


class Clock:
    def __init__(self):
        self.current = datetime(2026, 10, 3, tzinfo=UTC)

    def __call__(self):
        return self.current

    def advance(self, seconds):
        self.current += timedelta(seconds=seconds)


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def settings():
    return Settings(
        environment="test", database_url="", guest_idle_seconds=10, guest_absolute_seconds=30
    )


@pytest.fixture
def store(settings, clock):
    content = CourseRepository(settings.course_catalog_path)
    assert content.trace_context is not None, "Run tests from the repository with content/courses"
    return GuestLeaseStore(settings, clock, trace_context=content.trace_context)


@pytest.fixture
def trace_payload():
    return {
        "kind": "verify_trace",
        "course_code": "CS03",
        "activity_version": "CS03-STACK-01-TRACE@0.1.0",
        "standard_version": "stack-trace-v1",
        "client_artifact_id": str(uuid4()),
        "client_revision_id": str(uuid4()),
        "trace": [
            {"after_stack": [8], "output": None, "underflow": False},
            {"after_stack": [8, 3], "output": None, "underflow": False},
            {"after_stack": [8], "output": 3, "underflow": False},
            {"after_stack": [8, 5], "output": None, "underflow": False},
            {"after_stack": [8], "output": 5, "underflow": False},
            {"after_stack": [], "output": 8, "underflow": False},
            {"after_stack": [], "output": None, "underflow": True},
        ],
        "explanation": "后加入且未取出的元素先取出；空栈不改变并标记下溢。",
    }


@pytest.fixture
def submission(trace_payload):
    return TraceSubmission.model_validate(trace_payload)


def pytest_asyncio_loop_factories(config, item):
    import asyncio

    return {"selector": asyncio.SelectorEventLoop}
