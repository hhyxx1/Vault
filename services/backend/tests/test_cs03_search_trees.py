import pytest

from vault_backend.course_checks.semantic_suites import ORACLES


@pytest.mark.parametrize(
    "stdin,expected",
    [
        (
            "I 4\nI 2\nI 6\nI 4\nD 4\nP\nF 4\nV\n",
            "inserted\ninserted\ninserted\nexists\ndeleted\n2 6\nmissing\nvalid\n",
        ),
        (
            "D 1\nI -3\nI -2\nI -1\nD -2\nP\nV\n",
            "missing\ninserted\ninserted\ninserted\ndeleted\n-3 -1\nvalid\n",
        ),
    ],
)
def test_search_tree_operations_preserve_the_key_set(stdin, expected):
    assert ORACLES["cs03_search_tree"](stdin) == expected
