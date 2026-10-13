"""Pure ADT contracts, independent of C++ student representations.

The suite checks finite operation transcripts, not pointer layout or asymptotic
complexity proofs. Those require the frozen-work human review.
"""

from collections import deque
from uuid import NAMESPACE_URL, uuid5

COURSE_VERSION = str(uuid5(NAMESPACE_URL, "vault:CS03-core-practice-0.3.0"))


def list_model(stdin: str) -> str:
    lines = stdin.splitlines()
    capacity = int(lines[0])
    values: list[int] = []
    out = []
    for line in lines[1:]:
        tokens = line.split()
        if not tokens:
            continue
        op = tokens[0]
        if op in {"P", "R"}:
            row = values if op == "P" else values[::-1]
            out.append(" ".join(map(str, row)) if row else "empty")
        elif op == "V":
            out.append("valid")
        else:
            i = int(tokens[1])
            if op == "I":
                if not 0 <= i <= len(values):
                    out.append("invalid")
                elif len(values) == capacity:
                    out.append("full")
                else:
                    values.insert(i, int(tokens[2]))
                    out.append("ok")
            elif not 0 <= i < len(values):
                out.append("invalid")
            elif op == "D":
                out.append(str(values.pop(i)))
            elif op == "G":
                out.append(str(values[i]))
            elif op == "S":
                values[i] = int(tokens[2])
                out.append("ok")
            else:
                raise ValueError("Unknown internal list fixture operation")
    return "\n".join(out) + "\n"


def _container(stdin: str, *, stack: bool) -> str:
    lines = stdin.splitlines()
    cap = int(lines[0])
    values: deque[int] = deque()
    out = []
    for line in lines[1:]:
        tokens = line.split()
        if not tokens:
            continue
        op = tokens[0]
        if op == "push":
            if len(values) == cap:
                out.append("full")
            else:
                values.append(int(tokens[1]))
                out.append("ok")
        elif op == "size":
            out.append(str(len(values)))
        elif op in {"pop", "peek"}:
            if not values:
                out.append("empty")
            elif op == "peek":
                out.append(str(values[-1] if stack else values[0]))
            else:
                out.append(str(values.pop() if stack else values.popleft()))
        else:
            raise ValueError("Unknown internal stack/queue fixture operation")
    return "\n".join(out) + "\n"


def stack_model(stdin: str) -> str:
    return _container(stdin, stack=True)


def queue_model(stdin: str) -> str:
    return _container(stdin, stack=False)


def brackets_model(stdin: str) -> str:
    results = []
    pairs = {")": "(", "]": "[", "}": "{"}
    for line in stdin.splitlines():
        stack = []
        valid = True
        for char in line:
            if char in "([{":
                stack.append(char)
            elif char in pairs:
                if not stack or stack.pop() != pairs[char]:
                    valid = False
                    break
        results.append("balanced" if valid and not stack else "unbalanced")
    return "\n".join(results) + "\n"


def cost_model(stdin: str) -> str:
    results = []
    for line in stdin.splitlines():
        n, i = map(int, line.split())
        if n < 0 or i < 0 or i > n:
            results.append("invalid")
        else:
            get = f"1,{i + 1}" if i < n else "invalid"
            delete = str(n - i - 1) if i < n else "invalid"
            results.append(f"get={get} insert={n - i} delete={delete}")
    return "\n".join(results) + "\n"


ORACLES = {
    "cs03_list": list_model,
    "cs03_stack": stack_model,
    "cs03_queue": queue_model,
    "cs03_brackets": brackets_model,
    "cs03_cost": cost_model,
}

