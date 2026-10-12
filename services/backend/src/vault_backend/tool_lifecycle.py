"""Unified tool lifecycle capability matrix (C05).

Every execution tool (code, SQL, Linux experiments, network labs, data/ML) must
describe the same eight lifecycle methods from ACTIVITY_ENGINE_PLAN.md:
``prepare / run_or_step / inspect / check / snapshot / restore / cancel /
cleanup``. A method that does not exist yet is declared explicitly as
``unsupported``; one that is meaningless for that tool shape is
``not_applicable``; one blocked by an environment the platform cannot provision
itself (VM images, containerlab/FRR) is ``blocked_external``.

Nothing here grants execution power: it is a read-only, testable contract of
what the platform actually provides today, so the UI and health endpoints never
advertise a lab that is not really there.
"""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ToolId(StrEnum):
    CODE = "code"
    SQL = "sql"
    LINUX = "linux"
    NETWORK = "network"
    DATA = "data"


class LifecycleStep(StrEnum):
    PREPARE = "prepare"
    RUN_OR_STEP = "run_or_step"
    INSPECT = "inspect"
    CHECK = "check"
    SNAPSHOT = "snapshot"
    RESTORE = "restore"
    CANCEL = "cancel"
    CLEANUP = "cleanup"


# The contract order is fixed and shared by every tool descriptor.
LIFECYCLE_STEPS: tuple[LifecycleStep, ...] = (
    LifecycleStep.PREPARE,
    LifecycleStep.RUN_OR_STEP,
    LifecycleStep.INSPECT,
    LifecycleStep.CHECK,
    LifecycleStep.SNAPSHOT,
    LifecycleStep.RESTORE,
    LifecycleStep.CANCEL,
    LifecycleStep.CLEANUP,
)


class Support(StrEnum):
    # Implemented and exercised by the isolated worker / verification layer.
    SUPPORTED = "supported"
    # The tool shape exists but this lifecycle method is not built yet.
    UNSUPPORTED = "unsupported"
    # This method has no meaning for a one-shot / stateless tool shape.
    NOT_APPLICABLE = "not_applicable"
    # Requires external provisioning this environment does not have (VM, images).
    BLOCKED_EXTERNAL = "blocked_external"


class ToolState(StrEnum):
    AVAILABLE = "available"        # adapter exists and runs
    PARTIAL = "partial"            # one-shot path works; stateful lease missing
    UNAVAILABLE = "unavailable"    # adapter not built
    BLOCKED_EXTERNAL = "blocked_external"


