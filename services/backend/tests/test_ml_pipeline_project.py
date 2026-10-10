import importlib.util
from pathlib import Path

import pytest


@pytest.fixture
def pipeline():
    path = Path(__file__).resolve().parents[3] / "tools/curriculum/assets/ml_pipeline.py"
    spec = importlib.util.spec_from_file_location("ml_pipeline", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def rows():
    return [
        {"id": str(i), "split": split, "x": x, "y": 2 * x + 1 if x is not None else 5}
        for i, (split, x) in enumerate(
            [
                ("train", 0),
                ("train", 2),
                ("train", 4),
                ("train", None),
                ("validation", 1),
                ("validation", 3),
                ("test", 5),
                ("test", 7),
            ]
        )
    ]


def test_fits_only_train_selects_validation_and_restores_identical_predictions(pipeline, tmp_path):
    result = pipeline.run(rows(), tmp_path / "model.json")
    assert result["fit_ids"] == ["0", "1", "2", "3"]
    assert result["selection_ids"] == ["4", "5"]
    assert result["test_ids"] == ["6", "7"]
    assert result["model"]["impute_mean"] == 2
    assert result["selected"] == "linear"
    assert result["test_predictions"] == pytest.approx([11, 15])
    assert result["test_mse"] == pytest.approx(0, abs=1e-20)
    assert result["reload_predictions"] == result["test_predictions"]
    assert result["baseline_test_mse"] == 68
    assert result["gradient_error"] < 1e-6


def test_test_labels_cannot_change_fit_or_selected_candidate(pipeline, tmp_path):
    first = pipeline.run(rows(), tmp_path / "a.json")
    changed = rows()
    for row in changed:
        if row["split"] == "test":
            row["y"] += 1000
    second = pipeline.run(changed, tmp_path / "b.json")
    assert first["model"] == second["model"]
    assert first["validation_scores"] == second["validation_scores"]
    assert first["selected"] == second["selected"]
    assert first["test_predictions"] == second["test_predictions"]
    assert second["test_mse"] > 999999


@pytest.mark.parametrize("mutation", ["duplicate", "empty_train", "all_missing", "nonfinite"])
def test_invalid_dataset_has_actionable_failure(pipeline, tmp_path, mutation):
    data = rows()
    if mutation == "duplicate":
        data[6]["id"] = data[0]["id"]
    elif mutation == "empty_train":
        data = [r for r in data if r["split"] != "train"]
    elif mutation == "all_missing":
        for r in data:
            if r["split"] == "train":
                r["x"] = None
    else:
        data[0]["x"] = float("inf")
    with pytest.raises(ValueError):
        pipeline.run(data, tmp_path / "bad.json")


def test_preprocessing_parameters_survive_missing_value_inference(pipeline, tmp_path):
    result = pipeline.run(rows(), tmp_path / "saved.json")
    assert pipeline.predict(result["model"], [None, 3]) == pytest.approx([5, 7])
