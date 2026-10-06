# 账号与本地学习同步实现

日期：2026 年 10 月 6 日。范围：开发环境的邮箱密码账号、当前学习切片的本地关联和同步。开发账号与当前同步切片已实现并验证；真实邮件投递、生产容量、教师共享、资料、附件和完整课程仍需分别通过交付验收。

## 使用流程

未登录仍可直接学习，本机作品不会因打开登录页上传。登录入口说明将关联当前未绑定空间及其作品、版本、帮助、核验历史和备课草稿。学生与教师分别注册；邮箱确认完成后才能登录，教师初始状态为待核实。教师也可以承接自己的个人学习记录，身份选项不授予读取学生记录或发布课程的权限。

登录成功后先固定本地关联日志和账号归属，再发关联请求。服务器确认后显示已关联、待同步；记录逐项确认后才能显示已同步。断网、写入失败、部分拒绝与版本冲突有分别的状态，本地原件继续保留。退出后使用新的访客空间，已关联的记录仍归原账号；其他账号不能认领。恢复原账号后继续原关联和待传操作。

已登录的另一设备可以读取本人服务器空间并恢复记录。旧设备的未同步修改与服务器更新冲突时保留双方，不能按设备时间自动覆盖。删除标记防止旧更新复活记录。当前支持的学习对象是目标草稿、不可变作品版本、求助记录、核验历史、私人备课草稿和继续学习位置；附件不在当前活动中，后端明确拒绝附件操作，不会返回上传完成。

未登录、未绑定且没有待确认归属的访客可在“本地记录”页清除当前空间。前端在一次 IndexedDB 事务中清除该空间的作品、版本、证据、帮助、备课草稿、同步标记和继续位置，然后创建新访客空间；旧标签页持有的空间 ID 无法再写入。界面先明确提示此操作不可撤销及建议导出，跨标签页通知使旧页面重新读取空间。已归属或待归属账号的空间拒绝此入口；这不是云端账号数据删除，云端删除流程仍待实现。

## 身份与权限

- 复用 `account`、互斥 student／teacher profile 和 `auth_session`；补充邮箱确认状态及一次性邮箱能力令牌。密码采用 Argon2id，数据库仅存 session／CSRF／邮箱令牌摘要；密码不写日志。
- 开发 HTTP 使用明确命名的 HttpOnly cookie，不把 session 放入 localStorage 或 URL。预认证 nonce 在进程内一次性保存，默认 300 秒，绑定 HttpOnly `vault_dev_preauth` cookie、Origin 与实际 client IP；会话 cookie 为 `vault_dev_session`，已登录写操作要求当前会话及 CSRF。
- 每次读取或同步都以数据库中的实际 session 为准，校验账号状态、auth revision、撤销和到期；同步请求里的 expected_account_id 只用于拒绝过期身份，不指定所有者。
- 数据库事务先锁账号，再锁会话，随后检查空间与对象，RLS 上下文在事务内设置；撤销与同步采用同一锁顺序。连接池不得保留上一账号上下文。
- 同步不能写入账号类型、教师核实、管理员权限或教师共享授权。初始教师为 pending，自身学习空间与后续教学发布权限分开。

邮箱尚未确认的重复注册将确认令牌绑定至本次提交的密码摘要、账号类型与显示名；确认时原子应用，防止真实邮箱持有人确认后激活他人预注册的密码。已确认账号的重复注册不修改其密码或身份。密码重置一次性消费并撤销旧会话。

本轮使用私有 TEMP 邮件捕获器，没有向真实邮箱发送邮件。HTTP 不返回确认／重置能力令牌，捕获目录不作为静态资源或 CI 附件公开。生产环境明确禁止启用当前账号实现，真实投递、容量、运维和完整发布认证门仍需实施。

## 同步与证据

claim_id、原本地空间、期望账号和清单 hash 在请求前通过 IndexedDB 事务固定，未知结果不会退回未绑定。服务器关联、空间和 origin 映射在一个事务提交；丢失响应可以由本人查询或使用同一请求重试。相同幂等标识不同内容拒绝，跨账号 origin 不转移。

同步用稳定操作 ID、基础版本和正文 hash，逐项报告 applied、already_applied、conflict、rejected 或 dependency_pending。服务端追加操作回执和变化，客户端可靠应用后才推进恢复游标。游标由服务端签发且绑定本人空间，不能通过改空间或游标读取他人记录。

`sync_object` 是经过逐类型 schema 检查的本地学习数据传输视图；身份、空间、稳定映射、版本、回执、冲突、变化和游标分别管理。它不是任意 JSON 上传接口，也不代替课程、平台作品和可信证据的完整领域表。同步引入的记录统一保留 client_reported 来源，核验历史可以保存，但不能直接写入平台 `verification_event` 或改变掌握结论。跨设备恢复的历史核验标明待复核，重新核验当前作品后才获得当前工具的真实结果。

## 实际契约

接口统一在 `/api/v1` 下，实际字段以生成的 OpenAPI 与 TypeScript 为准。

| 路径 | 用途 |
|---|---|
| `POST /auth/nonce` | 当前浏览器预认证 nonce |
| `POST /auth/register`、`POST /auth/verify-email` | 两类账号注册和一次性邮箱确认 |
| `POST /auth/login`、`GET /auth/session`、`GET /auth/csrf`、`POST /auth/logout` | 不透明会话、恢复和撤销 |
| `POST /auth/password-reset/request`、`POST /auth/password-reset/confirm` | 开发捕获邮件与一次性密码重置 |
| `POST /sync/claims`、`GET /sync/claims/{claim_id}` | 明确归属与本人恢复查询 |
| `GET /sync/spaces` | 本人已关联空间 |
| `POST /sync/spaces/{space_id}/batches` | 有逐项结果的幂等同步 |
| `GET /sync/spaces/{space_id}/changes` | 本人变化及恢复游标 |
| `GET /sync/spaces/{space_id}/conflicts` | 当前空间保留的冲突版本 |

原技术文档的 `/auth/me` 和 `/spaces/{id}/sync/...` 为设计阶段路径，实际切片统一使用上表路径；生成文件与本记录应同步更新，不维护两套写入协议。

## 验证范围与后续门

开发环境的真实 PostgreSQL HTTP 身份、归属、同步、迁移与真实桌面／移动浏览器关键流程已执行；具体检查范围、数量和环境见 [技术验证](TECHNICAL_VALIDATION.md)，页面复核与合成截图见 [前端品质记录](FRONTEND_QUALITY_REVIEW.md)。Linux GitHub Actions 状态以本次提交的远端结果为准。

本轮不能代表附件恢复、教师关系与授权、生产长期容量、完整 B03／B05／B06 或全课程验收。共享设备产品界面隔离也不等于操作系统加密，保留本机数据可被同一系统用户通过存储工具访问。开发测试采用合成账号与记录，不产生学习效果数据。

依据：[账号与数据基线](ACCOUNT_AND_DATA_DESIGN.md)、[物理与事务基线](TECHNICAL_DATA_CONTRACT.md)、[OWASP 认证](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)、[OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)、[PostgreSQL 18 锁](https://www.postgresql.org/docs/18/explicit-locking.html)。
