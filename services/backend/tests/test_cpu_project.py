import importlib.util
from pathlib import Path

import pytest


@pytest.fixture
def cpu():
    path = Path(__file__).resolve().parents[3] / "tools/curriculum/assets/cpu_project.py"
    spec = importlib.util.spec_from_file_location("cpu_project", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_actual_encoded_program_has_four_phases_and_store_not_load(cpu):
    program = cpu.assemble("LDI R0 7\nLDI R1 5\nADD R0 R1\nSTORE R0 3\nLOAD R2 3\nHALT")
    result = cpu.run(program)
    assert program == [0x1007, 0x1405, 0x2100, 0x5003, 0x4803, 0]
    assert result["registers"] == [12, 5, 12, 0]
    assert result["memory"][3] == 12
    assert result["status"] == "halted"
    assert [r["phase"] for r in result["trace"]] == ["fetch", "decode", "execute", "commit"] * 6
    assert result["trace"][15]["controls"]["mem_write"] is True
    assert result["trace"][19]["controls"]["reg_write"] is True
    assert result["trace"][19]["controls"]["mem_write"] is False


def test_branch_observes_zero_and_eight_bit_wrap(cpu):
    program = cpu.assemble("LDI R0 255\nLDI R1 1\nADD R0 R1\nJZ R0 end\nLDI R2 99\nend: HALT")
    result = cpu.run(program)
    assert result["registers"] == [0, 1, 0, 0]
    assert result["cycles"] == 20


def test_cache_writeback_and_conflicting_block_reload(cpu):
    program = cpu.assemble("LDI R0 9\nSTORE R0 0\nLOAD R1 2\nLOAD R2 0\nHALT")
    result = cpu.run(program)
    assert result["registers"][2] == result["memory"][0] == 9
    assert result["cache_events"] == [
        {"address": 0, "operation": "store", "hit": False, "writeback": None},
        {"address": 2, "operation": "load", "hit": False, "writeback": 0},
        {"address": 0, "operation": "load", "hit": False, "writeback": None},
    ]


def test_loop_budget_is_not_success(cpu):
    result = cpu.run(cpu.assemble("loop: JMP loop"), max_cycles=12)
    assert result["status"] == "budget_exhausted"
    assert result["cycles"] == 12


@pytest.mark.parametrize(
    "source", ["LDI R4 1", "LDI R0 256", "LOAD R0 16", "JMP missing", "x: HALT\nx: HALT", "ADD R0"]
)
def test_bad_encoding_rejected(cpu, source):
    with pytest.raises(ValueError):
        cpu.assemble(source)


def test_illegal_opcode_and_write_conflict_rejected(cpu):
    with pytest.raises(ValueError):
        cpu.run([0xF000])
    with pytest.raises(ValueError):
        cpu.validate_controls({"reg_write": True, "mem_write": True})


def test_arithmetic_family_matches_independent_modulo_and_no_early_register_write(cpu):
    for left in [0, 1, 127, 255]:
        for right in [0, 1, 128, 255]:
            for op, expected in [("ADD", (left + right) % 256), ("SUB", (left - right) % 256)]:
                result = cpu.run(cpu.assemble(f"LDI R0 {left}\nLDI R1 {right}\n{op} R0 R1\nHALT"))
                assert result["registers"][0] == expected
                previous = [0, 0, 0, 0]
                for start in range(0, len(result["trace"]), 4):
                    phases = result["trace"][start : start + 4]
                    assert all(t["registers"] == previous for t in phases[:3])
                    previous = phases[3]["registers"]


def test_cache_hit_is_not_counted_as_an_eviction_and_ram_flush_is_explicit(cpu):
    result = cpu.run(cpu.assemble("LDI R0 42\nSTORE R0 1\nLOAD R1 1\nHALT"))
    assert result["registers"][1] == result["memory"][1] == 42
    assert result["cache_events"][1] == {
        "address": 1,
        "operation": "load",
        "hit": True,
        "writeback": None,
    }
    assert result["final_flush"] == [1]


@pytest.mark.parametrize("memory", [[0] * 15, [256] + [0] * 15, [True] + [0] * 15])
def test_invalid_data_memory_is_not_silently_wrapped(cpu, memory):
    with pytest.raises(ValueError):
        cpu.run([0], memory=memory)
