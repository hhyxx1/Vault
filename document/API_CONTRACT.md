# API 与异步事件契约

版本：v0.1

状态：逻辑接口草案；最终路径、认证方案、传输和序列化格式待架构决策。服务端在任何操作中解析账号及数据归属，客户端提供的 owner 不具授权效力。

## 1 通用契约

| 项 | 契约 |
|---|---|
| 请求上下文 | 会话凭据；空间／课程／活动标识；明确的对象版本；稳定 `request_id`／幂等键。来宾操作附本地空间签发的临时、限权运行声明，不向远端开放永久身份 |
| 成功 | 返回 `request_id`、对象／事件标识、有效版本和确定状态；异步操作返回 `job_id` 和查询／取消权 |
| 错误 | 稳定机器码、可读说明、是否可重试、冲突版本／解决动作；不把网络／权限／工具错误改写成内容不正确 |
| 并发 | `expected_version` 或等价前置条件；版本不同则返回冲突及可比差异，不静默覆盖 |
| 事件 | 单一任务 `job_id`；事件带单调 `sequence`、`type`、`occurred_at` 和 `attempt_id`。断线可依据游标续读，事件终态唯一 |
| 幂等 | 创建／提交、同步写入和核验应用同一稳定幂等键不得重复执行或重复推进；相同键但内容不同返回冲突 |
| 权限 | 请求解析后的账号类型、对象空间、共享授权、发布实例、答案规则、配额每次重新验证；撤销或换号后旧 token／工作流不保留旧访问 |
| 内容版本 | 课程、目标、活动、测试、Skill、答案策略均携带不可变 `*_version_id`；引用版本与提交结果一并返回 |

统一错误类型：`UNAUTHENTICATED`、`FORBIDDEN`、`NOT_FOUND_OR_NOT_VISIBLE`、`VERSION_CONFLICT`、`VALIDATION_FAILED`、`QUOTA_EXCEEDED`、`ENVIRONMENT_UNAVAILABLE`、`EXECUTION_FAILED`、`VERIFICATION_PENDING`、`SYNC_PARTIAL`、`RATE_LIMITED`、`INTERNAL_ERROR`。对访客不得返回泄露其他账号对象是否存在的差异细节。

## 2 逻辑操作目录

实际资源路径由实现决定，以下标识供 FR／测试映射，命令为语义操作名。

| API ID | 语义操作 | 主要输入与返回 |
|---|---|---|
| API-01 | 认证上下文 | 认证／刷新／退出；返回账号类型、命名空间标识及认证状态，不接受客户端角色赋值 |
| API-02 | 课程目录／蓝图 | 课程、课程／蓝图版本；返回范围、节点、关系和发布审校状态。未发布版本不可进入正常支持目录 |
| API-03 | 创建／确认／修订目标 | 空间、本地 ID、目标草案／期望版本；返回学生确认状态、映射目标和当前路线版本 |
| API-04 | 创建／恢复活动 | 目标、活动与课程版本、作品引用；返回活动状态、待学生动作、作品／恢复版本 |
| API-05 | 请求教学协作 | 活动、学生请求、允许上下文、所需动作；返回 `run_id` 和步骤／学生待办事件。输出为建议 |
| API-06 | 保存产物版本 | 活动／任务、父版本、内容引用、操作者／本地来源；返回持久化版本或冲突 |
| API-07 | 创建／取消执行任务 | 运行时 ID、源码或配置版本、允许输入、额度；返回 job 及真实 stdout／stderr 引用、退出／资源状态 |
| API-08 | 提交核验 | 作品／推演版本、目标、活动／标准／课程版本、已有工具事实；返回各条件结果、适用证据目标、待复核原因 |
| API-09 | 课程图谱与状态摘要 | 账号／访客空间和蓝图版本、统计范围；返回去重目标、父节点聚合、来源和状态投影 |
| API-10 | 关联本地空间／同步批次 | 认证账号、显式当前未绑定空间、对象／附件批次、游标；返回部分成功、版本冲突、待上传项和删除确认 |
| API-11 | 资料与 Skill 生命周期 | 上传／创建／试用／版本／校核／分享动作、范围和权限；禁止包内容改变平台角色或工具许可 |
| API-12 | 教师关联、授权及发布 | 关系、范围／目的、任务实例、答案策略和版本；返回被授权视图与当前发布规则 |
| API-13 | 导出／删除／保留请求 | 当前空间所有权确认、对象集和策略版本；逐对象返回排队、完成或失败；审计规则单列 |

## 3 工作流事件类型

允许类型需版本化：`run.accepted`、`step.started`、`assistant.delta`、`student.input_required`、`student.input_received`、`tool.requested`、`tool.progress`、`tool.completed`、`evidence.pending`、`evidence.recorded`、`sync.progress`、`run.paused`、`run.resumed`、`run.cancelled`、`run.failed`、`run.completed`。重连事件按 `run_id` 和最后已确认序号继续；重复事件以稳定事件 ID 去重。

结束 `run.completed` 仅表示协作任务结束，不代表活动完成或目标达标。工具结果未收到时不得先发成功事件。取消无法收回已完成外部执行，但后续迟到结果绑定原 job、空间和作品版本，不写入当前其他账号／当前作品。

## 4 同步操作契约

每条同步操作由 `(space_id, object_id, op_id, parent_version, payload_hash)` 唯一标记。接收端由认证上下文确定账号；客户端 owner 只作一致性核验。上传／删除／关系引用先验证所属空间和课程版本，逐条返回对象状态。附件以不可猜测临时上传权上传，完成后提交 hash、长度和关联对象校验。批次可部分成功，重试未完成操作幂等；删除标记和撤权优先于旧设备回传。

访客在线运行通过独立短时令牌限定可执行模板、资源额度、租期和清理规则。取消、过期和提供方失败分别返回原因；默认不授予读取访客云端学习档案的能力。具体时限列为上线前运营决策。

## 5 核验请求与返回样例

```json
{
  "request_id": "stable-client-operation-id",
  "space_id": "owned-or-local-space",
  "course_version_id": "course-version",
  "activity_version_id": "activity-version",
  "objective_id": "CS03-STACK-02",
  "artifact_version_id": "artifact-revision",
  "standard_version_id": "criterion-version",
  "source_attempt_id": "attempt-id",
  "client_claim": "submitted-work"
}
```

服务器解析真实 owner 与角色；`client_claim` 只是用户提交内容，不能指定状态。返回各条必要条件的 `met`／`not_met`／`not_evaluated` 及工具状态、标准与实际作品引用、适用目标 IDs 和原因。业务服务仅追加核验事件；课程状态投影按版本规则计算。样例标识演示契约，不是可用线上 API。

## 6 关联与验收

具体字段与关系见 [数据库模式](DATABASE_SCHEMA.md)，流程见 [用户流程](USER_FLOWS.md)。每个操作需关联认证、权限、幂等、版本冲突、迟到结果、异常及资料留存案例。实际 OpenAPI／JSON Schema 文件在一类接口实现稳定并经评审后生成、版本化。
