import importlib.util
from itertools import permutations
from pathlib import Path

import pytest


@pytest.fixture
def algebra():
    path = Path(__file__).resolve().parents[1] / "src/vault_backend/course_checks/finite_algebra.py"
    spec = importlib.util.spec_from_file_location("algebra_project", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def modular(n, multiply=False):
    return [[(a * b if multiply else a + b) % n for b in range(n)] for a in range(n)]


def test_closed_identity_and_inverses_do_not_replace_associativity(algebra):
    result = algebra.group([[0, 1, 2], [1, 0, 0], [2, 0, 0]])
    assert result["closed"] and result["identity"] == 0
    assert all(v is not None for v in result["inverses"])
    assert result["is_group"] is False
    assert result["associativity_witness"] == [1, 1, 2, 2, 1]


def test_commutativity_is_not_a_required_group_axiom(algebra):
    elements = list(permutations(range(3)))
    table = [
        [elements.index(tuple(left[right[i]] for i in range(3))) for right in elements]
        for left in elements
    ]
    result = algebra.group(table)
    assert result["is_group"] and result["commutative"] is False
    assert result["identity"] == 0


def test_all_known_modular_rings_and_prime_fields_in_small_range(algebra):
    for n in range(1, 13):
        result = algebra.ring(modular(n), modular(n, True))
        assert result["ring"] and result["unital_ring"]
        assert result["field"] == (n in {2, 3, 5, 7, 11})
    six = algebra.ring(modular(6), modular(6, True))
    assert six["zero_divisor_witness"] == [2, 3]
    assert six["nonzero_inverse_witness"] == 2
    assert algebra.ring([[0]], [[0]])["field"] is False


def test_non_distributive_pair_is_not_a_ring(algebra):
    multiply = modular(3, True)
    multiply[1][1] = 0
    result = algebra.ring(modular(3), multiply)
    assert result["ring"] is False
    assert result["distributivity_witness"] is not None


def test_out_of_domain_cell_has_explicit_closure_witness(algebra):
    result = algebra.group([[0, 1], [1, 2]])
    assert result["closed"] is False
    assert result["closure_witness"] == [1, 1, 2]
    assert result["is_group"] is False


def test_missing_multiplicative_identity_is_distinct_from_all_inverses_present(algebra):
    result = algebra.ring(modular(4), [[0] * 4 for _ in range(4)])
    assert result["ring"] and not result["unital_ring"] and not result["field"]
    assert result["nonzero_inverse_state"] == "not_applicable_no_identity"


def test_noncommutative_ring_is_not_misclassified_as_a_field(algebra):
    add = [[a ^ b for b in range(8)] for a in range(8)]

    def multiply(a, b):
        x, y, z = a & 1, (a >> 1) & 1, (a >> 2) & 1
        u, v, w = b & 1, (b >> 1) & 1, (b >> 2) & 1
        return (x * u) | (((x * v + y * w) % 2) << 1) | ((z * w) << 2)

    table = [[multiply(a, b) for b in range(8)] for a in range(8)]
    result = algebra.ring(add, table)
    assert result["ring"] and result["unital_ring"]
    assert result["multiplication"]["identity"] == 5
    assert result["multiplication"]["commutative"] is False
    assert result["field"] is False


@pytest.mark.parametrize("table", [[], [[0, 1]], [[True]], [[0.0]], [[0] * 13 for _ in range(13)]])
def test_invalid_shape_or_value_type_is_rejected(algebra, table):
    with pytest.raises(ValueError):
        algebra.group(table)


def test_homomorphism_can_preserve_operation_without_being_injective(algebra):
    result = algebra.homomorphism(modular(4), modular(2), [0, 1, 0, 1])
    assert result["preserves_operation"]
    assert not result["injective"] and result["surjective"]
    assert result["is_group_homomorphism"] and not result["is_group_isomorphism"]
    assert result["collision_witness"] == [0, 2, 0]


def test_bijective_mapping_does_not_necessarily_preserve_operation(algebra):
    result = algebra.homomorphism(modular(3), modular(3), [1, 0, 2])
    assert result["injective"] and result["surjective"]
    assert not result["preserves_operation"]
    assert result["preservation_witness"] == [0, 0, 1, 2]
    assert not result["is_group_homomorphism"]


def test_non_group_operation_preservation_is_not_a_group_homomorphism(algebra):
    result = algebra.homomorphism([[0, 0], [0, 0]], [[0]], [0, 0])
    assert result["preserves_operation"]
    assert not result["source_is_group"]
    assert not result["is_group_homomorphism"]


@pytest.mark.parametrize("mapping", [[0], [0, True], [0, 2], [0, 0.0]])
def test_mapping_requires_total_in_domain_integer_values(algebra, mapping):
    with pytest.raises(ValueError):
        algebra.homomorphism(modular(2), modular(2), mapping)
