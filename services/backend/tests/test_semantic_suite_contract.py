"""C02 discovery contract: a public package may announce a trusted semantic
suite, but it can never carry the oracle, expected outputs or independent
inputs, and the announcement must match the server-held registry."""

import copy
import json

import pytest
from pydantic import ValidationError

from vault_backend.course_checks.semantic_suites import SUITES, get_suite
from vault_backend.course_packages import PublicCoursePackage


def _load(settings):
    path = (
        settings.course_catalog_path.parent
        / "CS01"
        / "CS01-core-practice-0.9.0"
        / "manifest.json"
    )
    return json.loads(path.read_text(encoding="utf-8")), path


def _all_packages(settings):
    content_root = settings.course_catalog_path.parent
    packages = {}
    for manifest in content_root.glob("CS*/*/manifest.json"):
        raw = json.loads(manifest.read_text(encoding="utf-8"))
        packages[raw["course_version_id"]] = raw
    return packages


def test_cs01_package_validates_with_the_semantic_suite_announcement(settings):
    raw, _ = _load(settings)
    package = PublicCoursePackage.model_validate(raw)
    activity = next(
        a
        for a in package.activities
        if a.kind == "code" and "CS01-M03-O03" in a.objective_codes
    )
    assert activity.semantic_suite is not None
    assert activity.semantic_suite.standard_version == "code-semantic-suite-v1"
    assert activity.semantic_suite.independent_case_count == 6
    # Only learning-visible inputs are published; never an expected output.
    assert all(
        set(case.model_dump().keys()) == {"code", "stdin"}
        for case in activity.semantic_suite.visible_cases
    )


def test_package_announcement_matches_the_trusted_registry(settings):
    raw, _ = _load(settings)
    package = PublicCoursePackage.model_validate(raw)
    activity = next(
        a
        for a in package.activities
        if a.semantic_suite is not None and "CS01-M03-O03" in a.objective_codes
    )
    announced = activity.semantic_suite
    suite = get_suite(
        raw["course_version_id"], "CS01-M03-O03", activity.version_id
    )
    assert announced.oracle_id == suite.oracle_id
    assert announced.comparator == suite.comparator
    assert announced.language == suite.language
    assert announced.scope_note == suite.scope_note
    assert [(c.code, c.stdin) for c in announced.visible_cases] == [
        (c.code, c.stdin) for c in suite.visible_cases
    ]
    assert announced.independent_case_count == len(suite.independent_cases)
    # The independent inputs must never be published; the oracle and its
    # expected outputs live server-side only.
    published = json.dumps(raw, ensure_ascii=False)
    for independent in suite.independent_cases:
        assert independent.stdin not in published


def test_every_registered_suite_is_discoverable_in_a_public_package(settings):
    packages = _all_packages(settings)
    assert SUITES, "registry should contain at least one audited suite"
    for (course_version_id, objective), suite in SUITES.items():
        raw = packages.get(course_version_id)
        assert raw is not None, f"no package for registered suite {objective}"
        package = PublicCoursePackage.model_validate(raw)
        announced = [
            a.semantic_suite
            for a in package.activities
            if objective in a.objective_codes and a.semantic_suite is not None
        ]
        assert len(announced) == 1, f"{objective} must be announced exactly once"
        assert announced[0].oracle_id == suite.oracle_id
        assert announced[0].independent_case_count == len(suite.independent_cases)


def _cs01_activity(settings):
    raw, _ = _load(settings)
    activity = next(
        a
        for a in raw["activities"]
        if a.get("kind") == "code" and "CS01-M03-O03" in a.get("objective_codes", [])
    )
    return raw, activity


def _replace_activity(raw, leaked):
    for index, current in enumerate(raw["activities"]):
        if current.get("code") == leaked.get("code"):
            raw["activities"][index] = leaked
            return
    raise AssertionError("activity to replace not found")


def test_manifest_cannot_publish_expected_outputs_or_independent_inputs(settings):
    raw, activity = _cs01_activity(settings)
    leaked = copy.deepcopy(activity)
    leaked["semantic_suite"]["visible_cases"][0]["expected_stdout"] = "0\n"
    _replace_activity(raw, leaked)
    with pytest.raises(ValidationError):
        PublicCoursePackage.model_validate(raw)

    raw, activity = _cs01_activity(settings)
    leaked = copy.deepcopy(activity)
    leaked["semantic_suite"]["independent_cases"] = [{"code": "x", "stdin": "31\n"}]
    _replace_activity(raw, leaked)
    with pytest.raises(ValidationError):
        PublicCoursePackage.model_validate(raw)


def test_semantic_suite_is_restricted_to_matching_code_activities(settings):
    raw, activity = _cs01_activity(settings)

    wrong_language = copy.deepcopy(raw)
    target = next(
        a
        for a in wrong_language["activities"]
        if a.get("kind") == "code" and "CS01-M03-O03" in a.get("objective_codes", [])
    )
    target["semantic_suite"]["language"] = "python313"
    with pytest.raises(ValidationError):
        PublicCoursePackage.model_validate(wrong_language)

    non_code = copy.deepcopy(raw)
    target = next(
        a
        for a in non_code["activities"]
        if a.get("kind") == "code" and "CS01-M03-O03" in a.get("objective_codes", [])
    )
    suite_meta = target.pop("semantic_suite")
    target["kind"] = "open_response"
    target.pop("code_request", None)
    target.pop("reference_answer", None)
    target["variants"] = []
    target["semantic_suite"] = suite_meta
    with pytest.raises(ValidationError):
        PublicCoursePackage.model_validate(non_code)
