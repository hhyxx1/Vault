"""Original private-loopback teaching service; identities are simulated, not login."""

import http.client
import json
import sqlite3
import sys
import threading
from contextlib import closing, contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import quote


def connection(path):
    if sys.platform == "linux":
        # All connections to this private lesson DB use the same real dot-file lock VFS.
        # The isolate runtime denies POSIX fcntl locks; do not use unix-none or disable journals.
        uri = "file:" + quote(str(Path(path).resolve()), safe="/") + "?vfs=unix-dotfile"
        return sqlite3.connect(uri, uri=True, timeout=2)
    return sqlite3.connect(path, timeout=2)


def initialize(path):
    with closing(connection(path)) as db, db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS drafts(id INTEGER PRIMARY KEY, owner TEXT NOT NULL,
          title TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('draft','submitted')));
        CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, draft INTEGER NOT NULL, action TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS repeats(owner TEXT NOT NULL, key TEXT NOT NULL,
          draft INTEGER NOT NULL, response TEXT NOT NULL, PRIMARY KEY(owner,key));
        """)


def dispatch(path, release, method, route, identity, body):
    if method == "GET" and route == "/health":
        return 200, {"release": release, "ready": True}
    # A lesson-only trusted identity simulator. This header is NOT authentication.
    if identity not in ("alice", "bob"):
        return 401, {"error": "identity_required"}
    with closing(connection(path)) as db, db:
        db.execute("BEGIN IMMEDIATE")
        if method == "POST" and route == "/drafts":
            title = body.get("title")
            if not isinstance(title, str) or not title.strip() or len(title) > 200:
                return 400, {"error": "title_required_1_to_200_characters"}
            cursor = db.execute(
                "INSERT INTO drafts(owner,title,state) VALUES(?,?,?)",
                (identity, title.strip(), "draft"),
            )
            draft = cursor.lastrowid
            db.execute(
                "INSERT INTO events(draft,action) VALUES(?,?)", (draft, "created")
            )
            return 201, {"id": draft, "title": title.strip(), "state": "draft"}
        parts = route.strip("/").split("/")
        if len(parts) not in (2, 3) or parts[0] != "drafts" or not parts[1].isdigit():
            return 404, {"error": "route_not_found"}
        draft = int(parts[1])
        row = db.execute(
            "SELECT owner,title,state FROM drafts WHERE id=?", (draft,)
        ).fetchone()
        if row is None:
            return 404, {"error": "draft_not_found"}
        if identity != row[0]:
            return 403, {"error": "owner_required"}
        response = {"id": draft, "title": row[1], "state": row[2]}
        if method == "GET" and len(parts) == 2:
            return 200, response
        if method != "POST" or len(parts) != 3 or parts[2] != "submit" or release < 2:
            return 404, {"error": "route_not_found"}
        key = body.get("key")
        if not isinstance(key, str) or not key or len(key) > 100:
            return 400, {"error": "idempotency_key_required"}
        prior = db.execute(
            "SELECT draft,response FROM repeats WHERE owner=? AND key=?",
            (identity, key),
        ).fetchone()
        if prior:
            return (
                (200, json.loads(prior[1]))
                if prior[0] == draft
                else (409, {"error": "key_reused_for_other_draft"})
            )
        if row[2] != "draft":
            return 409, {"error": "already_submitted"}
        response["state"] = "submitted"
        db.execute("UPDATE drafts SET state=? WHERE id=?", ("submitted", draft))
        db.execute("INSERT INTO events(draft,action) VALUES(?,?)", (draft, "submitted"))
        db.execute(
            "INSERT INTO repeats(owner,key,draft,response) VALUES(?,?,?,?)",
            (identity, key, draft, json.dumps(response, sort_keys=True)),
        )
        return 200, response


@contextmanager
def running(path, release=2):
    initialize(path)

    class Handler(BaseHTTPRequestHandler):
        def handle_request(self):
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length < 0 or length > 4096:
                    raise ValueError("body too large")
                body = json.loads(self.rfile.read(length)) if length else {}
                if not isinstance(body, dict):
                    raise TypeError("object body required")
                status, result = dispatch(
                    path,
                    release,
                    self.command,
                    self.path,
                    self.headers.get("X-Lab-Identity"),
                    body,
                )
            except (ValueError, TypeError, UnicodeError):
                status, result = 400, {"error": "invalid_request_body"}
            encoded = json.dumps(result, sort_keys=True).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        do_GET = handle_request
        do_POST = handle_request

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(
        target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True
    )
    thread.start()
    try:
        yield server.server_address
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def request(address, method, route, identity=None, body=None):
    headers = {"Content-Type": "application/json"}
    if identity:
        headers["X-Lab-Identity"] = identity
    connection = http.client.HTTPConnection(*address, timeout=2)
    try:
        connection.request(
            method,
            route,
            body=json.dumps(body) if body is not None else None,
            headers=headers,
        )
        response = connection.getresponse()
        return response.status, json.loads(response.read())
    finally:
        connection.close()


def audit(path):
    with closing(connection(path)) as db:
        return [row[0] for row in db.execute("SELECT action FROM events ORDER BY id")]


def exercise(title="Graph proof", path="submission.db"):
    with running(path, release=1) as address:
        health = request(address, "GET", "/health")
        created = request(address, "POST", "/drafts", "alice", {"title": title})
        draft = created[1]["id"]
        route = f"/drafts/{draft}"
        other = request(address, "GET", route, "bob")
        early = request(address, "POST", route + "/submit", "alice", {"key": "first"})
    with running(path, release=2) as address:
        restored = request(address, "GET", route, "alice")
        submitted = request(
            address, "POST", route + "/submit", "alice", {"key": "first"}
        )
        repeated = request(
            address, "POST", route + "/submit", "alice", {"key": "first"}
        )
        conflict = request(
            address, "POST", route + "/submit", "alice", {"key": "different"}
        )
    with running(path, release=2) as address:
        reopened = request(address, "GET", route, "alice")
    return {
        "release1_health": health,
        "created": created,
        "other_owner_status": other[0],
        "release1_submit_status": early[0],
        "restored_draft": restored,
        "submitted": submitted,
        "repeated_identical": repeated == submitted,
        "repeat_new_key_status": conflict[0],
        "restored_submission": reopened,
        "audit": audit(path),
        "identity_mode": "simulated private lesson identity, not authentication",
    }
