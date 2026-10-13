"""Stable unsigned 32-bit LSD radix-sort oracle for CS03."""

from __future__ import annotations

import json


def radix_sort_model(stdin: str) -> str:
    tokens = stdin.split()
    if not tokens:
        raise ValueError("Radix-sort fixtures require a record count")
    count = int(tokens[0])
    if not 0 <= count <= 500 or len(tokens) != 1 + 2 * count:
        raise ValueError("Invalid radix-sort fixture size")
    records: list[tuple[int, int]] = []
    for index in range(count):
        key, tag = int(tokens[1 + 2 * index]), int(tokens[2 + 2 * index])
        if not 0 <= key <= 0xFFFF_FFFF:
            raise ValueError("Radix-sort keys must be unsigned 32-bit integers")
        records.append((key, tag))
    records.sort(key=lambda row: row[0])
    return json.dumps({"records": records}, separators=(",", ":")) + "\n"


ORACLE_ID = "cs03_radix_sort"
OBJECTIVE = "CS03-M10-O04"
VISIBLE = (
    "7\n256 0\n0 1\n1 2\n256 3\n255 4\n65536 5\n0 6\n",
    "6\n4294967295 0\n1 1\n16777216 2\n255 3\n256 4\n1 5\n",
)
INDEPENDENT = (
    "1\n2147483648 9\n",
    "0\n",
    "8\n42 0\n0 1\n65536 2\n4294967295 3\n255 4\n42 5\n256 6\n1 7\n",
    "5\n0 4\n0 3\n0 2\n0 1\n0 0\n",
)
