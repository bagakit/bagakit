# Feature Tracker 优化记录

本页记录技能维护中已经验证的通用问题、取舍和反例；它不是需求或运行时
真相，契约与当前 reviewed Task plan 仍是唯一权威。

## 区分启动输入、最终证明与失败路径

一个 Task 可能既包含当前即可完成的调查，又包含必须绑定最终候选或固定
快照的签收证明。若不区分，最终证明条件会被误当成调查启动门槛。计划审查
现在要求 Owner 分别检查“现在开工需要什么”和“最终签收需要什么”；必要时
拆成独立调查 Task 与最终 join，且不降低不可变证据要求。

失败节点也要区分两种情况：仍未安装 successor 的失败节点是停滞的重规划
入口；已经有 successor、且后续工作可继续的失败节点是已处理的历史分支。
两者都保留 `failed` 历史，但投影文案不能都叫“待重规划”。这不新增状态机，
只使用现有 supersession lineage 和派生 frontier。

## 验证配置错误的诊断边界

`kind=command` 的 `ref` 是命令文本；`kind=artifact` 才是文件证据。把
`package.json` 写成 command 会让代码测试通过而 gate 失败，属于 Tracker
配置错误，不是产品代码回归。Tracker 对明确的 `package.json` 误配给出类型化
错误和修复方向，不猜测包管理器，也不执行任意文件来“判断”它是否可运行。

## 候选漂移与执行空转

FlowLens 的近期执行记录显示，主要浪费发生在控制面：同一类昂贵 gate
跨旧 SHA 重复运行、远程观察没有截止时间、handoff 与 Tracker revision
漂移，且大 Task 同时承载诊断、发布、路由、合并和 closeout。此前的
`last_gate_commands` 只绑定命令文本，不能发现同一分支已经换了 HEAD。

因此 gate receipt 现在额外绑定候选 HEAD、tracked diff digest、验证文件
digest、计划 revision 和 dedup key。相同本地 fingerprint 的 pass 可复用；相同
fingerprint 的失败需要 `--rerun --rerun-reason <reason>`，理由写入 Feature
history。外部输入仍由 Task artifact receipt 负责。这些是 execution evidence，
不是 Goal 或 reviewed Task 语义；候选变化后必须在新候选上重新 gate。

计划侧保持轻量：每个执行 session 只承载一个 Task、一个 owner、一个 close
condition 和一个 bounded wait；昂贵外部动作前先做低成本、生产形状的反例或
preflight；两次 bounded checkpoint 没有代码、Tracker、artifact、runtime 或
blocker 不确定性变化时，若没有仍在 deadline 内的 active wait，先做 bounded
convergence review，再决定 revise、block、fail 或 transfer。Tracker 不新增
调度器或第二套 session 状态。
