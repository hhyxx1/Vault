"""Graph models: independent algorithms and explicit graph contracts."""

import heapq
import json
from collections import deque


def _unweighted(stdin):
    values = list(map(int, stdin.split()))
    n, m, d, s = values[:4]
    edges = list(zip(values[4::2], values[5::2], strict=True))
    if (
        len(edges) != m
        or not 1 <= n <= 50
        or d not in {0, 1}
        or not 0 <= s < n
        or any(not 0 <= x < n for edge in edges for x in edge)
    ):
        raise ValueError("Invalid fixture")
    adjacency = [set() for _ in range(n)]
    for u, v in edges:
        adjacency[u].add(v)
        if not d:
            adjacency[v].add(u)
    return n, s, [sorted(row) for row in adjacency]


def adjacency_model(stdin):
    n, _, adj = _unweighted(stdin)
    return (
        "".join(
            f"{i}:" + (" ".join(map(str, row)) if row else "empty") + "\n"
            for i, row in enumerate(adj)
        )
        + "matrix\n"
        + "".join(" ".join(str(int(j in adj[i])) for j in range(n)) + "\n" for i in range(n))
    )


def search_model(stdin):
    n, source, adj = _unweighted(stdin)
    queue = deque([source])
    distance = [-1] * n
    distance[source] = 0
    bfs = []
    while queue:
        u = queue.popleft()
        bfs.append(u)
        for v in adj[u]:
            if distance[v] == -1:
                distance[v] = distance[u] + 1
                queue.append(v)
    visited = set()
    dfs = []

    def visit(u):
        if u in visited:
            return
        visited.add(u)
        dfs.append(u)
        for v in adj[u]:
            visit(v)

    visit(source)
    for node in range(n):
        visit(node)
    return (
        "bfs="
        + " ".join(map(str, bfs))
        + "\ndfs="
        + " ".join(map(str, dfs))
        + "\ndistance="
        + " ".join(map(str, distance))
        + "\n"
    )


def _weighted(stdin, has_source=False):
    values = list(map(int, stdin.split()))
    n, m = values[:2]
    start = 3 if has_source else 2
    source = values[2] if has_source else None
    edges = [tuple(values[i : i + 3]) for i in range(start, len(values), 3)]
    if (
        not 1 <= n <= 50
        or len(edges) != m
        or any(len(edge) != 3 or not 0 <= edge[0] < n or not 0 <= edge[1] < n for edge in edges)
    ):
        raise ValueError("Invalid fixture")
    return n, source, edges


def forest_model(stdin):
    n, _, edges = _weighted(stdin)
    # Prim over each component, independent of the submitted Kruskal/DSU code.
    adj = [[] for _ in range(n)]
    for u, v, w in edges:
        adj[u].append((w, v))
        adj[v].append((w, u))
    visited = set()
    cost = 0
    components = 0
    for root in range(n):
        if root in visited:
            continue
        components += 1
        heap = [(0, root)]
        while heap:
            weight, u = heapq.heappop(heap)
            if u in visited:
                continue
            visited.add(u)
            cost += weight
            for w, v in adj[u]:
                if v not in visited:
                    heapq.heappush(heap, (w, v))
    return f"cost={cost} components={components}\n"


def shortest_model(stdin):
    n, source, edges = _weighted(stdin, True)
    # Floyd-Warshall reference rather than the learner's two implementations.
    infinity = float("inf")
    distance = [[infinity] * n for _ in range(n)]
    for i in range(n):
        distance[i][i] = 0
    for u, v, w in edges:
        distance[u][v] = min(distance[u][v], w)
    for k in range(n):
        for i in range(n):
            for j in range(n):
                distance[i][j] = min(distance[i][j], distance[i][k] + distance[k][j])
    negative = any(distance[source][i] != infinity and distance[i][i] < 0 for i in range(n))
    row = (
        "negative-cycle"
        if negative
        else " ".join("INF" if x == infinity else str(int(x)) for x in distance[source])
    )
    dijkstra = "unsupported-negative" if any(w < 0 for _, _, w in edges) else row
    return "dijkstra=" + dijkstra + "\nbellman=" + row + "\n"


def _topology(n, edges):
    indegree = [0] * n
    adj = [[] for _ in range(n)]
    for u, v, *_ in edges:
        adj[u].append(v)
        indegree[v] += 1
    queue = deque(i for i in range(n) if not indegree[i])
    order = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in adj[u]:
            indegree[v] -= 1
            if not indegree[v]:
                queue.append(v)
    return order


