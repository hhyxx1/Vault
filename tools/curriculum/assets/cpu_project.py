"""Original educational ISA: 16-bit instructions, 8-bit words, four phases.

Not Hack, x86, a physical processor, pipelined timing or an electrical simulation.
ROM<=256, four writable registers, sixteen words of data RAM, separate I/D space.
Two direct-mapped one-word data-cache lines, write-allocate/write-back; flush at end.
Encoding: opcode[15:12], destination[11:10], source[9:8], operand[7:0].
"""

import copy
import re

OPS = {
    "HALT": 0,
    "LDI": 1,
    "ADD": 2,
    "SUB": 3,
    "LOAD": 4,
    "STORE": 5,
    "JZ": 6,
    "JMP": 7,
}
ARITY = {
    "HALT": 0,
    "LDI": 2,
    "ADD": 2,
    "SUB": 2,
    "LOAD": 2,
    "STORE": 2,
    "JZ": 2,
    "JMP": 1,
}


def reg(token):
    if not re.fullmatch(r"R[0-3]", token):
        raise ValueError("register must be R0..R3")
    return int(token[1])


def assemble(source):
    if not isinstance(source, str) or len(source) > 8192:
        raise ValueError("source size")
    labels, instructions = {}, []
    for line in source.splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        if ":" in line:
            label, line = line.split(":", 1)
            label = label.strip()
            if not re.fullmatch(r"[A-Za-z_][A-Za-z_0-9]*", label) or label in labels:
                raise ValueError("duplicate or invalid label")
            labels[label] = len(instructions)
            line = line.strip()
        if line:
            instructions.append(line.split())
    if not 0 < len(instructions) <= 256:
        raise ValueError("ROM size")
    words = []
    for tokens in instructions:
        op, *args = tokens
        if op not in OPS or len(args) != ARITY[op]:
            raise ValueError("opcode or operand count")
        dest = src = value = 0
        if op not in {"HALT", "JMP"}:
            dest = reg(args[0])
        if op in {"ADD", "SUB"}:
            src = reg(args[1])
        elif op not in {"HALT"}:
            token = args[-1]
            value = labels[token] if token in labels else int(token, 0)
            maximum = 15 if op in {"LOAD", "STORE"} else 255
            if not 0 <= value <= maximum:
                raise ValueError("operand out of range")
            if op in {"JZ", "JMP"} and value >= len(instructions):
                raise ValueError("branch outside ROM")
        words.append((OPS[op] << 12) | (dest << 10) | (src << 8) | value)
    return words


def decode(word):
    if type(word) is not int or not 0 <= word <= 65535:
        raise ValueError("instruction width")
    opcode = word >> 12
    if opcode not in OPS.values():
        raise ValueError("unknown opcode")
    op = next(name for name, code in OPS.items() if code == opcode)
    dest, src, value = (word >> 10) & 3, (word >> 8) & 3, word & 255
    if op == "HALT" and word != 0:
        raise ValueError("HALT reserved bits")
    if op in {"ADD", "SUB"} and value:
        raise ValueError("ALU reserved bits")
    if op not in {"ADD", "SUB"} and src:
        raise ValueError("source reserved bits")
    if op == "JMP" and dest:
        raise ValueError("jump reserved bits")
    if op in {"LOAD", "STORE"} and value > 15:
        raise ValueError("RAM address")
    return op, dest, src, value


def validate_controls(controls):
    if controls.get("reg_write") and controls.get("mem_write"):
        raise ValueError("simultaneous register/memory write is unsupported")


def run(program, memory=None, max_cycles=256):
    if not isinstance(program, list) or not 0 < len(program) <= 256:
        raise ValueError("ROM size")
    for word in program:
        decode(word)
    if type(max_cycles) is not int or not 4 <= max_cycles <= 4096:
        raise ValueError("cycle budget")
    ram = list(memory) if memory is not None else [0] * 16
    if len(ram) != 16 or any(type(v) is not int or not 0 <= v <= 255 for v in ram):
        raise ValueError("RAM words")
    registers, trace, events = [0] * 4, [], []
    cache = [{"valid": False, "tag": 0, "value": 0, "dirty": False} for _ in range(2)]
    pc, cycles, status = 0, 0, "budget_exhausted"

    def access(address, operation, value=None):
        line = cache[address % 2]
        hit = line["valid"] and line["tag"] == address // 2
        writeback = None
        if not hit:
            if line["valid"] and line["dirty"]:
                writeback = line["tag"] * 2 + address % 2
                ram[writeback] = line["value"]
            line.update(valid=True, tag=address // 2, value=ram[address], dirty=False)
        if operation == "store":
            line.update(value=value, dirty=True)
        events.append(
            {
                "address": address,
                "operation": operation,
                "hit": hit,
                "writeback": writeback,
            }
        )
        return line["value"]

    def snapshot(phase, controls=None, **values):
        nonlocal cycles
        cycles += 1
        trace.append(
            {
                "cycle": cycles,
                "phase": phase,
                "pc": pc,
                "registers": registers.copy(),
                "controls": controls or {},
                **copy.deepcopy(values),
            }
        )

    while cycles + 4 <= max_cycles:
        if not 0 <= pc < len(program):
            status = "rom_exhausted"
            break
        word = program[pc]
        snapshot("fetch", instruction=word)
        op, dest, src, operand = decode(word)
        controls = {
            "reg_write": op in {"LDI", "ADD", "SUB", "LOAD"},
            "mem_write": op == "STORE",
            "branch": op in {"JZ", "JMP"},
        }
        validate_controls(controls)
        snapshot(
            "decode", controls, opcode=op, destination=dest, source=src, operand=operand
        )
        result = None
        next_pc = pc + 1
        if op == "LDI":
            result = operand
        elif op == "ADD":
            result = (registers[dest] + registers[src]) & 255
        elif op == "SUB":
            result = (registers[dest] - registers[src]) & 255
        elif op == "LOAD":
            result = access(operand, "load")
        elif op == "JMP" or (op == "JZ" and registers[dest] == 0):
            next_pc = operand
        snapshot("execute", controls, alu_result=result, next_pc=next_pc)
        if controls["reg_write"]:
            registers[dest] = result
        if controls["mem_write"]:
            access(operand, "store", registers[dest])
        snapshot("commit", controls, next_pc=next_pc)
        pc = next_pc
        if op == "HALT":
            status = "halted"
            break
    # Explicit diagnostic write-back, separate from instruction cycles/events.
    flushed = []
    for index, line in enumerate(cache):
        if line["valid"] and line["dirty"]:
            address = line["tag"] * 2 + index
            ram[address] = line["value"]
            flushed.append(address)
            line["dirty"] = False
    return {
        "status": status,
        "cycles": cycles,
        "pc": pc,
        "registers": registers,
        "memory": ram,
        "trace": trace,
        "cache_events": events,
        "cache": cache,
        "final_flush": flushed,
    }
