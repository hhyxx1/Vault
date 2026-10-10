# 数据实验运行环境

2026-10-10。显式语言标识 `python313ml`，页面显示「Python 3.13 · 数据实验」。普通Python环境及历史作品不自动迁移。环境标识 `python313ml-isolate-dev@0.1.0` 写入执行结果。

Linux x86_64 独立工具链固定 Python 3.13.16、NumPy 2.3.3、SciPy 1.16.2、scikit-learn 1.7.2、joblib 1.5.2、threadpoolctl 3.6.0。五个二进制 wheel 的官方 PyPI SHA256 写入 `tools/execution/ml-requirements.lock`；安装器要求 hash、禁止源码包与隐式依赖下载，安装到独立目录。拒绝覆盖已有不匹配环境，未修改普通Python包或绕过其受管环境保护。

部署者先提供已有普通3.13.16工具链，再在专用Linux执行机运行 `tools/execution/install_ml_profile.py`，之后加载新版执行worker。Windows开发机通过WSL执行服务使用该环境；不是Windows本机直接运行科学包。环境更新必须创建新profile及课程版本，重跑工件验证；不能改写历史记录对应的版本。

串行CPU：BLAS/OpenMP各1线程，joblib多进程关闭。实际隔离环境不允许创建共享内存信号量；此小规模教学profile明确采用串行，而非隐藏警告或取消隔离。保持既有CPU 5秒、墙钟10秒、内存512MiB、进程32等限制；学习作业不能安装包、联网下载数据或获得worker密钥。大型训练、GPU及任意第三方包不在此profile能力范围。

实际隔离测试检查五库可导入版本、训练均值填补、回归拟合与预测、线程限制、worker密钥不可见。模型依赖升级、长期并发容量、其他CPU架构和GPU尚未验收。

这些依赖通过安装器下载，不将第三方库源码复制进课程。发布执行镜像时保留所安装发行包的许可证/NOTICE；本锁文件与版本信息不是第三方授权条款的替代。课程脚本和合成数据为本项目原创。
