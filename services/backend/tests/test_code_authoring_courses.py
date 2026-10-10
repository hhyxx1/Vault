import importlib.util
from pathlib import Path


def test_authoring_can_open_a_non_cs01_course_without_changing_source():
    root = Path(__file__).resolve().parents[3]
    spec = importlib.util.spec_from_file_location(
        "course_authoring", root / "tools/curriculum/code_authoring.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    book = module.CodeBook(
        root,
        "CS02-core-scope-0.1.0",
        "CS02-core-practice-0.1.0",
        "受限实践",
        course="CS02",
        standard="code-fixed-condition-v1",
    )
    assert book.package["course_code"] == "CS02"
    assert book.course == "CS02"
    assert book.standard == "code-fixed-condition-v1"