class MethodCapability(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    step: LifecycleStep
    support: Support
    detail: str = Field(min_length=1, max_length=400)


class ToolCapability(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    tool: ToolId
    label: str = Field(min_length=1, max_length=120)
    state: ToolState
    runtime_profile: str | None = None
    external_blockers: list[str] = Field(default_factory=list, max_length=10)
    methods: list[MethodCapability]

    @model_validator(mode="after")
    def _exactly_covers_lifecycle(self) -> "ToolCapability":
        steps = [method.step for method in self.methods]
        if sorted(steps) != sorted(LIFECYCLE_STEPS) or len(set(steps)) != len(LIFECYCLE_STEPS):
            raise ValueError(
                f"tool {self.tool} must declare each lifecycle method exactly once "
                f"(prepare/run_or_step/inspect/check/snapshot/restore/cancel/cleanup)"
            )
        if self.state is ToolState.BLOCKED_EXTERNAL and not self.external_blockers:
            raise ValueError(f"tool {self.tool} blocked_external must list blockers")
        for method in self.methods:
            if method.support is Support.BLOCKED_EXTERNAL and not self.external_blockers:
                raise ValueError(
                    f"tool {self.tool}.{method.step} blocked_external requires tool blockers"
                )
        return self


def _m(**kwargs: object) -> MethodCapability:
    return MethodCapability(**kwargs)  # type: ignore[arg-type]


# Honest, environment-verified matrix. WSL probe on 2026-10-12: isolate, PG18,
# cpython/node/python-3.13(+ml) toolchains installed and worker active;
# containerlab and FRR (vtysh) absent; no per-lease network VM boundary exists.
TOOL_CAPABILITIES: dict[ToolId, ToolCapability] = {
    ToolId.CODE: ToolCapability(
        tool=ToolId.CODE,
        label="E01 多语言代码（C17/C++17/Java21/Python3.13/Node24）",
        state=ToolState.AVAILABLE,
        runtime_profile="<language>-isolate-dev@0.1.0",
        methods=[
            _m(step=LifecycleStep.PREPARE, support=Support.SUPPORTED,
               detail="每次运行在独立 Linux isolate box 内初始化并挂载源文件，无跨租约持久环境。"),
            _m(step=LifecycleStep.RUN_OR_STEP, support=Support.SUPPORTED,
               detail="支持整程序编译与一次性运行；非步进式环境，不支持交互式单步。"),
            _m(step=LifecycleStep.INSPECT, support=Support.NOT_APPLICABLE,
               detail="一次性批处理，无运行中交互检视；事实仅来自 stdout/stderr/metadata。"),
            _m(step=LifecycleStep.CHECK, support=Support.SUPPORTED,
               detail="规则/语义核验由受信核验层基于本次结果与服务端侧车/语义套件完成；工具只产出事实，不判掌握。"),
            _m(step=LifecycleStep.SNAPSHOT, support=Support.NOT_APPLICABLE,
               detail="无持久租约与可变环境状态，无可快照对象。"),
            _m(step=LifecycleStep.RESTORE, support=Support.NOT_APPLICABLE,
               detail="无状态可恢复；需要新结果即发起一次新运行，不把旧日志展示为新运行。"),
            _m(step=LifecycleStep.CANCEL, support=Support.SUPPORTED,
               detail="worker 接收取消后终止任务进程组并触发回收，断连同样走取消路径。"),
            _m(step=LifecycleStep.CLEANUP, support=Support.SUPPORTED,
               detail="isolate 清理进程与 box 文件；清理失败会隔离 worker，绝不复用脏环境。"),
        ],
    ),
    ToolId.SQL: ToolCapability(
        tool=ToolId.SQL,
        label="E03 PostgreSQL 18 SQL 实验",
        state=ToolState.PARTIAL,
        runtime_profile="postgres18-isolate-dev@0.1.0",
        methods=[
            _m(step=LifecycleStep.PREPARE, support=Support.SUPPORTED,
               detail="当前经 isolate 内 PG18 工具链为每个脚本初始化一次性实例。"),
            _m(step=LifecycleStep.RUN_OR_STEP, support=Support.SUPPORTED,
               detail="支持单脚本一次性执行；每租约独立角色/数据与双连接屏障调度事务尚未实现（unsupported）。"),
            _m(step=LifecycleStep.INSPECT, support=Support.UNSUPPORTED,
               detail="独立实验实例的跨调用检视（表/会话/锁状态）尚未实现。"),
            _m(step=LifecycleStep.CHECK, support=Support.SUPPORTED,
               detail=("一次性结果可按集合/多重集/有序规则比较；"
                       "事务正确性核验随有状态租约建设，禁止以 sleep 作为正确性依据。")),
            _m(step=LifecycleStep.SNAPSHOT, support=Support.UNSUPPORTED,
               detail="每租约独立角色与数据的快照尚未实现。"),
            _m(step=LifecycleStep.RESTORE, support=Support.UNSUPPORTED,
               detail="租约数据恢复/回滚到检查点尚未实现。"),
            _m(step=LifecycleStep.CANCEL, support=Support.SUPPORTED,
               detail="一次性执行复用 isolate 的任务取消与进程回收。"),
            _m(step=LifecycleStep.CLEANUP, support=Support.SUPPORTED,
               detail="一次性实例随 isolate 清理；独立租约的数据/角色清理随租约建设。"),
        ],
    ),
    ToolId.LINUX: ToolCapability(
        tool=ToolId.LINUX,
        label="E04 Linux 受控子进程/管道/信号/文件权限实验",
        state=ToolState.UNAVAILABLE,
        methods=[
            _m(step=LifecycleStep.PREPARE, support=Support.UNSUPPORTED,
               detail=("受控 shell/系统调用实验适配器尚未建设；"
                       "现有代码运行仅整程序批处理，不得冒充 Linux 实验。")),
            _m(step=LifecycleStep.RUN_OR_STEP, support=Support.UNSUPPORTED,
               detail="真实受控子进程、管道、信号、同步、文件权限与重建的交互运行尚未实现。"),
            _m(step=LifecycleStep.INSPECT, support=Support.UNSUPPORTED,
               detail="进程表/文件状态/权限的受控检视尚未实现。"),
            _m(step=LifecycleStep.CHECK, support=Support.UNSUPPORTED,
               detail="基于真实退出码、进程与文件状态的核验尚未实现；禁止用预置字符串替代真实系统调用。"),
            _m(step=LifecycleStep.SNAPSHOT, support=Support.UNSUPPORTED,
               detail="实验环境快照尚未实现。"),
            _m(step=LifecycleStep.RESTORE, support=Support.UNSUPPORTED,
               detail="实验环境重建/恢复尚未实现。"),
            _m(step=LifecycleStep.CANCEL, support=Support.UNSUPPORTED,
               detail="实验进程树的受控取消随适配器建设。"),
            _m(step=LifecycleStep.CLEANUP, support=Support.UNSUPPORTED,
               detail="实验进程与文件回收随适配器建设。"),
        ],
    ),
    ToolId.NETWORK: ToolCapability(
        tool=ToolId.NETWORK,
        label="E05 containerlab/Linux/FRR 网络实验（A—R—B 回程路由）",
        state=ToolState.BLOCKED_EXTERNAL,
        external_blockers=[
            "WSL 实测未安装 containerlab",
            "WSL 实测未安装 FRR（无 vtysh）",
            "每租约独立 VM 边界与外联关闭尚未建设",
        ],
        methods=[
            _m(step=LifecycleStep.PREPARE, support=Support.BLOCKED_EXTERNAL,
               detail="按 ADR 的每租约独立 VM 内起 containerlab 拓扑依赖外部环境，当前不可得。"),
            _m(step=LifecycleStep.RUN_OR_STEP, support=Support.BLOCKED_EXTERNAL,
               detail=("浏览器终端配置 A—R—B 与 FRR 回程路由需 containerlab/FRR，未安装；"
                       "不依赖 eNSP/Cisco，不宣称厂商 CLI 等价。")),
            _m(step=LifecycleStep.INSPECT, support=Support.BLOCKED_EXTERNAL,
               detail="拓扑/接口/路由状态检视随网络租约建设。"),
            _m(step=LifecycleStep.CHECK, support=Support.BLOCKED_EXTERNAL,
               detail="限定链路抓包与正反向探针、报文证据随网络租约建设；不按命令字符串判定。"),
            _m(step=LifecycleStep.SNAPSHOT, support=Support.BLOCKED_EXTERNAL,
               detail="配置快照随网络租约建设。"),
            _m(step=LifecycleStep.RESTORE, support=Support.BLOCKED_EXTERNAL,
               detail="拓扑重建后重新验证的恢复能力随网络租约建设。"),
            _m(step=LifecycleStep.CANCEL, support=Support.BLOCKED_EXTERNAL,
               detail="租约取消随网络租约建设。"),
            _m(step=LifecycleStep.CLEANUP, support=Support.BLOCKED_EXTERNAL,
               detail="VM/容器与链路回收随网络租约建设；网络外联默认关闭。"),
        ],
    ),
    ToolId.DATA: ToolCapability(
        tool=ToolId.DATA,
        label="E06 数据/机器学习实验（python313ml 固定依赖）",
        state=ToolState.PARTIAL,
        runtime_profile="python313ml-isolate-dev@0.1.0",
        external_blockers=[
            ("WSL 存在 python-3.13-ml.incomplete-20261010 目录，"
             "ML profile 完整性需按 lock 复核后再发布"),
        ],
        methods=[
            _m(step=LifecycleStep.PREPARE, support=Support.SUPPORTED,
               detail=("经 isolate 的 python-3.13-ml 固定依赖 profile 运行；"
                       "发布前须按 ml-requirements.lock 复核（曾见 incomplete 标记）。")),
            _m(step=LifecycleStep.RUN_OR_STEP, support=Support.SUPPORTED,
               detail="支持 CPU 小数据一次性脚本，训练先限 60 秒；无需 GPU，不先建设 GPU。"),
            _m(step=LifecycleStep.INSPECT, support=Support.NOT_APPLICABLE,
               detail="一次性批处理，无运行中交互检视。"),
            _m(step=LifecycleStep.CHECK, support=Support.UNSUPPORTED,
               detail="数据版本、划分、seed、预处理拟合范围、模型与指标的结构化记录/核验尚未实现。"),
            _m(step=LifecycleStep.SNAPSHOT, support=Support.UNSUPPORTED,
               detail="数据集与模型状态快照尚未实现。"),
            _m(step=LifecycleStep.RESTORE, support=Support.UNSUPPORTED,
               detail="按数据版本/seed 的复现恢复尚未实现。"),
            _m(step=LifecycleStep.CANCEL, support=Support.SUPPORTED,
               detail="一次性训练/运行复用 isolate 的任务取消与进程回收。"),
            _m(step=LifecycleStep.CLEANUP, support=Support.SUPPORTED,
               detail="isolate 清理进程与临时文件。"),
        ],
    ),
}


# Fixed display / reporting order.
TOOL_ORDER: tuple[ToolId, ...] = (
    ToolId.CODE,
    ToolId.SQL,
    ToolId.LINUX,
    ToolId.NETWORK,
    ToolId.DATA,
)


def capability_matrix() -> list[ToolCapability]:
    """Return the full matrix in the canonical tool order."""
    return [TOOL_CAPABILITIES[tool] for tool in TOOL_ORDER]


def methods_for(tool: ToolId) -> dict[LifecycleStep, MethodCapability]:
    return {method.step: method for method in TOOL_CAPABILITIES[tool].methods}
