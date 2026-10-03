# 首个工程的依赖记录

日期：2026年10月3日。锁文件与实际安装元数据是本次开发记录，不代表未实施模块已经集成，也不代替正式分发时的许可证／NOTICE核对。

## 锁与工具链

- Web：`apps/web/package-lock.json`，React19.3／Vite8.3.2／TypeScript6.0系列；实际Node24.19.0安装、测试和构建。
- API：`services/backend/uv.lock`，CPython3.13.16、uv0.12.22；FastAPI／Pydantic2／SQLAlchemy2／psycopg3／Alembic与pytest／Hypothesis／Ruff。
- 契约工具：`packages/contracts/tooling/package-lock.json`，openapi-typescript7.13.0＋TypeScript5.9.3，应用继续TS6。隔离原因与实际验证见ADR-0007。
- PostgreSQL：本机独立18.1测试实例。开发镜像为 `pgvector/pgvector:0.8.7-pg18-bookworm` 的linux/amd64 digest `sha256:ad249f9fb9572979643a47694e59b9a8cdcdf6abc6accebf49bb80ad5f20ff9b`。仅manifest与配置已核对，Engine／向量运行未测。
- Python容器采用明确3.13.16维护版本，当前尚未构建Linux镜像；发布前应补齐镜像digest及实际镜像库存。所有CI Action已有固定提交SHA，CI中没有部署步骤。

## 直接与传递依赖元数据

完整机器记录在 [dependency_inventory.json](engineering/dependency_inventory.json)：npm条目来自实际锁文件，包含版本／license字段／dev或optional／registry integrity；Python来自实际已安装wheel的版本、license expression／classifier及项目链接。不足或缺失的字段保留null，不猜许可。

React、Router、Cytoscape、CodeMirror及构建工具按本次安装版本使用；Dexie的Apache-2.0声明保留。没有引入付费字体、商业组件许可或模型权重，没有复制参考项目的实现。系统字体只作客户端回退，仓库未包含字体文件。

锁更新须重跑受影响的类型、迁移、领域和浏览器检查；新增未安装的Agent、资料、执行及模型依赖需重新补库存。实际开源声明文件与可能要求的NOTICE随正式分发清单核对，不从当前未部署切片推导已完成全部分发审核。
