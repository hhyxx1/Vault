# CS10 提交服务综合实验

2026-10-10；CS10-core-practice-0.2.0；M09-O03活动@0.2.0。两个不同错误的桌面/手机4项闭环实际通过，包含重跑、代码/结果刷新和图谱部分条件满足（0/27掌握）。

## 学习产物

main.py实际在私有沙箱127.0.0.1启动HTTP服务，service.py提供SQLite状态、参数化查询、事务和审计。第一增量创建/读取草稿，关闭服务后第二增量增加提交/幂等重放，再关闭重启读取已提交状态。每次HTTP请求真实执行；不使用伪造HTTP状态日志。学生分别修复缺失所属人判断和重复请求再次写审计的两个不同错误，再解释需求/代码/反例/验收的对应。

输出401/403/404/409情境、草稿/提交恢复、相同key重放和审计。模拟身份只用于本次私有实验，X-Lab-Identity可伪造，不能当真实登录或生产鉴权方案；HTTP标准库服务也不用于真实生产上线。两增量为本地功能发布演练，尚不是CI构建版本两次公网发布。

## 实际核验

112份新版本作者工件在真实Linux isolate核对。Windows11项实际HTTP/状态测试通过，包括同key跨资源冲突不改状态、非法key/JSON对象、未知身份/对象、SQL文本作为参数、服务重启与审计只追加一次。专业审校、完整需求/架构评审、容量故障演练、真实发布与独立迁移仍待建设。

隔离环境实际fcntl锁返回EPERM，SQLite默认VFS写入失败；没有关闭事务/锁或删库绕过。依据[SQLite VFS说明](https://www.sqlite.org/vfs.html)改为所有Linux实验连接一致使用unix-dotfile文件锁，Windows使用其默认VFS；不同VFS不能并发访问同一文件。本题只有单HTTP服务顺序请求和同次沙箱数据库，不宣称多进程、崩溃断电、网络文件系统耐久已经验证。沙箱文件不跨执行作业保留，刷新恢复学生代码和结果。

实际阅读[Python HTTP](https://docs.python.org/3.13/library/http.server.html)、[SQLite事务](https://docs.python.org/3.13/library/sqlite3.html)、[OWASP授权](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)正文，代码/场景原创。
