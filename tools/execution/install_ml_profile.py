"""Install a separate immutable teaching toolchain from the verified wheel lock."""

import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

SOURCE = Path("/opt/vault-toolchains/python-3.13")
TARGET = Path("/opt/vault-toolchains/python-3.13-ml")
LOCK = Path(__file__).with_name("ml-requirements.lock").resolve()


def main():
    if sys.platform != "linux" or os.geteuid() != 0 or platform.machine() != "x86_64":
        raise SystemExit("Dedicated Linux x86_64 worker root required")
    if SOURCE.is_symlink() or TARGET.is_symlink():
        raise SystemExit("Toolchain paths must be real directories")
    python = SOURCE / "bin/python3.13"
    version = subprocess.check_output([str(python), "--version"], text=True).strip()
    if version != "Python 3.13.16":
        raise SystemExit("Profile requires the existing pinned Python 3.13.16 runtime")
    identity = {
        "profile": "python313ml-isolate-dev@0.1.0",
        "python": version,
        "lock_sha256": hashlib.sha256(LOCK.read_bytes()).hexdigest(),
    }
    marker = TARGET / ".vault-ml-profile.json"
    if TARGET.exists():
        if marker.is_file() and json.loads(marker.read_text()) == identity:
            print("Matching ML profile already installed")
            return
        raise SystemExit(
            "Existing unmatched target preserved; no overwrite or deletion"
        )
    shutil.copytree(SOURCE, TARGET, symlinks=True)
    prefix = subprocess.check_output(
        [str(TARGET / "bin/python3.13"), "-c", "import sys;print(sys.prefix)"],
        text=True,
    ).strip()
    if Path(prefix).resolve() != TARGET:
        raise SystemExit(
            "Copied interpreter does not resolve to the dedicated ML directory"
        )
    environment = {
        "PATH": "/usr/bin:/bin",
        "LANG": "C.UTF-8",
        "HOME": "/root",
        "PIP_CONFIG_FILE": "/dev/null",
        "PIP_DISABLE_PIP_VERSION_CHECK": "1",
    }
    subprocess.run(
        [
            str(TARGET / "bin/python3.13"),
            "-m",
            "pip",
            "install",
            "--index-url",
            "https://pypi.org/simple",
            "--only-binary=:all:",
            "--require-hashes",
            "--no-deps",
            "--target",
            str(TARGET / "lib/python3.13/site-packages"),
            "-r",
            str(LOCK),
        ],
        env=environment,
        check=True,
    )
    marker.write_text(json.dumps(identity, sort_keys=True) + "\n", encoding="utf-8")
    print("Installed separate verified ML runtime; original Python untouched")


if __name__ == "__main__":
    main()
