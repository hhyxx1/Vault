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
- column order is significant by default (positional projection), optionally
  ignored by matching column names;
- numbers compare with an optional tolerance via deterministic quantization
  (so multiset multiplicity stays countable), exact by default.

Nothing here executes SQL or reads an "answer" from the client; it only decides
whether two relations the trusted layer already holds are equivalent.
"""

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

    def normalized(self, tolerance: Decimal) -> "Relation":
        return Relation(
            columns=list(self.columns),
            rows=[[normalize_cell(cell, tolerance) for cell in row] for row in self.rows],
        )


class RelationComparison(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    matches: bool
    semantics: ResultSemantics
    column_order: ColumnOrder
    reason: str = Field(min_length=1)


def normalize_cell(value: object, tolerance: Decimal) -> object:
    """Make a scalar cell hashable and comparable with SQL conventions."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, Decimal):
        number = value
    elif isinstance(value, (int, float)):
        try:
            number = Decimal(str(value))
        except InvalidOperation:
            return str(value)
    elif isinstance(value, str):
        # Numeric-looking strings are NOT coerced: varchar '1' differs from
        # integer 1 unless the runner typed them the same way.
        return value
    else:
        return str(value)
    if tolerance > 0:
        # Deterministic quantization keeps rows countable for multisets.
        exponent = -tolerance.as_tuple().exponent if tolerance < 1 else 0
        quant = Decimal(1).scaleb(-exponent) if exponent > 0 else Decimal(1)
        return number.quantize(quant)
    return number


def _row_key(row: list[object]) -> tuple[object, ...]:
    return tuple(row)


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


def compare_relations(
    expected: Relation,
    observed: Relation,
    semantics: ResultSemantics,
    column_order: ColumnOrder = ColumnOrder.SIGNIFICANT,
    numeric_tolerance: float = 0.0,
) -> RelationComparison:
    tolerance = Decimal(str(numeric_tolerance))
    exp = expected.normalized(tolerance)
    obs_raw = observed.normalized(tolerance)
    aligned, shape_error = _check_shape(exp, obs_raw, column_order)
    if shape_error is not None:
        return RelationComparison(
            matches=False,
            semantics=semantics,
            column_order=column_order,
            reason=shape_error,
        )
    obs = aligned.normalized(tolerance)

    if semantics is ResultSemantics.ORDERED:
        if len(exp.rows) != len(obs.rows):
            return RelationComparison(
                matches=False, semantics=semantics, column_order=column_order,
                reason=f"行数不同：期望 {len(exp.rows)} 行，实际 {len(obs.rows)} 行。",
            )
        for index, (erow, orow) in enumerate(zip(exp.rows, obs.rows, strict=True)):
            if _row_key(erow) != _row_key(orow):
                return RelationComparison(
                    matches=False, semantics=semantics, column_order=column_order,
                    reason=f"第 {index + 1} 行起顺序或内容不一致（有序比较）。",
                )
        return RelationComparison(
            matches=True, semantics=semantics, column_order=column_order,
            reason="有序结果逐行一致。",
        )

    # set / multiset: compare rows as collections ignoring order. A set records
    # presence (multiplicity 1); a multiset records real multiplicity.
    dedup = semantics is ResultSemantics.SET
    exp_bag = _row_bag(exp.rows, dedup)
    obs_bag = _row_bag(obs.rows, dedup)

    if exp_bag == obs_bag:
        if semantics is ResultSemantics.SET:
            return RelationComparison(
                matches=True, semantics=semantics, column_order=column_order,
                reason="结果作为行集合一致（无序、忽略重复行）。",
            )
        return RelationComparison(
            matches=True, semantics=semantics, column_order=column_order,
            reason="结果作为行多重集一致（无序、重复行数相同）。",
        )

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


def _row_bag(rows: list[list[object]], dedup: bool) -> dict:
    bag: dict = {}
    for row in rows:
        key = _row_key(row)
        bag[key] = 1 if dedup else bag.get(key, 0) + 1
    return bag


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
