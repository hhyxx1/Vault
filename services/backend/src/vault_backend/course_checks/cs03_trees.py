"""Tree representations and ordered binary traversal, with invalid graphs rejected."""


def parent_model(stdin):
    values = list(map(int, stdin.split()))
    n = values[0]
    parents = values[1:]
    if len(parents) != n or any(p < -1 or p >= n for p in parents):
        return "invalid\n"
    if n == 0:
        return "empty\n"
    roots = [i for i, p in enumerate(parents) if p == -1]
    if len(roots) != 1:
        return "invalid\n"
    root = roots[0]
    children = [[] for _ in range(n)]
    for i, p in enumerate(parents):
        if p != -1:
            children[p].append(i)
    visited = set()
    stack = [root]
    while stack:
        node = stack.pop()
        if node in visited:
            return "invalid\n"
        visited.add(node)
        stack.extend(children[node])
    if len(visited) != n:
        return "invalid\n"
    first = [row[0] if row else -1 for row in children]
    sibling = [-1] * n
    for row in children:
        for a, b in zip(row, row[1:], strict=False):
            sibling[a] = b
    return f"root={root}\n" + "".join(f"{i}:{first[i]},{sibling[i]}\n" for i in range(n))


def traversal_model(stdin):
    values = list(map(int, stdin.split()))
    n, root = values[:2]
    pairs = values[2:]
    if len(pairs) != 2 * n:
        return "invalid\n"
    if n == 0:
        return "empty\n" if root == -1 else "invalid\n"
    if not 0 <= root < n or any(x < -1 or x >= n for x in pairs):
        return "invalid\n"
    seen = set()
    pre = []
    inorder = []
    post = []

    def visit(i):
        if i == -1:
            return
        if i in seen:
            raise ValueError
        seen.add(i)
        pre.append(i)
        visit(pairs[2 * i])
        inorder.append(i)
        visit(pairs[2 * i + 1])
        post.append(i)

    try:
        visit(root)
    except (ValueError, RecursionError):
        return "invalid\n"
    if len(seen) != n:
        return "invalid\n"
    return "".join(
        name + "=" + " ".join(map(str, order)) + "\n"
        for name, order in (("pre", pre), ("in", inorder), ("post", post), ("iter_in", inorder))
    )


ORACLES = {"cs03_parent_tree": parent_model, "cs03_traversal": traversal_model}
INPUTS = {
    "cs03_parent_tree": (
        ("5\n-1 0 0 1 1\n", "3\n-1 2 1\n"),
        ("1\n-1\n", "4\n2 2 -1 0\n", "3\n-1 -1 0\n"),
    ),
    "cs03_traversal": (
        ("3 0\n1 2\n-1 -1\n-1 -1\n", "2 0\n1 1\n-1 -1\n"),
        ("1 0\n-1 -1\n", "4 2\n-1 3\n-1 -1\n0 1\n-1 -1\n", "2 0\n1 -1\n0 -1\n"),
    ),
}
GOALS = {
    "CS03-M05-O01": ("cs03_parent_tree", "parent_tree"),
    "CS03-M05-O02": ("cs03_traversal", "traversal"),
}
