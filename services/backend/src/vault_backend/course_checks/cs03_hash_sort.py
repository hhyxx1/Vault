"""Hash probing and record-preserving sorting/project reference contracts."""

import json
from collections import Counter, deque


def hash_model(stdin):
    lines = stdin.splitlines()
    capacity = int(lines[0])
    table = [None] * capacity
    tomb = object()
    probes = 0
    size = 0
    out = []

    def locate(key, insert=False):
        nonlocal probes
        first_tomb = None
        for step in range(capacity):
            i = (key % capacity + step) % capacity
            probes += 1
            if table[i] is None:
                return (False, first_tomb if first_tomb is not None else i)
            if table[i] is tomb:
                if first_tomb is None:
                    first_tomb = i
            elif table[i] == key:
                return True, i
        return False, first_tomb

    for line in lines[1:]:
        tokens = line.split()
        if not tokens:
            continue
        op = tokens[0]
        if op == "P":
            keys = sorted(x for x in table if x is not None and x is not tomb)
            out.append(" ".join(map(str, keys)) if keys else "empty")
        elif op == "C":
            out.append(f"size={size} capacity={capacity} probes={probes}")
        elif op == "V":
            out.append("valid")
        elif op == "R":
            new_capacity = int(tokens[1])
            if new_capacity < size or new_capacity < 1:
                out.append("invalid")
                continue
            keys = sorted(x for x in table if x is not None and x is not tomb)
            capacity = new_capacity
            table = [None] * capacity
            for key in keys:
                _, slot = locate(key, True)
                table[slot] = key
            out.append("rehash")
        else:
            key = int(tokens[1])
            found, slot = locate(key, op == "I")
            if op == "I":
                if found:
                    out.append("exists")
                elif slot is None:
                    out.append("full")
                else:
                    table[slot] = key
                    size += 1
                    out.append("inserted")
            elif op == "F":
                out.append("found" if found else "missing")
            elif op == "D":
                out.append("deleted" if found else "missing")
                if found:
                    table[slot] = tomb
                    size -= 1
            else:
                raise ValueError("Invalid trusted hash operation")
    return "\n".join(out) + "\n"


def sort_model(stdin):
    lines = stdin.splitlines()
    algorithm = lines[0]
    n = int(lines[1])
    records = [list(map(int, row.split())) for row in lines[2:]]
    if len(records) != n:
        raise ValueError("Invalid trusted sort fixture")
    return json.dumps({"records": records, "stable": algorithm in {"insertion", "bubble", "merge"}})


def _valid_records(original, observed, stable):
    if not isinstance(observed, list) or any(
        not isinstance(row, list) or len(row) != 2 or any(type(x) is not int for x in row)
        for row in observed
    ):
        return False
    if Counter(map(tuple, original)) != Counter(map(tuple, observed)):
        return False
    if any(a[0] > b[0] for a, b in zip(observed, observed[1:], strict=False)):
        return False
    return not stable or observed == sorted(original, key=lambda row: row[0])


def compare_sorted(expected, observed):
    try:
        model = json.loads(expected)
        work = json.loads(observed)
        if not isinstance(work, dict) or set(work) != {"records", "comparisons", "moves"}:
            return False
        if any(
            type(work[key]) is not int or not 0 <= work[key] <= 1_000_000
            for key in ("comparisons", "moves")
        ):
            return False
        return _valid_records(model["records"], work["records"], model["stable"])
    except (ValueError, TypeError, KeyError, RecursionError):
        return False


def external_model(stdin):
    lines = stdin.splitlines()
    if lines[0] == "EXTERNAL":
        n, block = map(int, lines[1].split())
        records = [list(map(int, row.split())) for row in lines[2:]]
        if n != len(records) or block < 2:
            raise ValueError("Invalid external-sort fixture")
        runs = (n + block - 1) // block
        passes = 0
        while runs > 1:
            runs = (runs + 1) // 2
            passes += 1
        peak = max(min(n, block), 2 if n > block else 0)
        return json.dumps(
            {
                "kind": "external",
                "records": records,
                "block": block,
                "n": n,
                "passes": passes,
                "peak": peak,
            }
        )
    if lines[0] != "CATALOG":
        raise ValueError("Invalid project mode")
    n, m = map(int, lines[1].split())
    rows = [row.split() for row in lines[2 : 2 + n]]
    edges = [list(map(int, row.split())) for row in lines[2 + n : 2 + n + m]]
    query = lines[2 + n + m]
    source, target = map(int, lines[3 + n + m].split())
    return json.dumps(
        {
            "kind": "catalog",
            "rows": rows,
            "edges": edges,
            "query": query,
            "source": source,
            "target": target,
        }
    )