def topology_model(stdin):
    values = list(map(int, stdin.split()))
    n, m = values[:2]
    edges = list(zip(values[2::2], values[3::2], strict=True))
    if len(edges) != m:
        raise ValueError
    return json.dumps({"n": n, "edges": edges, "cycle": len(_topology(n, edges)) != n})


def compare_topology(expected, observed):
    try:
        model = json.loads(expected)
        work = json.loads(observed)
        if (
            not isinstance(work, dict)
            or set(work) != {"order", "cycle"}
            or type(work["cycle"]) is not bool
        ):
            return False
        order = work["order"]
        if not isinstance(order, list):
            return False
        if model["cycle"]:
            return work["cycle"] is True and order == []
        if (
            work["cycle"]
            or len(order) != model["n"]
            or any(type(x) is not int for x in order)
            or set(order) != set(range(model["n"]))
        ):
            return False
        positions = {v: i for i, v in enumerate(order)}
        return all(positions[u] < positions[v] for u, v in model["edges"])
    except (ValueError, TypeError, KeyError, IndexError, RecursionError):
        return False


def critical_model(stdin):
    n, _, edges = _weighted(stdin)
    if any(w < 0 for _, _, w in edges):
        return "invalid\n"
    order = _topology(n, edges)
    if len(order) != n:
        return "cycle\n"
    early = [0] * n
    for u in order:
        for a, v, w in edges:
            if a == u:
                early[v] = max(early[v], early[u] + w)
    late = [max(early)] * n
    for u in reversed(order):
        for a, v, w in edges:
            if a == u:
                late[u] = min(late[u], late[v] - w)
    critical = [i for i, (u, v, w) in enumerate(edges) if early[u] == late[v] - w]
    return (
        "early="
        + " ".join(map(str, early))
        + "\nlate="
        + " ".join(map(str, late))
        + "\ncritical="
        + (" ".join(map(str, critical)) if critical else "none")
        + "\n"
    )


ORACLES = {
    "cs03_adjacency": adjacency_model,
    "cs03_search": search_model,
    "cs03_forest": forest_model,
    "cs03_shortest": shortest_model,
    "cs03_topology": topology_model,
    "cs03_critical": critical_model,
}
INPUTS = {
    "cs03_adjacency": (
        ("3 3 0 0\n0 1\n1 2\n0 1\n", "4 2 1 0\n0 1\n2 2\n"),
        ("1 1 0 0\n0 0\n", "5 3 1 0\n4 1\n1 0\n3 2\n", "3 0 0 1\n"),
    ),
    "cs03_search": (
        ("4 2 0 0\n0 1\n2 3\n", "4 4 1 0\n0 1\n0 2\n1 3\n2 3\n"),
        ("1 0 0 0\n", "5 4 1 3\n3 4\n4 2\n2 3\n0 1\n", "4 3 0 2\n0 1\n1 2\n2 2\n"),
    ),
    "cs03_forest": (
        ("4 3\n0 1 3\n1 2 -2\n0 2 1\n", "3 3\n0 1 2\n1 2 2\n0 2 2\n"),
        ("1 0\n", "5 3\n0 1 -4\n1 1 -99\n3 4 7\n", "3 4\n0 1 9\n0 1 1\n1 2 2\n0 2 5\n"),
    ),
    "cs03_shortest": (
        ("4 4 0\n0 1 4\n0 2 1\n2 1 1\n1 3 2\n", "3 2 0\n0 1 4\n1 2 -2\n"),
        ("3 3 0\n0 1 1\n1 2 -4\n2 1 1\n", "4 2 0\n0 1 2\n2 3 -1\n", "2 0 1\n"),
    ),
    "cs03_topology": (
        ("4 4\n0 1\n0 2\n1 3\n2 3\n", "2 2\n0 1\n1 0\n"),
        ("3 0\n", "4 3\n3 2\n2 1\n1 0\n", "2 1\n1 1\n"),
    ),
    "cs03_critical": (
        ("4 4\n0 1 3\n0 2 2\n1 3 2\n2 3 1\n", "3 2\n0 1 3\n1 2 2\n"),
        ("4 2\n0 1 5\n2 3 2\n", "2 2\n0 1 1\n1 0 1\n", "3 2\n0 1 0\n1 2 1\n"),
    ),
}
GOALS = {
    "CS03-M07-O01": ("cs03_adjacency", "adjacency"),
    "CS03-M07-O02": ("cs03_search", "graph_search"),
    "CS03-M07-O03": ("cs03_forest", "forest"),
    "CS03-M08-O01": ("cs03_shortest", "shortest"),
    "CS03-M08-O02": ("cs03_topology", "topology"),
    "CS03-M08-O03": ("cs03_critical", "critical"),
}


