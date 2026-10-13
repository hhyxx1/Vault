"""Versioned CS03 release data for heap-based priority queues."""

from __future__ import annotations

import heapq
from uuid import NAMESPACE_URL, uuid5

from vault_backend.course_checks import cs03_linear as _previous
from vault_backend.course_checks import cs03_chaining as _chaining
from vault_backend.course_checks import cs03_deque as _deque

COURSE_VERSION = str(uuid5(NAMESPACE_URL, "vault:CS03-core-practice-0.4.0"))
OBJECTIVE = "CS03-M03-O04"
ORACLE_ID = "cs03_priority_queue"


def activity_id(goal: str = OBJECTIVE) -> str:
    return str(uuid5(NAMESPACE_URL, "vault:" + goal + "-CODE:0.4.0"))


def priority_queue_model(stdin: str) -> str:
    """Evaluate the public priority-queue command protocol with a min-heap oracle."""
    values: list[int] = []
    output: list[str] = []
    for line in stdin.splitlines():
        tokens = line.split()
        if not tokens:
            continue
        operation = tokens[0]
        if operation == "push" and len(tokens) == 2:
            heapq.heappush(values, int(tokens[1]))
            output.append("ok")
        elif operation == "top" and len(tokens) == 1:
            output.append(str(values[0]) if values else "empty")
        elif operation == "pop" and len(tokens) == 1:
            output.append(str(heapq.heappop(values)) if values else "empty")
        elif operation == "size" and len(tokens) == 1:
            output.append(str(len(values)))
        else:
            raise ValueError("Unknown internal priority-queue fixture operation")
    return "\n".join(output) + ("\n" if output else "")


ORACLES = {
    **_previous.ORACLES,
    ORACLE_ID: priority_queue_model,
    _deque.ORACLE_ID: _deque.deque_model,
    _chaining.ORACLE_ID: _chaining.chaining_model,
}
INPUTS = {
    **_previous.INPUTS,
    ORACLE_ID: (
        (
            "push 7\npush 3\npush 9\ntop\npop\ntop\nsize\n",
            "top\npop\nsize\npush -4\npush 2\npush -4\ntop\npop\npop\nsize\n",
        ),
        (
            "push 8\npush 1\npush 6\npush 2\npush 5\npop\npush -3\ntop\npop\npop\npop\npop\n",
            "push 4\npush 4\npush 4\ntop\npop\nsize\npop\npop\npop\n",
            "size\ntop\npop\npush -1\ntop\npush -9\npop\npop\n",
            "push 11\npush -7\npush 5\npush 0\npop\npush -8\npop\npop\npop\npop\npop\n",
        ),
    ),
    _deque.ORACLE_ID: (_deque.VISIBLE, _deque.INDEPENDENT),
    _chaining.ORACLE_ID: (_chaining.VISIBLE, _chaining.INDEPENDENT),
}
GOALS = {
    **_previous.GOALS,
    OBJECTIVE: (ORACLE_ID, "min_heap"),
    _deque.OBJECTIVE: (_deque.ORACLE_ID, "circular_array_deque"),
    _chaining.OBJECTIVE: (_chaining.ORACLE_ID, "separate_chaining"),
}
COMPARATORS = {
    **_previous.COMPARATORS,
    ORACLE_ID: "exact",
    _deque.ORACLE_ID: "exact",
    _chaining.ORACLE_ID: "exact",
}
