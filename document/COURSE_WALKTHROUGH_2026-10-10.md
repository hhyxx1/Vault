# 13课程逐目标作者走查

2026-10-10，实际本机前端5176、FastAPI8000、Linux隔离执行服务8091及独立实验PostgreSQL环境；Chromium桌面单worker。耗时18.2分钟，13项课程测试全部通过，逐一遍历366核心目标。

测试显式查看并记录参考答案使用，把作者参考文件填写到真实编辑器，调用真实执行服务，核对本次固定条件，再刷新核对代码与结果恢复。每课最后图谱掌握数仍为0/核心目标数；匿名同tab租约跨完整刷新续接，每课授权次数最多2。没有以看答案后的通过认证独立掌握，也没有将作者工程走查当学生教学效果实验。

|课程|走查时课程版本|目标数|
|---|---|---|
|CS01|core-practice-0.9.0|30|
|CS02|core-practice-0.2.0|24|
|CS03|core-practice-0.2.0|30|
|CS04|core-practice-0.1.0|27|
|CS05|core-practice-0.1.0|30|
|CS06|core-practice-0.1.0|27|
|CS07|core-practice-0.1.0|27|
|CS08|core-practice-0.1.0|30|
|CS09|core-practice-0.1.0|30|
|CS10|core-practice-0.2.0|27|
|CS11|core-practice-0.2.0|27|
|CS12|core-practice-0.2.0|27|
|CS13|core-practice-0.3.0|30|

实际命令：设置VAULT_E2E_PORT=5176、PLAYWRIGHT_CHANNEL=chrome、VAULT_ALL_OBJECTIVES_E2E=1；执行 `npm --prefix apps/web run test:e2e -- course-all-objectives.spec.ts --project=chromium --workers=1`。完整输出保存于[实际日志](course-reviews/test-runs/ALL_OBJECTIVES_2026-10-10.txt)。

此前一次走查在第九课暴露匿名租约容量耗尽；已修复刷新复用及明确预算/到期续接，并重新完整运行，失败没有记成通过或学生错误。服务始终保留，必要更新仅替换后端进程。

本次不涵盖全部独立变体、两种错误/替代正确解、开放解释审阅、教师发布权限、私有RAG、模型教学质量、专业审校或完整课程深度。综合项目另有桌面/手机专项报告。CS04/CS06随后更新至0.2.0；本表不提前声称新版本通过，需追加对应新版目标与项目验证。Q0–Q5完整交付仍0/13。

## 更新版本追加核验

CS04/CS06切换0.2.0后分别完整走查27目标，2项测试/54目标通过，用时2.7分钟，日志见course-reviews/test-runs/UPDATED_OBJECTIVES_2026-10-10.txt。连同前述其余11门，本轮当前默认版本366目标均实际核对过；不把重复的54次执行计为新增目标。新综合任务另有桌面/手机10项通过，处理器首尾键盘及截图2项通过。完整内容/评估/审校门槛未改变。
