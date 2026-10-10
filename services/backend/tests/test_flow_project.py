import importlib.util
import random
from itertools import product
from pathlib import Path

import pytest


@pytest.fixture
def flow():
    path = Path(__file__).resolve().parents[3] / "tools/curriculum/assets/flow_project.py"
    spec = importlib.util.spec_from_file_location("flow_project", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def network():
    return [[0, 1, 1], [0, 2, 1], [1, 3, 1], [1, 4, 1], [2, 3, 1], [3, 5, 1], [4, 5, 1]]


def test_reverse_residual_edge_reassigns_a_committed_matching(flow):
    result = flow.solve(6, network(), 0, 5)
    assert result["value"] == result["cut_capacity"] == 2
    assert result["feasible"] and result["optimal_certificate"]
    assert any(
        step["direction"] == -1
        for augmentation in result["augmentations"]
        for step in augmentation["path"]
    )
    assert result["flows"] == [1, 1, 0, 1, 1, 1, 1]


def test_actual_maxflow_equals_independent_exhaustive_small_graph_cuts(flow):
    rng = random.Random(731)
    for _ in range(50):
        edges = [
            [u, v, rng.randrange(4)]
            for u in range(4)
            for v in range(4)
            if u != v and rng.randrange(2)
        ]
        result = flow.solve(4, edges, 0, 3)
        cuts = []
        for inside in product([False, True], repeat=2):
            group = {0} | {i + 1 for i, selected in enumerate(inside) if selected}
            cuts.append(sum(c for u, v, c in edges if u in group and v not in group))
        assert result["value"] == min(cuts)
        assert result["feasible"] and result["optimal_certificate"]


def test_parallel_edges_and_antiparallel_edges_keep_distinct_capacities(flow):
    result = flow.solve(3, [[0, 1, 2], [0, 1, 3], [1, 0, 8], [1, 2, 5]], 0, 2)
    assert result["value"] == 5
    assert result["flows"] == [2, 3, 0, 5]


def test_budget_exhaustion_has_no_false_optimal_certificate(flow):
    result = flow.solve(6, network(), 0, 5, max_augmentations=1)
    assert result["status"] == "budget_exhausted"
    assert result["value"] == 1 and result["feasible"]
    assert result["optimal_certificate"] is False


@pytest.mark.parametrize(
    "edges", [[[0, 1, -1]], [[0, 4, 1]], [[0, 0, 1]], [[0, 1, True]], [[0, 1, 1.5]]]
)
def test_invalid_network_does_not_silently_change_the_problem(flow, edges):
    with pytest.raises(ValueError):
        flow.solve(3, edges, 0, 2)
