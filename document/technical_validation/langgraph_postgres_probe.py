"""Disposable-DB probe: PostgreSQL checkpoint pause/restart/resume, no student text or model.

Run `prepare` and `resume` in separate processes against the same disposable DB URI.
This is an architecture probe, not an account API or a production authorization check.
"""

import asyncio
import json
import os
import sys
from typing import TypedDict

os.environ["LANGGRAPH_STRICT_MSGPACK"] = "true"

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from psycopg import AsyncConnection
from psycopg.rows import dict_row


class State(TypedDict):
    owner_ref: str
    activity_ref: str
    work_revision_ref: str
    proposal_ref: str


def wait_for_student(state: State):
    revision_ref = interrupt(
        {"kind": "student.input_required", "activity_ref": state["activity_ref"]}
    )
    if not isinstance(revision_ref, str) or not revision_ref.startswith("revision-"):
        raise ValueError("A validated student revision reference is required")
    return {"work_revision_ref": revision_ref}


def propose_review(state: State):
    return {"proposal_ref": f"review-needed:{state['work_revision_ref']}"}


def graph_with(checkpointer):
    graph = StateGraph(State)
    graph.add_node("wait_for_student", wait_for_student)
    graph.add_node("propose_review", propose_review)
    graph.add_edge(START, "wait_for_student")
    graph.add_edge("wait_for_student", "propose_review")
    graph.add_edge("propose_review", END)
    return graph.compile(checkpointer=checkpointer)


def config(run_id):
    return {"configurable": {"thread_id": run_id}, "recursion_limit": 12}


async def main(phase, url):
    if phase == "prepare":
        async with await AsyncConnection.connect(url, autocommit=True) as connection:
            await connection.execute("CREATE SCHEMA agent_checkpoint")
    async with await AsyncConnection.connect(
        url, autocommit=True, row_factory=dict_row, options="-c search_path=agent_checkpoint"
    ) as connection:
        checkpointer = AsyncPostgresSaver(connection)
        if phase == "prepare":
            await checkpointer.setup()
        graph = graph_with(checkpointer)
        if phase == "prepare":
            for run_id, owner in (
                ("synthetic-run-a", "synthetic-owner-a"),
                ("synthetic-run-b", "synthetic-owner-b"),
            ):
                state = await graph.ainvoke(
                    {
                        "owner_ref": owner,
                        "activity_ref": "CS03-STACK-01-TRACE@0.1.0",
                        "work_revision_ref": "",
                        "proposal_ref": "",
                    },
                    config(run_id),
                )
                assert state["__interrupt__"] and not state["proposal_ref"]
            print(
                json.dumps({"phase": phase, "passed": ["two_pending_runs", "minimal_references"]})
            )
        elif phase == "resume":
            result = await graph.ainvoke(Command(resume="revision-a2"), config("synthetic-run-a"))
            assert result["owner_ref"] == "synthetic-owner-a"
            assert result["proposal_ref"] == "review-needed:revision-a2"
            pending = await graph.aget_state(config("synthetic-run-b"))
            assert pending.values["owner_ref"] == "synthetic-owner-b"
            assert pending.next == ("wait_for_student",)
            assert "proposal_ref" not in pending.values or not pending.values["proposal_ref"]
            print(
                json.dumps(
                    {
                        "phase": phase,
                        "passed": [
                            "restart_resume",
                            "second_run_isolated",
                            "proposal_not_evidence",
                        ],
                    }
                )
            )
        else:
            raise ValueError("Use prepare or resume")


if __name__ == "__main__":
    asyncio.run(
        main(sys.argv[1], os.environ["VAULT_PG_PROBE_DATABASE_URL"]),
        loop_factory=asyncio.SelectorEventLoop,
    )