# Author-defined internal fixtures. Never serialize independent inputs to clients.
INPUTS = {
    "cs03_list": (
        (
            "3\nI 0 10\nI 1 20\nI 1 15\nP\nD 1\nP\nV\n",
            "2\nD 0\nI 0 -5\nI 1 7\nI 2 8\nR\nS 0 9\nG 0\nV\n",
        ),
        (
            "1\nI 0 91\nD 0\nI 0 -32\nG 0\nP\nV\n",
            "4\nI 0 2\nI 0 2\nI 1 -4\nD 2\nI 2 8\nR\nV\n",
            "3\nI -1 2\nI 1 3\nD 0\nS 0 8\nI 0 17\nD 0\nP\nV\n",
        ),
    ),
    "cs03_stack": (
        (
            "2\npush 10\npush 20\npush 30\npeek\npop\npop\npop\nsize\n",
            "1\npop\npush -3\npop\npush 7\npeek\nsize\n",
        ),
        (
            "3\npush -8\npush 0\npush 31\npop\npush 4\npop\npop\npop\n",
            "1\npush 88\npush 44\npop\npop\n",
            "4\nsize\npeek\npush 6\npop\npush 9\npeek\n",
        ),
    ),
    "cs03_queue": (
        (
            "2\npush 10\npush 20\npush 30\npop\npush 40\npeek\npop\npop\npop\n",
            "1\npush -5\npop\npush 8\npeek\npop\nsize\n",
        ),
        (
            "3\npush 91\npush -2\npush 73\npop\npush 42\npop\npush 8\npop\npop\npop\n",
            "2\npop\npush 101\npop\npush 202\npop\npop\npush 303\npeek\n",
            "1\npush 27\npush 28\nsize\npop\npush -49\npop\nsize\n",
        ),
    ),
    "cs03_brackets": (
        ("([]){}\n([)]\n", "a(b[c]{d})\n\n]a\n"),
        ("{[a+(b*c)]}\n({)}\n", "(((())))\n((((\n", "x)y\n{}[]()\n"),
    ),
    "cs03_cost": (
        ("4 0\n4 3\n", "0 0\n4 4\n4 -1\n"),
        ("17 9\n", "32 0\n32 31\n", "1 0\n1 1\n1 2\n"),
    ),
}
GOALS = {
    "CS03-M01-O01": ("cs03_list", "array"),
    "CS03-M01-O02": ("cs03_list", "dual"),
    "CS03-M01-O03": ("cs03_cost", "cost"),
    "CS03-M02-O01": ("cs03_list", "array"),
    "CS03-M02-O02": ("cs03_list", "singly"),
    "CS03-M02-O03": ("cs03_list", "circular"),
    "CS03-M03-O01": ("cs03_stack", "stack"),
    "CS03-M03-O02": ("cs03_queue", "queue"),
    "CS03-M03-O03": ("cs03_brackets", "brackets"),
}


def activity_id(goal: str) -> str:
    return str(uuid5(NAMESPACE_URL, "vault:" + goal + "-CODE:0.3.0"))


from vault_backend.course_checks import cs03_strings as _strings  # noqa: E402

ORACLES.update(_strings.ORACLES)
INPUTS.update(_strings.INPUTS)
GOALS.update(_strings.GOALS)

from vault_backend.course_checks import cs03_huffman as _huffman  # noqa: E402

ORACLES.update(_huffman.ORACLES)
INPUTS.update(_huffman.INPUTS)
GOALS.update(_huffman.GOALS)

from vault_backend.course_checks import cs03_trees as _trees  # noqa: E402

ORACLES.update(_trees.ORACLES)
INPUTS.update(_trees.INPUTS)
GOALS.update(_trees.GOALS)

from vault_backend.course_checks import cs03_search_trees as _search  # noqa: E402

ORACLES.update(_search.ORACLES)
INPUTS.update(_search.INPUTS)
GOALS.update(_search.GOALS)

from vault_backend.course_checks import cs03_graphs as _graphs  # noqa: E402

ORACLES.update(_graphs.ORACLES)
INPUTS.update(_graphs.INPUTS)
GOALS.update(_graphs.GOALS)
COMPARATORS = {"cs03_huffman": "huffman_codebook", "cs03_topology": "topological_order"}

from vault_backend.course_checks import cs03_hash_sort as _hash_sort  # noqa: E402

ORACLES.update(_hash_sort.ORACLES)
INPUTS.update(_hash_sort.INPUTS)
GOALS.update(_hash_sort.GOALS)
COMPARATORS.update(_hash_sort.COMPARATORS)

COMPARATORS.update(_graphs.COMPARATORS)
