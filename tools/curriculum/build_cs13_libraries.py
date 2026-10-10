"""Original bounded scientific-library experiments; author on pinned Linux runtime."""

import copy
import json
import subprocess
import sys
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2]
NAME = "CS13-core-practice-0.3.0"
VERSION = str(uuid5(NAMESPACE_URL, "vault:" + NAME))
PYTHON = "/opt/vault-toolchains/python-3.13-ml/bin/python3.13"

# Explicit predictions come from the small mathematical construction, not grades.
LABS = [
    (
        "M03-O01",
        "linear",
        "实际拟合线性与逻辑回归",
        (
            "from sklearn.linear_model import LinearRegression,LogisticRegression\n"
            "x=[[-2],[-1],[1],[2]]\ny=[-3,-1,3,5]\n"
            "reg=LinearRegression(fit_intercept=True).fit(x,y)\n"
            "clf=LogisticRegression(random_state=0).fit(x,[0,0,1,1])\n"
            'result={"regression":reg.predict([[-3],[0],[3]]).tolist(),"classes":clf.predict([[-3],[3]]).tolist()}\n'
        ),
        "fit_intercept=True",
        "fit_intercept=False",
        {"regression": [-5.0, 1.0, 7.0], "classes": [0, 1]},
        "截距与系数均从训练数据拟合；类别预测依赖训练标签。四个点不证明总体泛化。",
    ),
    (
        "M03-O03",
        "ridge",
        "比较正则惩罚与训练误差",
        (
            "from sklearn.linear_model import Ridge\n"
            "x=[[-1],[0],[1]]\ny=[-2,0,2]\n"
            "model=Ridge(alpha=10.0).fit(x,y)\np=model.predict(x)\n"
            'result={"coefficient":float(model.coef_[0]),"training_mse":float(((p-y)**2).mean())}\n'
        ),
        "alpha=10.0",
        "alpha=0.0",
        {"coefficient": 0.333333, "training_mse": 1.851852},
        "岭回归最小化平方误差加L2惩罚；该构造的系数为4/(2+alpha)。训练误差升高不能单独判断泛化。",
    ),
    (
        "M05-O01",
        "tree",
        "拟合能分离异或的决策树",
        (
            "from sklearn.tree import DecisionTreeClassifier\n"
            "x=[[-1,-1],[-1,1],[1,-1],[1,1]]\ny=[0,1,1,0]\n"
            "model=DecisionTreeClassifier(max_depth=2,random_state=0).fit(x,y)\n"
            'result={"predictions":model.predict(x).tolist(),"correct":int((model.predict(x)==y).sum())}\n'
        ),
        "max_depth=2",
        "max_depth=1",
        {"predictions": [0, 1, 1, 0], "correct": 4},
        "深度1无法分离四点异或；深度2可以。但训练点全部正确仍不是独立测试。",
    ),
    (
        "M06-O03",
        "svm",
        "用真实核支持向量机学习异或",
        (
            "from sklearn.svm import SVC\n"
            "x=[[-1,-1],[-1,1],[1,-1],[1,1]]\ny=[0,1,1,0]\n"
            'model=SVC(C=10,gamma=1,kernel="rbf").fit(x,y)\n'
            'result={"predictions":model.predict(x).tolist(),"correct":int((model.predict(x)==y).sum())}\n'
        ),
        'kernel="rbf"',
        'kernel="linear"',
        {"predictions": [0, 1, 1, 0], "correct": 4},
        "RBF核在这一固定数据上表达非线性边界，线性核不能分离异或；C与gamma仍需独立验证集选择。",
    ),
    (
        "M07-O01",
        "kmeans",
        "实际迭代聚类并核对质心",
        (
            "from sklearn.cluster import KMeans\n"
            "x=[[0,0],[0,1],[10,10],[10,11]]\n"
            "model=KMeans(n_clusters=2,n_init=10,random_state=42).fit(x)\n"
            'result={"centers":sorted(model.cluster_centers_.tolist()),"inertia":float(model.inertia_)}\n'
        ),
        "n_clusters=2",
        "n_clusters=1",
        {"centers": [[0.0, 0.5], [10.0, 10.5]], "inertia": 1.0},
        "inertia是样本到所属质心的平方距离之和；簇编号无语义，所以按质心排序核对。一个簇为201。",
    ),
    (
        "M07-O02",
        "pca",
        "真实PCA变换与重构",
        (
            "import numpy as np\nfrom sklearn.decomposition import PCA\n"
            "x=np.array([[1,1],[2,2],[3,3]],dtype=float)\n"
            'model=PCA(n_components=1,svd_solver="full").fit(x)\nz=model.transform(x)\n'
            'result={"retained_variance":float(model.explained_variance_ratio_.sum()),"max_error":float(np.abs(model.inverse_transform(z)-x).max()),"width":int(z.shape[1])}\n'
        ),
        "n_components=1",
        "n_components=0",
        {"retained_variance": 1.0, "max_error": 0.0, "width": 1},
        "三点共线，中心化后秩为1；一个主成分可重构。用重构和方差核对，避免奇异向量符号歧义。",
    ),
    (
        "M08-O02",
        "mlp",
        "真实多层感知机训练",
        (
            "from sklearn.neural_network import MLPClassifier\n"
            "x=[[-1,-1],[-1,1],[1,-1],[1,1]]\ny=[0,1,1,0]\n"
            'model=MLPClassifier(hidden_layer_sizes=(8,),activation="tanh",solver="lbfgs",alpha=0,random_state=7,max_iter=2000).fit(x,y)\n'
            'result={"predictions":model.predict(x).tolist(),"correct":int((model.predict(x)==y).sum())}\n'
        ),
        "hidden_layer_sizes=(8,)",
        "hidden_layer_sizes=()",
        {"predictions": [0, 1, 1, 0], "correct": 4},
        "隐藏层加非线性激活可表达异或；没有隐藏层的这一模型不能分离。小实验不等于大型深度学习训练。",
    ),
]