def compare_project(expected, observed):
    try:
        model = json.loads(expected)
        work = json.loads(observed)
        if not isinstance(work, dict):
            return False
        if model["kind"] == "external":
            if set(work) != {"records", "peak", "passes"}:
                return False
            return (
                type(work["peak"]) is int
                and type(work["passes"]) is int
                and work["peak"] == model["peak"]
                and work["passes"] == model["passes"]
                and _valid_records(model["records"], work["records"], True)
            )
        if set(work) != {"matches", "path", "file_roundtrip"} or work["file_roundtrip"] is not True:
            return False
        matches = sorted(int(row[0]) for row in model["rows"] if model["query"] in row[1])
        if (
            not isinstance(work["matches"], list)
            or any(type(x) is not int for x in work["matches"])
            or work["matches"] != matches
        ):
            return False
        ids = {int(row[0]) for row in model["rows"]}
        edges = {tuple(edge) for edge in model["edges"]}
        source, target = model["source"], model["target"]
        if source not in ids or target not in ids:
            return False
        dist = {source: 0}
        queue = deque([source])
        while queue:
            u = queue.popleft()
            for a, b in edges:
                if a == u and b not in dist:
                    dist[b] = dist[u] + 1
                    queue.append(b)
        path = work["path"]
        if not isinstance(path, list) or any(type(x) is not int for x in path):
            return False
        if target not in dist:
            return path == []
        return (
            len(path) == dist[target] + 1
            and path[0] == source
            and path[-1] == target
            and all((a, b) in edges for a, b in zip(path, path[1:], strict=False))
        )
    except (ValueError, TypeError, KeyError, IndexError, RecursionError):
        return False


ORACLES = {"cs03_hash": hash_model, "cs03_sort": sort_model, "cs03_external": external_model}
_HASH_BASE = "3\nI -1\nI 2\nI 5\nD 2\nF 5\nI 8\nP\nR 7\nC\nV\n"
_SORT_BASE = "insertion\n4\n2 0\n1 1\n2 2\n1 3\n"
INPUTS = {
    "cs03_hash": (
        (_HASH_BASE, "1\nD 8\nI 8\nI 9\nI 8\nD 8\nI -5\nF -5\nC\nV\n"),
        (
            "4\nI 17\nI 21\nI 25\nD 21\nF 25\nI 29\nR 2\nP\nR 6\nC\nV\n",
            "2\nI -99\nD -99\nF -99\nI 7\nI 9\nD 7\nI 11\nP\nC\nV\n",
            "3\nI 3\nI 6\nI 9\nD 3\nD 6\nD 9\nR 1\nI 42\nC\nV\n",
        ),
    ),
    "cs03_sort": (
        (_SORT_BASE, "merge\n0\n"),
        (
            "heap\n5\n9 0\n-2 1\n9 2\n0 3\n1 4\n",
            "quick\n4\n3 0\n3 1\n2 2\n1 3\n",
            "selection\n3\n2 0\n1 1\n2 2\n",
            "bubble\n3\n2 0\n2 1\n1 2\n",
            "merge\n6\n3 0\n1 1\n3 2\n1 3\n2 4\n-1 5\n",
            "quick\n5\n7 0\n7 1\n7 2\n7 3\n7 4\n",
        ),
    ),
    "cs03_external": (
        (
            "EXTERNAL\n6 2\n5 0\n1 1\n4 2\n2 3\n3 4\n0 5\n",
            "CATALOG\n4 4\n10 stacks\n20 queues\n30 graph\n40 graph-search\n"
            "10 20\n10 30\n20 40\n30 40\ngraph\n10 40\n",
        ),
        (
            "EXTERNAL\n5 2\n2 0\n1 1\n2 2\n1 3\n2 4\n",
            "EXTERNAL\n0 3\n",
            "CATALOG\n3 1\n7 tree\n8 trie\n9 hash\n7 8\nmissing\n7 9\n",
        ),
    ),
}
GOALS = {
    "CS03-M09-O01": ("cs03_hash", "hash_function"),
    "CS03-M09-O02": ("cs03_hash", "hash_delete"),
    "CS03-M09-O03": ("cs03_hash", "hash_load"),
    "CS03-M10-O01": ("cs03_sort", "sort_algorithms"),
    "CS03-M10-O02": ("cs03_sort", "sort_stability"),
    "CS03-M10-O03": ("cs03_external", "external"),
}
COMPARATORS = {"cs03_sort": "sorted_records", "cs03_external": "external_project"}
