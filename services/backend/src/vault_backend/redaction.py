"""Remove historical hidden-suite details at storage and response boundaries."""

_HIDDEN_REASON = "保密独立输入不公开；仅保留公开判定与汇总。"


def redact_hidden_suite_fields(payload: object) -> object:
    """Copy only changed branches; cover exports and nested review snapshots too."""
    if isinstance(payload, list):
        cleaned = [redact_hidden_suite_fields(item) for item in payload]
        return payload if all(a is b for a, b in zip(payload, cleaned, strict=True)) else cleaned
    if not isinstance(payload, dict):
        return payload
    cleaned = {key: redact_hidden_suite_fields(value) for key, value in payload.items()}
    suite = cleaned.get("suite_assessment")
    if isinstance(suite, dict) and isinstance(suite.get("cases"), list):
        cases = []
        ordinal = 0
        for case in suite["cases"]:
            if isinstance(case, dict) and case.get("kind") == "independent":
                ordinal += 1
                case = dict(case, stdin=None, expected_stdout=None, observed_stdout=None,
                            case_code=f"independent-{ordinal}", reason=_HIDDEN_REASON)
            cases.append(case)
        if ordinal:
            # Old aggregate reasons also embedded private input/answer values.
            criteria = [dict(row, reason=_HIDDEN_REASON) if isinstance(row, dict) else row
                        for row in suite.get("criteria", [])]
            cleaned["suite_assessment"] = dict(suite, cases=cases, criteria=criteria)
    return payload if cleaned == payload else cleaned
