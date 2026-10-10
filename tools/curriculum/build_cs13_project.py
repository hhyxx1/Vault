"""Original data-pipeline composite with frozen versioned observations."""

import copy
import importlib.util
import json
import tempfile
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS13-core-practice-0.2.0"
VERSION = str(uuid5(NAMESPACE_URL, "vault:" + NAME))
GOAL = "CS13-M10-O02"
ACTIVITY = str(uuid5(NAMESPACE_URL, "vault:" + GOAL + "-CODE:0.2.0"))
REFERENCE = (ROOT / "tools/curriculum/assets/ml_pipeline.py").read_text(
    encoding="utf-8"
)
assert "fit_rows = train" in REFERENCE
INITIAL = REFERENCE.replace("fit_rows = train", "fit_rows = data", 1)
MAIN = """import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('pipeline','pipeline.py')
pipeline=importlib.util.module_from_spec(spec);spec.loader.exec_module(pipeline)
result=pipeline.run(json.loads(sys.stdin.read()))
def stable(value):
    if isinstance(value,float):return round(value,8)
    if isinstance(value,list):return [stable(v) for v in value]
    if isinstance(value,dict):return {k:stable(v) for k,v in value.items()}
    return value
print(json.dumps(stable(result),sort_keys=True))
"""


def stable(value):
    if isinstance(value, float):
        return round(value, 8)
    if isinstance(value, list):
        return [stable(v) for v in value]
    if isinstance(value, dict):
        return {k: stable(v) for k, v in value.items()}
    return value


def dataset(test_shift=0):
    pairs = [
        ("train", 0),
        ("train", 2),
        ("train", 4),
        ("train", None),
        ("validation", 1),
        ("validation", 3),
        ("test", 5 + test_shift),
        ("test", 7 + test_shift),
    ]
    return [
        {"id": str(i), "split": s, "x": x, "y": 2 * x + 1 if x is not None else 5}
        for i, (s, x) in enumerate(pairs)
    ]


def build():
    spec = importlib.util.spec_from_file_location(
        "author_pipeline", ROOT / "tools/curriculum/assets/ml_pipeline.py"
    )
    reference = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reference)
    wrong = type(reference)("wrong_pipeline")
    exec(compile(INITIAL, "original_starter", "exec"), wrong.__dict__)  # noqa: S102 - owner-authored asset only, never learner source
    package = json.loads(
        (
            ROOT / "content/courses/CS13/CS13-core-practice-0.1.0/manifest.json"
        ).read_text(encoding="utf-8")
    )
    package.update(
        course_version_id=VERSION,
        version=NAME,
        scope_note="30目标局部实践及实际训练/验证/测试、缺失填补、拟合、模型选择、JSON重载综合项目；全课程深度与审校仍待完成。",
    )
    for relation in package["relations"]:
        relation["course_version_id"] = VERSION
    activity = next(a for a in package["activities"] if a["code"] == GOAL + "-CODE")
    activity.update(version_id=ACTIVITY, version=GOAL + "-CODE@0.2.0")
    activity["theory"] += [
        "综合项目实际拟合单特征最小二乘回归与常数基线，只用验证误差选择，最后计算测试误差。预处理从训练特征学习并随模型保存；JSON重新读取后预测。",
        "原创合成数据，不代表真实用户数据、全机器学习算法或统计泛化保证。训练拟合/选择/测试ID分别展示，模型文件只在本次隔离作业内存在；跨会话恢复代码与结果，不保留沙箱文件。",
    ]
    activity["source_refs"] = sorted(
        set(activity["source_refs"] + ["ml-leak", "ml-validation", "ml-linear"])
    )
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS13-core.json").read_text(
            encoding="utf-8"
        )
    )
    for row in rows:
        row["version"] = VERSION
        if row["goal"] == GOAL:
            row["activity"] = ACTIVITY
    for task, title, shift in [
        ("pipeline-leak", "综合项目：修复预处理数据泄漏", 0),
        ("pipeline-shift", "综合新条件：测试特征范围改变后重跑", 10),
    ]:
        data = dataset(shift)
        with tempfile.TemporaryDirectory() as directory:
            actual = reference.run(data, Path(directory) / "correct.json")
            bad = wrong.run(data, Path(directory) / "wrong.json")
        assert actual["selected"] == "linear" and actual["test_mse"] < 1e-20
        assert actual["test_predictions"] == [
            2 * r["x"] + 1 for r in data if r["split"] == "test"
        ]
        first = {
            "language": "python313",
            "entry": "main.py",
            "files": {"main.py": MAIN, "pipeline.py": INITIAL},
            "stdin": json.dumps(data, sort_keys=True) + "\n",
        }
        fixed = {**first, "files": {"main.py": MAIN, "pipeline.py": REFERENCE}}
        activity["variants"].append(
            {
                "code": task,
                "title": title,
                "student_action": "预测拟合ID与误差；运行检查泄漏，修改pipeline.py，再比较选择、测试和JSON重载工件。",
                "code_request": first,
                "reference_answer": fixed,
                "prediction_prompt": "哪些样本能用于fit与selection？预测泄漏前后测试误差，并解释不能用测试误差选模型。",
                "reflection_prompt": "用实际fit_ids定位泄漏；解释训练/验证/测试和模型恢复，还需哪些独立数据证明泛化？",
            }
        )
        for label, request, result in [
            ("initial", first, bad),
            ("repaired", fixed, actual),
        ]:
            rows.append(
                {
                    "id": task + "/" + label,
                    "version": VERSION,
                    "goal": GOAL,
                    "activity": ACTIVITY,
                    "task": task,
                    "request": copy.deepcopy(request),
                    "stdout": json.dumps(stable(result), sort_keys=True) + "\n",
                    "decision": "met" if label == "repaired" else "not_met",
                }
            )
    for path, value in [
        (ROOT / f"content/courses/CS13/{NAME}/manifest.json", package),
        (ROOT / "services/backend/fixtures/course-code/CS13-project.json", rows),
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    print(VERSION, len(rows))


if __name__ == "__main__":
    build()
