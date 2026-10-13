import json

from vault_backend.redaction import redact_hidden_suite_fields


def test_historical_reasons_and_nested_snapshots_cannot_reveal_hidden_cases():
    suite = {
        "cases": [{"kind": "independent", "case_code": "independent-1",
                   "stdin": None, "expected_stdout": None, "observed_stdout": None,
                   "status": "not_met", "reason": "secret-314159"}],
        "criteria": [{"id": "fixed_condition", "status": "not_met",
                      "reason": "failed independent input secret-314159"}],
    }
    source = {"snapshots": [{"client_reported_result": {"suite_assessment": suite}}]}
    cleaned = redact_hidden_suite_fields(source)
    assert "secret-314159" not in json.dumps(cleaned)
    assert cleaned["snapshots"][0]["client_reported_result"]["suite_assessment"][
        "criteria"][0]["status"] == "not_met"
    assert "secret-314159" in json.dumps(source)
    assert redact_hidden_suite_fields(cleaned) == cleaned
