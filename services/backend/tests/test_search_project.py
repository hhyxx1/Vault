import importlib.util
from pathlib import Path

import pytest


@pytest.fixture
def search():
    source = Path(__file__).resolve().parents[3] / "tools/curriculum/assets/search_project.py"
    spec = importlib.util.spec_from_file_location("search", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_weighted_route_uses_cost_not_only_number_of_edges(search):
    grid = [[1, 1, 1], [1, 9, 1], [1, 1, 1]]
    report = search.compare(grid, [0, 1], [2, 1])
    assert report["astar"]["cost"] == report["dijkstra"]["cost"] == 4
    assert report["bfs"]["cost"] == 10
    assert len(report["astar"]["path"]) == 5
    assert report["astar"]["trace"]
    assert report["astar"]["replayed_cost"] == 4


def test_blocked_route_distinguishes_unreachable_from_budget(search):
    report = search.compare([[1, None, 1], [1, None, 1]], [0, 0], [2, 0])
    assert report["astar"]["status"] == "unreachable"
    limited = search.solve([[1] * 5 for _ in range(5)], [0, 0], [4, 4], budget=1)
    assert limited["status"] == "budget_exhausted"
    assert limited["path"] == []


def test_start_goal_same_and_lower_cost_detour_after_map_change(search):
    same = search.solve([[1]], [0, 0], [0, 0])
    assert same["cost"] == 0 and same["path"] == [[0, 0]]
    report = search.compare([[1, 1, 1], [1, 2, 1], [1, 1, 1]], [0, 1], [2, 1])
    assert report["astar"]["cost"] == report["dijkstra"]["cost"] == 3


@pytest.mark.parametrize(
    "grid,start,goal",
    [
        ([[0]], [0, 0], [0, 0]),
        ([[1], [1, 1]], [0, 0], [0, 1]),
        ([[None]], [0, 0], [0, 0]),
        ([[1]], [-1, 0], [0, 0]),
    ],
)
def test_invalid_map_or_endpoint_rejected(search, grid, start, goal):
    with pytest.raises(ValueError):
        search.solve(grid, start, goal)


def test_deterministic_family_matches_independent_dijkstra(search):
    for expensive in range(2, 12):
        for wall in [False, True]:
            grid = [[1, 1, 1], [1, expensive, 1], [1, None if wall else 1, 1]]
            report = search.compare(grid, [0, 1], [2, 1])
            assert report["astar"]["cost"] == report["dijkstra"]["cost"] == min(expensive + 1, 4)
