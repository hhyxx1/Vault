"""Versioned CS03 core gaps closed in release 0.6.0."""

from __future__ import annotations

from uuid import NAMESPACE_URL, uuid5

from vault_backend.course_checks import cs03_union_find_radix as _previous
from vault_backend.course_checks.cs03_graphs import forest_contract

COURSE_VERSION = str(uuid5(NAMESPACE_URL, "vault:CS03-core-practice-0.6.0"))


def activity_id(goal: str) -> str:
    return str(uuid5(NAMESPACE_URL, "vault:" + goal + "-CODE:0.6.0"))


def binary_search_model(stdin: str) -> str:
    values = list(map(int, stdin.split()))
    if len(values) < 2:
        raise ValueError("Invalid binary-search fixture")
    n, q = values[:2]
    if n < 0 or q < 0 or len(values) != 2 + n + q:
        raise ValueError("Invalid binary-search fixture")
    array = values[2 : 2 + n]
    queries = values[2 + n :]
    if any(a > b for a, b in zip(array, array[1:], strict=False)):
        raise ValueError("Binary search requires a sorted array")
    output = []
    for target in queries:
        lo, hi = 0, n
        while lo < hi:
            mid = lo + (hi - lo) // 2
            if array[mid] < target:
                lo = mid + 1
            else:
                hi = mid
        output.append(str(lo if lo < n and array[lo] == target else -1))
    return "\n".join(output) + ("\n" if output else "")


def boyer_moore_model(stdin: str) -> str:
    lines = stdin.split("\n")
    text = lines[0] if lines else ""
    pattern = lines[1] if len(lines) > 1 else ""
    if pattern == "":
        return " ".join(map(str, range(len(text) + 1))) + "\n"
    positions = []
    start = 0
    while True:
        found = text.find(pattern, start)
        if found < 0:
            break
        positions.append(found)
        start = found + 1
    return (" ".join(map(str, positions)) if positions else "none") + "\n"


def quadratic_probing_model(stdin: str) -> str:
    capacity = 11  # prime; h(k,i) = (k mod 11 + i^2) mod 11
    empty = object()
    tombstone = object()
    table = [empty] * capacity
    size = 0
    output = []

    def locate(key: int, inserting: bool = False):
        first_tombstone = None
        home = key % capacity
        for step in range(capacity):
            slot = (home + step * step) % capacity
            value = table[slot]
            if value is empty:
                return False, first_tombstone if first_tombstone is not None else slot
            if value is tombstone:
                if first_tombstone is None:
                    first_tombstone = slot
            elif value == key:
                return True, slot
        return False, first_tombstone if inserting else None

    for line in stdin.splitlines():
        tokens = line.split()
        if not tokens:
            continue
        operation = tokens[0]
        if operation == "P":
            keys = sorted(value for value in table if value is not empty and value is not tombstone)
            output.append(" ".join(map(str, keys)) if keys else "empty")
            continue
        if operation == "V":
            keys = [value for value in table if value is not empty and value is not tombstone]
            output.append("valid" if len(keys) == size and len(set(keys)) == size else "invalid")
            continue
        if len(tokens) != 2:
            raise ValueError("Invalid internal quadratic-probing operation")
        key = int(tokens[1])
        found, slot = locate(key, inserting=operation == "I")
        if operation == "I":
            if found:
                output.append("exists")
            elif slot is None:
                output.append("full")
            else:
                table[slot] = key
                size += 1
                output.append("inserted")
        elif operation == "F":
            output.append("found" if found else "missing")
        elif operation == "D":
            output.append("deleted" if found else "missing")
            if found:
                table[slot] = tombstone
                size -= 1
        else:
            raise ValueError("Invalid internal quadratic-probing operation")
    return "\n".join(output) + ("\n" if output else "")


def prim_forest_model(stdin: str) -> str:
    """Kruskal/Prim independent forest contract, not a preferred edge list."""
    return forest_contract(stdin)


def floyd_warshall_model(stdin: str) -> str:
    """Bellman-Ford-per-source oracle, independent from the submitted Floyd loops."""
    values = list(map(int, stdin.split()))
    if len(values) < 2:
        raise ValueError("Invalid all-pairs fixture")
    n, m = values[:2]
    if n < 1 or m < 0 or len(values) != 2 + 3 * m:
        raise ValueError("Invalid all-pairs fixture")
    edges = [tuple(values[i : i + 3]) for i in range(2, len(values), 3)]
    if any(not 0 <= u < n or not 0 <= v < n for u, v, _ in edges):
        raise ValueError("Invalid all-pairs fixture")

    # A zero-weight super-source detects a negative cycle in any component.
    global_distance = [0] * n
    for iteration in range(n):
        changed = False
        for u, v, weight in edges:
            if global_distance[v] > global_distance[u] + weight:
                global_distance[v] = global_distance[u] + weight
                changed = True
        if not changed:
            break
        if iteration == n - 1:
            return "negative-cycle\n"

    rows = []
    for source in range(n):
        distance: list[int | None] = [None] * n
        distance[source] = 0
        for _ in range(n - 1):
            changed = False
            for u, v, weight in edges:
                if distance[u] is not None and (
                    distance[v] is None or distance[v] > distance[u] + weight
                ):
                    distance[v] = distance[u] + weight
                    changed = True
            if not changed:
                break
        rows.append(" ".join("INF" if value is None else str(value) for value in distance))
    return "\n".join(rows) + "\n"


