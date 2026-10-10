"""Verify the chosen Linux CPython313 wheels against primary PyPI digests."""

import hashlib
import json
import sys
from pathlib import Path
from urllib.request import urlopen

PACKAGES = {
    "numpy": "2.3.3",
    "scipy": "1.16.2",
    "scikit-learn": "1.7.2",
    "joblib": "1.5.2",
    "threadpoolctl": "3.6.0",
}


def main():
    directory = Path(sys.argv[1]).resolve()
    wheels = list(directory.glob("*.whl"))
    lines = [
        "# Linux x86_64 / CPython 3.13 only. Official PyPI wheel SHA256; no source builds."
    ]
    for name, version in PACKAGES.items():
        prefix = name.replace("-", "_") + "-" + version + "-"
        matches = [p for p in wheels if p.name.startswith(prefix)]
        if len(matches) != 1:
            raise ValueError("Expected one compatible wheel per locked package")
        wheel = matches[0]
        with urlopen(
            f"https://pypi.org/pypi/{name}/{version}/json", timeout=30
        ) as response:
            metadata = json.load(response)
        published = next(
            row for row in metadata["urls"] if row["filename"] == wheel.name
        )
        digest = hashlib.sha256(wheel.read_bytes()).hexdigest()
        if published["digests"]["sha256"] != digest:
            raise ValueError("Wheel digest does not match primary release metadata")
        lines += ["# " + wheel.name, f"{name}=={version} --hash=sha256:{digest}"]
    destination = Path(__file__).with_name("ml-requirements.lock")
    destination.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("Verified and locked", len(PACKAGES), "original PyPI wheels")


if __name__ == "__main__":
    main()
