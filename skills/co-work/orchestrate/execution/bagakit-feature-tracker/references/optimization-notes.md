# Feature Tracker 优化记录

本页记录技能维护中已经验证的通用问题、取舍和反例；它不是需求或运行时
真相，契约与当前 reviewed Task plan 仍是唯一权威。

## 区分启动输入、最终证明与失败路径

一个 Task 可能既包含当前即可完成的调查，又包含必须绑定最终候选或固定
快照的签收证明。若不区分，最终证明条件会被误当成调查启动门槛。计划审查
现在要求 Owner 分别检查“现在开工需要什么”和“最终签收需要什么”；必要时
拆成独立调查 Task 与最终 join，且不降低不可变证据要求。

失败节点也要区分两种情况：仍未安装 successor 的失败节点需要重规划；
已经有 successor、且后续工作可继续的失败节点是已处理的历史分支。
正常依赖等待只展示等待原因，不反复触发 `review_required`；未处理的
failed/cancelled 路径才触发该信号。历史与当前阻塞通过现有 supersession
lineage 和派生 frontier 区分，不新增状态或 review cache。

## 验证配置错误的诊断边界

`kind=command` 的 `ref` 是命令文本；`kind=artifact` 才是文件证据。把
`package.json` 写成 command 会让代码测试通过而 gate 失败，属于 Tracker
配置错误，不是产品代码回归。Tracker 对明确的 `package.json` 误配给出类型化
错误和修复方向，不猜测包管理器，也不执行任意文件来“判断”它是否可运行。
命令拼写、工具缺失、环境故障和普通测试失败都在原 Task 内修复。环境修复
无需改计划；失败 gate 后可通过 reviewed revision 只纠正 command ref，保留
原有证明义务，再运行纠正后的 gate。只有证据推翻方案假设才进入 failed 与
successor 路径，不能为了修改一条命令而伪造失败假设。

## 候选漂移与执行空转

FlowLens 的近期执行记录显示，主要浪费发生在控制面：同一类昂贵 gate
跨旧 SHA 重复运行、远程观察没有截止时间、handoff 与 Tracker revision
漂移，且大 Task 同时承载诊断、发布、路由、合并和 closeout。此前的
`last_gate_commands` 只绑定命令文本，不能发现同一分支已经换了 HEAD。

候选绑定阻止旧证明覆盖新内容，但把整个 plan revision 放进失效键又会误伤
无关 Task 的有效证明。现在按当前 Task 的语义、依赖、验证输入、命令、证明
策略及本地候选判断复用；原 revision 只保留为出处。相同本地 fingerprint 的
pass 可复用；相同 fingerprint 的失败仍需要显式重跑理由。外部输入继续由
Task artifact receipt 负责，不能把本地 fingerprint 当作完整环境快照。

执行侧的收敛点是可恢复的结果：当前 Task、有效证据、剩余验收和下一步。
正常等待有完成信号和观察边界，到界即停止轮询并保留恢复条件，不强行 fail
或改计划。换人执行不使证据失效，也不需要 lease、身份协议或强制 Flow
Runner；一个 session 可以推进多个就绪 Task。

拆分大 Task 时也容易矫枉过正：测试、review、发布、浏览器验收、MR 是流程
步骤，未必是独立交付结果。仅在产物、oracle、依赖或恢复边界可以独立关闭时
拆分；Task 与 commit/MR 不要求一一对应。进展报告优先说明离目标还缺什么，
revision、gate 次数和执行者活动只用于诊断。
