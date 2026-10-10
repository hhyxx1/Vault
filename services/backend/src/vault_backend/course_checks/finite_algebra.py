"""Original exhaustive finite operation-table explorer, domain labels 0..n-1.

Ring convention: additive abelian group, associative multiplication, both
distributive laws; a multiplicative identity is reported separately. Field also
requires commutativity, distinct additive/multiplicative identities and inverses
of all nonzero elements. Exhaustion is conclusive only for the supplied tables.
"""

from itertools import product


def validate(table):
    if not isinstance(table, list) or not 1 <= len(table) <= 12:
        raise ValueError("nonempty domain, at most 12 labels")
    n = len(table)
    if any(not isinstance(row, list) or len(row) != n for row in table):
        raise ValueError("complete square operation table required")
    if any(type(value) is not int for row in table for value in row):
        raise ValueError("integer element labels required")
    return n


def group(table):
    n = validate(table)
    closure = next(
        ([a, b, table[a][b]] for a, b in product(range(n), repeat=2) if not 0 <= table[a][b] < n),
        None,
    )
    result = {
        "closed": closure is None,
        "closure_witness": closure,
        "associative": None,
        "associativity_witness": None,
        "identity": None,
        "inverses": None,
        "commutative": None,
        "commutativity_witness": None,
        "is_group": False,
    }
    if closure is not None:
        return result
    witness = next(
        (
            [a, b, c, table[table[a][b]][c], table[a][table[b][c]]]
            for a, b, c in product(range(n), repeat=3)
            if table[table[a][b]][c] != table[a][table[b][c]]
        ),
        None,
    )
    identity = next(
        (e for e in range(n) if all(table[e][a] == table[a][e] == a for a in range(n))),
        None,
    )
    inverses = (
        None
        if identity is None
        else [
            next((b for b in range(n) if table[a][b] == table[b][a] == identity), None)
            for a in range(n)
        ]
    )
    commuting = next(
        (
            [a, b, table[a][b], table[b][a]]
            for a, b in product(range(n), repeat=2)
            if table[a][b] != table[b][a]
        ),
        None,
    )
    result.update(
        associative=witness is None,
        associativity_witness=witness,
        identity=identity,
        inverses=inverses,
        commutative=commuting is None,
        commutativity_witness=commuting,
    )
    result["is_group"] = (
        witness is None and identity is not None and all(value is not None for value in inverses)
    )
    return result


def homomorphism(source, target, mapping):
    n, m = validate(source), validate(target)
    if (
        not isinstance(mapping, list)
        or len(mapping) != n
        or any(type(value) is not int or not 0 <= value < m for value in mapping)
    ):
        raise ValueError("total mapping into the target domain required")
    source_report, target_report = group(source), group(target)
    closed = source_report["closed"] and target_report["closed"]
    witness = (
        next(
            (
                [a, b, mapping[source[a][b]], target[mapping[a]][mapping[b]]]
                for a, b in product(range(n), repeat=2)
                if mapping[source[a][b]] != target[mapping[a]][mapping[b]]
            ),
            None,
        )
        if closed
        else None
    )
    collision = next(
        ([a, b, mapping[a]] for a in range(n) for b in range(a + 1, n) if mapping[a] == mapping[b]),
        None,
    )
    missing = [value for value in range(m) if value not in mapping]
    is_hom = closed and witness is None and source_report["is_group"] and target_report["is_group"]
    return {
        "source_is_group": source_report["is_group"],
        "target_is_group": target_report["is_group"],
        "preserves_operation": witness is None if closed else None,
        "preservation_witness": witness,
        "injective": collision is None,
        "collision_witness": collision,
        "surjective": not missing,
        "missing_targets": missing,
        "is_group_homomorphism": is_hom,
        "is_group_isomorphism": is_hom and collision is None and not missing,
    }


def ring(add, multiply):
    n = validate(add)
    if validate(multiply) != n:
        raise ValueError("operations must share the same labelled domain")
    addition, multiplication = group(add), group(multiply)
    result = {
        "addition": addition,
        "multiplication": multiplication,
        "distributivity_witness": None,
        "ring": False,
        "unital_ring": False,
        "field": False,
        "nonzero_inverse_witness": None,
        "nonzero_inverse_state": "not_checked",
        "zero_divisor_witness": None,
    }
    if not addition["closed"] or not multiplication["closed"]:
        return result
    witness = None
    for a, b, c in product(range(n), repeat=3):
        left, right = multiply[a][add[b][c]], add[multiply[a][b]][multiply[a][c]]
        if left != right:
            witness = ["left", a, b, c, left, right]
            break
        left, right = multiply[add[a][b]][c], add[multiply[a][c]][multiply[b][c]]
        if left != right:
            witness = ["right", a, b, c, left, right]
            break
    zero, one = addition["identity"], multiplication["identity"]
    is_ring = (
        addition["is_group"]
        and addition["commutative"]
        and multiplication["associative"]
        and witness is None
    )
    missing = None
    if zero is not None and one is not None:
        missing = next(
            (
                a
                for a in range(n)
                if a != zero and not any(multiply[a][b] == multiply[b][a] == one for b in range(n))
            ),
            None,
        )
    divisor = (
        None
        if zero is None
        else next(
            (
                [a, b]
                for a, b in product(range(n), repeat=2)
                if a != zero and b != zero and multiply[a][b] == zero
            ),
            None,
        )
    )
    field = (
        is_ring
        and multiplication["commutative"]
        and one is not None
        and one != zero
        and missing is None
    )
    result.update(
        distributivity_witness=witness,
        ring=is_ring,
        unital_ring=is_ring and one is not None,
        field=field,
        nonzero_inverse_witness=missing,
        nonzero_inverse_state=(
            "not_applicable_no_identity"
            if one is None
            else "not_checked_no_additive_identity"
            if zero is None
            else "missing"
            if missing is not None
            else "all_present"
        ),
        zero_divisor_witness=divisor,
    )
    return result
