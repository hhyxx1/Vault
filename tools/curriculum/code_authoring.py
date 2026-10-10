"""Shared authoring format; expected outputs are supplied before actual execution."""

import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5


class CodeBook:
    def __init__(self, root: Path, previous: str, version: str, scope: str):
        self.root = root
        self.name = version
        self.package = json.loads(
            (root / f"content/courses/CS01/{previous}/manifest.json").read_text(
                encoding="utf-8"
            )
        )
        self.version = str(uuid5(NAMESPACE_URL, "vault:" + version))
        self.package.update(
            course_version_id=self.version, version=version, scope_note=scope
        )
        self.rows = []
        self.rules = []

    def add(self, goal, title, action, theory, hints, sources, cases):
        code = goal + "-CODE"
        identity = str(uuid5(NAMESPACE_URL, "vault:" + code + ":0.1.0"))
        activity = {
            "id": str(uuid5(NAMESPACE_URL, "vault:" + code)),
            "version_id": identity,
            "code": code,
            "version": code + "@0.1.0",
            "objective_codes": [goal],
            "kind": "code",
            "title": title,
            "student_action": action,
            "theory": theory,
            "starter": "先预测并标注约束，再运行、解释和修改。",
            "source_refs": sources,
            "availability": "practice_ready",
            "completion_limit": "只比较本次固定输入的实际状态与输出，不证明一般正确性、独立能力或原理解释。解释和独立迁移待复核。",
            "code_request": cases[0][3],
            "reference_answer": cases[0][4],
            "prediction_prompt": "逐步预测状态、输出和错误分支，说明依据。",
            "reflection_prompt": "保存差异、修正理由和下一项边界；说明本次运行尚未证明什么。",
            "hints": hints,
            "variants": [],
            "check_version": "cs01-fixed-condition-v1",
        }
        for task, label, instruction, initial, repaired, before, after in cases:
            if task != "base":
                activity["variants"].append(
                    {
                        "code": task,
                        "title": label,
                        "student_action": instruction,
                        "code_request": initial,
                        "prediction_prompt": activity["prediction_prompt"],
                        "reflection_prompt": activity["reflection_prompt"],
                    }
                )
            self.rules.append([goal, task, repaired["stdin"], "success", after, ""])
            for label, request, output in [
                ("initial", initial, before),
                ("repaired", repaired, after),
            ]:
                self.rows.append(
                    {
                        "id": goal + "/" + task + "/" + label,
                        "version": self.version,
                        "goal": goal,
                        "activity": identity,
                        "task": task,
                        "request": request,
                        "stdout": output,
                        "decision": "met" if output == after else "not_met",
                    }
                )
        self.package["activities"].append(activity)
        next(o for o in self.package["objectives"] if o["code"] == goal)["criteria"] = [
            {
                "id": "fixed_condition",
                "title": "本次任务的固定条件",
                "verification": "deterministic_checker",
            },
            {
                "id": "explanation",
                "title": "解释原理、差异与适用范围",
                "verification": "independent_review_pending",
            },
            {
                "id": "independent_transfer",
                "title": "在独立新条件下验证",
                "verification": "independent_review_pending",
            },
        ]

    def save(self, fixture):
        for name, value in [
            (f"content/courses/CS01/{self.name}/manifest.json", self.package),
            (f"services/backend/fixtures/course-code/{fixture}.json", self.rows),
            (f"services/backend/fixtures/course-code/{fixture}-rules.json", self.rules),
        ]:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        print(self.version, len(self.rows))
