"""Deterministic teaching state machines for structured-trace activities.

Each machine replays a fixed, trusted operation sequence and emits the expected
snapshot after every step, so the checker can compare the student's predicted
state field by field. The conventions follow the CS03 stack/queue unit plan
(document/course-construction/UNIT_EXAMPLE_CS03_STACK.md):

* Stack: an array written bottom -> top, the right end is the top. ``push(x)``
  appends; ``pop`` removes and returns the right end. An empty ``pop`` keeps the
  stack empty, returns no value and reports ``underflow``. When a bounded stack
  is full, ``push`` reports ``full`` and leaves the state unchanged.
* Ring queue: fixed-capacity array with explicit ``head`` (next dequeue slot),
  ``tail`` (next enqueue slot) and ``size``; empty/full are distinguished by
  ``size``. Enqueue advances ``tail`` modulo capacity; dequeue advances ``head``
  modulo capacity (wrap-around). Failed operations never mutate the state.

Sentinel values such as EMPTY/FULL are represented by ``status`` rather than by
integers that could be confused with real data.
"""

from dataclasses import dataclass, field
from typing import Literal, Optional

OpStatus = Literal["ok", "underflow", "full"]


@dataclass(frozen=True)
class Operation:
    kind: str
    value: Optional[int] = None


@dataclass(frozen=True)
class StackSnapshot:
    """State after one stack operation."""

    items: tuple[int, ...]  # bottom -> top; right end is the top
    value: Optional[int]  # popped value; None for push or a failed operation
    status: OpStatus


@dataclass
class StackMachine:
    capacity: Optional[int] = None  # None means unbounded
    items: list[int] = field(default_factory=list)

    def step(self, operation: Operation) -> StackSnapshot:
        if operation.kind == "push":
            if operation.value is None:
                raise ValueError("push requires a value")
            if self.capacity is not None and len(self.items) >= self.capacity:
                return StackSnapshot(tuple(self.items), None, "full")
            self.items.append(operation.value)
            return StackSnapshot(tuple(self.items), None, "ok")
        if operation.kind == "pop":
            if not self.items:
                return StackSnapshot((), None, "underflow")
            value = self.items.pop()
            return StackSnapshot(tuple(self.items), value, "ok")
        raise ValueError(f"unknown stack operation: {operation.kind}")

    def run(self, operations: tuple[Operation, ...]) -> list[StackSnapshot]:
        return [self.step(operation) for operation in operations]


@dataclass(frozen=True)
class QueueSnapshot:
    """State after one ring-queue operation."""

    buffer: tuple[Optional[int], ...]  # physical slots, empty slot is None
    head: int  # index of the next element to dequeue
    tail: int  # index at which the next element will be enqueued
    size: int
    logical: tuple[int, ...]  # FIFO order starting at head
    value: Optional[int]  # dequeued value; None for enqueue or a failure
    status: OpStatus


@dataclass
class RingQueueMachine:
    capacity: int
    buffer: list[Optional[int]] = field(init=False)
    head: int = field(default=0, init=False)
    tail: int = field(default=0, init=False)
    size: int = field(default=0, init=False)

    def __post_init__(self) -> None:
        if self.capacity < 1:
            raise ValueError("ring queue capacity must be positive")
        self.buffer = [None] * self.capacity

    def logical_order(self) -> tuple[int, ...]:
        return tuple(
            self.buffer[(self.head + offset) % self.capacity]  # type: ignore[index]
            for offset in range(self.size)
        )

    def _snapshot(self, value: Optional[int], status: OpStatus) -> QueueSnapshot:
        return QueueSnapshot(
            tuple(self.buffer),
            self.head,
            self.tail,
            self.size,
            self.logical_order(),
            value,
            status,
        )

    def step(self, operation: Operation) -> QueueSnapshot:
        if operation.kind == "enqueue":
            if operation.value is None:
                raise ValueError("enqueue requires a value")
            if self.size == self.capacity:
                return self._snapshot(None, "full")
            self.buffer[self.tail] = operation.value
            self.tail = (self.tail + 1) % self.capacity
            self.size += 1
            return self._snapshot(None, "ok")
        if operation.kind == "dequeue":
            if self.size == 0:
                return self._snapshot(None, "underflow")
            value = self.buffer[self.head]
            self.buffer[self.head] = None
            self.head = (self.head + 1) % self.capacity
            self.size -= 1
            return self._snapshot(value, "ok")
        raise ValueError(f"unknown queue operation: {operation.kind}")

    def run(self, operations: tuple[Operation, ...]) -> list[QueueSnapshot]:
        return [self.step(operation) for operation in operations]


@dataclass(frozen=True)
class LinkedQueueSnapshot:
    """Logical state after one linked-queue operation.

    The singly linked representation (head/tail node pointers, resetting both
    to null when the last node is removed) is taught in the theory panel. The
    deterministic checker compares the observable logical front -> rear
    content, the dequeued value and the boundary status: pointer bookkeeping
    that produced a wrong logical order would fail exactly there, while C++
    memory diagnostics stay an isolated, separately-reviewed activity.
    """

    sequence: tuple[int, ...]  # front -> rear logical content
    value: Optional[int]  # dequeued value; None for enqueue or underflow
    status: OpStatus


@dataclass
class LinkedQueueMachine:
    """Unbounded FIFO queue backed conceptually by a head/tail linked chain."""

    sequence: list[int] = field(default_factory=list)

    def step(self, operation: Operation) -> LinkedQueueSnapshot:
        if operation.kind == "enqueue":
            if operation.value is None:
                raise ValueError("enqueue requires a value")
            self.sequence.append(operation.value)
            return LinkedQueueSnapshot(tuple(self.sequence), None, "ok")
        if operation.kind == "dequeue":
            if not self.sequence:
                return LinkedQueueSnapshot((), None, "underflow")
            value = self.sequence.pop(0)
            # Removing the only node resets both head and tail, so a later
            # enqueue starts a fresh chain that still dequeues in FIFO order.
            return LinkedQueueSnapshot(tuple(self.sequence), value, "ok")
        raise ValueError(f"unknown linked queue operation: {operation.kind}")

    def run(self, operations: tuple[Operation, ...]) -> list[LinkedQueueSnapshot]:
        return [self.step(operation) for operation in operations]
