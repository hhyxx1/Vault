"""Selection probe only: synthetic data, no LLM, API, production ACL or evidence writes."""
from __future__ import annotations
import json
import os
import sys
from importlib.metadata import version
from pathlib import Path
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt, Command
from langgraph.checkpoint.sqlite import SqliteSaver

class State(TypedDict):
    owner: str
    task: str
    student_work: str
    proposal: str

# Production must resolve these facts in PostgreSQL; this probe uses explicit fixtures.
OWNERS = {'run-a': 'student-a', 'run-b': 'student-b', 'run-revoked': 'student-a', 'run-cancelled': 'student-a'}
REVOKED = set()
CANCELLED = set()

def guard(actor: str, run_id: str):
    if OWNERS.get(run_id) != actor:
        raise PermissionError('wrong owner')
    if run_id in REVOKED or run_id in CANCELLED:
        raise PermissionError('run cannot resume')

def wait_student(state: State):
    work = interrupt({'kind': 'student.input_required', 'task': state['task']})
    if not isinstance(work, str) or not work:
        raise ValueError('real student input required')
    return {'student_work': work}

def propose_review(state: State):
    return {'proposal': 'needs_real_verification:' + state['student_work']}

def build(saver):
    return (StateGraph(State)
            .add_node('wait_student', wait_student)
            .add_node('propose_review', propose_review)
            .add_edge(START, 'wait_student')
            .add_edge('wait_student', 'propose_review')
            .add_edge('propose_review', END)
            .compile(checkpointer=saver))

def run_actor(graph, actor, run_id, value):
    guard(actor, run_id)
    return graph.invoke(value, {'configurable': {'thread_id': run_id}, 'recursion_limit': 12})

def main():
    phase, db_path = sys.argv[1:3]
    with SqliteSaver.from_conn_string(db_path) as saver:
        graph = build(saver)
        if phase == 'prepare':
            for run_id, actor, task in [('run-a', 'student-a', 'task-a'), ('run-b', 'student-b', 'task-b')]:
                output = run_actor(graph, actor, run_id, {'owner': actor, 'task': task, 'student_work': '', 'proposal': ''})
                assert output['__interrupt__'] and not output.get('proposal')
            print(json.dumps({'phase': phase, 'passed': ['pause_waits_for_student', 'two_independent_pending_runs']}))
            return
        a = run_actor(graph, 'student-a', 'run-a', Command(resume='work-a'))
        assert a['owner'] == 'student-a' and a['student_work'] == 'work-a'
        assert a['proposal'] == 'needs_real_verification:work-a'
        b = graph.get_state({'configurable': {'thread_id': 'run-b'}})
        assert b.values['student_work'] == '' and b.next == ('wait_student',)
        denied = []
        for run_id, actor in [('run-a', 'student-b'), ('run-revoked', 'student-a'), ('run-cancelled', 'student-a')]:
            REVOKED.add('run-revoked')
            CANCELLED.add('run-cancelled')
            try:
                run_actor(graph, actor, run_id, Command(resume='unauthorized'))
                raise AssertionError('guard did not reject')
            except PermissionError:
                denied.append(run_id)
        print(json.dumps({'phase': phase, 'passed': ['restart_resumes_sqlite_checkpoint', 'other_run_remains_pending', 'output_is_proposal_not_evidence', 'fixture_owner_guard', 'fixture_revoke_guard', 'fixture_cancel_guard'], 'denied': denied, 'python': sys.version.split()[0], 'versions': {p: version(p) for p in ['langgraph', 'langgraph-checkpoint', 'langgraph-checkpoint-sqlite']}}))

if __name__ == '__main__':
    main()
