import pytest

from vault_backend.course_checks.semantic_suites import ORACLES


@pytest.mark.parametrize(
    "oracle,stdin,expected",
    [
        ("cs03_adjacency", "3 2 0 0\n0 1\n1 2\n", "0:1\n1:0 2\n2:1\nmatrix\n0 1 0\n1 0 1\n0 1 0\n"),
        ("cs03_search", "4 2 0 0\n0 1\n2 3\n", "bfs=0 1\ndfs=0 1 2 3\ndistance=0 1 -1 -1\n"),
        ("cs03_forest", "4 3\n0 1 3\n1 2 -2\n0 2 1\n", "cost=-1 components=2\n"),
        (
            "cs03_shortest",
            "3 2 0\n0 1 4\n1 2 -2\n",
            "dijkstra=unsupported-negative\nbellman=0 4 2\n",
        ),
        (
            "cs03_critical",
            "4 4\n0 1 3\n0 2 2\n1 3 2\n2 3 3\n",
            "early=0 3 2 5\nlate=0 3 2 5\ncritical=0 1 2 3\n",
        ),
    ],
)
def test_graph_expected_values_are_independently_specified(oracle, stdin, expected):
    assert ORACLES[oracle](stdin) == expected


@pytest.mark.parametrize(
    "order,cycle,valid",
    [
        ([0, 1, 2, 3], False, True),
        ([0, 2, 1, 3], False, True),
        ([0, 3, 1, 2], False, False),
        ([0, 1, 1, 3], False, False),
        ([], True, False),
        ([False, 1, 2, 3], False, False),
    ],
)
def test_topology_accepts_any_valid_order_not_one_reference_string(order, cycle, valid):
    import json

    from vault_backend.course_checks.cs03_graphs import compare_topology, topology_model

    expected = topology_model("4 4\n0 1\n0 2\n1 3\n2 3\n")
    assert compare_topology(expected, json.dumps({"order": order, "cycle": cycle})) == valid


@pytest.mark.parametrize(
    "order,valid",
    [
        ("bfs=0 2 1 3\ndfs=0 2 3 1\ndistance=0 1 1 2\n", True),
        ("bfs=0 1 3 2\ndfs=0 1 3 2\ndistance=0 1 1 2\n", False),
        ("bfs=0 1 2 3\ndfs=0 1 2 3\ndistance=0 1 1 2\n", False),
    ],
)
def test_graph_search_accepts_legitimate_neighbor_orders(order, valid):
    from vault_backend.course_checks.semantic_suites import compare_output

    expected = ORACLES["cs03_search_contract"]("4 4 1 0\n0 1\n0 2\n1 3\n2 3\n")
    assert compare_output("graph_search_order", expected, order) == valid


@pytest.mark.parametrize(
    "edges,cost,valid",
    [
        ([0, 1], 4, True),
        ([0, 2], 4, True),
        ([1, 2], 4, True),
        ([0, 0], 4, False),
        ([], 4, False),
    ],
)
def test_forest_validates_the_actual_selected_edges(edges, cost, valid):
    import json

    from vault_backend.course_checks.semantic_suites import compare_output

    expected = ORACLES["cs03_forest_contract"]("3 3\n0 1 2\n1 2 2\n0 2 2\n")
    assert (
        compare_output(
            "minimum_forest", expected, json.dumps({"edges": edges, "cost": cost, "components": 1})
        )
        == valid
    )


@pytest.mark.parametrize(
    "mode", ["huffman_codebook", "topological_order", "sorted_records", "external_project"]
)
def test_deeply_nested_student_output_is_rejected_not_a_server_error(mode):
    from vault_backend.course_checks.semantic_suites import compare_output

    assert compare_output(mode, "{}", "[" * 1200 + "0" + "]" * 1200) is False
