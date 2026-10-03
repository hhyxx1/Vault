import argparse
import json
from pathlib import Path

from vault_backend.api import create_app
from vault_backend.config import Settings


def main():
    parser = argparse.ArgumentParser(description="Export the implemented FastAPI contract")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    app = create_app(Settings(environment="test", database_url=""))
    content = json.dumps(app.openapi(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.check:
        if not args.output.is_file() or args.output.read_text(encoding="utf-8") != content:
            raise SystemExit("OpenAPI differs; regenerate and review the contract")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
