"""Set-operation oracle independent of student BST/AVL/B+ representations."""


def search_model(stdin: str) -> str:
    keys: set[int] = set()
    out = []
    for line in stdin.splitlines():
        tokens = line.split()
        if not tokens:
            continue
        op = tokens[0]
        if op == "P":
            out.append(" ".join(map(str, sorted(keys))) if keys else "empty")
        elif op == "V":
            out.append("valid")
        else:
            key = int(tokens[1])
            if op == "I":
                out.append("exists" if key in keys else "inserted")
                keys.add(key)
            elif op == "D":
                out.append("deleted" if key in keys else "missing")
                keys.discard(key)
            elif op == "F":
                out.append("found" if key in keys else "missing")
            else:
                raise ValueError("Unknown internal search-tree operation")
    return "\n".join(out) + "\n"


ORACLES = {"cs03_search_tree": search_model}
INPUTS = {
    "cs03_search_tree": (
        (
            "I 4\nI 2\nI 6\nI 1\nI 3\nI 5\nI 7\nD 4\nP\nV\n",
            "I 3\nI 1\nI 2\nV\nI 5\nI 4\nV\nD 2\nP\nV\n",
        ),
        (
            "I 41\nI 42\nI 43\nI 44\nI 45\nV\nD 43\nD 41\nP\nV\n",
            "D 9\nI -7\nI -7\nF -7\nD -7\nV\nI 8\nP\nV\n",
            "I 8\nI 6\nI 7\nI 10\nI 9\nI 12\nD 8\nV\nD 6\nD 7\nD 9\nD 10\nD 12\nP\nV\n",
        ),
    )
}
GOALS = {
    "CS03-M06-O01": ("cs03_search_tree", "bst"),
    "CS03-M06-O02": ("cs03_search_tree", "avl"),
    "CS03-M06-O03": ("cs03_search_tree", "bplus"),
}
