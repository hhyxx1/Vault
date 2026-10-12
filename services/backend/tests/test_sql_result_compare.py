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


# --- Regression counterexamples from review (D) -------------------------------


def test_bool_true_is_distinct_from_number_one():
    # Python treats bool as a subclass of int; SQL/result comparison must not.
    for semantics in ResultSemantics:
        result = compare_relations(
            rel(["a"], [[True]]), rel(["a"], [[1]]), semantics
        )
        assert result.matches is False, semantics
        result = compare_relations(
            rel(["a"], [[False]]), rel(["a"], [[0]]), semantics
        )
        assert result.matches is False, semantics


def test_absolute_tolerance_does_not_depend_on_quantization_grid():
    # 1.004 and 1.006 are 0.002 apart: within 0.01 regardless of rounding grid.
    result = compare_relations(
        rel(["v"], [[1.004]]), rel(["v"], [[1.006]]),
        ResultSemantics.MULTISET, numeric_tolerance=0.01,
    )
    assert result.matches is True
    # 1.01 and 1.04 are 0.03 apart: within 0.05.
    result = compare_relations(
        rel(["v"], [[1.01]]), rel(["v"], [[1.04]]),
        ResultSemantics.MULTISET, numeric_tolerance=0.05,
    )
    assert result.matches is True
    # Just over tolerance must still differ.
    over = compare_relations(
        rel(["v"], [[1.00]]), rel(["v"], [[1.04]]),
        ResultSemantics.MULTISET, numeric_tolerance=0.03,
    )
    assert over.matches is False


def test_high_precision_decimal_tolerance_never_raises():
    from decimal import Decimal

    value = Decimal("1.00000000000000000000000001")
    same = compare_relations(
        rel(["v"], [[value]]), rel(["v"], [[value]]),
        ResultSemantics.MULTISET, numeric_tolerance=0.01,
    )
    assert same.matches is True
    apart = compare_relations(
        rel(["v"], [[Decimal("1.00000000000000000000000001")]]),
        rel(["v"], [[Decimal("1.00000000000000000000000009")]]),
        ResultSemantics.MULTISET, numeric_tolerance=Decimal("1e-20"),
    )
    # 8e-26 apart is within 1e-20.
    assert apart.matches is True


def test_tolerance_multiset_uses_one_to_one_matching():
    # Greedy in-order matching fails here, but a perfect matching exists:
    # 1.00 -> 0.99 and 1.05 -> 1.03.
    expected = rel(["v"], [[1.00], [1.05]])
    observed = rel(["v"], [[1.03], [0.99]])
    result = compare_relations(
        expected, observed, ResultSemantics.MULTISET, numeric_tolerance=0.05
    )
    assert result.matches is True
    # Same values under the exact multiset comparison must be distinct.
    exact = compare_relations(expected, observed, ResultSemantics.MULTISET)
    assert exact.matches is False


def test_non_finite_values_have_explicit_semantics():
    # NaN never matches anything, including another NaN.
    for semantics in ResultSemantics:
        result = compare_relations(
            rel(["a"], [[float("nan")]]), rel(["a"], [[float("nan")]]), semantics
        )
        assert result.matches is False, semantics
    # Same-signed infinity matches; opposite sign and finite do not.
    assert compare_relations(
        rel(["a"], [[float("inf")]]), rel(["a"], [[float("inf")]]),
        ResultSemantics.MULTISET,
    ).matches is True
    assert compare_relations(
        rel(["a"], [[float("inf")]]), rel(["a"], [[float("-inf")]]),
        ResultSemantics.MULTISET,
    ).matches is False
    assert compare_relations(
        rel(["a"], [[float("inf")]]), rel(["a"], [[1e308]]),
        ResultSemantics.MULTISET,
    ).matches is False


def test_invalid_tolerance_is_rejected():
    for bad in (-0.01, float("nan"), float("inf")):
        with pytest.raises(ValueError):
            compare_relations(
                rel(["a"], [[1]]), rel(["a"], [[1]]),
                ResultSemantics.MULTISET, numeric_tolerance=bad,
            )


