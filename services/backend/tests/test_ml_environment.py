import os
import sys
from pathlib import Path

import pytest

from vault_backend.code_execution import CodeRequest, IsolateWorker


def test_ml_profile_is_explicit_and_does_not_change_plain_python():
    request = CodeRequest(language="python313ml", entry="main.py", files={"main.py": "print(1)"})
    assert (
        IsolateWorker()._plans(request)[1][0]
        == "/opt/vault-toolchains/python-3.13-ml/bin/python3.13"
    )
    plain = CodeRequest(language="python313", entry="main.py", files={"main.py": "print(1)"})
    assert IsolateWorker()._plans(plain)[1][0] == "/opt/vault-toolchains/python-3.13/bin/python3.13"


@pytest.mark.asyncio
@pytest.mark.skipif(
    sys.platform != "linux" or os.environ.get("VAULT_ML_INTEGRATION") != "1",
    reason="pinned real ML isolate",
)
async def test_actual_pinned_libraries_fit_transform_train_predict_and_no_worker_secret():
    source = """import os,numpy,scipy,sklearn
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
print(numpy.__version__,scipy.__version__,sklearn.__version__)
model=make_pipeline(SimpleImputer(),LinearRegression())
model.fit([[0],[2],[4],[numpy.nan]],[1,5,9,5])
print([round(v,8) for v in model.predict([[5],[7]])])
print(model[0].statistics_.tolist())
print(os.environ.get('OPENBLAS_NUM_THREADS'))
print(os.environ.get('VAULT_CODE_WORKER_TOKEN') is None)
"""
    result = await IsolateWorker(box_id=701).run(
        CodeRequest(language="python313ml", entry="main.py", files={"main.py": source})
    )
    assert (result.status, result.stdout, result.stderr) == (
        "success",
        "2.3.3 1.16.2 1.7.2\n[np.float64(11.0), np.float64(15.0)]\n[2.0]\n1\nTrue\n",
        "",
    ), result
    assert result.runtime_profile == "python313ml-isolate-dev@0.1.0"


def test_pinned_linux_wheel_lock_is_recorded():
    path = Path(__file__).resolve().parents[3] / "tools/execution/ml-requirements.lock"
    text = path.read_text(encoding="utf-8")
    assert "scikit-learn==1.7.2 --hash=sha256:" in text
    assert "numpy==2.3.3 --hash=sha256:" in text
