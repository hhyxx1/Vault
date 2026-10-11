import pytest
from test_algebra_registry import registry_work as registry_work
from test_algebra_sync import payload as payload
from test_sync import batch, claim, operation
from test_sync import cloud as cloud

pytestmark = pytest.mark.postgres


@pytest.mark.parametrize("account_type", ["student", "teacher"])
async def test_native_work_sync_retains_history_and_owner_boundaries(cloud, payload, account_type):
    _, seed, _ = cloud
    client, owner = seed(account_type)
    mapping, _ = await claim(client, owner)
    sid = mapping["server_space_id"]
    payload = {**payload, "spaceId": mapping["origin_local_space_id"]}
    draft = {
        **payload,
        "result": None,
        "submittedAt": None,
        "predictions": {"closed": "", "associative": "", "is_group": ""},
    }
    created, _ = await batch(
        client, owner, sid, [operation("algebra_attempt", payload["id"], draft)]
    )
    assert created.status_code == 200, created.text
    assert created.json()["results"][0]["status"] == "applied", created.text
    edited, _ = await batch(
        client,
        owner,
        sid,
        [
            operation(
                "algebra_attempt", payload["id"], {**draft, "table": [["0", "1"], ["1", "0"]]}, "1"
            )
        ],
    )
    assert edited.json()["results"][0]["status"] == "applied", edited.text
    submitted, _ = await batch(
        client,
        owner,
        sid,
        [operation("algebra_attempt", payload["id"], {**payload, "result": None}, "2")],
    )
    assert submitted.json()["results"][0]["status"] == "applied", submitted.text
    checked, _ = await batch(
        client, owner, sid, [operation("algebra_attempt", payload["id"], payload, "3")]
    )
    assert checked.json()["results"][0]["status"] == "applied", checked.text
    rejected, _ = await batch(
        client,
        owner,
        sid,
        [
            operation(
                "algebra_attempt",
                payload["id"],
                {**payload, "result": None, "explanation": "事后改写"},
                "4",
            )
        ],
    )
    assert rejected.json()["results"][0]["reason"] == "COURSE_ATTEMPT_LOCKED", rejected.text
    deleted, _ = await batch(
        client, owner, sid, [operation("algebra_attempt", payload["id"], {"deleted": True}, "4")]
    )
    assert deleted.json()["results"][0]["status"] == "rejected", deleted.text
    other, _ = seed("student")
    assert (await other.get(f"/api/v1/sync/spaces/{sid}/changes")).status_code == 404
    restored, _ = seed(account_type, account_id=owner)
    changes = await restored.get(f"/api/v1/sync/spaces/{sid}/changes")
    assert changes.status_code == 200, changes.text
    entries = [row for row in changes.json()["changes"] if row["object_type"] == "algebra_attempt"]
    assert entries and all(
        row["provenance"] == "client_reported" and row["requires_review"] for row in entries
    )
