"""Reference oracle for a bounded circular-array deque activity."""

from collections import deque


def deque_model(stdin: str) -> str:
    lines = stdin.splitlines()
    capacity = int(lines[0])
    if capacity < 1:
        raise ValueError("Deque fixtures require positive capacity")
    values: deque[int] = deque()
    output: list[str] = []
    for line in lines[1:]:
        tokens = line.split()
        if not tokens:
            continue
        operation = tokens[0]
        if operation in {"push_front", "push_back"} and len(tokens) == 2:
            if len(values) == capacity:
                output.append("full")
            else:
                value = int(tokens[1])
                (values.appendleft if operation == "push_front" else values.append)(value)
                output.append("ok")
        elif operation in {"pop_front", "pop_back"} and len(tokens) == 1:
            if not values:
                output.append("empty")
            else:
                output.append(str(values.popleft() if operation == "pop_front" else values.pop()))
        elif operation in {"front", "back"} and len(tokens) == 1:
            output.append(str(values[0] if operation == "front" else values[-1]) if values else "empty")
        elif operation == "size" and len(tokens) == 1:
            output.append(str(len(values)))
        else:
            raise ValueError("Unknown internal deque fixture operation")
    return "\n".join(output) + ("\n" if output else "")


ORACLE_ID = "cs03_deque"
OBJECTIVE = "CS03-M03-O05"
VISIBLE = (
    "3\npush_back 10\npush_back 20\npush_front 5\npop_back\npop_front\nfront\nback\nsize\n",
    "2\npop_front\npush_front -3\npush_back 7\npush_back 8\nback\npop_front\npush_back 7\nfront\nback\npop_back\nsize\n",
)
INDEPENDENT = (
    "1\npush_front 2\npush_back 3\npop_back\npop_front\n",
    "4\npush_back 1\npush_back 2\npop_front\npush_front -1\npush_back 3\npop_front\npop_back\nfront\nsize\n",
    "3\npop_back\npush_front 4\npush_front 4\npush_back -2\npop_front\npop_front\npop_back\npop_back\n",
    "2\npush_front -5\npush_back -5\nfront\nback\npop_back\npop_front\nsize\n",
)
