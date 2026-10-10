"""Original single-feature regression lab, standard library only."""

import hashlib
import json
import math
from pathlib import Path


def mse(actual, predictions):
    if not actual or len(actual) != len(predictions):
        raise ValueError("metric needs equally sized nonempty sequences")
    return sum((a - b) ** 2 for a, b in zip(actual, predictions)) / len(actual)


def predict(model, features):
    return [
        model["intercept"]
        + model["slope"]
        * ((model["impute_mean"] if x is None else x) - model["center"])
        for x in features
    ]


def run(data, destination="model.json"):
    if len(data) > 1000:
        raise ValueError("dataset exceeds 1000-row teaching budget")
    ids = [row["id"] for row in data]
    if len(ids) != len(set(ids)):
        raise ValueError("sample IDs must be unique across splits")
    for row in data:
        if row["split"] not in ("train", "validation", "test"):
            raise ValueError("unknown split")
        for key in ("x", "y"):
            value = row[key]
            if key == "x" and value is None:
                continue
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
            ):
                raise ValueError("features and labels must be finite numbers")
    splits = {
        name: [r for r in data if r["split"] == name]
        for name in ("train", "validation", "test")
    }
    if any(not part for part in splits.values()):
        raise ValueError("train, validation and test must all be nonempty")
    train, validation, test = (splits[n] for n in ("train", "validation", "test"))
    fit_rows = train
    observed = [r["x"] for r in fit_rows if r["x"] is not None]
    if not observed:
        raise ValueError("training feature is entirely missing")
    mean = sum(observed) / len(observed)
    xs = [(mean if r["x"] is None else r["x"]) - mean for r in train]
    ys = [r["y"] for r in train]
    xbar, ybar = sum(xs) / len(xs), sum(ys) / len(ys)
    denominator = sum((x - xbar) ** 2 for x in xs)
    if denominator == 0:
        raise ValueError("linear candidate requires varying training features")
    slope = sum((x - xbar) * (y - ybar) for x, y in zip(xs, ys)) / denominator
    linear = {
        "impute_mean": mean,
        "center": mean,
        "slope": slope,
        "intercept": ybar - slope * xbar,
        "schema": "single-feature-regression-v1",
    }
    baseline = {**linear, "slope": 0.0, "intercept": ybar}
    candidates = {"baseline": baseline, "linear": linear}
    scores = {
        name: mse(
            [r["y"] for r in validation], predict(model, [r["x"] for r in validation])
        )
        for name, model in candidates.items()
    }
    selected = min(scores, key=lambda name: (scores[name], name))
    model = candidates[selected]
    # Independent finite-difference check of d(MSE)/d(slope) at an arbitrary trial point.
    trial, epsilon = 0.75, 1e-5
    loss = lambda weight: mse(ys, [ybar + weight * x for x in xs])
    numeric = (loss(trial + epsilon) - loss(trial - epsilon)) / (2 * epsilon)
    analytic = 2 * sum((ybar + trial * x - y) * x for x, y in zip(xs, ys)) / len(xs)
    path = Path(destination)
    path.write_text(
        json.dumps(model, sort_keys=True, allow_nan=False), encoding="utf-8"
    )
    restored = json.loads(path.read_text(encoding="utf-8"))
    predictions = predict(model, [r["x"] for r in test])
    return {
        "fit_ids": [r["id"] for r in fit_rows],
        "selection_ids": [r["id"] for r in validation],
        "test_ids": [r["id"] for r in test],
        "selected": selected,
        "model": model,
        "validation_scores": scores,
        "test_predictions": predictions,
        "reload_predictions": predict(restored, [r["x"] for r in test]),
        "test_mse": mse([r["y"] for r in test], predictions),
        "baseline_test_mse": mse(
            [r["y"] for r in test], predict(baseline, [r["x"] for r in test])
        ),
        "gradient_error": abs(numeric - analytic),
        "data_sha256": hashlib.sha256(
            json.dumps(data, sort_keys=True, allow_nan=False).encode()
        ).hexdigest(),
    }