def bucket_sort_model(stdin: str) -> str:
    values = [list(map(int, line.split())) for line in stdin.splitlines() if line.strip()]
    if not values or len(values[0]) != 2:
        raise ValueError("Invalid bucket-sort fixture")
    n, maximum = values[0]
    records = values[1:]
    if (
        n < 0
        or maximum < 0
        or len(records) != n
        or any(len(row) != 2 or not 0 <= row[0] <= maximum for row in records)
    ):
        raise ValueError("Bucket keys must be in the declared bounded domain")
    buckets: list[list[list[int]]] = [[] for _ in range(maximum + 1)]
    for record in records:
        buckets[record[0]].append(record)
    return "".join(f"{key} {tag}\n" for bucket in buckets for key, tag in bucket)


ORACLES = {
    **_previous.ORACLES,
    "cs03_binary_search": binary_search_model,
    "cs03_boyer_moore": boyer_moore_model,
    "cs03_quadratic_probing": quadratic_probing_model,
    "cs03_prim_forest": prim_forest_model,
    "cs03_floyd_warshall": floyd_warshall_model,
    "cs03_bucket_sort": bucket_sort_model,
}

GOALS = {
    **_previous.GOALS,
    "CS03-M02-O04": ("cs03_binary_search", "sorted_array_lower_bound"),
    "CS03-M04-O04": ("cs03_boyer_moore", "bad_character_and_good_suffix"),
    "CS03-M07-O05": ("cs03_prim_forest", "prim_minimum_spanning_forest"),
    "CS03-M08-O04": ("cs03_floyd_warshall", "floyd_all_pairs_shortest_path"),
    "CS03-M09-O05": ("cs03_quadratic_probing", "quadratic_probe_with_prime_capacity"),
    "CS03-M10-O05": ("cs03_bucket_sort", "stable_bounded_integer_bucket_sort"),
}

COMPARATORS = {
    **_previous.COMPARATORS,
    "cs03_binary_search": "exact",
    "cs03_boyer_moore": "exact",
    "cs03_quadratic_probing": "exact",
    "cs03_prim_forest": "minimum_forest",
    "cs03_floyd_warshall": "exact",
    "cs03_bucket_sort": "exact",
}

INPUTS = {
    **_previous.INPUTS,
    "cs03_binary_search": (
        (
            "6 5\n1 2 2 2 4 7\n2 0 3 8 1\n",
            "1 4\n-9\n-9 0 10 2147483647\n",
        ),
        (
            "0 2\n-4 9\n",
            "7 5\n5 5 5 5 5 5 5\n5 4 6 5 5\n",
            "5 4\n-2147483648 -1 0 1 2147483647\n2147483647 -2147483648 2 0\n",
        ),
    ),
    "cs03_boyer_moore": (
        ("ABABABA\nABA\n", "HERE IS A SIMPLE EXAMPLE\nEXAMPLE\n"),
        ("abc\n\n", "short\nlongpattern\n", "AAAAAA\nAAA\n", "MISSISSIPPI\nISSI\n"),
    ),
    "cs03_quadratic_probing": (
        (
            "I 0\nI 11\nI 22\nI 33\nI 44\nD 11\nF 22\nI 55\nP\nV\n",
            "I -1\nI 10\nI 21\nF 32\nI 32\nD -1\nI 43\nP\nV\n",
        ),
        (
            "I 0\nI 11\nI 22\nI 33\nI 44\nI 55\nI 66\n",
            "I 7\nI 7\nF 7\nD 7\nF 7\nI 18\nP\nV\n",
            "I -22\nI -11\nI 0\nI 11\nI 22\nD 0\nF 22\nI 33\nP\nV\n",
        ),
    ),
    "cs03_prim_forest": (
        (
            "4 5\n0 1 1\n1 2 2\n0 2 10\n2 3 3\n0 3 15\n",
            "5 4\n0 1 3\n1 2 -2\n3 4 7\n0 2 4\n",
        ),
        (
            "1 0\n",
            "5 3\n0 1 2\n1 2 2\n3 4 -1\n",
            "4 5\n0 1 9\n0 1 1\n1 2 2\n0 2 5\n2 3 0\n",
        ),
    ),
    "cs03_floyd_warshall": (
        ("4 4\n0 1 5\n0 2 10\n1 2 -4\n2 3 2\n", "3 3\n0 1 2\n0 1 1\n1 2 4\n"),
        (
            "4 2\n0 1 2\n2 3 -1\n",
            "2 0\n",
            "2 2\n0 1 -1\n1 0 -1\n",
        ),
    ),
    "cs03_bucket_sort": (
        (
            "6 5\n4 0\n0 1\n4 2\n2 3\n0 4\n4 5\n",
            "4 3\n3 0\n3 1\n0 2\n1 3\n",
        ),
        (
            "0 3\n",
            "5 1\n1 0\n0 1\n1 2\n0 3\n1 4\n",
            "4 9\n9 0\n0 1\n5 2\n9 3\n",
        ),
    ),
}
