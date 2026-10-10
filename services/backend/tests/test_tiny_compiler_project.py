import importlib.util
from pathlib import Path

import pytest

SOURCE = Path(__file__).resolve().parents[3] / "tools/curriculum/assets/tiny_compiler.py"


@pytest.fixture
def compiler():
    spec = importlib.util.spec_from_file_location("tiny_compiler", SOURCE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("let x=0; while(x<4){ x=x+1; } print(x);", [4]),
        ("let x=7; {let x=2;print(x);}print(x);", [2, 7]),
        ("let ready=true; if(ready){print(1);}else{print(2);}", [1]),
        ("print(8-3-1); print(-7/3);", [4, -2]),
        ("print(false && (1/0==0)); print(true || (1/0==0));", [False, True]),
        ("let x=0; while(x<2){let y=0;while(y<3){y=y+1;}print(y);x=x+1;}", [3, 3]),
    ],
)
def test_reference_and_compiled_control_scope_and_semantics(compiler, source, expected):
    result = compiler.run(source)
    assert result["interpreted"] == result["compiled"] == expected
    assert result["tokens"] and result["ast"] and result["instructions"]


@pytest.mark.parametrize(
    ("source", "stage"),
    [
        ("print(1@2);", "lex"),
        ("print(1 2);", "parse"),
        ("print(missing);", "type"),
        ("let x=true;x=1;", "type"),
        ("if(1){print(1);}", "type"),
        ("let x=1;let x=2;", "type"),
    ],
)
def test_errors_are_assigned_to_actual_stage_with_location(compiler, source, stage):
    with pytest.raises(compiler.LanguageError) as error:
        compiler.run(source)
    assert error.value.stage == stage
    assert isinstance(error.value.position, int) and error.value.position >= 0


def test_finite_differential_program_family_and_input_budget(compiler):
    for a in range(-3, 4):
        for b in range(1, 4):
            r = compiler.run(f"let x={a};while(x<{b}){{x=x+1;}}print(x);print({a}/{b});")
            assert r["compiled"] == r["interpreted"] == [max(a, b), int(a / b)]
    with pytest.raises(compiler.LanguageError, match="budget"):
        compiler.run("while(true){}", budget=20)
