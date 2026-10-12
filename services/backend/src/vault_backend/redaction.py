"""Trust-boundary redaction of historical hidden semantic-suite data.

Early suite results stored the independent (server-held) cases in full —
stdin, expected answer and observed output — inside ordinary learning records.
The server now redacts at the trust boundary so those secrets can never be
re-served, re-imported, exported or frozen into a review snapshot, regardless
of the client. This is a server-side guarantee, not a frontend display choice.
"""

from __future__ import annotations

import copy

_HIDDEN_REASON = "保密独立输入不公开；历史记录已在服务端去敏。"


def redact_hidden_suite_fields(payload: object) -> object:
    """Return a copy of ``payload`` with independent-case secrets removed.

    Only the server-held independent cases are touched; the public aggregate
    counts and the learning-visible cases are preserved verbatim.
    """
    if not isinstance(payload, dict):
        return payload
    result = payload.get("result")
    if not isinstance(result, dict):
        return payload
    suite = result.get("suite_assessment")
    if not isinstance(suite, dict):
        return payload
    cases = suite.get("cases")
    if not isinstance(cases, list):
        return payload
    cleaned = copy.deepcopy(payload)
    redacted = False
    ordinal = 0
    for case in cleaned["result"]["suite_assessment"]["cases"]:
        if not isinstance(case, dict) or case.get("kind") != "independent":
            continue
        ordinal += 1
        if (
            case.get("stdin") is not None
            or case.get("expected_stdout") is not None
            or case.get("observed_stdout") is not None
            or not str(case.get("case_code", "")).startswith("independent-")
        ):
            redacted = True
        case["stdin"] = None
        case["expected_stdout"] = None
        case["observed_stdout"] = None
        case["case_code"] = f"independent-{ordinal}"
        if case.get("reason"):
            case["reason"] = _HIDDEN_REASON
    if not redacted:
        return payload
    return cleaned
