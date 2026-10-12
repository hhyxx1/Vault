"""Structured relational result comparison for E03 SQL experiments (C05).

A one-shot SQL runner printing text cannot tell whether two query *results*
agree as relations. This pure, worker-free check layer compares already-parsed
relations (columns + rows) under the three semantics required by
EXECUTION_PLAN.md C05/E03:

- ``set``      : rows are unordered and duplicates ignored (a set of rows);
- ``multiset`` : rows unordered but multiplicity matters (plain SQL table / a
                 query without ORDER BY);
- ``ordered``   : row order matters (the query used ORDER BY and the task
                  asserts that order).

SQL comparison rules that differ from host-language equality:
- NULL equals NULL when comparing *result sets* (two NULLs in the same cell
  position denote the same unknown value, unlike ``NULL = NULL`` in a predicate);
- types are explicit: a boolean ``true`` is never equal to the number ``1`` and
  a varchar ``'1'`` is never coerced to the number ``1``; integers/floats and
  ``Decimal`` are all *numeric* and compare numerically;
- column order is significant by default (positional projection), optionally
  ignored by matching column names;
- numbers compare with an optional *absolute* tolerance. A one-to-one row
  matching is used so an unordered multiset/set under tolerance cannot be
  fooled by a naive greedy pass; the same value can only be consumed once.

Non-finite and invalid parameters have explicit semantics: ``NaN`` never
matches anything (including another ``NaN``); infinities match only the same
sign and ignore tolerance; a negative, non-finite or ``NaN`` tolerance is an
invalid-argument error rather than a silent "not equal".

Nothing here executes SQL or reads an "answer" from the client; it only decides
whether two relations the trusted layer already holds are equivalent.
"""

import math
from decimal import Decimal, InvalidOperation
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class ResultSemantics(StrEnum):
    SET = "set"
    MULTISET = "multiset"
    ORDERED = "ordered"


class ColumnOrder(StrEnum):
    SIGNIFICANT = "significant"  # compare columns positionally
    IGNORED = "ignored"          # align observed columns by expected names


class Relation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    columns: list[str] = Field(min_length=0)
    rows: list[list[object]] = Field(default_factory=list)

    def normalized(self) -> "Relation":
        """Canonical, hashable typed cells (no tolerance applied)."""
        return Relation(
            columns=list(self.columns),
            rows=[[normalize_cell(cell) for cell in row] for row in self.rows],
        )


