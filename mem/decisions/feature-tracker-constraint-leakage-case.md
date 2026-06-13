# Feature Tracker：局部约束泄漏案例

## 案例

FlowLens 的减熵 Feature 把“整体结果必须净减”误写成了“每个 Task 在自己的代码范围内都必须删得比加得多”。执行到 T-014 时，正确实现需要增加少量生产代码和验证代码，因此被局部净删门禁判为 `block`。这个 `block` 不是产品、依赖或资源不可用，而是计划分解时把 Feature 级目标错误提升成了 Task 级不可违背条件，阻止了本来应继续推进的路径。

## 现象名称

- **约束泄漏（constraint leakage）**：上层目标或评价指标未经授权地泄漏到下层边界，改变了下层工作的可行域。
- **过度约束分解（over-constrained decomposition）**：拆分任务时，把“整体必须满足”的约束复制成“每个节点都必须满足”的约束。
- **局部最优门禁造成的全局失败**：门禁优化了局部代理指标，却拒绝了能完成真实目标的整体方案。

## 为什么会出现

1. 计划没有标注约束的作用域（Feature、Task、commit 或验证步骤）。
2. “熵减”被当成了单一可计算指标，而不是带有功能正确性优先级的目标函数。
3. Tracker 把失败的门禁结果直接映射为 blocker，没有区分“真实不可执行”与“当前门禁假设不适用”。
4. 分解时只传递了约束文本，没有传递例外条件、优先级和升级路径。
5. 缺少一个整体收敛检查：局部节点的增量是否由删除重复职责、恢复正确行为或 Feature 级净减所抵销。

## 避免方式

### 计划层

- 为每条约束记录 `scope`（Feature / Task / commit / gate）和 `strength`（hard / target / review）。
- 将“整体净减”设为 Feature 级目标或 review 信号；只有明确写入 Task acceptance 的约束才是 Task 硬门禁。
- 在拆分时保留“允许局部增量”的条件：功能正确性、边界收敛、必要测试和删除重复 owner 可以使单个节点暂时增量。
- 对共享热点或不可拆分的正确性修复，使用一个拥有完整边界的 Task；不要为了满足局部行数指标再切碎。

### 执行与门禁层

- `block` 仅表示当前授权范围内没有可执行恢复，不能把“指标未达标”自动当作 blocker。
- 门禁失败但仍有可行修复时保持 `active`；若门禁假设被证伪，标记 `failed` 并重规划，而不是伪装成资源 blocker。
- 同时检查 Task 局部 diff 和 Feature 累计 diff。局部 `+` 必须说明被哪项正确性或去重收益抵销，最终由 Feature 级 join 验证。
- 在 claim/finish 前运行一次约束作用域审查：该限制来自用户要求、Feature 目标、Task acceptance，还是 Worker 自行推断。

### 监督层

- Supervisor 发现局部门禁阻塞整体路径时，先回到约束来源和作用域，不能要求 Worker 通过增加删除量来“冲绿”。
- 允许在不改变用户目标的前提下豁免局部净删，但必须留下理由、影响范围和 Feature 级补偿证据。
- 将类似事件加入 review 反例库，优先修正计划模板和门禁语义，避免靠口头提醒重复修复。

## 适用边界

这不是放松所有门禁的理由。安全、数据正确性、公共契约、权限和资源上限等约束仍可在 Task 级设为 hard；可调整的是把 Feature 级优化目标误当成每个节点的硬阻塞条件。最终验收应证明真实行为与整体目标，而不是证明每个局部代理指标都单独最优。

## 关联证据

- FlowLens session：`flowlens/.codex/history.jsonl`，2026-09-14 附近关于 T-014 blocker 与“整体熵减、局部豁免”的讨论。
- Feature Tracker 计划塑形：`skills/co-work/orchestrate/execution/bagakit-feature-tracker/references/plan-shaping/granularity.md`。
- Feature Tracker blocker 语义：`docs/specs/feature-tracker-contract.md` 的“Failure, blocking, and replanning”。
