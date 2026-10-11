import importlib.util
from pathlib import Path

from vault_backend.course_packages import PublicCoursePackage


def test_native_course_build_keeps_all_goals_and_optional_code_without_mutating_source():
    root = Path(__file__).resolve().parents[3]
    path = root / "tools/curriculum/build_cs05_algebra.py"
    spec = importlib.util.spec_from_file_location("algebra_course_builder", path)
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    source = root / "content/courses/CS05/CS05-core-practice-0.1.0/manifest.json"
    before = source.read_bytes()
    package = PublicCoursePackage.model_validate(builder.build_package())
    native = [a for a in package.activities if a.kind == "finite_algebra"]
    assert len(package.objectives) == 30
    assert len(native) == 3
    assert {a.algebra_prompt.mode for a in native} == {"group", "ring", "homomorphism"}
    assert len([a for a in package.activities if a.kind == "code"]) == 30
    assert source.read_bytes() == before
    assert package.course_version_id != "ad0499ca-f205-5b96-bb4f-f4c3137e8238"