FOOTER = """import json
def stable(v):
    if isinstance(v,float):return round(v,6)
    if isinstance(v,list):return [stable(x) for x in v]
    if isinstance(v,dict):return {k:stable(x) for k,x in v.items()}
    return v
print(json.dumps(stable(result),sort_keys=True))
"""


def run(source):
    env = {
        "PATH": "/usr/bin:/bin",
        "OPENBLAS_NUM_THREADS": "1",
        "OMP_NUM_THREADS": "1",
        "MKL_NUM_THREADS": "1",
        "JOBLIB_MULTIPROCESSING": "0",
    }
    process = subprocess.run(
        [PYTHON, "-I", "-c", source],
        env=env,
        capture_output=True,
        text=True,
        check=True,
        timeout=15,
    )
    assert not process.stderr, process.stderr
    return process.stdout


def build():
    if sys.platform != "linux" or not Path(PYTHON).exists():
        raise RuntimeError(
            "Use the separately installed pinned Linux scientific runtime"
        )
    package = json.loads(
        (
            ROOT / "content/courses/CS13/CS13-core-practice-0.2.0/manifest.json"
        ).read_text(encoding="utf-8")
    )
    package.update(
        course_version_id=VERSION,
        version=NAME,
        scope_note="30目标局部实践、数据流程综合项目与7个真实科学库算法实验；全课程深度、独立迁移与审校仍待完成。",
    )
    for relation in package["relations"]:
        relation["course_version_id"] = VERSION
    rows = json.loads(
        (ROOT / "services/backend/fixtures/course-code/CS13-project.json").read_text(
            encoding="utf-8"
        )
    )
    for row in rows:
        row["version"] = VERSION
    for suffix, name, title, source, correct, wrong, expected, theory in LABS:
        goal = "CS13-" + suffix
        activity = next(a for a in package["activities"] if a["code"] == goal + "-CODE")
        activity_id = str(uuid5(NAMESPACE_URL, "vault:" + goal + "-CODE:0.2.0"))
        activity.update(version_id=activity_id, version=goal + "-CODE@0.2.0")
        for row in rows:
            if row["goal"] == goal:
                row["activity"] = activity_id
        activity["theory"] += [
            theory,
            "运行环境固定Python3.13.16 / NumPy2.3.3 / SciPy1.16.2 / scikit-learn1.7.2，串行CPU。预测→运行→修改实际模型参数→重试→解释；输出只核对本次固定数据。",
        ]
        section = {
            "linear": "linear_model",
            "ridge": "linear_model",
            "tree": "tree",
            "svm": "svm",
            "kmeans": "clustering",
            "pca": "decomposition",
            "mlp": "neural_networks_supervised",
        }[name]
        ref = "ml17-" + section
        if not any(s["id"] == ref for s in package["sources"]):
            package["sources"].append(
                {
                    "id": ref,
                    "title": "scikit-learn 1.7.2 " + section,
                    "url": "https://scikit-learn.org/1.7/modules/" + section + ".html",
                    "locator": "algorithm definition, fit/transform and limitations",
                    "checked_at": "2026-10-10",
                    "status": "authority_checked",
                }
            )
        activity["source_refs"] = sorted(set(activity["source_refs"] + [ref]))
        source += FOOTER
        bad_source = source.replace(correct, wrong, 1)
        actual, bad = run(source), run(bad_source)
        assert json.loads(actual) == expected, (name, actual, expected)
        assert actual != bad, name
        fixed = {
            "language": "python313ml",
            "entry": "main.py",
            "files": {"main.py": source},
            "stdin": "",
        }
        initial = {**fixed, "files": {"main.py": bad_source}}
        task = "library-" + name
        activity["variants"].append(
            {
                "code": task,
                "title": title,
                "student_action": "先预测结果，运行初始模型，修改模型配置，再实际拟合并比较输出与数学条件。",
                "code_request": initial,
                "reference_answer": fixed,
                "prediction_prompt": theory + " 预测初始配置输出。",
                "reflection_prompt": "解释修改影响了什么、训练观察不能证明什么，并提出未使用的新数据验证办法。",
            }
        )
        for label, request, stdout in [
            ("initial", initial, bad),
            ("repaired", fixed, actual),
        ]:
            rows.append(
                {
                    "id": task + "/" + label,
                    "version": VERSION,
                    "goal": goal,
                    "activity": activity_id,
                    "task": task,
                    "request": copy.deepcopy(request),
                    "stdout": stdout,
                    "decision": "met" if label == "repaired" else "not_met",
                }
            )
    for path, value in [
        (ROOT / f"content/courses/CS13/{NAME}/manifest.json", package),
        (ROOT / "services/backend/fixtures/course-code/CS13-libraries.json", rows),
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    print(VERSION, len(rows))


if __name__ == "__main__":
    build()