class RelationComparison(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    matches: bool
    semantics: ResultSemantics
    column_order: ColumnOrder
    reason: str = Field(min_length=1)


# Canonical typed-cell tags. A cell is None (NULL) or a (kind, value) tuple so a
# bool, a number, a varchar and any other scalar never collide by hash/equality.
_NUMBER = "number"
_BOOL = "bool"
_STR = "str"
_OTHER = "other"
_NAN = "nan"
_INF = "inf"


def normalize_cell(value: object) -> object:
    """Make one scalar cell typed and comparable with SQL conventions.

    Returns ``None`` for NULL or a ``(kind, value)`` tuple that keeps distinct
    SQL types apart while letting int/float/Decimal compare as numbers.
    """
    if value is None:
        return None
    if isinstance(value, bool):
        # bool must be checked before int: in Python bool is a subclass of int,
        # but SQL/Python treat a boolean as a different type from the number 1.
        return (_BOOL, value)
    if isinstance(value, Decimal):
        if value.is_nan():
            return (_NAN, object())  # distinct token: NaN never equals NaN
        if value.is_infinite():
            return (_INF, value.is_signed())
        return (_NUMBER, value)
    if isinstance(value, int):
        return (_NUMBER, Decimal(value))
    if isinstance(value, float):
        if math.isnan(value):
            return (_NAN, object())  # distinct token: NaN never equals NaN
        if math.isinf(value):
            return (_INF, value > 0)
        # str() round-trips the shortest decimal representation so 1.004 stays
        # 1.004 instead of the binary float's 1.00400000000000000355….
        try:
            return (_NUMBER, Decimal(str(value)))
        except InvalidOperation:
            return (_OTHER, str(value))
    if isinstance(value, str):
        # Numeric-looking strings are NOT coerced: varchar '1' differs from the
        # integer 1 unless the runner typed them the same way.
        return (_STR, value)
    return (_OTHER, str(value))


def _cell_compatible(left: object, right: object, tolerance: Decimal) -> bool:
    if left is None or right is None:
        return left is None and right is None
    if left[0] != right[0]:
        return False
    kind = left[0]
    if kind == _NAN:
        # IEEE-754 convention: NaN never equals anything, including NaN.
        return False
    if kind == _INF:
        return left[1] == right[1]
    if kind == _NUMBER:
        return abs(left[1] - right[1]) <= tolerance
    return left[1] == right[1]


def _row_key(row: list[object]) -> tuple[object, ...]:
    return tuple(row)


def _rows_compatible(left: list[object], right: list[object], tolerance: Decimal) -> bool:
    if len(left) != len(right):
        return False
    return all(_cell_compatible(a, b, tolerance) for a, b in zip(left, right, strict=True))


def _perfect_match(
    expected: list[list[object]], observed: list[list[object]], tolerance: Decimal
) -> bool:
    """True when every expected row can be matched to a distinct observed row.

    A one-to-one maximum matching with backtracking. With a numeric tolerance
    the relation is not transitive (1.00≈1.004≈1.008 but 1.00≉1.008), so a
    greedy scan can under-count; this finds a perfect matching if one exists.
    Result sets are small by construction, which keeps the search bounded.
    """
    if len(expected) != len(observed):
        return False
    used = [False] * len(observed)

    def visit(index: int) -> bool:
        for candidate in range(len(observed)):
            if used[candidate]:
                continue
            if not _rows_compatible(expected[index], observed[candidate], tolerance):
                continue
            used[candidate] = True
            if index == len(expected) - 1 or visit(index + 1):
                return True
            used[candidate] = False
        return False

    return visit(0) if expected else True


def _check_shape(expected: Relation, observed: Relation, column_order: ColumnOrder):
    """Return (aligned observed relation, error reason or None)."""
    if len(expected.columns) != len(observed.columns):
        return None, (
            f"列数不同：期望 {len(expected.columns)} 列，实际 {len(observed.columns)} 列。"
        )
    if not expected.columns and (expected.rows or observed.rows):
        return None, "缺少列名时无法对齐带数据行的结果。"
    for relation in (expected, observed):
        for index, row in enumerate(relation.rows):
            if len(row) != len(relation.columns):
                return None, (
                    f"第 {index + 1} 行的单元格数（{len(row)}）与列数"
                    f"（{len(relation.columns)}）不一致。"
                )
    if column_order is ColumnOrder.IGNORED and expected.columns:
        if len(set(expected.columns)) != len(expected.columns) or len(
            set(observed.columns)
        ) != len(observed.columns):
            return None, "列名有重复，无法按列名忽略列顺序比较。"
        if set(expected.columns) != set(observed.columns):
            return None, (
                f"列名集合不同：期望 {expected.columns}，实际 {observed.columns}。"
            )
        permutation = [observed.columns.index(name) for name in expected.columns]
        aligned = Relation(
            columns=list(expected.columns),
            rows=[[row[i] for i in permutation] for row in observed.rows],
        )
        return aligned, None
    if expected.columns and expected.columns != observed.columns:
        return None, f"列名或列顺序不同：期望 {expected.columns}，实际 {observed.columns}。"
    return observed, None


def _validate_tolerance(numeric_tolerance: float) -> Decimal:
    try:
        tolerance = Decimal(str(numeric_tolerance))
    except InvalidOperation as exc:
        raise ValueError("numeric_tolerance 必须是有限数值") from exc
    if not tolerance.is_finite():
        raise ValueError("numeric_tolerance 必须是有限数值")
    if tolerance < 0:
        raise ValueError("numeric_tolerance 不能为负数")
    return tolerance


def compare_relations(
    expected: Relation,
    observed: Relation,
    semantics: ResultSemantics,
    column_order: ColumnOrder = ColumnOrder.SIGNIFICANT,
    numeric_tolerance: float = 0.0,
) -> RelationComparison:
    tolerance = _validate_tolerance(numeric_tolerance)
    exp = expected.normalized()
    obs_raw = observed.normalized()
    # _check_shape returns an already-normalized relation in both branches
    # (the observed relation, optionally re-ordered by column name), so it must
    # not be normalized again: normalize_cell is not idempotent on tag tuples.
    aligned, shape_error = _check_shape(exp, obs_raw, column_order)
    if shape_error is not None:
        return RelationComparison(
            matches=False,
            semantics=semantics,
            column_order=column_order,
            reason=shape_error,
        )
    obs = aligned

    if semantics is ResultSemantics.ORDERED:
        if len(exp.rows) != len(obs.rows):
            return RelationComparison(
                matches=False, semantics=semantics, column_order=column_order,
                reason=f"行数不同：期望 {len(exp.rows)} 行，实际 {len(obs.rows)} 行。",
            )
        for index, (erow, orow) in enumerate(zip(exp.rows, obs.rows, strict=True)):
            if not _rows_compatible(erow, orow, tolerance):
                return RelationComparison(
                    matches=False, semantics=semantics, column_order=column_order,
                    reason=f"第 {index + 1} 行起顺序或内容不一致（有序比较）。",
                )
        return RelationComparison(
            matches=True, semantics=semantics, column_order=column_order,
            reason="有序结果逐行一致。",
        )

    # set / multiset: rows are unordered. A set records presence (multiplicity
    # 1); a multiset records real multiplicity. Exact comparison uses a bag;
    # a tolerance comparison uses a one-to-one matching so a value can only be
    # consumed once.
    dedup = semantics is ResultSemantics.SET
    exp_rows = _dedup_rows(exp.rows) if dedup else exp.rows
    obs_rows = _dedup_rows(obs.rows) if dedup else obs.rows

    if tolerance == 0:
        exp_bag = _row_bag(exp_rows)
        obs_bag = _row_bag(obs_rows)
        if exp_bag == obs_bag:
            return _matched(semantics, column_order, dedup)
        return _mismatch(exp_bag, obs_bag, semantics, column_order)

    if _perfect_match(exp_rows, obs_rows, tolerance):
        return _matched(semantics, column_order, dedup)
    word = _semantics_word(semantics)
    return RelationComparison(
        matches=False,
        semantics=semantics,
        column_order=column_order,
        reason=(
            f"在给定数值容差下无法将期望行与实际行一一匹配（{word}语义，"
            f"期望 {len(exp_rows)} 行、实际 {len(obs_rows)} 行）。"
        ),
    )


def _dedup_rows(rows: list[list[object]]) -> list[list[object]]:
    seen: set[tuple[object, ...]] = set()
    result: list[list[object]] = []
    for row in rows:
        key = _row_key(row)
        if key not in seen:
            seen.add(key)
            result.append(row)
    return result


def _matched(
    semantics: ResultSemantics, column_order: ColumnOrder, dedup: bool
) -> RelationComparison:
    if dedup:
        return RelationComparison(
            matches=True, semantics=semantics, column_order=column_order,
            reason="结果作为行集合一致（无序、忽略重复行）。",
        )
    return RelationComparison(
        matches=True, semantics=semantics, column_order=column_order,
        reason="结果作为行多重集一致（无序、重复行数相同）。",
    )


def _row_bag(rows: list[list[object]]) -> dict:
    bag: dict = {}
    for row in rows:
        key = _row_key(row)
        bag[key] = bag.get(key, 0) + 1
    return bag


def _mismatch(
    exp_bag: dict, obs_bag: dict, semantics: ResultSemantics, column_order: ColumnOrder
) -> RelationComparison:
    missing = _diff(exp_bag, obs_bag)
    extra = _diff(obs_bag, exp_bag)
    parts = []
    if missing:
        parts.append(f"缺少 {_count(missing)} 行（按{_semantics_word(semantics)}计）")
    if extra:
        parts.append(f"多出 {_count(extra)} 行（按{_semantics_word(semantics)}计）")
    reason = "；".join(parts) or "结果不一致。"
    if semantics is ResultSemantics.SET:
        reason += "（集合语义忽略重复行）"
    return RelationComparison(
        matches=False, semantics=semantics, column_order=column_order, reason=reason + "。"
    )


def _diff(left: dict, right: dict) -> dict:
    result = {}
    for key, count in left.items():
        delta = count - right.get(key, 0)
        if delta > 0:
            result[key] = delta
    return result


def _count(bag: dict) -> int:
    return sum(bag.values())


def _semantics_word(semantics: ResultSemantics) -> str:
    return "集合" if semantics is ResultSemantics.SET else "多重集"
