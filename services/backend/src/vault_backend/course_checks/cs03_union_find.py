"""Audited parent-pointer disjoint-set oracle for CS03."""

from __future__ import annotations


def union_find_model(stdin: str) -> str:
    lines = stdin.splitlines()
    count = int(lines[0])
    if not 1 <= count <= 200:
        raise ValueError("Union-find fixtures require between 1 and 200 elements")

    parent = list(range(count))
    weight = [1] * count
    components = count
    output: list[str] = []

    def find(value: int) -> int:
        root = value
        while parent[root] != root:
            root = parent[root]
        while parent[value] != value:
            following = parent[value]
            parent[value] = root
            value = following
        return root

    def size(value: int) -> int:
        root = find(value)
        return weight[root]

    for line in lines[1:]:
        tokens = line.split()
        if not tokens:
            continue
        operation = tokens[0]
        if operation == "U" and len(tokens) == 3:
            left, right = map(int, tokens[1:])
            root_left, root_right = find(left), find(right)
            if root_left == root_right:
                output.append("same")
                continue
            if weight[root_left] < weight[root_right] or (
                weight[root_left] == weight[root_right] and root_left > root_right
            ):
                root_left, root_right = root_right, root_left
            parent[root_right] = root_left
            weight[root_left] += weight[root_right]
            components -= 1
            output.append("merged")
        elif operation == "C" and len(tokens) == 3:
            left, right = map(int, tokens[1:])
            output.append("1" if find(left) == find(right) else "0")
        elif operation == "S" and len(tokens) == 2:
            output.append(str(size(int(tokens[1]))))
        elif operation == "N" and len(tokens) == 1:
            output.append(str(components))
        elif operation == "P" and len(tokens) == 2:
            value = int(tokens[1])
            depth = 0
            current = value
            while parent[current] != current:
                depth += 1
                current = parent[current]
            find(value)
            output.append(str(depth))
        elif operation == "V" and len(tokens) == 1:
            roots = [index for index, ancestor in enumerate(parent) if index == ancestor]
            observed = [0] * count
            for value in range(count):
                observed[find(value)] += 1
            valid = (
                len(roots) == components
                and all(observed[root] == weight[root] for root in roots)
                and sum(weight[root] for root in roots) == count
            )
            output.append("valid" if valid else "corrupt")
        else:
            raise ValueError("Unknown internal union-find fixture operation")
    return "\n".join(output) + ("\n" if output else "")


ORACLE_ID = "cs03_union_find"
OBJECTIVE = "CS03-M07-O04"
VISIBLE = (
    "8\nU 0 1\nU 2 3\nU 0 2\nU 4 5\nU 6 7\nU 4 6\nU 0 4\n"
    "C 3 7\nS 7\nN\nP 7\nP 7\nV\n",
    "6\nC 0 5\nU 0 1\nU 2 3\nU 1 3\nC 0 2\nS 3\nN\nU 0 3\nV\n",
)
INDEPENDENT = (
    "5\nU 1 2\nU 3 4\nC 2 3\nU 2 4\nC 1 3\nS 4\nN\nV\n",
    "1\nC 0 0\nS 0\nN\nP 0\nU 0 0\nV\n",
    "10\nU 0 1\nU 2 3\nU 4 5\nU 6 7\nU 0 2\nU 4 6\nU 0 4\nP 7\nC 9 8\nN\nV\n",
    "4\nU 0 1\nU 0 1\nU 0 2\nU 3 2\nS 3\nC 1 3\nN\nP 3\nV\n",
)
