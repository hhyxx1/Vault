# 数据库与同步核心模式

版本：v0.1

状态：逻辑／概念模型；不锁定数据库产品，不表示 SQL 迁移已实现。产品数据边界和同步规则见 [账号与数据设计](ACCOUNT_AND_DATA_DESIGN.md)。

## 1 统一标识原则

- 每个业务对象使用稳定、不可变 ID；每条可编辑对象有单调版本和创建／更新时间。
- 数据实体归属账号或显式未绑定本地空间；服务器端 owner 是最终权限依据。
- 课程模板、课程版本、个人课程计划、任务发布实例与学生个人作品不可混为一个可变对象。
- 关系引用需指出引用版本；课程范围变化不得无依据改变旧证据适用目标。
- 尝试、帮助、运行、核验和状态变化使用追加式事件或不可变版本；纠正通过新事件表达。
- 删除传播使用有时限规则的 tombstone；删除、撤权与数据保留策略要分别记录。
- 重试安全：`(space_id, op_id)` 唯一；执行／核验 job 和事件有稳定幂等键。

## 2 实体关系总览

```mermaid
erDiagram
  ACCOUNT ||--o{ LEARNING_SPACE : owns
  ACCOUNT ||--o| STUDENT_PROFILE : has
  ACCOUNT ||--o| TEACHER_PROFILE : has
  LEARNING_SPACE ||--o{ PERSONAL_GOAL : stores
  COURSE ||--o{ COURSE_VERSION : versions
  COURSE_VERSION ||--o{ CURRICULUM_NODE : contains
  CURRICULUM_NODE ||--o{ LEARNING_OBJECTIVE : maps
  COURSE_VERSION ||--o{ OBJECTIVE_RELATION : connects
  COURSE_VERSION ||--o{ ACTIVITY_TEMPLATE : defines
  LEARNING_SPACE ||--o{ LEARNING_SESSION : continues
  LEARNING_SESSION ||--o{ ACTIVITY_INSTANCE : includes
  ACTIVITY_INSTANCE ||--o{ ARTIFACT_VERSION : creates
  ACTIVITY_INSTANCE ||--o{ ATTEMPT : records
  ATTEMPT ||--o{ HELP_EVENT : follows
  ATTEMPT ||--o{ EXECUTION_JOB : launches
  ATTEMPT ||--o{ VERIFICATION_EVENT : checks
  VERIFICATION_EVENT ||--o{ OBJECTIVE_EVIDENCE : supports
  LEARNING_OBJECTIVE ||--o{ OBJECTIVE_EVIDENCE : receives
  ACCOUNT ||--o{ TEACHER_RELATION : participates
  COURSE_VERSION ||--o{ COURSE_PUBLICATION : publishes
  TEACHER_PROFILE ||--o{ COURSE_PUBLICATION : authors
  ACTIVITY_TEMPLATE ||--o{ TASK_PUBLICATION : may_publish
  ACCOUNT ||--o{ SKILL_VERSION : contributes
  LEARNING_SPACE ||--o{ SYNC_OPERATION : queues
```

## 3 逻辑数据字典

