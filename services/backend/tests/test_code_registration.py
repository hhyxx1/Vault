import importlib.util
from pathlib import Path

import pytest


def module():
    path = Path(__file__).resolve().parents[3] / "tools/curriculum/register_code_book.py"
    spec = importlib.util.spec_from_file_location("registration", path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def row(task="base", output="ok\n"):
    return {
        "id": "goal/" + task + "/repaired",
        "version": "version",
        "goal": "goal",
        "activity": "activity",
        "task": task,
        "request": {"stdin": "1\n"},
        "stdout": output,
        "decision": "met",
    }


def test_register_is_append_only_and_does_not_mutate_input():
    register = module().register_rows
    initial = {}
    first = register(initial, [row()])
    assert initial == {}
    assert register(first, [row()]) == first
    with pytest.raises(ValueError, match="immutable"):
        register(first, [row(output="changed\n")])
    with pytest.raises(ValueError, match="immutable"):
        register(first, [row(), row("new-task")])


def test_register_rejects_conflicting_authored_conditions():
    with pytest.raises(ValueError, match="Conflicting"):
        module().register_rows({}, [row(), row(output="other\n")])
