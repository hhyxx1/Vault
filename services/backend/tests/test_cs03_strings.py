"""Independent string and special-storage contract examples."""

import pytest

from vault_backend.course_checks.semantic_suites import ORACLES


@pytest.mark.parametrize(
    "oracle,stdin,expected",
    [
        ("cs03_naive", "ababa\naba\n", "0 2\n"),
        ("cs03_naive", "abc\n\n", "0 1 2 3\n"),
        ("cs03_kmp", "ababa\naba\n", "pi=0 0 1\nmatch=0 2\n"),
        ("cs03_kmp", "aaaaa\naaa\n", "pi=0 1 2\nmatch=0 1 2\n"),
        (
            "cs03_special",
            "COO\n2 3 4\n0 1 3\n0 1 -1\n1 0 5\n1 2 -2\n",
            "dense\n0 2 0\n5 0 -2\ntranspose\n0 5\n2 0\n0 -2\n",
        ),
        ("cs03_special", "GLIST\n(1,(2,3),())\n", "depth=2 atoms=3\n"),
        ("cs03_special", "GLIST\n(1,)\n", "invalid\n"),
    ],
)
def test_strings_and_storage_independent_examples(oracle, stdin, expected):
    assert ORACLES[oracle](stdin) == expected
