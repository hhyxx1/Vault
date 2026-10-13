"""Independent reference models for string matching and finite special storage."""

import re


def _parts(stdin):
    text, pattern = stdin.splitlines()[:2]
    return text, pattern


def _positions(text, pattern):
    return [i for i in range(len(text) - len(pattern) + 1) if text[i : i + len(pattern)] == pattern]


def naive_model(stdin):
    text, pattern = _parts(stdin)
    positions = _positions(text, pattern)
    return (" ".join(map(str, positions)) if positions else "none") + "\n"


def kmp_model(stdin):
    text, pattern = _parts(stdin)
    # Deliberately use a brute-force proper-prefix definition, not C++ KMP.
    pi = []
    for i in range(len(pattern)):
        prefix = pattern[: i + 1]
        lengths = [k for k in range(1, len(prefix)) if prefix[:k] == prefix[-k:]]
        pi.append(max(lengths, default=0))
    positions = _positions(text, pattern)
    return (
        "pi="
        + (" ".join(map(str, pi)) if pi else "empty")
        + "\nmatch="
        + (" ".join(map(str, positions)) if positions else "none")
        + "\n"
    )


def special_model(stdin):
    lines = stdin.splitlines()
    if lines[0] == "COO":
        r, c, k = map(int, lines[1].split())
        if not (1 <= r <= 50 and 1 <= c <= 50 and 0 <= k <= 2500):
            return "invalid\n"
        entries = [list(map(int, line.split())) for line in lines[2:]]
        if len(entries) != k or any(
            len(x) != 3 or not 0 <= x[0] < r or not 0 <= x[1] < c for x in entries
        ):
            return "invalid\n"
        dense = [[0] * c for _ in range(r)]
        for i, j, value in entries:
            dense[i][j] += value
        transpose = [[dense[i][j] for i in range(r)] for j in range(c)]
        return (
            "dense\n"
            + "\n".join(" ".join(map(str, row)) for row in dense)
            + "\ntranspose\n"
            + ("\n".join(" ".join(map(str, row)) for row in transpose))
            + "\n"
        )
    if lines[0] != "GLIST" or len(lines) != 2:
        return "invalid\n"
    text = lines[1].replace(" ", "")
    tokens = re.findall(r"-?\d+|[(),]", text)
    if "".join(tokens) != text:
        return "invalid\n"
    index = 0

    def parse():
        nonlocal index
        if index >= len(tokens):
            raise ValueError
        token = tokens[index]
        index += 1
        if token != "(":
            if not re.fullmatch(r"-?\d+", token):
                raise ValueError
            return 0, 1
        depth = 1
        atoms = 0
        if index < len(tokens) and tokens[index] == ")":
            index += 1
            return depth, atoms
        while True:
            child_depth, child_atoms = parse()
            depth = max(depth, 1 + child_depth)
            atoms += child_atoms
            if index >= len(tokens):
                raise ValueError
            delimiter = tokens[index]
            index += 1
            if delimiter == ")":
                return depth, atoms
            if delimiter != ",":
                raise ValueError

    try:
        if not tokens or tokens[0] != "(":
            return "invalid\n"
        depth, atoms = parse()
        return f"depth={depth} atoms={atoms}\n" if index == len(tokens) else "invalid\n"
    except (ValueError, RecursionError):
        return "invalid\n"


ORACLES = {"cs03_naive": naive_model, "cs03_kmp": kmp_model, "cs03_special": special_model}
INPUTS = {
    "cs03_naive": (("ababa\naba\n", "abc\n\n"), ("mississippi\nissi\n", "\na\n", "aaaaa\naaa\n")),
    "cs03_kmp": (
        ("abababacaba\nababaca\n", "aaaaa\naaa\n"),
        ("abcabcabxabcabc\nabcabc\n", "\n\n", "ab\nabc\n"),
    ),
    "cs03_special": (
        ("COO\n2 3 4\n0 1 3\n0 1 -1\n1 0 5\n1 2 -2\n", "GLIST\n(1,(2,3),())\n"),
        ("COO\n1 2 3\n0 0 9\n0 0 -9\n0 1 -7\n", "GLIST\n((),(-12,(4)),5)\n", "GLIST\n(1,)\n"),
    ),
}
GOALS = {
    "CS03-M04-O01": ("cs03_naive", "naive"),
    "CS03-M04-O02": ("cs03_kmp", "kmp"),
    "CS03-M04-O03": ("cs03_special", "special"),
}
