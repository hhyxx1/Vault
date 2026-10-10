"""Original finite orthogonal weighted-grid search lab."""

import heapq
import math
from collections import deque


def validate(grid, start, goal):
    if not grid or not grid[0] or len(grid) * len(grid[0]) > 400:
        raise ValueError("nonempty grid with at most 400 cells required")
    if any(len(row) != len(grid[0]) for row in grid):
        raise ValueError("grid must be rectangular")
    for row in grid:
        for cost in row:
            if cost is not None and (
                isinstance(cost, bool)
                or not isinstance(cost, (int, float))
                or not math.isfinite(cost)
                or cost <= 0
            ):
                raise ValueError("cell cost must be positive finite or null wall")
    for endpoint in (start, goal):
        if len(endpoint) != 2 or any(type(v) is not int for v in endpoint):
            raise ValueError("coordinates must be integer pairs")
        x, y = endpoint
        if not (0 <= y < len(grid) and 0 <= x < len(grid[0])) or grid[y][x] is None:
            raise ValueError("endpoint must be inside traversable grid")


def neighbors(grid, node):
    x, y = node
    for dx, dy in [(1, 0), (0, 1), (-1, 0), (0, -1)]:
        nx, ny = x + dx, y + dy
        if 0 <= ny < len(grid) and 0 <= nx < len(grid[0]) and grid[ny][nx] is not None:
            yield (nx, ny), grid[ny][nx]


def finish(grid, start, goal, parents, trace, status):
    path = []
    if status == "found":
        node = goal
        while node != start:
            path.append(node)
            node = parents[node]
        path.append(start)
        path.reverse()
    total = sum(grid[y][x] for x, y in path[1:]) if path else None
    return {
        "status": status,
        "path": [list(p) for p in path],
        "cost": total,
        "replayed_cost": total,
        "trace": trace,
        "expanded": len(trace),
    }


def solve(grid, start, goal, budget=1000):
    validate(grid, start, goal)
    if type(budget) is not int or budget <= 0:
        raise ValueError("positive expansion budget required")
    start, goal = tuple(start), tuple(goal)
    minimum = min(v for row in grid for v in row if v is not None)
    heuristic = lambda node: minimum * (abs(node[0] - goal[0]) + abs(node[1] - goal[1]))
    costs = {start: 0}
    parents = {}
    frontier = [(heuristic(start), 0, start)]
    trace = []
    while frontier:
        priority, g, node = heapq.heappop(frontier)
        if g != costs[node]:
            continue
        if len(trace) >= budget:
            return finish(grid, start, goal, parents, trace, "budget_exhausted")
        trace.append(
            {
                "node": list(node),
                "g": g,
                "h": heuristic(node),
                "priority": priority,
                "frontier_size": len(frontier),
            }
        )
        if node == goal:
            return finish(grid, start, goal, parents, trace, "found")
        for next_node, weight in neighbors(grid, node):
            tentative = g + weight
            if tentative < costs.get(next_node, math.inf):
                costs[next_node] = tentative
                parents[next_node] = node
                priority = tentative + heuristic(next_node)
                heapq.heappush(frontier, (priority, tentative, next_node))
    return finish(grid, start, goal, parents, trace, "unreachable")


def breadth_first(grid, start, goal):
    start, goal = tuple(start), tuple(goal)
    queue = deque([start])
    seen = {start}
    parents = {}
    trace = []
    while queue:
        node = queue.popleft()
        trace.append({"node": list(node), "frontier_size": len(queue)})
        if node == goal:
            return finish(grid, start, goal, parents, trace, "found")
        for neighbor, _ in neighbors(grid, node):
            if neighbor not in seen:
                seen.add(neighbor)
                parents[neighbor] = node
                queue.append(neighbor)
    return finish(grid, start, goal, parents, trace, "unreachable")


def dijkstra(grid, start, goal):
    # Separate uniform-cost implementation without the A* priority expression.
    start, goal = tuple(start), tuple(goal)
    frontier = [(0, start)]
    settled = set()
    best = {start: 0}
    parents = {}
    trace = []
    while frontier:
        cost, node = heapq.heappop(frontier)
        if node in settled:
            continue
        settled.add(node)
        trace.append({"node": list(node), "g": cost})
        if node == goal:
            return finish(grid, start, goal, parents, trace, "found")
        for neighbor, weight in neighbors(grid, node):
            candidate = cost + weight
            if candidate < best.get(neighbor, math.inf):
                best[neighbor] = candidate
                parents[neighbor] = node
                heapq.heappush(frontier, (candidate, neighbor))
    return finish(grid, start, goal, parents, trace, "unreachable")


def compare(grid, start, goal):
    validate(grid, start, goal)
    a = solve(grid, start, goal)
    reference = dijkstra(grid, start, goal)
    return {
        "astar": a,
        "dijkstra": reference,
        "bfs": breadth_first(grid, start, goal),
        "matches_optimal_cost": a["status"] == reference["status"]
        and a["cost"] == reference["cost"],
        "assumptions": "four-neighbor positive entry costs; Manhattan times minimum cell cost; start cost excluded",
    }
