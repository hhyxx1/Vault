"""Read-only tool lifecycle capability endpoint (C05).

Publishes the honest, environment-verified capability matrix so the UI, health
checks, and tests observe the same contract. It never executes anything and
never advertises an unbuilt or externally blocked lab as available.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from vault_backend.tool_lifecycle import (
    LIFECYCLE_STEPS,
    LifecycleStep,
    ToolCapability,
    ToolId,
    capability_matrix,
)

router = APIRouter(prefix="/api/v1", tags=["tool-capabilities"])


class ToolCapabilitiesOut(BaseModel):
    lifecycle_steps: list[LifecycleStep]
    tool_order: list[ToolId]
    tools: list[ToolCapability]
    note: str


_NOTE = (
    "能力矩阵描述各工具对 prepare/run_or_step/inspect/check/snapshot/restore/"
    "cancel/cleanup 的真实支持情况；unsupported 表示尚未建设，blocked_external "
    "表示依赖当前环境不具备的外部条件（如 containerlab/FRR/独立 VM）。"
    "未列出为 supported 的能力一律不可用，前端不得显示为已开通。"
)


@router.get("/tool-capabilities", response_model=ToolCapabilitiesOut)
async def tool_capabilities() -> ToolCapabilitiesOut:
    matrix = capability_matrix()
    return ToolCapabilitiesOut(
        lifecycle_steps=list(LIFECYCLE_STEPS),
        tool_order=[tool.tool for tool in matrix],
        tools=matrix,
        note=_NOTE,
    )
