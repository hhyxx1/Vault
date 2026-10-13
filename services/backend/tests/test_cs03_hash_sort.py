import json

from vault_backend.course_checks.semantic_suites import ORACLES


def test_hash_tombstones_and_rehash_preserve_existing_keys():
    stdin = "3\nI -1\nI 2\nI 5\nD 2\nF 5\nI 8\nP\nR 7\nC\nV\n"
    assert ORACLES["cs03_hash"](stdin) == (
        "inserted\ninserted\ninserted\ndeleted\nfound\ninserted\n-1 5 8\nrehash\n"
        "size=3 capacity=7 probes=17\nvalid\n"
    )


def test_sort_reference_contract_preserves_record_identity_and_stability():
    expected = json.loads(ORACLES["cs03_sort"]("insertion\n4\n2 0\n1 1\n2 2\n1 3\n"))
    assert expected["records"] == [[2, 0], [1, 1], [2, 2], [1, 3]]
    assert expected["stable"] is True


def test_external_sort_requires_real_run_bound_and_multiple_passes():
    expected = json.loads(ORACLES["cs03_external"]("EXTERNAL\n6 2\n5 0\n1 1\n4 2\n2 3\n3 4\n0 5\n"))
    assert expected["block"] == 2
    assert expected["passes"] == 2
    assert expected["n"] == 6
