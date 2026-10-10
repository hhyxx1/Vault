"""Append trusted author conditions. Does not execute source or load learner grades."""

import ast
import copy
import json
import pprint
import sys
from pathlib import Path


def register_rows(registry, rows):
    versions = {}
    for row in rows:
        if not row["id"].endswith("/repaired"):
            continue
        if row["decision"] != "met":
            raise ValueError("Repaired author fixture must match its condition")
        key = (row["goal"], row["task"])
        rule = (row["activity"], row["request"]["stdin"], "success", row["stdout"], "")
        rules = versions.setdefault(row["version"], {})
        if key in rules and rules[key] != rule:
            raise ValueError("Conflicting authored condition")
        rules[key] = rule
    result = copy.deepcopy(registry)
    for version, rules in versions.items():
        if version in result and result[version] != rules:
            raise ValueError("Published code rules are immutable; create a new version")
        result[version] = rules
    return result


def main():
    root = Path(__file__).resolve().parents[2]
    destination = (
        root / "services/backend/src/vault_backend/course_checks/generic_rules.py"
    )
    tree = ast.parse(destination.read_text(encoding="utf-8"))
    assignment = next(node for node in tree.body if isinstance(node, ast.Assign))
    registry = ast.literal_eval(assignment.value)
    rows = json.loads((root / sys.argv[1]).read_text(encoding="utf-8"))
    result = register_rows(registry, rows)
    destination.write_text(
        '"""Frozen additional code-course rules. Never change published entries."""\n\n'
        + "GENERIC_RULES = "
        + pprint.pformat(result, width=95)
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
