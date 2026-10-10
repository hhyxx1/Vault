"""Original Tiny classroom language; no eval, host AST, LLVM or external packages."""

import re
from typing import ClassVar


class LanguageError(Exception):
    def __init__(self, stage, position, message):
        self.stage, self.position = stage, position
        super().__init__(f"{stage}@{position}: {message}")


KEYWORDS = {"let", "print", "if", "else", "while", "true", "false"}
PATTERN = re.compile(
    r"\s+|[0-9]+|[A-Za-z_][A-Za-z0-9_]*|&&|\|\||==|!=|<=|>=|[+*/<>=!;(){}-]"
)


def lex(source):
    if len(source) > 16384:
        raise LanguageError("lex", 0, "source budget")
    tokens, offset = [], 0
    while offset < len(source):
        match = PATTERN.match(source, offset)
        if match is None:
            raise LanguageError("lex", offset, "illegal character")
        text = match.group()
        if not text.isspace():
            kind = (
                "number"
                if text[0].isdigit()
                else "name"
                if re.fullmatch(r"[A-Za-z_]\w*", text) and text not in KEYWORDS
                else text
            )
            tokens.append((kind, text, offset))
        offset = match.end()
    tokens.append(("eof", "", len(source)))
    return tokens


class Parser:
    precedence: ClassVar[dict[str, int]] = {
        "||": 1,
        "&&": 2,
        "==": 3,
        "!=": 3,
        "<": 4,
        ">": 4,
        "<=": 4,
        ">=": 4,
        "+": 5,
        "-": 5,
        "*": 6,
        "/": 6,
    }

    def __init__(self, tokens):
        self.tokens, self.index = tokens, 0

    def peek(self):
        return self.tokens[self.index][0]

    def take(self, kind=None):
        token = self.tokens[self.index]
        if kind is not None and token[0] != kind:
            raise LanguageError("parse", token[2], "expected " + kind)
        self.index += 1
        return token

    def expression(self, minimum=1):
        kind, text, pos = self.take()
        if kind == "number":
            node = {"kind": "literal", "value": int(text), "pos": pos}
        elif kind in ("true", "false"):
            node = {"kind": "literal", "value": kind == "true", "pos": pos}
        elif kind == "name":
            node = {"kind": "variable", "name": text, "pos": pos}
        elif kind == "(":
            node = self.expression()
            self.take(")")
        elif kind in ("-", "!"):
            node = {
                "kind": "unary",
                "op": kind,
                "right": self.expression(7),
                "pos": pos,
            }
        else:
            raise LanguageError("parse", pos, "expected expression")
        while self.precedence.get(self.peek(), 0) >= minimum:
            _, op, pos = self.take()
            right = self.expression(self.precedence[op] + 1)
            node = {
                "kind": "binary",
                "op": op,
                "left": node,
                "right": right,
                "pos": pos,
            }
        return node

    def block(self):
        self.take("{")
        body = []
        while self.peek() not in ("}", "eof"):
            body.append(self.statement())
        self.take("}")
        return body

    def statement(self):
        kind, text, pos = self.tokens[self.index]
        if kind == "{":
            return {"kind": "block", "body": self.block(), "pos": pos}
        self.take()
        if kind == "let":
            _, name, _ = self.take("name")
            self.take("=")
            node = {"kind": "let", "name": name, "expr": self.expression(), "pos": pos}
        elif kind == "name":
            self.take("=")
            node = {
                "kind": "assign",
                "name": text,
                "expr": self.expression(),
                "pos": pos,
            }
        elif kind == "print":
            self.take("(")
            node = {"kind": "print", "expr": self.expression(), "pos": pos}
            self.take(")")
        elif kind in ("if", "while"):
            self.take("(")
            cond = self.expression()
            self.take(")")
            body = self.block()
            node = {"kind": kind, "cond": cond, "body": body, "pos": pos}
            if kind == "if":
                node["else"] = []
                if self.peek() == "else":
                    self.take()
                    node["else"] = self.block()
            return node
        else:
            raise LanguageError("parse", pos, "expected statement")
        self.take(";")
        return node

    def program(self):
        body = []
        while self.peek() != "eof":
            body.append(self.statement())
        return body


