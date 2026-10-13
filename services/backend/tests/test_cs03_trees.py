import pytest

from vault_backend.course_checks.semantic_suites import ORACLES


@pytest.mark.parametrize(
    "oracle,stdin,expected",
    [
        (
            "cs03_parent_tree",
            "5\n-1 0 0 1 1\n",
            "root=0\n0:1,-1\n1:3,2\n2:-1,-1\n3:-1,4\n4:-1,-1\n",
        ),
        ("cs03_parent_tree", "3\n-1 2 1\n", "invalid\n"),
        (
            "cs03_traversal",
            "3 0\n1 2\n-1 -1\n-1 -1\n",
            "pre=0 1 2\nin=1 0 2\npost=1 2 0\niter_in=1 0 2\n",
        ),
        ("cs03_traversal", "2 0\n1 1\n-1 -1\n", "invalid\n"),
    ],
)
def test_tree_representation_and_traversal_examples(oracle, stdin, expected):
    assert ORACLES[oracle](stdin) == expected