| 表／对象族 | 主字段 | 约束与用途 |
|---|---|---|
| `account` | `account_id`, `account_type`, `status`, timestamps | 类型由认证与管理员流程授予；仅一种基础角色类型 |
| `student_profile` / `teacher_profile` | `account_id`, verified/status, profile data | 分角色资料；资料 ID 必须与 account 类型一致 |
| `learning_space` | `space_id`, `owner_account_id?`, `origin_kind`, `status`, version | 访客时无云端 owner；绑定为不可逆归属事件；支持本地 account cache 映射 |
| `course` / `course_version` | stable `course_id`, `version_id`, scope, depth, review/publish state, provenance, curriculum ref | 发布版本不可变；编辑生成新版本；审核和兼容映射可追溯 |
| `curriculum_node` | `node_id`, `course_version_id`, parent, node_type, title, ordering, scope tag | 仅组织层级；不得计作额外可检验目标；唯一父关系需无环 |
| `learning_objective` | `objective_id`, version, node links, statement, necessary criteria, evidence dimensions, scope tag | 稳定目标可跨版本映射；每个版本的准则固定；跨章节重复引用仍唯一 |
| `objective_relation` | from/to IDs, relation type, direction, source, version | `contains/prerequisite/concept/application/evidence_support` 分型；关联边不传播个人状态 |
| `reference_resource` / `resource_version` | owner/visibility, source/license/provenance, blob hash, parsed status, version | 个人资料和公开材料权限不同；解析中／失败可查询，检索按 owner 和授权过滤 |
| `activity_template` / `activity_version` | target IDs, goals, learner actions, theory refs, artifacts, tools, environment, criteria, help, recovery, next action | 活动有课程适配版本；声明标准、真实工具和不可自动核验边界 |
| `personal_goal` / `learning_session` | `space_id`, selected goal, learner confirmation, route version, current state/position | 私人计划引用课程目标；确认、修改、恢复位置有版本和来源 |
| `activity_instance` / `attempt` | session, activity version, attempt ID, actor type, parent revision, status, timestamps | 真实 student/agent/system 动作分开；操作不重复推进状态 |
| `artifact` / `artifact_version` | object ID, parent revision, content/blob ref, media type, author source, hash | 作品不可静默覆盖；敏感载荷权限、临时附件生命周期和导出清晰 |
| `help_event` | attempt, skill/role, exposure type, content revision, viewed_at, source/policy version | 记录实际提示、示范、答案查看及未显示情况；不能推测外部帮助不存在 |
| `execution_job` / `execution_result` | job ID, runtime image/version, resource policy, input/output refs, exit/error state | 输入、stdout/stderr、结果上限及租期；错误和学生表现分开 |
| `verification_standard` / `verification_event` | standard/version, artifact revision, criteria outcomes, reviewers/tool/job refs | 标准需审核发布；一次失败只影响其有效覆盖，旧结果保留 |
| `objective_evidence` / `objective_state_event` | objective/version, evidence IDs, criteria, provenance, assistance, confidence/reason, supersession | 证据可追溯、可撤销／复核；系统按版本重算状态和父节点投影 |
| `teacher_relation` / `authorization` | student, teacher, course scopes, data scopes, purpose, status, granted/revoked_at | 关系邀请和授权分开；撤销传播至读 API、索引、缓存和 Agent |
| `task_publication` / `answer_policy_version` | publisher, instance ID, task/version, rule, start/end conditions, hints, answer ref | 真实来源由服务端；复制与导入不能改策略；历史披露策略可追溯 |
| `skill` / `skill_version` / `skill_review_event` | owner, package version, applicability, steps, refs/tools, permissions, tests, review/publish state | 版本化声明式包；自助试用／审核／发布状态分开；不授予平台权限 |
| `agent_run` / `agent_handoff` | workflow/version, owner/space, role, skill versions, request, budget, state, errors, tool evidence refs | 有等待学生、工具、取消、恢复和终态；不能将消息文本当可信核验 |
| `sync_batch` / `sync_object` / `sync_operation` | batch cursor, origin ID, target ID, operation ID, payload hash, base/current version, status | 部分提交和冲突可恢复；跨账号拒绝；重复 operation 幂等 |
| `attachment` / `blob_ref` | owner/space, object/version, hash, MIME/size, storage state, expiry/deletion | 分块／补传状态明确；下载需授权；访客服务端副本按公布期限删除 |
| `audit_event` / `quota_usage` | actor/account/space, action, policy version, resource totals, sanitized reason, retention class | 审计与学习内容分存储；按目的最少采集；费用与超额边界可查 |

## 4 索引与事务约束

- 所有个人读查询以服务端解析的 `owner_account_id` 或明确空间归属为前导过滤条件，并与对象 ID 组合索引。
- 同一稳定目标在一个课程蓝图版本最多出现一次；同一 goal 在不同目录节点的额外显示通过 `curriculum_node_goal` 映射，不克隆 `objective_id`。
- `objective_state_event` 与 `objective_evidence` 可按 `(space_id, course_version_id, objective_id, event_time)` 查询；父节点摘要是从唯一目标集合计算出的投影／缓存，不作为第二份得分来源。
- 同步幂等唯一约束至少覆盖 `(space_id, op_id)` 与 `(space_id, source_object_id)`；附件完成受内容 hash 校验。
- 发布时一个事务固定课程、活动、标准和答案策略版本；运行 job 创建时绑定这些版本及作品 revision。迟到 job 只能添加到其原绑定版本。
- 答案披露校验、授权读取和证据写入须避免权限撤销与敏感数据泄漏。跨服务工作流需可靠事件／重试设计及对账任务；不得假定分布式全局事务。
- 本地存储采用相同 ID、版本、来源和操作模型的持久化序列化；具体 IndexedDB 或客户端数据库选型、清理空间和迁移须经故障恢复验收。

## 5 状态重算边界

一次有效 evidence event 只更新它明示覆盖的 objective 和必要条件。更新先验证本人／访客来源、活动／作品／课程／核验版本及帮助记录。课程变更时通过审核过的目标映射续用证据；新增、语义不等价和删除项说明后保留历史／待重验。关系图边、图谱展开状态、同步次数、Agent 自述和个人勾选均不能产生达标证据。

`pending/unknown`、`partial/helped`、`needs_improvement`、`independent_criteria_met`、`disputed`、`environment_unavailable` 等证据／诊断维度应在 API 类型定义中独立表示。用户展示的四种摘要可由这些维度计算，不能压缩存储后丢失原因。

## 6 待定实现决定

数据库厂商、部署拓扑、完整检索索引方案、加密／密钥托管、精确 TTL、备份保留周期、历史数据迁移及分片／分区参数需由 [架构决策记录](ARCHITECTURE_DECISIONS.md) 与上线测试确定。本概念模型不把单库或分库方案预定为用户产品规则。
