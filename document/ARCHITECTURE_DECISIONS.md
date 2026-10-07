# 架构决策记录

日期：2026 年 10 月 3 日

记录状态、理由、备选、后果和复审条件。项目发起人授权“你来帮我确定”，本轮接受开发设计；接受不代表全部集成／发布测试通过。原 ADR-0001 提议保留在 Git 历史，依官方研究、小型原型和明确授权转为接受，未完成验证继续作为实施门。总表见 [技术基线](TECHNOLOGY_BASELINE.md)。

## ADR 状态

- **提议**：候选项；不能作为实施事实。
- **接受**：已授权纳入当前架构基线。
- **替代**：被新 ADR 取代，旧版本仍保留。
- **拒绝**：记录原因，后续重开须提供新依据。

## ADR-0001：多 Agent 工作流编排器

- 状态：接受，自托管 Python LangGraph。
- 来源：FR11／FR19／FR37–FR39，四项学习职责＋按需课程／Skill 设计。
- 理由：显式条件交接、学生中断等待、检查点恢复适合反复操作；框架与业务数据分离，供应商独立适配。官方 MIT 许可已核对。
- 备选：手写可恢复状态机，会额外承担中断／检查点维护；初期不依赖托管编排。
- 验证：Python3.12／LangGraph1.2.12 小原型通过中断、跨进程SQLite恢复、两线程隔离及夹具拒绝；[记录](TECHNICAL_VALIDATION.md)。生产Python3.13／PG、并发取消、工具回收、ACL、版本与budget未测，必须完成。
- 后果：账号checkpoint独立存PG，访客短期流程不进永久checkpoint；恢复重验身份／版本／授权。节点可能重执行，外部动作用业务幂等键；checkpoint不是证据或许可。
- 复审：Linux依赖、迁移或恢复不可维护时调整；多Agent需对照验证实际价值。

## ADR-0002：前端和业务工程形态

- 状态：接受，React SPA＋FastAPI 模块化单体。
- 理由：工作台、本地保存、图谱为核心；同源API简化会话，API／worker同库减少初期跨服务事务。
- 备选：SSR全栈、业务微服务；当前没有先引入的SEO／组织边界收益，未来公开入口和扩容另评审。
- 后果：Node24／npm、Python3.13／uv；Dexie持久化／Query缓存／Zustand UI分工；Cytoscape、CodeMirror、Tiptap不裁决证据。原创视觉和八维复核保持正式要求。
- 复审：依赖组合、移动编辑、图谱性能与公开入口需求；[前端实现](FRONTEND_IMPLEMENTATION.md)。

## ADR-0003：账号、权威存储与同步

- 状态：接受，自托管邮箱密码＋Argon2id／DB session，PG18＋pgvector0.8、私有OSS、Dexie自有同步。
- 理由：身份、ACL、课程、证据与幂等在同事务层；附件adapter保留替换边界。
- 备选：托管身份／数据平台、SQLite业务库、独立向量库；增加外部交付依赖、并发限制或ACL同步责任。
- 后果：维护认证和邮箱恢复；student／teacher分表；pending教师私备、verified才能学生发布，核实不授予学生数据权。RLS防御；claim先写本地journal再幂等请求，响应丢失不转号，访客无永久空间。
- 复审：认证运维、事务性能、私有交付；[物理／API](TECHNICAL_DATA_CONTRACT.md) B02–B05必测。

## ADR-0004：资料解析与授权检索

- 状态：接受，Docling本地CPU＋受控LibreOffice／OOXML检查，bge-m3 dense1024＋固定jieba／PG GIN，先授权集精确检索。
- 理由：要求的Office／PDF／文本有统一处理路径；向量和策略同库，先证明中文／代码相关性。
- 备选：托管解析／embedding、独立搜索引擎、立即ANN；当前收益未证明。
- 后果：CPU及profile管理；PPT学生副本单独索引，原答案谱系保留；模型发送／输出／回放重验ACL；独立审阅发布物依据自身授权。
- 复审：检索质量、延迟／峰值、ANN过滤召回、格式遗漏与撤权竞态；FR44–FR46必测。

## ADR-0005：异步、模型与浏览器协议

- 状态：接受，Celery5／Valkey8＋PG outbox、REST v1＋fetch SSE／受限WS；DeepSeek deepseek-flash 为首个可选样例适配器，开源版支持自定义模型与按职责路由。
- 理由：长任务释放API，至少一次由租约／幂等补偿；刷新可带Last-Event-ID；provider网关隔离协议与替换成本。
- 备选：仅进程内任务、全部长期WS、供应商SDK全平台；增加崩溃恢复或耦合成本。
- 后果：事件回放仍授权，长流逐批查session／guest lease；result backend不是证据。高级模型自动切换关闭，alias变化需profile回归；外部处理条款、真实质量／成本和budget待测。无凭据仅明确模拟。
- 复审：broker兼容、重投／取消、流式／quota、供应商变化。

## ADR-0006：真实执行与新环境部署

- 状态：接受，受信业务Compose／Caddy，代码原生isolate专用VM，SQL独立实验PG，网络containerlab＋Linux／FRR，公开每实验租约独立VM。
- 理由：课程活动需不同执行模型，高权限控制器不进入业务宿主；旧机2CPU／约1.6GiB不是整套新环境容量基线。
- 备选：业务容器内执行、共享内核恶意多租户、Kubernetes、并行多个执行平台；当前风险或维护量不适合。
- 后果：VM／模板生命周期、取消清理和安全审核；厂商镜像另授权，FRR不替代专有CLI。精确工具链和公开并发以实测锁定。
- 运维：pgBackRest独立POSIX repository＋OSS隔离备份，RPO15min／RTO4h待测；未采购或改旧服务器。[部署设计](DEPLOYMENT.md)。
- 复审：隔离、峰值、恢复、成本与私有交付。失败阻止开放对应能力，不用模拟结果代替实操。

## ADR-0007：契约生成工具的 TypeScript 隔离

- 状态：接受，2026 年 10 月 3 日的实际依赖安装结果。
- 问题：openapi-typescript 7.13.0 的 peer 要求 TypeScript 5，与应用选定的 TypeScript 6.0.3 合并安装发生 ERESOLVE；当时没有可用正式版8。
- 决定：应用继续 TypeScript6；契约工具独立位于 `packages/contracts/tooling/`，锁定 openapi-typescript7.13.0＋TypeScript5.9.3。两个目录均使用npm和精确lock，每个环境先npmci；生成结果是应用可编译的普通类型文件。
- 备选：把应用降至5、force／legacy-peer-deps忽略、手写所有接口类型；分别改变既定基线、掩盖不兼容或造成漂移。
- 后果：多一个工具依赖锁，CI显式安装并检查；后端实际OpenAPI与前端生成类型均需审阅，禁用手改生成文件。
- 验证：Node24真实安装／生成／check通过，TypeScript6应用typecheck和构建通过。
- 复审：上游正式支持TS6后评估合并工具链，附相同契约回归，不仅看包版本。