class Compiler:
    def __init__(self):
        self.scopes, self.code, self.slots = [{}], [], 0

    def emit(self, op, value=None, pos=0):
        self.code.append([op, value, pos])
        return len(self.code) - 1

    def lookup(self, name, pos):
        for scope in reversed(self.scopes):
            if name in scope:
                return scope[name]
        raise LanguageError("type", pos, "undeclared " + name)

    def require(self, condition, pos):
        if not condition:
            raise LanguageError("type", pos, "incompatible types")

    def expression(self, node):
        kind, pos = node["kind"], node["pos"]
        if kind == "literal":
            self.emit("PUSH", node["value"], pos)
            return type(node["value"])
        if kind == "variable":
            slot, category = self.lookup(node["name"], pos)
            self.emit("LOAD", slot, pos)
            return category
        if kind == "unary":
            category = self.expression(node["right"])
            self.require(category is (int if node["op"] == "-" else bool), pos)
            self.emit("UNARY", node["op"], pos)
            return category
        op = node["op"]
        left = self.expression(node["left"])
        if op in ("&&", "||"):
            self.require(left is bool, pos)
            jump = self.emit("JF", pos=pos)
            if op == "||":
                self.emit("PUSH", True, pos)
            else:
                self.require(self.expression(node["right"]) is bool, pos)
            end = self.emit("JMP", pos=pos)
            self.code[jump][1] = len(self.code)
            if op == "||":
                self.require(self.expression(node["right"]) is bool, pos)
            else:
                self.emit("PUSH", False, pos)
            self.code[end][1] = len(self.code)
            return bool
        right = self.expression(node["right"])
        self.require(left is right, pos)
        if op not in ("==", "!="):
            self.require(left is int, pos)
        self.emit("BINARY", op, pos)
        return bool if op in ("==", "!=", "<", "<=", ">", ">=") else int

    def body(self, nodes, scoped=False):
        if scoped:
            self.scopes.append({})
        for node in nodes:
            kind, pos = node["kind"], node["pos"]
            if kind in ("let", "assign"):
                category = self.expression(node["expr"])
                if kind == "let":
                    self.require(node["name"] not in self.scopes[-1], pos)
                    slot = self.slots
                    self.slots += 1
                    self.scopes[-1][node["name"]] = (slot, category)
                else:
                    slot, previous = self.lookup(node["name"], pos)
                    self.require(category is previous, pos)
                self.emit("STORE", slot, pos)
            elif kind == "print":
                self.expression(node["expr"])
                self.emit("PRINT", pos=pos)
            elif kind == "block":
                self.body(node["body"], True)
            else:
                start = len(self.code)
                self.require(self.expression(node["cond"]) is bool, pos)
                exit_jump = self.emit("JF", pos=pos)
                self.body(node["body"], True)
                if kind == "while":
                    self.emit("JMP", start, pos)
                    self.code[exit_jump][1] = len(self.code)
                else:
                    end_jump = self.emit("JMP", pos=pos)
                    self.code[exit_jump][1] = len(self.code)
                    self.body(node["else"], True)
                    self.code[end_jump][1] = len(self.code)
        if scoped:
            self.scopes.pop()
        return self.code


def stack_run(code, budget):
    stack, slots, output, pc = [], {}, [], 0
    while pc < len(code):
        budget -= 1
        op, value, pos = code[pc]
        if budget < 0:
            raise LanguageError("run", pos, "instruction budget")
        pc += 1
        if op == "PUSH":
            stack.append(value)
        elif op == "LOAD":
            stack.append(slots[value])
        elif op == "STORE":
            slots[value] = stack.pop()
        elif op == "PRINT":
            output.append(stack.pop())
        elif op == "JMP":
            pc = value
        elif op == "JF":
            if not stack.pop():
                pc = value
        elif op == "UNARY":
            operand = stack.pop()
            stack.append(-operand if value == "-" else not operand)
        else:
            right, left = stack.pop(), stack.pop()
            if value == "+":
                result = left + right
            elif value == "-":
                result = left - right
            elif value == "*":
                result = left * right
            elif value == "/":
                if right == 0:
                    raise LanguageError("run", pos, "division by zero")
                result = (1 if left * right >= 0 else -1) * (abs(left) // abs(right))
            elif value == "<":
                result = left < right
            elif value == "<=":
                result = left <= right
            elif value == ">":
                result = left > right
            elif value == ">=":
                result = left >= right
            elif value == "==":
                result = left == right
            else:
                result = left != right
            stack.append(result)
    return output


class Interpreter:
    def __init__(self, budget):
        self.scopes, self.output, self.budget = [{}], [], budget

    def tick(self, pos):
        self.budget -= 1
        if self.budget < 0:
            raise LanguageError("run", pos, "source budget")

    def binding(self, name):
        return next(scope for scope in reversed(self.scopes) if name in scope)

    def expression(self, node):
        self.tick(node["pos"])
        kind = node["kind"]
        if kind == "literal":
            return node["value"]
        if kind == "variable":
            return self.binding(node["name"])[node["name"]]
        if kind == "unary":
            right = self.expression(node["right"])
            return -right if node["op"] == "-" else not right
        left = self.expression(node["left"])
        op = node["op"]
        if op == "&&":
            return left and self.expression(node["right"])
        if op == "||":
            return left or self.expression(node["right"])
        right = self.expression(node["right"])
        if op == "+":
            return left + right
        if op == "-":
            return left - right
        if op == "*":
            return left * right
        if op == "/":
            if right == 0:
                raise LanguageError("run", node["pos"], "division by zero")
            quotient = abs(left) // abs(right)
            return -quotient if (left < 0) != (right < 0) else quotient
        if op == "<":
            return left < right
        if op == "<=":
            return left <= right
        if op == ">":
            return left > right
        if op == ">=":
            return left >= right
        if op == "==":
            return left == right
        return left != right

    def body(self, nodes, scoped=False):
        if scoped:
            self.scopes.append({})
        for node in nodes:
            self.tick(node["pos"])
            kind = node["kind"]
            if kind == "let":
                self.scopes[-1][node["name"]] = self.expression(node["expr"])
            elif kind == "assign":
                self.binding(node["name"])[node["name"]] = self.expression(node["expr"])
            elif kind == "print":
                self.output.append(self.expression(node["expr"]))
            elif kind == "block":
                self.body(node["body"], True)
            elif kind == "if":
                self.body(
                    node["body"] if self.expression(node["cond"]) else node["else"],
                    True,
                )
            else:
                while self.expression(node["cond"]):
                    self.body(node["body"], True)
        if scoped:
            self.scopes.pop()
        return self.output


def run(source, budget=10000):
    tokens = lex(source)
    ast = Parser(tokens).program()
    code = Compiler().body(ast)
    interpreted = Interpreter(budget).body(ast)
    compiled = stack_run(code, budget)
    return {
        "tokens": tokens,
        "ast": ast,
        "instructions": code,
        "interpreted": interpreted,
        "compiled": compiled,
    }
