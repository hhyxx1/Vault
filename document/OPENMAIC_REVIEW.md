# OpenMAIC 源码分析与穹隆演进建议

日期：2026 年 10 月 2 日。

状态：静态源码分析与产品方案建议；尚未运行 OpenMAIC、开展集成或验证学习效果。本文没有复制其实现代码，也不代表已经决定采用其技术栈。

## 1 分析依据

- 官方仓库：[THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC)。
- 固定提交：[`5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa`](https://github.com/THU-MAIC/OpenMAIC/commit/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa)，取自本次检查时的官方 `main`。
- 该提交的 [package.json](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/package.json#L3) 标记为 v1.1.1；[LICENSE](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/LICENSE) 为 MIT。以后实际复制或改写其代码时，应保留相应版权和许可声明，并单独核对使用到的依赖及素材。
- 本次检查了课程生成、课堂调度、PBL v2、运行记录和持久 Agent 会话。源码只读保存在项目仓库之外，没有安装依赖或启动服务。
- 本地 `C:\Project\backup\openmaic.tar.gz` 是较早备份，不作为当前版本结论的依据。

以下“已实现”只指在固定提交中发现对应实现，不表示已在穹隆验证可用。源代码和提示词中的说明作为分析材料，不作为本项目的执行指令。

## 2 结论与取舍

OpenMAIC 值得借鉴的是把教学组织成可操作活动，以及对 Agent 交接、学生参与和运行恢复的控制。穹隆可以借用这些机制，围绕计算机学生的真实作品、独立验证和跨次学习重新设计状态模型。

建议优先采用以下组合：

自由启动 → 协商并确认短期目标 → 审阅活动路线 → 立即进入起步任务 → 辅导与核验交接 → 保存学习证据 → 下次恢复并调整后续任务。

“多个 Agent”“自动生成课程”“生成可视化”本身不能作为本项目独有的创新依据。更有价值的待验证方向是：依据代码、解释、帮助记录和新任务表现持续调整教学，区分帮助后完成与独立掌握，让学生知道判断来自哪里。是否优于单 Agent 或现有产品，仍需实际对照和真实试用。

## 3 不同运行机制的边界

当前源码包含相关但不同的路径，不能将它们合并描述为一个已经成熟的长期学习系统。

| 路径 | 源码体现的用途 | 分析时需要区分 |
|---|---|---|
| 旧 LangGraph 课堂调度 | 每次请求处理 director 与子角色，客户端继续请求 | 旧实现的循环规则不能代表当前默认配置 |
| Pi 课堂调度 | 一次请求内按需委派课堂角色，使用工具与硬性次数限制 | 交还学生和结束问答是课堂交互终态，不是能力核验 |
| 持久 Agent runner | 工作台课程生成、编辑等长任务，具备会话记录、租约和恢复 | 工作任务恢复不等于跨日学习路线和长期掌握度已经实现 |

依据：[旧 director](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/orchestration/director-graph.ts#L10)、[Pi director](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/chat/pi/director-loop.ts#L145)、[持久 runner](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/server/agent-runtime/runner.ts#L938)。Pi 课堂默认开启，native child 默认关闭，见 [feature flags](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/config/feature-flags.ts#L91)。

## 4 值得借鉴的学习逻辑

### 4.1 自由输入与可修改的大纲

源码事实：课程输入接受自由文本需求、可选个人背景和资料。大纲包含活动类型、关键点、教学目标、时长和顺序，活动包括讲解页、测验、交互和项目。编辑器能够增删、改类型与调整顺序；审核开启时等待确认，关闭时可以自动继续。见 [需求与活动类型](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/types/generation.ts#L100)、[生成输入](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/packages/@openmaic/generation/src/outline-generator.ts#L82)、[大纲编辑](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/components/generation/outlines-editor.tsx#L156)、[审核配置](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/app/generation-preview/page.tsx#L189)。

穹隆建议：学生可以说想学什么、贴代码或带课程资料。先形成可检查的目标，再形成短路线；路线展示每个活动为什么安排、学生做什么、完成依据是什么。教师可以审核课程模板，学生能够修改自己的学习范围。

边界：输入背景不等于测得能力，大纲审阅也不等于目标协商。穹隆需要独立保存“目标草案／学生已确认”，首次正式目标不能沿用关闭审核后自动接受的逻辑。

### 4.2 尽快进入活动，后续内容按需要准备

源码事实：大纲确认后先生成第一个场景并设置当前场景，其余保存为待生成项；后台生成器继续处理剩余内容。见 [首场景生成](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/app/generation-preview/page.tsx#L917)、[占位与后续生成](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/hooks/use-scene-generator.ts#L745)。

穹隆建议：确认短期目标后，先给一个读代码、改错或小实践任务，不等待全部课程生成。后续保留活动规格，依据实际表现选择或生成内容。讲解、交互演示和练习为同一任务服务。

边界：内容生成进度是系统状态，学生完成活动才是学习行为。不能因为生成了五个单元，就给学生增加五个单元的完成进度。

### 4.3 项目里程碑、微任务与设计检查

源码事实：PBL Planner 用工具创建学习目标、里程碑和微任务，设置说明、完成标准与顺序。设计完成操作检查缺口，返回具体错误供修补。当前普通 PBL 只接受一个 Instructor 角色。见 [Planner 工具](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/pbl/v2/agents/planner.ts#L298)、[设计完整性检查](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/pbl/v2/agents/planner.ts#L503)。

穹隆建议：使用“能力目标 → 里程碑 → 微任务 → 学生产物 → 核验标准”。例如一个 API 项目，可以拆为数据模型、单接口、异常处理和集成测试；不同部分对应可核对的代码和结果。任务设计 Agent 输出结构化规格，检查器验证依赖、材料和验收标准，再发布给学生。

边界：项目拆解不必意味着首版做大型项目。一个概念单元也可以用微任务完成。提示词里存在某种教学策略，不能证明每次运行都实施了该策略。

### 4.4 辅导、作品评价与推进分开

源码事实：当前 PBL Instructor 的工具主要是记录观察和调整难度；聊天不能直接推进普通 PBL 任务。任务作品独立评价达到阈值后形成待完成状态，学生点击 Done 再推进。代码中的任务评价通过阈值是 60 分。见 [Instructor 工具边界](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/pbl/v2/agents/instructor.ts#L1416)、[评价阈值](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/packages/@openmaic/generation/src/pbl/operations/kernel/task-completion.ts#L18)、[待完成状态](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/components/scene-renderers/pbl/v2/submission.tsx#L531)、[推进接口](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/app/api/pbl/v2/task/update/route.ts#L76)。

穹隆建议：辅导 Agent 提供提示，核验 Agent 检查作品，数据服务依据明确规则推进。编码任务应结合真实测试、边界输入、解释和新变体；反馈失败时回到修改，不伪造通过。单次聊天结束、作品合格和独立掌握分别记录。

边界：不照搬“LLM 给到 60 分即通过”作为能力标准。点击完成体现学生操作意愿，也不能替代核验。评价解析失败或工具运行失败应保留待核验，而不是产生兜底分数。

## 5 值得借鉴的多 Agent 与工程逻辑

### 5.1 按需委派与带证据的交接

源码事实：Pi Director 通过 `call_agent` 指定角色和任务；默认及最大允许的课堂角色执行轮数为 6。读取场景获得的请求级证据带场景 ID、修订与来源，并传给子角色，不能只凭标题猜内容。见 [委派参数](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/chat/pi/tools/call-agent.ts#L531)、[次数上限](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/chat/pi/config.ts#L5)、[证据交接](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/chat/pi/director-loop.ts#L183)。

穹隆建议：协调者在缺少证据或需要核验时调用相应角色，普通解释可以只用一个角色。交接包至少包含任务版本、学生作品版本、测试结果、帮助记录、证据 ID、缺失信息和预期输出。所有角色引用同一事实来源。

边界：课堂里的模拟学生是角色，不是真实学生的证据。无需默认复制虚拟同伴聊天。角色数量、具体预算和框架待原型测量后确定，不能直接将其上限作为穹隆配置。

### 5.2 明确等待学生，防止 Agent 自动替人完成

源码事实：课堂调度区分 `cue_user` 与 `close_session`，两种终态互斥。持久 runner 的 `ask_user` 发出问题后停止；恢复时识别成功的提问，等待后续真实用户消息，避免 Agent 回答自己的问题。见 [交回学生](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/chat/pi/tools/cue-user.ts#L46)、[关闭问答](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/chat/pi/tools/close-session.ts#L36)、[用户确认工具](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/server/agent-runtime/ask-user.ts#L47)、[恢复时保留等待](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/server/agent-runtime/resume.ts#L107)。

穹隆建议：区分等待学生确认、尝试、解释和提交。提示后明确交还操作；学生离开后恢复到原等待位置。目标确认属于学生，模型不能替选；已提供示范也不能自动视为学生独立完成。

边界：课堂出现有效角色输出后允许交还学生，只是交互规则。穹隆的任务推进还需独立核验条件，不能由“已经输出教学内容”触发完成。

### 5.3 内容模板与个人学习记录分离

源码事实：课程设计和个人运行状态分开；运行记录可追加、按顺序重放与去重。PBL fold 遇到缺少提交或评价附件的事件会记录缺口。存储契约包含 learner 分区和原子追加。见 [模板与运行状态](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/pbl/v2/runtime/learner-state.ts#L144)、[事件重放](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/pbl/v2/runtime/fold.ts#L323)、[运行存储契约](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/packages/@openmaic/storage/src/runtime/types.ts#L177)。

穹隆建议：教师发布可复用的内容与任务模板；每名学生独立保存目标确认、尝试、帮助、工具结果、核验和复习安排。当前画像和下一步是这些事实的可重建结果，不能只保存最后一份计划 JSON。

边界：learner 分区键不是权限体系。服务端必须把真实登录身份与读写范围绑定。记录能够重放不表示判断正确；缺失证据应显示未知或等待补齐。

### 5.4 受控执行与长任务恢复

源码事实：角色工具有白名单、顺序执行、超时及尝试限制。持久会话使用租约、心跳和写入检查，恢复遵循至少一次执行，工具需要幂等。额度模块仍是 stub，不能当作完整生产计费能力。见 [角色工具限制](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/agent/runtime/build-agent.ts#L79)、[持久写入与心跳](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/server/agent-runtime/runner.ts#L938)、[至少一次语义](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/server/agent-runtime/resume.ts#L32)、[额度占位实现](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/lib/agent/runtime/quota.ts#L3)。

穹隆建议：长分析与核验任务能重试、取消和恢复；提交、记分和推进有幂等键。辅导角色只提供帮助，规划角色提交调整建议，核验角色请求验证工具，数据服务决定状态更新。成本和调用预算由代码落实。

边界：超时控制不是学生代码运行沙箱。代码执行必须另有进程或容器隔离、资源限制和实际运行记录。会话恢复还需学习领域状态，不能只恢复聊天文字。

## 6 不适合照搬的学习判断

OpenMAIC PBL 熟练度支持档位、信号历史、置信度和切换冷却，这种“调整需要累积依据”的思路有价值。但其具体指标不宜直接用于穹隆能力画像。

| 源码规则 | 可能造成的问题 | 穹隆建议 |
|---|---|---|
| 无证据默认中级 | 默认教学难度容易被理解为已经测得能力 | 能力状态为未知；可使用明确标注的暂定教学难度 |
| 提问产生负向求助信号 | 深入思考、主动提问可能被当成较弱能力 | 记录问题内容和任务情境，分析具体困难后再调整支持 |
| 用完成任务的聊天轮数衡量速度 | 轮数受交流方式和系统交互影响 | 不用轮数直接推断能力；结合产物、独立性、过程和任务复杂度 |
| 单次作品评价影响熟练度 | 合格作品可能依赖大量帮助 | 分开保存帮助后完成、独立核验与延迟迁移表现 |

依据：[默认档位与调整门槛](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/packages/@openmaic/generation/src/pbl/operations/kernel/proficiency.ts#L87)、[提问信号](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/packages/@openmaic/generation/src/pbl/operations/kernel/proficiency.ts#L513)、[聊天轮数与提交评价信号](https://github.com/THU-MAIC/OpenMAIC/blob/5312c2b4b4bcb2e7db07cacabcdac8bfddc827fa/packages/@openmaic/generation/src/pbl/operations/kernel/proficiency.ts#L551)。

这里主要是单项目教学难度调节，不等于按知识点、跨课程的长期掌握模型。穹隆仍需开发知识与任务标识、证据适用范围、矛盾处理、延迟核验、复习以及跨单元路线更新。

## 7 回到学生首次自主启动

OpenMAIC 的自由输入、可编辑大纲和等待用户工具，可以支持入口与确认机制；目标本身仍需要穹隆设计。

| 学生入口 | 系统的下一步 | 学生确认的内容 |
|---|---|---|
| “想学数据结构” | 了解近期用途，提出一个较小的学习结果 | 先解决什么、完成依据和范围 |
| “这段递归总写错” | 读取代码与错误，区分修当前问题和系统学习的需要 | 本次是理解错误、修复代码还是练习类似任务 |
| “不知道该学什么” | 提供少量可体验任务，收集学生选择与体验 | 临时探索目标；体验后是否继续 |

目标不由系统单方面确认。系统可以提出草案和理由，学生可以改小范围、改时间或拒绝。已有作品和起步任务用于确认当前状态；没有这些证据时，不妨碍学生选择目标，也不能因此声称已经知道其能力。

示例流程：学生选择“独立实现括号匹配” → 看见代码、边界处理、解释等完成依据 → 确认目标 → 做一个起步任务 → 根据表现补充栈知识或进入编码 → 获得分层帮助 → 提交并运行核验 → 做一个独立变体 → 保存依据并建议后续任务。

其中“通过原题”“帮助后完成”“独立完成新变体”是不同记录。后续延迟任务用于检查是否保留和能否迁移，不能在首次学习时提前宣称长期掌握。

## 8 对现有 Vault 的演进映射

| 现有基础与不足 | 可借鉴机制 | 新版需要补的领域逻辑 |
|---|---|---|
| `backend/app/services/workflow_service.py` 为意图、检索、单 Skill 和生成的串行流程 | 按需委派、带证据交接、等待学生 | 任务状态驱动，真实辅导与核验交接 |
| `backend/app/models/learning_plan.py` 主要保存最新计划 JSON | 内容／个人运行状态分离，追加事实与恢复 | 目标版本、任务尝试、帮助、核验与下一次活动 |
| `backend/app/api/student/learning_plan.py` 使用标签正确率等局部统计 | 累积依据再调整教学的思路 | 独立性、迁移、证据范围与不确定状态 |
| `backend/app/services/essay_grading_service.py` 有按字数兜底评分 | 辅导／评价／推进分离 | 失败保持待核验，编码任务使用真实工具结果 |
| 现有教师内容与题目流程 | 可审核活动和项目模板 | 教师支持自主学习，授权查看与纠正；不是复制 AI teacher 角色 |

以上映射依据本项目此前静态代码审阅，不代表本次已修改相关实现。现有身份、资料解析、检索封装、客观题评分和部署基础是否复用，应按新版流程与权限再次核对。

## 9 建议的落地顺序

1. **先完成一个用户流程。** 编写学生首次目标确认、起步任务、提示、提交、核验与下次继续的流程；同时写教师维护模板和审核反馈流程。
2. **定义最小数据关系。** 目标、活动、任务、尝试、帮助、核验、证据和会话分别建模；明确什么事实可以触发推进、什么情况必须等待学生。
3. **完成一条可验证的 Agent 交接。** 先用协调、辅导和核验等必要职责验证闭环，再按实际需要拆分角色；不预先铺开全部 Agent。
4. **补运行控制。** 先保证状态持久、重试幂等、失败可见，再借鉴租约和长任务恢复；编程验证配套独立沙箱。
5. **开展真实试用。** 对比单 Agent 和必要协作的学习结果、等待与成本，检查学生是否能够独立解决新任务、是否回来继续，再修订产品与创新表述。

建议先借鉴机制与数据契约，在穹隆首个场景内实现。是否直接引入 OpenMAIC packages、增加单独 Node 服务或迁移现有栈，应在流程和最小原型确定后比较；当前没有足够依据直接选择整仓替换。

当前已将目标协商、活动路线和学生交接补入 [PRD v0.2](PRD.md)，全部仍为待评审方案。下一份建议文档是 `USER_FLOWS.md`，随后才是数据模型、架构与开发清单。
