# 前端实现基线

版本：v1.1

更新日期：2026 年 10 月 3 日

状态：经项目发起人“你来帮我确定”授权选定的第一阶段技术基线；尚未创建工程、安装依赖、完成兼容性原型或通过功能／视觉 QA。本文件落实 [PRD](PRD.md)、[用户流程](USER_FLOWS.md) 和 [前端品质标准](FRONTEND_DESIGN_STANDARD.md)，不改变 13 门课程和教师自建课程的范围。

## 1 选定方案

采用浏览器优先的 React SPA：React 19、TypeScript、Vite；前后端 API 分离，同源部署。学习工作台支持长时间编辑、图谱探索、本地持久化和增量反馈；第一阶段不引入 SSR、React Server Components 或第二套前端框架。公开课程页未来需要搜索引擎收录时可增加独立静态生成入口，不迁移学习工作台。

以下是主版本／维护分支决策，建工程时选该分支内已发布、无预发布标记的补丁版本并锁定 lockfile；不得直接依赖 next、canary、beta 或 GitHub main。升级主版本须有兼容性记录，不把本表当作上游永久支持承诺。

| 领域 | 选定基线 | 使用边界与原因 | 许可及主源 |
|---|---|---|---|
| 页面 | React／react-dom 19，采用已稳定发布的 19.3 系列 | 学生与教师共享交互组件；保持作品编辑状态和真实异步反馈 | [发布说明](https://react.dev/blog/2026/09/09/react-19-3)、[MIT](https://github.com/react/react/blob/main/LICENSE) |
| 类型 | TypeScript 6.0 兼容线，严格模式 | 初始保留广泛使用的 JavaScript 编译器 API，减少新工程同时适配原生编译器与工具 API 的工作；不声称其为最新版本 | [6.0 说明](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)、[Apache-2.0](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt) |
| 构建 | Vite 8.3 系列＋匹配的官方 React 插件 | 官方当前常规补丁线；按页面和重组件拆包 | [维护分支](https://vite.dev/releases)、[Node 要求](https://vite.dev/blog/announcing-vite8)、[MIT](https://github.com/vitejs/vite/blob/main/LICENSE) |
| 路由 | React Router 7 最新稳定补丁，Data Mode | 使用 createBrowserRouter、懒加载路由和错误边界；不启用 Framework／RSC 模式；7 系列保持与现有本机 Node 兼容 | [Data Mode 安装](https://reactrouter.com/7.9.6/start/data/installation)、[升级要求](https://reactrouter.com/upgrading/v7)、[官方仓库／MIT](https://github.com/remix-run/react-router) |
| 样式 | Tailwind CSS 4＋项目 CSS 变量与局部 CSS | 公共组件使用设计令牌；图谱、排版、编辑器与特殊布局使用自写 CSS。不能把工具类、现成主题或模板视为原创设计 | [Vite 集成](https://tailwindcss.com/docs/installation/using-vite)、[兼容范围](https://tailwindcss.com/docs/compatibility)、[MIT](https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE) |
| 基础交互 | 按需使用 Radix Primitives 稳定包 | 无样式 Dialog、菜单、Tabs、Tooltip 负责键盘／焦点基础，项目自行设计外观并实际验证；不用 Radix Themes 或整站模板 | [无样式与访问性](https://www.radix-ui.com/primitives/docs/overview/introduction)、[MIT](https://github.com/radix-ui/primitives/blob/main/LICENSE) |
| 服务端数据 | TanStack Query 5 | 账号隔离的远端缓存、请求状态与重试；不承担作品永久保存、离线 outbox 或最终证据裁决 | [官方文档](https://tanstack.com/query/latest/docs/framework/react/overview)、[MIT](https://github.com/TanStack/query/blob/main/LICENSE) |
| UI 状态 | Zustand 5 | 面板、当前选择、视口等少量跨组件状态；普通表单保留 React 局部状态，不复制整个数据库 | [官方仓库](https://github.com/pmndrs/zustand)、[MIT](https://github.com/pmndrs/zustand/blob/main/LICENSE) |
| 本地数据库 | IndexedDB＋Dexie 4.4 系列 | 事务保存作品、版本、事件、outbox、附件和恢复位置；使用项目自有同步协议，不购买或绑定 Dexie Cloud | [稳定发布线](https://github.com/dexie/Dexie.js/releases)、[Apache-2.0](https://github.com/dexie/Dexie.js/blob/master/LICENSE) |
| 课程图谱 | Cytoscape.js 3.34 系列 | 同一个图谱引擎支持学生浏览和教师基础编辑；React 包装适配器自行维护 | [能力与发布线／MIT](https://js.cytoscape.org/) |
| 代码编辑 | CodeMirror 6 模块化包 | C／C++、Java、Python、JavaScript、SQL 语法高亮、搜索、缩进及必要补全；真实编译、运行和核验由执行服务完成 | [开发仓库](https://github.com/codemirror/dev)、[MIT](https://github.com/codemirror/view/blob/main/LICENSE) |
| 教师内容编辑 | Tiptap 3 开源核心＋所需开源扩展 | 课程正文、表格、代码、公式和目标说明；采用版本化 JSON 文档，AI 输出先作为可比较、可拒绝的草稿 | [能力和许可边界](https://tiptap.dev/docs/editor/getting-started/overview)、[稳定发布线](https://github.com/ueberdosis/tiptap/releases)；开源部分 MIT，商业扩展不纳入基线 |
| 学习内容显示 | react-markdown 稳定 10 系列＋GFM／数学插件＋KaTeX | 只读解释／对话显示 Markdown，编辑作品与教师文档分别使用 CodeMirror／Tiptap；不以 HTML 字符串直接注入模型输出 | [官方仓库／MIT](https://github.com/remarkjs/react-markdown)、[KaTeX／MIT](https://github.com/KaTeX/KaTeX)、[公式安全](https://katex.org/docs/security.html) |
| 动效 | CSS transition＋Motion 13.4 稳定系列 | CSS 覆盖简单状态，Motion 仅负责布局／交互转场；不同时引入 GSAP 和第二套动效引擎；不凭 main 的版本号判断已发布 | [官方文档](https://motion.dev/docs/react)、[稳定包发布列表](https://www.npmjs.com/package/motion?activeTab=versions)、[官方包许可 MIT](https://github.com/motiondivision/motion/blob/main/packages/motion/package.json) |
| 测试 | Vitest 5＋React Testing Library；Playwright 1 稳定线 | 领域／组件行为、实际浏览器流程、截图回归分层；自动检查不替代八维视觉复核 | [Vitest 发布线](https://github.com/vitest-dev/vitest/releases)、[工具链条件](https://vitest.dev/guide/)、[Vitest MIT](https://github.com/vitest-dev/vitest/blob/main/LICENSE)、[React Testing Library MIT](https://github.com/testing-library/react-testing-library/blob/main/LICENSE)、[Playwright 条件](https://playwright.dev/docs/intro)、[Playwright Apache-2.0](https://github.com/microsoft/playwright/blob/main/LICENSE) |

官方资料核对日期为 2026 年 10 月 3 日。首个工程提交须补充精确版本、直接与传递依赖许可证清单、兼容性结果和锁文件；本文件不是已运行证明。上游没有明确维护时限的库，不推定其存在长期支持承诺。TypeScript 7 已发布，初始采用 6.0 是生态兼容取舍；工具升级及安全维护评审时重新核对，不因本文件固定旧版本。

## 2 Node 与浏览器边界

只读检查得到本机 Node 为 v22.20.0。它满足 Vite 8 与 Vitest 5 文档中的 Node ≥22.12 数值门槛；React Router 8 文档要求 Node ≥22.22，因此第一阶段选 7 系列。以上只证明声明的版本门槛，未安装／构建／测试，不代表整个依赖组合已经兼容。

开发与 CI 统一采用 Node 24 LTS 的当期维护补丁并记录 .node-version／engine 条件；本机现有 22.20 可用于初始兼容性验证，正式 CI 和发布不长期停在旧补丁。应用采用 npm 和 `apps/web/package-lock.json`。契约工具因 openapi-typescript 7 的 TypeScript 5 peer 约束单独安装在 `packages/contracts/tooling/`，具有独立 npm 锁；应用仍使用 TypeScript 6，不使用 force／legacy-peer-deps。此兼容性例外见 ADR-0007；不混用包管理器。

浏览器基线以当前稳定 Chrome、Edge、Firefox 和 Safari 的实际验收为准。Tailwind 4 核心技术最低依赖 Chrome 111、Safari 16.4、Firefox 128；最低依赖不是对这些旧版本的完整产品验收承诺。iOS Safari 和 Android Chrome 补充真机编辑、触摸、软键盘和存储测试。视口、320 px、200% 缩放、减少动态效果和八维检查按前端品质标准执行。

## 3 工程组织

前端放在 apps/web；文档继续统一放 document。API 客户端从已审阅 OpenAPI 生成，契约类型、课程／证据计算与数据迁移不得塞入页面组件。

~~~text
apps/web/
  src/
    app/                 # router、provider、错误边界、启动与身份切换
    pages/               # P00–P10 路由页面，薄组合层
    features/
      learning/          # 目标确认、工作台与持续学习
      graph/             # Cytoscape 适配器、树视图与编辑
      evidence/          # 作品版本、核验与详情
      courses/           # 默认课与教师自建课
      resources/         # 上传、解析、可见性与学生预览
      skills/            # 私人 Skill、版本、审核和分享
      account/           # 登录、关系与授权
      sync/              # 归属承接、outbox、冲突、删除和恢复
    domain/              # 纯函数、稳定对象、状态与版本校验
    local/               # Dexie schema、repository、迁移、事务与导出
    api/                 # 生成客户端、流式适配器、取消与错误归一
    ui/                  # 原创基础组件与组合组件
    styles/              # tokens、字体、排版、语义色、响应式与动效
    test/                # fixtures、测试工厂和浏览器辅助
  e2e/
  public/
~~~

工作台、图谱、代码编辑、教师编辑各自懒加载。大课程图谱按层级和展开范围分批取数据；列表／树视图共用同一领域模型。是否增加 Web Worker 以布局、解析或计算性能测量为依据，避免创建无作用的通用 worker 层。

## 4 数据与保存职责

| 数据 | 权威与持久化 | 页面职责 |
|---|---|---|
| 未登录目标、作品、帮助、证据及位置 | 当前未绑定本地空间的 IndexedDB；对象有稳定 ID、空间归属、版本和创建来源 | 保存事务完成才显示“本地已保存”；配额／写入失败明确显示并提供导出 |
| 账号作品与离线修改 | 账号专属本地空间＋服务端按同步契约归档；outbox 在同一事务写入 | “本地已保存”“待同步”“云端已保存”“冲突”分别表达；不以 HTTP 已发出代表云端成功 |
| 图谱／课程正式版本 | 已发布服务端内容；授权缓存具有版本和可撤销条件 | 展示来源、版本及四类证据状态；过滤不改变统计分母 |
| 核验结果与达标状态 | 按证据契约校验与聚合；在线官方结果由服务端确认 | 访客本地显示有完整来源的核验结果，账号同步时服务端复查；点击或拖动不能写达标结果 |
| 教师私人课程／资料 | 教师教学空间及相应权限对象；本地草稿也是教师专属 | 学生预览调用服务端真实学生视图，不通过隐藏 DOM 模拟授权 |
| 远端列表、详情和请求状态 | TanStack Query 的可丢弃缓存 | query key 带账号、角色、空间、资源版本、授权 epoch；不作为学习档案 |
| 面板、图谱视口、即时输入 | React／Zustand；需恢复部分显式保存到当前空间 | 可恢复编辑不会被路由切换、动画或重新请求重置 |

每个归属空间使用独立 Dexie 数据库或严格封装的账号专属实例；数据库名不写明个人邮箱／手机号。第一阶段采用独立实例，索引键仍含 space_id，保证导出、迁移和同步校验明确。未绑定空间绑定本人账号后不能再被另一个账号领取，归属与上传完成分别记录。

发出 claim 请求前，本地事务先保存 claim journal：固定 claim_id、已认证 account_id、origin_local_space_id、冻结清单 hash 和 pending 状态；将该空间暂时保留给本人，不能继续显示为任意账号可承接的空间。请求使用同一 claim_id 作为幂等键，网络错误不重新生成请求或更换清单。服务器已提交但响应丢失时，只有同一账号重新认证后才能查询／重试确认原映射；账号 B 不能查看 journal 正文或接管该 pending 空间，可另建自己的空间。确认映射后以本地事务写入正式归属、服务器空间映射和待上传 outbox，再逐批同步；后续编辑以新的对象操作排队，不改写冻结 claim 请求。浏览器崩溃、多标签页重复承接、请求结果未知、退出和账号切换均须走这一恢复路径。

API 中 bigint 版本、revision 和 sequence 使用十进制字符串，本地记录和生成客户端保持同一约定，不转换为 JavaScript number；比较需要数值顺序时在纯函数中校验后使用 BigInt，序列化前仍转回字符串。初始创建的 base_version="0" 是明确的无前版本哨兵，不混作已存在对象的正版本；SSE 的 id 和 JSON sequence 同值校验，游标不得按字符串字典序排序。

账号切换先停止旧请求／流／运行结果接收，增加身份 epoch，关闭旧库并清理旧身份 Query/UI 状态，再打开新账号实例；每个迟到回调校验发起时的账号、空间和 epoch，不能写入当前新空间。身份切换广播到同源标签页。账号空间重新进入前需本人的有效认证；会话凭证不存入 IndexedDB／localStorage。

IndexedDB 不是加密保险箱，也无法对拥有同一浏览器配置文件访问权的其他人建立独立安全边界。应用层防串号须实现；共用设备提供退出后清除此账号本地副本的入口，导出／清除行为按数据契约处理。存储持久化请求失败、浏览器清理和隐私模式需实测，不能保证永久保存。

本地学习能力与断网调用模型／执行服务是不同状态：本人本地作品可继续编辑，在线动作明确显示离线并可恢复。建立最小 Service Worker 应用壳缓存用于断网后重开工作台；第一阶段自动离线持久化范围仅为平台明确标为 public 的不可变课程正文／蓝图版本，以及当前本人空间中的作品与学习记录。课程发布不自动意味着 public；私人 API、教师资料／切片、受控答案、其受限派生内容及带账号数据的导航响应不加入通用 Cache Storage，也不通过 IndexedDB 建立另一个资料缓存。需要这些内容时重新取得服务器授权，不能因之前在线可见而在离线继续提供。

公开内容缓存保留版本及 hash，服务重新可达时核对当前发布生命周期；撤回通知停止后续自动提供并清除适用缓存。教师资料的线上下载遵守 private, no-store 和服务端当前授权；用户明确选择的合法下载无法保证收回，不将这一事实解释为客户端有自动预取、离线索引或永久缓存许可。本人作品、权限受限的来源内容与事件恢复元数据分别管理，恢复游标记录不能顺带保存私有切片全文。

### 4.1 SSE 客户端、刷新恢复与身份

选定 fetch＋ReadableStream 的 SSE 客户端，不使用 native EventSource 作为本项目恢复客户端。客户端以 credentials: same-origin 发出只读 GET；刷新后从当前本人空间取已应用游标，显式发送 Last-Event-ID。请求创建与提交仍由带 CSRF／幂等信息的 POST 完成，GET 事件流不触发新运行。访客流采用后端 guest lease 契约，不能为了接入 SSE 自动创建永久云端学习空间。

解析器处理 UTF-8 跨 chunk、空行分隔、多行 data、id 和命名 event；检查响应状态及 Content-Type，不能把 401／403／游标过期 JSON 当作正常事件。按 run_id＋event_id 去重，状态事件成功应用到当前空间后才持久化对应 sequence／游标，处理失败不提前推进。断连以有限退避重新请求；EVENT_CURSOR_EXPIRED 使用本人仍有权访问的当前快照恢复，不能盲目从头重播。流内容遵守资料缓存边界；持续逐 token 输出不默认产生永久私有源资料副本。

每条流关联启动时的账号或访客 lease 主体、本地空间、run 和身份 epoch，AbortController 在切换、退出、取消和失效时立即结束连接；跨标签页身份变化同步停流，迟到事件不得写入新空间。服务器输出与回放网关对账号流每个有内容批次重新检查 auth_session 的撤销／期限、账号状态／auth revision 以及来源与答案授权；访客流同样检查 guest lease 的主体、撤销、期限和允许范围。前端停流不替代这些服务端检查。收到身份过期、授权撤销或来源不可用时停止自动重连，显示重新认证或其他恢复入口；不得保留已无权访问的旧正文供再次查询。
## 5 动态图谱实现

选择 Cytoscape.js，因其核心是节点、关系、布局和局部更新，契合课程完整范围导航。React Flow 擅长可组合节点式编辑器，但本项目不需要将学习图谱变成工作流拖拽画布；第一阶段不并行养两套图库。该取舍是项目判断，不声称某库天然更好或已测出性能优势。

图谱仅绘制领域模型的投影。课程／章节／知识单元的归属树与 mandatory_prerequisite 的 DAG 分开验证，concept_relation／application_relation 可存在合理环；不能用图布局算法自动替代课程审校或领域验证。

- 层级浏览采用稳定、可重复布局，先显示章节再展开单元／目标；固定选择、缩放和视口。
- 先修按有向关系画，概念与应用关系使用不同线型、图例和说明；不默认持续力导向运动。
- 目标节点用文字／形状辅助颜色，父节点用去重目标计数与状态分布；父节点不作为额外目标。
- 只更新受新证据影响的节点与聚合，动画可中断、支持 reduced-motion；不重建整张图造成跳动。
- 点击节点进入语义清晰的 HTML 详情面板；Canvas 图谱外提供真实 DOM 树／列表、键盘操作、搜索和关系列表，不假设 Canvas 自动满足访问性。
- 教师修改节点／边先形成草稿和变更列表，经结构检查再保存新版本；发布依据仍是服务端课程与权限检查。
- 密集图、中文长标题、触摸命中、性能和层级展开在实际浏览器验证；未测不承诺最大节点数。

## 6 内容、资料与编辑器

CodeMirror 6 统一桌面和移动代码编辑，语言模块按需加载。Monaco 官方 FAQ 明确不支持移动浏览器，因此不作为第一阶段唯一编辑器。[Monaco 官方 FAQ](https://github.com/microsoft/monaco-editor#faq) 表明该限制；代码补全也不等于语言运行环境。真实执行始终带作品版本、语言／依赖环境、输入与标准版本，前端只显示服务实际报告的状态和输出。

Tiptap 编辑教师正文及学生需结构化的证明／设计作品，源码作品交给 CodeMirror。JSON 内容有 schema_version；保存为不可变修订，Markdown／HTML 是派生导出格式，不能依赖有损往返充当原始版本。首阶段不引入实时多人协同或付费 Tiptap AI／云服务；AI 建议来自本项目接口，插入前展示改动与出处，需教师确认。

只读 Markdown 禁止任意原始 HTML、脚本和危险链接协议；嵌入内容按允许类型处理，公式渲染保持 KaTeX trust=false 并限制异常复杂内容。来源引用与答案开放范围依赖 API 权限，不通过删掉出处继续提供私有内容。

PPT／PDF／DOCX 的转换与解析在受控服务端完成。页面显示解析状态、页／幻灯片定位、缺失内容、隐藏页／备注选择、学生副本及学生视角预览；不将浏览器解析成功当作资料发布或私有信息过滤成功。教师未授权的切片不能出现在学生浏览器状态、网络响应、缓存、错误信息或模型流中，所有下载和 RAG 访问由服务端再次鉴权。

## 7 动效、原创与可访问性

原创视觉概念在高保真阶段确定，项目建立字体、网格、间距、字号、语义色、图标、焦点、圆角、阴影与时长令牌。Tailwind 和 Radix 仅提供工具与基础交互，默认皮肤、示例布局和批量套卡片不构成穹隆的视觉设计。

Motion 不负责改变学习结果或显示假进度。运行排队、解析、同步和 Agent 进度来自真实事件；等待动画不声称剩余时间或已完成比例。显著状态用适度 aria-live，逐 token 流不不断播报；菜单、抽屉、错误与返回动作管理焦点。理论／作品／结果／辅导在宽屏同活动布局，在手机按任务切换并保持上下文。

持续优化覆盖排版、留白、层级、色彩、动效、微交互、响应式和原创性。前端品质记录按 [品质标准](FRONTEND_DESIGN_STANDARD.md) 创建，截图之外实际操作、低性能设备和独立复核都须记录；未完成时不能在本文件填“获奖级已达成”。

## 8 验证与交付门

| 层次 | 实施与重点 |
|---|---|
| 领域／本地存储 | Vitest 检查目标去重分母、局部聚合、只读展示不写证据、版本冲突、归属绑定、事务与迁移失败；IndexedDB mock 仅做快速测试，真实持久化再由浏览器检验 |
| 组件 | React Testing Library 检查键盘入口、真实保存／错误文案、答案受控状态、学生预览、离线与冲突操作；以用户行为断言，不复制组件内部实现 |
| 浏览器闭环 | Playwright 覆盖访客刷新恢复→本人承接→claim 响应丢失及固定请求恢复→中断重试→账号 A/B 切换→迟到结果／多标签页→SSE 刷新游标及会话失效→附件失败→删除传播；核对图谱变更来源和理论实作上下文 |
| 资料与授权 | 学生对私有正文／切片／引用／下载／缓存／Agent 交接不可访问，撤权和答案开放策略有拒绝用例；后端安全验收与前端实际网络检查共同验证 |
| 编辑／布局 | 长中文、公式、长代码、图谱密集数据、触摸、IME、软键盘、320 px／200%／reduced-motion；Playwright WebKit 不替代实际 Safari／iOS 验证 |
| 视觉／访问性 | 截图回归与自动访问性扫描用于发现变化；八维实际走查与独立复核决定品质通过，截图基线不自动批准原有缺陷 |
| 工程 | typecheck、lint、production build、相应测试；禁止在前端注入模型密钥、对象存储管理员凭证或执行服务凭证 |

初始原型最先证明：P03 编辑保存与刷新恢复、P01 图谱增量更新与等价树视图、P08 归属承接和串号拒绝、P10 私有资料与真实学生预览。其后扩展全部 P00–P10 和 UF01–UF09，不以原型测试代替 13 门课程完整交付和实际学习证据验收。

本次只完成选型与职责划分；精确依赖组合、数据库迁移、前端构建、浏览器兼容、性能、权限拒绝和获奖级品质均尚未验证。

## 当前实施记录

2026-10-08：默认课程图谱已按用户指定设计稿采用共享 HTML 节点＋SVG 关系视图，提供全景、目录、搜索、局部关系、真实证据详情及 URL 恢复。此取舍用于语义按钮与可读文字、稳定布局、来源检查；个人课程的既有 Cytoscape 图谱继续保留。实际覆盖与验收边界见 [图谱实施记录](FRONTEND_ATLAS_IMPLEMENTATION.md)。

2026 年 10 月 3 日建立 React／Router Data Mode、原创 CSS、Cytoscape、CodeMirror、Dexie；其他选定工具按实际功能需要逐步集成。公开课程目录／版本／操作序列由 `content/courses/` 同源派生，访客核验使用生成类型，当前不实现账号数据归属或远端缓存伪装。

本机 Node24.19.0 的 typecheck、13项单元测试、24项桌面／手机真实浏览器测试与 build 通过。保存版本不回写编辑稿；迟到结果和帮助记录绑定提交快照；当前活动的 hash／版本／来源验证后才落本地事务。应用的账号、上传／资料、Agent、同步和执行功能仍未开放。可复现命令与品质证据见 [开发运行说明](DEVELOPMENT_GUIDE.md)、[技术验证](TECHNICAL_VALIDATION.md)、[八维记录](FRONTEND_QUALITY_REVIEW.md)。

## 账号／本地与云端切片（2026 年 10 月 5 日）

新增账号页：学生／教师注册、邮箱确认、登录、退出、密码重置。邮件来自私有本机开发捕获器，页面明确提示未真实投递。小屏先显示表单，宽屏保留品牌／说明与主要动作的层级。

Dexie v2 保留原表，迁入空间复合键工作表，增加固定 claim journal、批次、逐项 outbox 和同步游标。账号切换停止旧请求，事务校验身份代次、cachedAccount 和活动空间；pending origin 不交给另一账号。云端变化先应用后推进游标，冲突必须明确选择；当前打开工作台的外部草稿更新会显示，旧内容基准不能覆盖新稿。生产构建现预缓存公开应用壳和全部静态路由资源，已实测首次在线访问后断网重开访客工作台并继续编辑；`/api` 和私有资料不入 Cache Storage。公开课程正文离线版本、撤回同步与账号完整离线场景仍待实现和验收。

本地空间页显示归属、待传、被拒绝、依赖、冲突与可恢复账号空间。新设备核验为 client_reported／待复核；本机同正文真实核验保持原来源，动态图谱不因导入历史提高掌握状态。教师账号仅私人草稿同步；学生草稿只保留本机。实际测试／八维复核见 [技术验证](TECHNICAL_VALIDATION.md) 和 [前端品质](FRONTEND_QUALITY_REVIEW.md)。
