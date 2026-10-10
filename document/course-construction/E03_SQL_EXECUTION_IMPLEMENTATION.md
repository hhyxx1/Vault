# E03 PostgreSQL 18 开发执行底座

2026-10-10；状态：单次 SQL 脚本隔离执行已实现并真实验证；双连接事务调度、持久数据库会话和完整数据库课程未完成。

## 实际实现

公共执行请求新增 `postgres18`，沿用作品快照、hash、异步运行租约、取消及清理回执。一个 `main.sql` 文件，最大 64 KiB，不接受标准输入或任何反斜线（禁止 psql 客户端命令）。学生／教师自建课程可复用公共 `/code` 入口，活动编排和可靠目标检查仍需课程作者提供。

每次真实运行在 isolate 私有文件、进程、网络空间中初始化新的 PostgreSQL18.6 集群。数据库仅监听 `/box/tmp` 的 Unix socket，不监听 TCP，不连接业务 PG。使用合成的本沙箱用户信息，不挂宿主账户或业务配置。controller 创建 learner 角色，learner 不可超级用户、建库、建角色或复制，仅可在 workspace 创建自己的对象。数据库运行结果来自真实 PG18，不用 SQLite 或生成输出代替。

脚本逐语句执行，BEGIN/COMMIT/ROLLBACK 使用真实事务；结果为无表头、管道分隔，NULL 明示 `<NULL>`。无 ORDER BY 的结果不承诺顺序，课程检查按题目声明集合、多重集或有序比较。当前公共工作台保存实际输出，尚未以输出直接证明整门数据库课程。

128 MiB tmpfs、8192 inode、单文件 32 MiB、512 MiB cgroup、32 进程和64描述符，普通运行5秒 CPU／10秒墙钟。PG 默认每语句2秒、锁等待1秒，学生修改会话设置也仍受外层资源限制。初始化故障为 environment_error/prepare，SQL 拒绝或约束错误为 runtime_error。正常和错误结束都结束集群，外层清理进程、挂载和 cgroup；取消与清理按原执行服务协议。

每次从源脚本重建，旧数据库文件不复用。学生保留完整建表／数据脚本以继续学习，刷新恢复的是作品和历史结果；重新运行才产生新实例证据。当前不是长时交互数据库会话，不能声称已完成双连接隔离异常、真实备份恢复或完整下单项目。

## 环境及安装

专用 Ubuntu24.04 amd64 开发执行环境的二进制从官方 PGDG/Ubuntu APT 签名源下载，仅解包到 `/opt/vault-toolchains/pg18`，没有安装宿主 PostgreSQL 服务、没有新建宿主集群。服务端、客户端和libpq锁定18.6-1.pgdg24.04+2，liburing2锁定2.5-1build1；实际下载 SHA256 固定在 `tools/execution/install_postgres18.sh`。安装脚本提供同路径可复现步骤；当前二进制已通过这些下载／解包步骤部署，脚本另通过 bash 语法检查。

控制器只绑定选定的 Python3.13 及 PG 工具链；可信 runner 在只读工具链中，SQL 不可传入 runner 路径、角色或宿主参数。公开部署仍须按已有专用执行 VM、私有认证网关、配额与部署验收；本机开发通过不代表生产部署完成。

## 实际验证

- 单元测试先证明请求不接受 SQL，新增实现后允许受控 SQL，拒绝混合扩展名、标准输入及行中／行首 psql 命令。
- Linux 真实专项3项通过：NULL／重复／DISTINCT、事务回滚、新实例无旧表；SET ROLE controller、服务端文件读取、COPY PROGRAM、建超级角色及建库全部拒绝；CHECK 拒绝、statement timeout 后下一次 SELECT 正常。
- 桌面／手机2项浏览器通过：SQL真实计数、约束错误、刷新作品结果及新实例检查。
- 前端88项单元、TypeScript、生产构建及契约检查通过。完整后端回归另记录实际结果，不把 Windows 跳过当真实 Linux 运行。

## 下一步

逐目标建设 SQL 活动与语义检查；双连接屏障调度、只读角色与跨角色视图、参数化应用接口、备份恢复及综合迁移项目分别实现。有限输出、索引存在和声明了隔离级别都不能替代实际计划／并发／权限／恢复证据。

依据：[官方 Ubuntu 安装源](https://www.postgresql.org/download/linux/ubuntu/)、[initdb](https://www.postgresql.org/docs/18/app-initdb.html)、[连接配置](https://www.postgresql.org/docs/18/runtime-config-connection.html)。配置均实际验证；不连接业务库。
