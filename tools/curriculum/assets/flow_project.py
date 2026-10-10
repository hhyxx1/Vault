"""Original integer-capacity Edmonds-Karp experiment with explicit certificates.

Parallel and antiparallel directed edges have separate IDs; residual backward edges
cancel existing flow. At most 16 vertices/128 edges. No fractional or infinite caps.
"""

from collections import deque


def solve(nodes, edges, source, sink, max_augmentations=256):
    if type(nodes) is not int or not 2 <= nodes <= 16:
        raise ValueError("vertex count")
    if (
        any(type(v) is not int or not 0 <= v < nodes for v in [source, sink])
        or source == sink
    ):
        raise ValueError("terminals")
    if not isinstance(edges, list) or len(edges) > 128:
        raise ValueError("edge count")
    if type(max_augmentations) is not int or not 1 <= max_augmentations <= 1024:
        raise ValueError("augmentation budget")
    adjacency = [[] for _ in range(nodes)]
    for identity, edge in enumerate(edges):
        if not isinstance(edge, list) or len(edge) != 3:
            raise ValueError("edge shape")
        u, v, capacity = edge
        if (
            any(type(x) is not int for x in edge)
            or not 0 <= u < nodes
            or not 0 <= v < nodes
            or u == v
            or not 0 <= capacity <= 10000
        ):
            raise ValueError("edge endpoint/capacity")
        adjacency[u].append((v, identity, 1))
        adjacency[v].append((u, identity, -1))
    flows = [0] * len(edges)
    augmentations = []

    def residual(identity, direction):
        return (
            edges[identity][2] - flows[identity] if direction == 1 else flows[identity]
        )

    def search():
        parent = {source: None}
        queue = deque([source])
        while queue:
            u = queue.popleft()
            for v, identity, direction in adjacency[u]:
                if v not in parent and residual(identity, direction) > 0:
                    parent[v] = (u, identity, direction)
                    queue.append(v)
        return parent

    status = "complete"
    while True:
        parents = search()
        if sink not in parents:
            break
        if len(augmentations) >= max_augmentations:
            status = "budget_exhausted"
            break
        path = []
        vertex = sink
        while vertex != source:
            u, identity, direction = parents[vertex]
            path.append(
                {
                    "from": u,
                    "to": vertex,
                    "edge": identity,
                    "direction": direction,
                    "residual_before": residual(identity, direction),
                }
            )
            vertex = u
        path.reverse()
        delta = min(step["residual_before"] for step in path)
        for step in path:
            flows[step["edge"]] += step["direction"] * delta
        augmentations.append(
            {"amount": delta, "path": path, "flows_after": flows.copy()}
        )
    net = [0] * nodes
    for (u, v, capacity), value in zip(edges, flows, strict=True):
        net[u] += value
        net[v] -= value
    value = net[source]
    feasible = (
        all(0 <= flow <= edge[2] for edge, flow in zip(edges, flows, strict=True))
        and all(net[v] == 0 for v in range(nodes) if v not in {source, sink})
        and net[sink] == -value
    )
    reachable = sorted(search())
    cut_capacity = sum(
        capacity for u, v, capacity in edges if u in reachable and v not in reachable
    )
    optimal = (
        feasible
        and sink not in reachable
        and cut_capacity == value
        and status == "complete"
    )
    return {
        "status": status,
        "value": value,
        "flows": flows,
        "augmentations": augmentations,
        "reachable": reachable,
        "cut_capacity": cut_capacity,
        "feasible": feasible,
        "optimal_certificate": optimal,
    }
