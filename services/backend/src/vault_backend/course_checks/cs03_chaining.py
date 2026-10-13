"""Reference oracle for separate chaining with unique integer keys."""


def chaining_model(stdin: str) -> str:
    lines = stdin.splitlines()
    capacity = int(lines[0])
    if capacity < 1:
        raise ValueError("Hash table fixtures require positive capacity")
    buckets: list[list[int]] = [[] for _ in range(capacity)]
    size = 0
    output: list[str] = []

    def index(key: int) -> int:
        return key % capacity

    for line in lines[1:]:
        tokens = line.split()
        if not tokens:
            continue
        operation = tokens[0]
        if operation in {"P", "C", "V"} and len(tokens) == 1:
            if operation == "P":
                values = sorted(key for bucket in buckets for key in bucket)
                output.append(" ".join(map(str, values)) if values else "empty")
            elif operation == "C":
                output.append(f"size={size} max_chain={max(map(len, buckets), default=0)}")
            else:
                keys = [key for bucket in buckets for key in bucket]
                valid = (
                    len(keys) == size
                    and len(set(keys)) == size
                    and all(index(key) == slot for slot, bucket in enumerate(buckets) for key in bucket)
                )
                output.append("valid" if valid else "corrupt")
        elif operation in {"I", "D", "F"} and len(tokens) == 2:
            key = int(tokens[1])
            bucket = buckets[index(key)]
            found = key in bucket
            if operation == "I":
                if found:
                    output.append("exists")
                else:
                    bucket.append(key)
                    size += 1
                    output.append("inserted")
            elif operation == "D":
                if found:
                    bucket.remove(key)
                    size -= 1
                    output.append("deleted")
                else:
                    output.append("missing")
            else:
                output.append("found" if found else "missing")
        else:
            raise ValueError("Unknown internal separate-chaining fixture operation")
    return "\n".join(output) + ("\n" if output else "")


ORACLE_ID = "cs03_chaining"
OBJECTIVE = "CS03-M09-O04"
VISIBLE = (
    "3\nI -1\nI 2\nI 5\nI 2\nF 5\nD 2\nF 5\nP\nC\nV\n",
    "1\nI -4\nI 8\nI 12\nC\nF 8\nD 8\nF 8\nI 12\nP\nV\n",
)
INDEPENDENT = (
    "5\nI 1\nI 6\nI 11\nI 16\nC\nD 6\nD 11\nF 16\nC\nP\nV\n",
    "2\nI -3\nI -1\nI 1\nC\nD 99\nD -3\nP\nV\n",
    "1\nI 7\nI 7\nI -2\nF -2\nC\nD 7\nD 7\nP\nV\n",
    "4\nF 8\nD 8\nI 8\nI 12\nI 16\nI 20\nC\nP\nV\n",
)
