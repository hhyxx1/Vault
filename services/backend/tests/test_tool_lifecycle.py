"""Unit tests for the unified tool lifecycle capability matrix (C05).

These need no database or isolate worker: they pin the honest capability
contract and its read-only HTTP endpoint so unbuilt/externally blocked labs can
never be advertised as available.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from vault_backend.api import create_app
from vault_backend.config import Settings
from vault_backend.tool_lifecycle import (
    LIFECYCLE_STEPS,
    TOOL_CAPABILITIES,
    TOOL_ORDER,
    LifecycleStep,
    MethodCapability,
    Support,
    ToolCapability,
    ToolId,
    ToolState,
    capability_matrix,
    methods_for,
)


def test_matrix_covers_every_tool_and_all_eight_lifecycle_methods_once():
    assert set(TOOL_ORDER) == set(ToolId)
    assert len(TOOL_ORDER) == len(ToolId) == 5
    assert list(LIFECYCLE_STEPS) == [
        LifecycleStep.PREPARE,
        LifecycleStep.RUN_OR_STEP,
        LifecycleStep.INSPECT,
        LifecycleStep.CHECK,
        LifecycleStep.SNAPSHOT,
        LifecycleStep.RESTORE,
        LifecycleStep.CANCEL,
        LifecycleStep.CLEANUP,
    ]
    for capability in capability_matrix():
        steps = [method.step for method in capability.methods]
        assert sorted(steps) == sorted(LIFECYCLE_STEPS)
        assert len(set(steps)) == 8
        assert all(method.detail.strip() for method in capability.methods)


def test_code_advertises_only_what_the_isolate_worker_really_provides():
    code = methods_for(ToolId.CODE)
    assert TOOL_CAPABILITIES[ToolId.CODE].state is ToolState.AVAILABLE
    for step in (
        LifecycleStep.PREPARE,
        LifecycleStep.RUN_OR_STEP,
        LifecycleStep.CHECK,
        LifecycleStep.CANCEL,
        LifecycleStep.CLEANUP,
    ):
        assert code[step].support is Support.SUPPORTED
    # One-shot batch processing has no interactive inspection or persistent
    # lease state to snapshot/restore.
    for step in (LifecycleStep.INSPECT, LifecycleStep.SNAPSHOT, LifecycleStep.RESTORE):
        assert code[step].support is Support.NOT_APPLICABLE


def test_network_adapter_is_unavailable_and_lists_engineering_todos():
    # Installing containerlab/FRR and building per-lease isolation is internal
    # engineering work, not an external block: no resource/permission gap was
    # observed, so the adapter is simply not built yet.
    network = TOOL_CAPABILITIES[ToolId.NETWORK]
    assert network.state is ToolState.UNAVAILABLE
    assert not network.external_blockers
    for method in network.methods:
        assert method.support is Support.UNSUPPORTED
    assert any("工程待办" in method.detail for method in network.methods)


def test_linux_adapter_is_unavailable_and_never_claims_support():
    linux = TOOL_CAPABILITIES[ToolId.LINUX]
    assert linux.state is ToolState.UNAVAILABLE
    assert not linux.external_blockers  # buildable on existing isolate, not built
    assert all(method.support is Support.UNSUPPORTED for method in linux.methods)


def test_sql_and_data_are_partial_with_stateful_lease_methods_unsupported():
    sql = methods_for(ToolId.SQL)
    assert TOOL_CAPABILITIES[ToolId.SQL].state is ToolState.PARTIAL
    # One-shot run works; per-lease role/data, dual-connection barrier and
    # checkpoint restore are not built.
    assert sql[LifecycleStep.RUN_OR_STEP].support is Support.SUPPORTED
    for step in (LifecycleStep.INSPECT, LifecycleStep.SNAPSHOT, LifecycleStep.RESTORE):
        assert sql[step].support is Support.UNSUPPORTED

    data = methods_for(ToolId.DATA)
    assert TOOL_CAPABILITIES[ToolId.DATA].state is ToolState.PARTIAL
    assert data[LifecycleStep.RUN_OR_STEP].support is Support.SUPPORTED
    for step in (LifecycleStep.CHECK, LifecycleStep.SNAPSHOT, LifecycleStep.RESTORE):
        assert data[step].support is Support.UNSUPPORTED


def _unsupported_method(step: LifecycleStep) -> MethodCapability:
    return MethodCapability(step=step, support=Support.UNSUPPORTED, detail="x")


def test_descriptor_rejects_missing_lifecycle_methods():
    with pytest.raises(ValidationError):
        ToolCapability(
            tool=ToolId.LINUX,
            label="broken",
            state=ToolState.UNAVAILABLE,
            methods=[_unsupported_method(LifecycleStep.PREPARE)],
        )


def test_descriptor_rejects_duplicate_lifecycle_methods():
    methods = [_unsupported_method(step) for step in list(LIFECYCLE_STEPS)[:-1]]
    methods.append(_unsupported_method(LifecycleStep.PREPARE))
    with pytest.raises(ValidationError):
        ToolCapability(
            tool=ToolId.LINUX,
            label="broken",
            state=ToolState.UNAVAILABLE,
            methods=methods,
        )


def test_blocked_external_tool_requires_blockers():
    with pytest.raises(ValidationError):
        ToolCapability(
            tool=ToolId.NETWORK,
            label="broken",
            state=ToolState.BLOCKED_EXTERNAL,
            external_blockers=[],
            methods=[
                MethodCapability(step=step, support=Support.SUPPORTED, detail="x")
                for step in LIFECYCLE_STEPS
            ],
        )


@pytest.mark.asyncio
async def test_http_endpoint_publishes_the_honest_matrix():
    app = create_app(Settings(environment="test", database_url=""))
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/tool-capabilities")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["lifecycle_steps"]) == 8
    assert len(payload["tools"]) == 5
    assert payload["tool_order"] == [tool.value for tool in TOOL_ORDER]
    by_tool = {tool["tool"]: tool for tool in payload["tools"]}
    assert by_tool["network"]["state"] == "unavailable"
    assert all(
        method["support"] == "unsupported" for method in by_tool["network"]["methods"]
    )
    assert by_tool["linux"]["state"] == "unavailable"
    assert by_tool["code"]["state"] == "available"
    assert "不可用" in payload["note"]
