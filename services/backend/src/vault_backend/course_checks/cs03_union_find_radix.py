"""Versioned CS03 release data for union-find and radix sort."""

from __future__ import annotations

from uuid import NAMESPACE_URL, uuid5

from vault_backend.course_checks import cs03_priority_queue as _previous
from vault_backend.course_checks.cs03_radix_sort import (
    INDEPENDENT as _RADIX_INDEPENDENT,
    OBJECTIVE as _RADIX_OBJECTIVE,
    ORACLE_ID as _RADIX_ORACLE,
    VISIBLE as _RADIX_VISIBLE,
    radix_sort_model,
)
from vault_backend.course_checks.cs03_union_find import (
    INDEPENDENT as _UF_INDEPENDENT,
    OBJECTIVE as _UF_OBJECTIVE,
    ORACLE_ID as _UF_ORACLE,
    VISIBLE as _UF_VISIBLE,
    union_find_model,
)

COURSE_VERSION = str(uuid5(NAMESPACE_URL, "vault:CS03-core-practice-0.5.0"))


def activity_id(goal: str) -> str:
    return str(uuid5(NAMESPACE_URL, "vault:" + goal + "-CODE:0.5.0"))


ORACLES = {
    **_previous.ORACLES,
    _UF_ORACLE: union_find_model,
    _RADIX_ORACLE: radix_sort_model,
}
INPUTS = {
    **_previous.INPUTS,
    _UF_ORACLE: (_UF_VISIBLE, _UF_INDEPENDENT),
    _RADIX_ORACLE: (_RADIX_VISIBLE, _RADIX_INDEPENDENT),
}
GOALS = {
    **_previous.GOALS,
    _UF_OBJECTIVE: (_UF_ORACLE, "weighted_union_path_compression"),
    _RADIX_OBJECTIVE: (_RADIX_ORACLE, "stable_unsigned_lsd_radix"),
}
COMPARATORS = {**_previous.COMPARATORS, _UF_ORACLE: "exact", _RADIX_ORACLE: "exact"}
