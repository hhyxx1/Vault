"""Generate the 20-field engineering ledger; never infer acceptance from fixtures."""

import csv
import json
from pathlib import Path

FIELDS = [
    "course_version",
    "module_id",
    "objective_id",
    "core_or_elective",
    "criteria_ids",
    "theory_refs",
    "activity_ids",
    "environment_profiles",
    "checker_or_review_route",
    "normal_case_ids",
    "wrong_case_ids",
    "variant_ids",
    "source_refs",
    "reviewer",
    "review_date",
    "test_run",
    "blocking_issue",
    "content_state",
    "activity_state",
    "assessment_state",
]
PROFILES = {
    "c17": "c17-isolate-dev@0.1.0",
    "cpp17": "cpp17-isolate-dev@0.1.0",
    "java21": "java21-isolate-dev@0.1.0",
    "python313": "python313-isolate-dev@0.1.0",
    "python313ml": "python313ml-isolate-dev@0.1.0",
    "node24": "node24-isolate-dev@0.1.0",
    "postgres18": "postgres18-isolate-dev@0.1.0",
}


def normalized(request):
    return {**request, "stdin": request.get("stdin", "")}


def build_rows(root):
    catalog = json.loads(
        (root / "content/courses/scope-catalog.json").read_text(encoding="utf-8")
    )
    fixtures = []
    for path in sorted((root / "services/backend/fixtures/course-code").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            fixtures += [
                (path.name, row)
                for row in data
                if isinstance(row, dict) and "request" in row
            ]
    output = []
    for course in catalog["courses"]:
        package = json.loads(
            (root / "content/courses" / course["package_path"]).read_text(
                encoding="utf-8"
            )
        )
        for goal in package["objectives"]:
            activities = [
                a for a in package["activities"] if goal["code"] in a["objective_codes"]
            ]
            normal, wrong, profiles, variants, sources = [], [], set(), [], set()
            for a in activities:
                tasks = [
                    {
                        "code": "base",
                        "code_request": a["code_request"],
                        "reference_answer": a["reference_answer"],
                    },
                    *a["variants"],
                ]
                sources.update(a["source_refs"])
                for task in tasks:
                    profiles.add(PROFILES[task["code_request"]["language"]])
                    if task["code"] != "base":
                        variants.append(task["code"])
                    for filename, row in fixtures:
                        if (
                            row.get("goal") != goal["code"]
                            or row.get("task", "base") != task["code"]
                        ):
                            continue
                        reference = f"{filename}#{row['id']}"
                        # An older fixture can map only if the literal input/source is unchanged.
                        # This maps author cases, not a new version's execution pass or Q gate.
                        if (
                            task.get("reference_answer")
                            and row.get("decision") == "met"
                            and normalized(row["request"])
                            == normalized(task["reference_answer"])
                        ):
                            normal.append(reference)
                        if row.get("decision") == "not_met" and normalized(
                            row["request"]
                        ) == normalized(task["code_request"]):
                            wrong.append(reference)
            output.append(
                dict(
                    zip(
                        FIELDS,
                        [
                            course["version"],
                            goal["code"].rsplit("-O", 1)[0],
                            goal["code"],
                            "core",
                            ";".join(c["id"] for c in goal["criteria"]),
                            ";".join(
                                course["package_path"] + "#" + a["code"] + "/theory"
                                for a in activities
                            )
                            or "missing_theory",
                            ";".join(a["version"] for a in activities)
                            or "missing_activity",
                            ";".join(sorted(profiles)) or "missing_environment",
                            "fixed_condition:versioned_server_rule;explanation/independent_transfer:pending",
                            ";".join(sorted(set(normal)))
                            or "no_literal_current_reference_fixture_mapping",
                            ";".join(sorted(set(wrong)))
                            or "no_literal_current_starter_fixture_mapping",
                            ";".join(variants) or "missing_variant",
                            ";".join(sorted(sources)) or "missing_sources",
                            "unavailable_no_professional_signoff",
                            "not_applicable_no_signoff",
                            "consult_versioned_reports;fixtures_are_not_execution_passes",
                            "full_depth;alternative_correct_solution;two_meaningful_errors;independent_transfer;open_review;Q4/Q5",
                            "partial_original_theory;not_Q1_complete",
                            "bounded_practice_ready;not_all_required_labs",
                            "fixed_condition_only;explanation_and_independence_pending",
                        ],
                        strict=True,
                    )
                )
            )
    return output


def main():
    root = Path(__file__).resolve().parents[2]
    path = root / "document/course-reviews/13-course-core-coverage.csv"
    rows = build_rows(root)
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print("Generated 366-goal partial-delivery ledger; no acceptance inferred")


if __name__ == "__main__":
    main()
