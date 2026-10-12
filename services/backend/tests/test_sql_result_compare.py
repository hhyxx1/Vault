"""Unit tests for E03 relational result comparison (set/multiset/ordered)."""

import pytest

from vault_backend.course_checks.sql_result_compare import (
    ColumnOrder,
    Relation,
    ResultSemantics,
    compare_relations,
)


def rel(columns, rows):
    return Relation(columns=columns, rows=rows)


def test_set_ignores_row_order_and_duplicates():
    expected = rel(["a"], [[1], [2], [2]])
    observed = rel(["a"], [[2], [1]])  # reordered, duplicate collapsed
    result = compare_relations(expected, observed, ResultSemantics.SET)
    assert result.matches is True
    assert "集合" in result.reason


def test_multiset_ignores_order_but_requires_equal_multiplicity():
    expected = rel(["a"], [[1], [2], [2]])
    reordered = rel(["a"], [[2], [2], [1]])
    assert compare_relations(
        expected, reordered, ResultSemantics.MULTISET
    ).matches is True

    collapsed = rel(["a"], [[1], [2]])
    result = compare_relations(expected, collapsed, ResultSemantics.MULTISET)
    assert result.matches is False
    assert "缺少 1 行" in result.reason


def test_ordered_requires_exact_row_sequence():
    expected = rel(["a"], [[1], [2], [3]])
    assert compare_relations(
        expected, rel(["a"], [[1], [2], [3]]), ResultSemantics.ORDERED
    ).matches is True
    shuffled = compare_relations(
        expected, rel(["a"], [[1], [3], [2]]), ResultSemantics.ORDERED
    )
    assert shuffled.matches is False
    assert "顺序" in shuffled.reason
    shorter = compare_relations(
        expected, rel(["a"], [[1], [2]]), ResultSemantics.ORDERED
    )
    assert shorter.matches is False
    assert "行数不同" in shorter.reason


def test_null_equals_null_in_result_comparison():
    expected = rel(["a", "b"], [[None, 1], ["x", None]])
    observed = rel(["a", "b"], [["x", None], [None, 1]])
    assert compare_relations(
        expected, observed, ResultSemantics.MULTISET
    ).matches is True


def test_column_count_mismatch_is_reported():
    result = compare_relations(
        rel(["a", "b"], [[1, 2]]), rel(["a"], [[1]]), ResultSemantics.MULTISET
    )
    assert result.matches is False
    assert "列数不同" in result.reason


def test_column_order_significant_by_default_but_ignorable_by_name():
    expected = rel(["a", "b"], [[1, 2]])
    swapped = rel(["b", "a"], [[2, 1]])
    assert compare_relations(
        expected, swapped, ResultSemantics.MULTISET
    ).matches is False
    ignored = compare_relations(
        expected, swapped, ResultSemantics.MULTISET, ColumnOrder.IGNORED
    )
    assert ignored.matches is True


def test_ignored_column_order_requires_same_column_name_set():
    result = compare_relations(
        rel(["a", "b"], [[1, 2]]),
        rel(["a", "c"], [[1, 2]]),
        ResultSemantics.MULTISET,
        ColumnOrder.IGNORED,
    )
    assert result.matches is False
    assert "列名集合不同" in result.reason


def test_ignored_column_order_rejects_duplicate_column_names():
    result = compare_relations(
        rel(["a", "a"], [[1, 2]]),
        rel(["a", "a"], [[1, 2]]),
        ResultSemantics.MULTISET,
        ColumnOrder.IGNORED,
    )
    assert result.matches is False
    assert "列名有重复" in result.reason


def test_numeric_tolerance_quantizes_for_multiset_counting():
    expected = rel(["v"], [[1.00], [2.00]])
    close = rel(["v"], [[2.005], [1.004]])
    assert compare_relations(
        expected, close, ResultSemantics.MULTISET, numeric_tolerance=0.01
    ).matches is True
    exact = compare_relations(
        expected, close, ResultSemantics.MULTISET, numeric_tolerance=0.0
    )
    assert exact.matches is False


def test_varchar_digit_is_not_coerced_to_integer():
    expected = rel(["a"], [[1]])
    observed = rel(["a"], [["1"]])
    result = compare_relations(expected, observed, ResultSemantics.MULTISET)
    assert result.matches is False


def test_ragged_row_is_rejected():
    result = compare_relations(
        rel(["a", "b"], [[1]]), rel(["a", "b"], [[1, 2]]), ResultSemantics.MULTISET
    )
    assert result.matches is False
    assert "单元格数" in result.reason


def test_extra_rows_are_reported_separately():
    result = compare_relations(
        rel(["a"], [[1]]), rel(["a"], [[1], [9]]), ResultSemantics.SET
    )
    assert result.matches is False
    assert "多出 1 行" in result.reason
    assert result.reason.strip()


@pytest.mark.parametrize("semantics", list(ResultSemantics))
def test_empty_relations_are_equal_and_reason_never_blank(semantics):
    result = compare_relations(rel(["a"], []), rel(["a"], []), semantics)
    assert result.matches is True
    assert result.reason.strip()
