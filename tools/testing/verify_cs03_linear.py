"""Run authored CS03 reference works in the real isolated worker.

Requires a private worker token in the environment; never writes the token.
Outputs a reproducible, per-input outcome ledger rather than claiming mastery.
"""

import asyncio
import hashlib
import json
import os
from datetime import UTC, datetime
from pathlib import Path

import httpx
from vault_backend.code_execution import CodeRequest, CodeResult
from vault_backend.course_checks import cs03_linear as model
from vault_backend.course_checks.semantic_suites import (
    SUITES,
    compare_output,
    run_suite,
)

ROOT = Path(__file__).resolve().parents[2]
package = json.loads(
    (ROOT / "content/courses/CS03/CS03-core-practice-0.3.0/manifest.json").read_text(
        encoding="utf-8"
    )
)
records = []
with httpx.Client(timeout=90, trust_env=False) as client:
    for activity in package["activities"]:
        goal = activity["objective_codes"][0]
        if goal not in model.GOALS:
            continue
        oracle, _ = model.GOALS[goal]
        visible_outputs = []
        for group, inputs in zip(
            ("visible", "independent"), model.INPUTS[oracle], strict=True
        ):
            for i, stdin in enumerate(inputs):
                request = dict(activity["reference_answer"], stdin=stdin)
                result = client.post(
                    os.environ.get("VAULT_CODE_WORKER_URL", "http://127.0.0.1:8091")
                    + "/v1/runs",
                    headers={
                        "Authorization": "Bearer "
                        + os.environ["VAULT_CODE_WORKER_TOKEN"]
                    },
                    json=request,
                )
                result.raise_for_status()
                value = result.json()
                if group == "visible":
                    visible_outputs.append((stdin, value["stdout"]))
                expected = model.ORACLES[oracle](stdin)
                ok = value["status"] == "success" and compare_output(
                    SUITES[(model.COURSE_VERSION, goal)].comparator,
                    expected,
                    value["stdout"],
                )
                # Server-held inputs and answers must never enter a public report.
                records.append(
                    {
                        "objective": goal,
                        "kind": group,
                        "index": i + 1,
                        "passed": ok,
                        "status": value["status"],
                    }
                )
                print(goal, group, i + 1, value["status"], ok, flush=True)
                if not ok:
                    raise SystemExit(
                        "Reference execution does not match model: " + goal
                    )
        initial = client.post(
            os.environ.get("VAULT_CODE_WORKER_URL", "http://127.0.0.1:8091")
            + "/v1/runs",
            headers={
                "Authorization": "Bearer " + os.environ["VAULT_CODE_WORKER_TOKEN"]
            },
            json=activity["code_request"],
        )
        initial.raise_for_status()
        value = initial.json()
        if value["status"] == "environment_error":
            raise SystemExit("Worker unavailable")
        detected = value["status"] != "success" or not compare_output(
            SUITES[(model.COURSE_VERSION, goal)].comparator,
            model.ORACLES[oracle](activity["code_request"]["stdin"]),
            value["stdout"],
        )
        records.append(
            {
                "objective": goal,
                "kind": "starter_error",
                "index": 1,
                "passed": detected,
                "status": value["status"],
            }
        )
        print(goal, "starter_error", detected, flush=True)
        if not detected:
            raise SystemExit("Starter defect not detected: " + goal)
        branches = "\n".join(
            'if(input==R"VAULT('
            + stdin
            + ')VAULT"){std::cout<<R"VAULT('
            + output
            + ')VAULT";return 0;}'
            for stdin, output in visible_outputs
        )
        source = (
            "#include <iostream>\n#include <string>\n#include <iterator>\nint main(){std::string input((std::istreambuf_iterator<char>(std::cin)),{});"
            + branches
            + '\nstd::cout<<"unmatched sample\\n";}'
        )
        hardcoded = CodeRequest(
            language="cpp17", entry="main.cpp", files={"main.cpp": source}
        )

        async def execute(code):
            response = client.post(
                os.environ.get("VAULT_CODE_WORKER_URL", "http://127.0.0.1:8091")
                + "/v1/runs",
                headers={
                    "Authorization": "Bearer " + os.environ["VAULT_CODE_WORKER_TOKEN"]
                },
                json=code.model_dump(),
            )
            response.raise_for_status()
            return CodeResult.model_validate(response.json())

        assessment = asyncio.run(
            run_suite(execute, hardcoded, SUITES[(model.COURSE_VERSION, goal)])
        )
        detected = assessment["suspected_hardcoding"] is True
        redacted = all(
            case["stdin"] is None
            and case["expected_stdout"] is None
            and case["observed_stdout"] is None
            for case in assessment["cases"]
            if case["kind"] == "independent"
        )
        records.append(
            {
                "objective": goal,
                "kind": "sample_hardcoding",
                "passed": detected,
                "independent_redacted": redacted,
            }
        )
        print(goal, "sample_hardcoding", detected, redacted, flush=True)
        if not detected or not redacted:
            raise SystemExit(
                "Sample-only program not detected or hidden data leaked: " + goal
            )

report = (
    ROOT
    / "document/course-reviews/CS03/CS03-core-practice-0.3.0/worker-verification.json"
)
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(
    json.dumps(
        {
            "course_version_id": model.COURSE_VERSION,
            "verified_at": datetime.now(UTC).isoformat(),
            "manifest_sha256": hashlib.sha256(
                (
                    ROOT / "content/courses/CS03/CS03-core-practice-0.3.0/manifest.json"
                ).read_bytes()
            ).hexdigest(),
            "runtime": "WSL Ubuntu isolated worker, cpp17",
            "records": records,
        },
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
