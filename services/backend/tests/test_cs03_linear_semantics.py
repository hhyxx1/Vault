"""Independent expectations for complete linear-structure operation protocols."""

from uuid import NAMESPACE_URL, uuid5

import pytest

from vault_backend.course_checks.semantic_suites import ORACLES, get_suite

VERSION = str(uuid5(NAMESPACE_URL, "vault:CS03-core-practice-0.3.0"))


@pytest.mark.parametrize(
    "oracle,stdin,expected",
    [
        (
            "cs03_list",
            "3\nI 0 5\nI 1 -2\nI 1 9\nI 3 7\nP\nD 0\nG 1\nS 1 4\nR\nD 2\nV\n",
            "ok\nok\nok\nfull\n5 9 -2\n5\n-2\nok\n4 9\ninvalid\nvalid\n",
        ),
        (
            "cs03_list",
            "1\nD 0\nG -1\nI 1 3\nI 0 3\nD 0\nP\nV\n",
            "invalid\ninvalid\ninvalid\nok\n3\nempty\nvalid\n",
        ),
        (
            "cs03_stack",
            "2\npop\npush 4\npush -1\npush 9\npeek\npop\npop\npop\nsize\n",
            "empty\nok\nok\nfull\n-1\n-1\n4\nempty\n0\n",
        ),
        (
            "cs03_queue",
            "2\npush 4\npush 5\npush 6\npop\npush 7\npeek\npop\npop\npop\npush 8\npeek\nsize\n",
            "ok\nok\nfull\n4\nok\n5\n5\n7\nempty\nok\n8\n1\n",
        ),
        (
            "cs03_brackets",
            "([]){}\n([)]\nabc\n\n(((\n]a\n",
            "balanced\nunbalanced\nbalanced\nbalanced\nunbalanced\nunbalanced\n",
        ),
        (
            "cs03_cost",
            "5 0\n5 4\n0 0\n5 -1\n",
            "get=1,1 insert=5 delete=4\nget=1,5 insert=1 delete=0\n"
            "get=invalid insert=0 delete=invalid\ninvalid\n",
        ),
    ],
)
def test_models_have_independently_written_expected_results(oracle, stdin, expected):
    assert ORACLES[oracle](stdin) == expected


@pytest.mark.parametrize("module", [1, 2, 3])
@pytest.mark.parametrize("goal", [1, 2, 3])
def test_all_first_three_module_goals_have_version_bound_suites(module, goal):
    code = f"CS03-M{module:02d}-O{goal:02d}"
    suite = get_suite(VERSION, code)
    assert suite.language == "cpp17"
    assert len(suite.visible_cases) >= 2
    assert len(suite.independent_cases) >= 3
    assert suite.comparator == "exact"
    assert suite.activity_version_id == str(uuid5(NAMESPACE_URL, "vault:" + code + "-CODE:0.3.0"))


@pytest.mark.parametrize("module", range(1, 11))
@pytest.mark.parametrize("goal", range(1, 4))
def test_complete_implementation_variant_has_its_own_saved_task_identity(module, goal):
    from vault_backend.course_checks.code_tasks import resolve_task

    objective = f"CS03-M{module:02d}-O{goal:02d}"
    base = resolve_task(VERSION, objective, "base")
    independent = resolve_task(VERSION, objective, "from-scratch")
    assert independent.task_code == "from-scratch"
    assert independent.stdin == base.stdin
    assert independent.activity_version_id == base.activity_version_id