def search_contract(stdin):
    n, source, adj = _unweighted(stdin)
    text = search_model(stdin)
    distance = list(map(int, text.splitlines()[2].split("=", 1)[1].split()))
    return json.dumps({"n": n, "source": source, "adj": adj, "distance": distance})


def compare_search(expected, observed):
    try:
        model = json.loads(expected)
        lines = [line.strip() for line in observed.splitlines() if line.strip()]
        if len(lines) != 3:
            return False
        fields = {}
        for line in lines:
            name, values = line.split("=", 1)
            if name in fields:
                return False
            fields[name] = list(map(int, values.split()))
        if set(fields) != {"bfs", "dfs", "distance"} or fields["distance"] != model["distance"]:
            return False
        adj = [set(row) for row in model["adj"]]
        source = model["source"]
        n = model["n"]
        bfs = fields["bfs"]
        reachable = {i for i, x in enumerate(model["distance"]) if x >= 0}
        if not bfs or bfs[0] != source or len(bfs) != len(reachable) or set(bfs) != reachable:
            return False
        discovered = {source}
        queue = deque([source])
        cursor = 1
        while queue:
            u = queue.popleft()
            children = adj[u] - discovered
            row = bfs[cursor : cursor + len(children)]
            if set(row) != children:
                return False
            cursor += len(children)
            discovered.update(row)
            queue.extend(row)
        if cursor != len(bfs):
            return False
        dfs = fields["dfs"]
        if len(dfs) != n or set(dfs) != set(range(n)) or dfs[0] != source:
            return False
        visited = {source}
        stack = [source]
        for node in dfs[1:]:
            while stack and node not in adj[stack[-1]]:
                if adj[stack[-1]] - visited:
                    return False
                stack.pop()
            if not stack and node != min(set(range(n)) - visited):
                return False
            visited.add(node)
            stack.append(node)
        return True
    except (ValueError, TypeError, KeyError, IndexError, RecursionError):
        return False


def forest_contract(stdin):
    n, _, edges = _weighted(stdin)
    summary = forest_model(stdin).strip().split()
    return json.dumps(
        {
            "n": n,
            "edges": edges,
            "optimal_cost": int(summary[0].split("=")[1]),
            "components": int(summary[1].split("=")[1]),
        }
    )


def compare_forest(expected, observed):
    try:
        model = json.loads(expected)
        work = json.loads(observed)
        if not isinstance(work, dict) or set(work) != {"edges", "cost", "components"}:
            return False
        chosen = work["edges"]
        if not isinstance(chosen, list) or any(
            type(x) is not int or not 0 <= x < len(model["edges"]) for x in chosen
        ):
            return False
        if len(set(chosen)) != len(chosen) or len(chosen) != model["n"] - model["components"]:
            return False
        if type(work["cost"]) is not int or type(work["components"]) is not int:
            return False
        parent = list(range(model["n"]))

        def root(u):
            while parent[u] != u:
                u = parent[u]
            return u

        cost = 0
        for index in chosen:
            u, v, w = model["edges"][index]
            a, b = root(u), root(v)
            if a == b:
                return False
            parent[a] = b
            cost += w
        return (
            cost == model["optimal_cost"] == work["cost"]
            and work["components"] == model["components"]
        )
    except (ValueError, TypeError, KeyError, IndexError, RecursionError):
        return False


ORACLES.update(cs03_search_contract=search_contract, cs03_forest_contract=forest_contract)
INPUTS["cs03_search_contract"] = INPUTS["cs03_search"]
INPUTS["cs03_forest_contract"] = INPUTS["cs03_forest"]
GOALS["CS03-M07-O02"] = ("cs03_search_contract", "graph_search")
GOALS["CS03-M07-O03"] = ("cs03_forest_contract", "forest")
COMPARATORS = {
    "cs03_search_contract": "graph_search_order",
    "cs03_forest_contract": "minimum_forest",
}
