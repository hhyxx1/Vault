"""Validate complete Huffman codebooks, allowing all equivalent optimal codes."""

import heapq
import json


def huffman_model(stdin: str) -> str:
    tokens = list(map(int, stdin.split()))
    n = tokens[0]
    weights = tokens[1 : 1 + n]
    m = tokens[1 + n]
    message = tokens[2 + n :]
    if not 0 <= n <= 32 or len(message) != m or any(x <= 0 for x in weights):
        raise ValueError("Invalid trusted Huffman fixture")
    if any(not 0 <= symbol < n for symbol in message):
        raise ValueError("Invalid trusted message symbol")
    heap = list(weights)
    heapq.heapify(heap)
    cost = weights[0] if n == 1 else 0
    while len(heap) > 1:
        total = heapq.heappop(heap) + heapq.heappop(heap)
        cost += total
        heapq.heappush(heap, total)
    return json.dumps({"weights": weights, "message": message, "optimal_cost": cost})


def compare_codebook(expected: str, observed: str) -> bool:
    try:
        model = json.loads(expected)
        work = json.loads(observed)
        if not isinstance(work, dict) or set(work) != {"codes", "bits"}:
            return False
        codes, bits = work["codes"], work["bits"]
        weights, message = model["weights"], model["message"]
        if not isinstance(codes, list) or len(codes) != len(weights):
            return False
        if not isinstance(bits, str) or any(char not in "01" for char in bits):
            return False
        if any(
            not isinstance(code, str)
            or not 1 <= len(code) <= 32
            or any(char not in "01" for char in code)
            for code in codes
        ):
            return False
        if any(
            i != j and second.startswith(first)
            for i, first in enumerate(codes)
            for j, second in enumerate(codes)
        ):
            return False
        if sum(w * len(c) for w, c in zip(weights, codes, strict=True)) != model["optimal_cost"]:
            return False
        # Prefix-free property makes this concatenation uniquely decodable.
        return bits == "".join(codes[symbol] for symbol in message)
    except (ValueError, TypeError, KeyError, IndexError, OverflowError, RecursionError):
        return False


ORACLES = {"cs03_huffman": huffman_model}
INPUTS = {
    "cs03_huffman": (
        ("4\n5 9 12 13\n6\n0 1 2 3 0 3\n", "1\n8\n3\n0 0 0\n"),
        ("2\n7 7\n4\n1 0 1 0\n", "5\n1 2 3 8 13\n6\n4 3 2 1 0 4\n", "0\n\n0\n\n"),
    )
}
GOALS = {"CS03-M05-O03": ("cs03_huffman", "huffman")}
