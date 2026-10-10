import importlib.util
from pathlib import Path

import pytest


@pytest.fixture
def service():
    source = Path(__file__).resolve().parents[3] / "tools/curriculum/assets/submission_service.py"
    spec = importlib.util.spec_from_file_location("submission", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_real_http_increment_restart_and_repeat_submission(service, tmp_path):
    path = tmp_path / "course.db"
    with service.running(path, release=1) as address:
        assert service.request(address, "GET", "/health")[0] == 200
        assert service.request(address, "POST", "/drafts", body={"title": "Proof"})[0] == 401
        status, draft = service.request(address, "POST", "/drafts", "alice", {"title": "Proof"})
        assert status == 201
        assert service.request(address, "GET", f"/drafts/{draft['id']}", "bob")[0] == 403
        assert (
            service.request(
                address, "POST", f"/drafts/{draft['id']}/submit", "alice", {"key": "k1"}
            )[0]
            == 404
        )
    with service.running(path, release=2) as address:
        route = f"/drafts/{draft['id']}"
        assert service.request(address, "GET", route, "alice")[1]["state"] == "draft"
        first = service.request(address, "POST", route + "/submit", "alice", {"key": "k1"})
        assert first[0] == 200 and first[1]["state"] == "submitted"
        assert service.request(address, "POST", route + "/submit", "alice", {"key": "k1"}) == first
        assert service.request(address, "POST", route + "/submit", "alice", {"key": "k2"})[0] == 409
        assert service.request(address, "POST", route + "/submit", "bob", {"key": "k1"})[0] == 403
    with service.running(path, release=2) as address:
        assert service.request(address, "GET", route, "alice")[1]["state"] == "submitted"
        assert service.request(address, "POST", route + "/submit", "alice", {"key": "k1"}) == first
    assert service.audit(path) == ["created", "submitted"]


@pytest.mark.parametrize("title", [None, "", " " * 3, "x" * 201])
def test_invalid_draft_never_leaves_partial_record(service, tmp_path, title):
    path = tmp_path / "empty.db"
    with service.running(path) as address:
        assert service.request(address, "POST", "/drafts", "alice", {"title": title})[0] == 400
    assert service.audit(path) == []


def test_unknown_id_and_identity_are_distinct(service, tmp_path):
    with service.running(tmp_path / "course.db") as address:
        assert service.request(address, "GET", "/drafts/999", "alice")[0] == 404
        assert service.request(address, "GET", "/drafts/999")[0] == 401


def test_key_reuse_across_resources_rejected_without_new_state_or_event(service, tmp_path):
    path = tmp_path / "course.db"
    with service.running(path) as address:
        first = service.request(address, "POST", "/drafts", "alice", {"title": "' or 1=1 --"})[1]
        second = service.request(address, "POST", "/drafts", "alice", {"title": "second"})[1]
        assert (
            service.request(
                address, "POST", f"/drafts/{first['id']}/submit", "alice", {"key": "same"}
            )[0]
            == 200
        )
        assert (
            service.request(
                address, "POST", f"/drafts/{second['id']}/submit", "alice", {"key": "same"}
            )[0]
            == 409
        )
        assert (
            service.request(address, "GET", f"/drafts/{second['id']}", "alice")[1]["state"]
            == "draft"
        )
        assert (
            service.request(address, "GET", f"/drafts/{first['id']}", "alice")[1]["title"]
            == "' or 1=1 --"
        )
    assert service.audit(path) == ["created", "created", "submitted"]


@pytest.mark.parametrize("body", [[], {"key": ""}, {"key": None}, {"key": "x" * 101}])
def test_invalid_repeat_key_or_body_does_not_change_draft(service, tmp_path, body):
    path = tmp_path / "course.db"
    with service.running(path) as address:
        draft = service.request(address, "POST", "/drafts", "alice", {"title": "draft"})[1]
        route = f"/drafts/{draft['id']}"
        assert service.request(address, "POST", route + "/submit", "alice", body)[0] == 400
        assert service.request(address, "GET", route, "alice")[1]["state"] == "draft"
    assert service.audit(path) == ["created"]
