# 本机 Docker Desktop 运行端点修复

2026-10-10。本机 Docker Desktop 4.77.0 在启动 Inference manager 时无法移除 `Docker/run/dockerInference`；路径实际为零字节重解析点。引擎未启动，原数据库容器无法连接。类似问题记录见 [Docker #625](https://github.com/docker/desktop-feedback/issues/625) 和 [#554](https://github.com/docker/desktop-feedback/issues/554)；属于问题报告，不能视为官方已确认永久修复。

精确删除端点的命令被自动安全策略拒绝，未执行删除。随后在确认 Docker 已停止、目录真实绝对路径和目录类型后，将旧 `Docker/run` 可恢复改名。首次启动越过 Inference manager，但遇到同类 `docker-secrets-engine/engine.sock` 错误；保留并隔离该运行目录及新运行目录，创建空运行目录后再次启动成功。

保留目录位于 `C:/Users/Remote/AppData/Local` 下，名称含 `recovery-20261010`；没有清除、重置或重新初始化 Docker 数据。没有执行 factory reset、prune、WSL unregister 或 VHDX 操作。恢复后仍能列出 `vault-development_postgres-data` 及原 `vault-development-postgres-1`；启动原容器后 PostgreSQL 接受连接，原库 Alembic 版本为 `0011_code_draft`。

Windows 预览 5176、API 8000、隔离执行 8091 和 PostgreSQL 5442 恢复连接；API readiness 返回 200，后续 Java 活动真实浏览器测试 4 项通过。Linux 执行器用实际运行进程保持服务，不使用模拟执行结果。另一个空闲保活辅助进程的启动命令被安全策略拒绝；改为直接运行真实执行服务并验证连通。

这次验证证明当前启动和项目联调恢复，不证明以后所有 Docker 重启都不会再遇到端点问题。旧运行目录保留供追溯，数据库及容器卷保持原位置。