def test_type_distinction_across_number_string_and_bool():
    # varchar '1' != number 1 (already covered), and bool true != number 1.
    assert compare_relations(
        rel(["a"], [[1]]), rel(["a"], [["1"]]), ResultSemantics.MULTISET
    ).matches is False
    assert compare_relations(
        rel(["a"], [[True]]), rel(["a"], [["true"]]), ResultSemantics.MULTISET
    ).matches is False
    # int 1 and float 1.0 are both numeric and equal.
    assert compare_relations(
        rel(["a"], [[1]]), rel(["a"], [[1.0]]), ResultSemantics.MULTISET
    ).matches is True


# --- Round-2 regressions (item 5) --------------------------------------------


@pytest.mark.parametrize("semantics", list(ResultSemantics))
def test_decimal_and_float_infinity_share_a_sign_encoding(semantics):
    from decimal import Decimal

    # +inf (Decimal) == +inf (float)
    assert compare_relations(
        rel(["a"], [[Decimal("Infinity")]]), rel(["a"], [[float("inf")]]), semantics
    ).matches is True
    # -inf (Decimal) == -inf (float)
    assert compare_relations(
        rel(["a"], [[Decimal("-Infinity")]]), rel(["a"], [[float("-inf")]]), semantics
    ).matches is True
    # Opposite signs are never equal, in either direction.
    assert compare_relations(
        rel(["a"], [[Decimal("Infinity")]]), rel(["a"], [[float("-inf")]]), semantics
    ).matches is False
    assert compare_relations(
        rel(["a"], [[Decimal("-Infinity")]]), rel(["a"], [[float("inf")]]), semantics
    ).matches is False
    # Same-sign float/float still equal.
    assert compare_relations(
        rel(["a"], [[float("inf")]]), rel(["a"], [[float("inf")]]), semantics
    ).matches is True


def test_high_precision_tolerance_boundary_is_not_rounded_away():
    from decimal import Decimal

    a = Decimal("1.000000000000000000000000000000000000000001")
    b = Decimal("1.000000000000000000000000000000000000000002")
    # |a - b| is exactly 1e-42; tolerance at the boundary must accept.
    assert compare_relations(
        rel(["v"], [[a]]), rel(["v"], [[b]]),
        ResultSemantics.MULTISET, numeric_tolerance=Decimal("1e-42"),
    ).matches is True
    # Just below the boundary must reject (no round-to-zero).
    assert compare_relations(
        rel(["v"], [[a]]), rel(["v"], [[b]]),
        ResultSemantics.MULTISET, numeric_tolerance=Decimal("0.9e-42"),
    ).matches is False


def test_tolerance_matching_is_polynomial_and_terminates_on_dense_duplicates():
    # Highly duplicated, near-identical rows that DO admit a perfect matching.
    n = 400
    expected = rel(["v"], [[1.0] for _ in range(n)])
    observed = rel(["v"], [[1.0 + 1e-9] for _ in range(n)])
    assert compare_relations(
        expected, observed, ResultSemantics.MULTISET, numeric_tolerance=1e-6
    ).matches is True

    # Same scale but one row cannot be matched: no perfect matching, and the
    # polynomial matcher must return promptly instead of exhausting permutations.
    observed_bad = rel(["v"], [[1.0 + 1e-9] for _ in range(n - 1)] + [[99.0]])
    assert compare_relations(
        expected, observed_bad, ResultSemantics.MULTISET, numeric_tolerance=1e-6
    ).matches is False


def test_oversized_relations_are_rejected_as_invalid_arguments():
    from vault_backend.course_checks.sql_result_compare import MAX_RELATION_ROWS

    big = rel(["v"], [[1] for _ in range(MAX_RELATION_ROWS + 1)])
    with pytest.raises(ValueError):
        compare_relations(big, rel(["v"], []), ResultSemantics.MULTISET)
    big_obs = rel(["v"], [[1] for _ in range(MAX_RELATION_ROWS + 1)])
    with pytest.raises(ValueError):
        compare_relations(rel(["v"], []), big_obs, ResultSemantics.MULTISET)
