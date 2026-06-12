# Fixture：需求 provenance 与无证据重规划

## 输入情境

用户只确认了一个可验收的行为。Agent 的详细计划额外加入了架构迁移、
更高质量门槛和一条并非必要的依赖。第一次执行没有产生新的失败证据，
Agent 却在多个版本的计划之间来回切换。

## 错误结果

Tracker 把这些计划假设直接物化成 reviewed Task，或者允许没有新假设、
新依赖、候选变化或验收变化的计划修订继续执行。结果是用户目标、Task
验收和 Agent 自己的计划互相竞争，反复重规划看似有审查记录，却没有新
的判别证据。

## 期望判定

- 将原始行为保留为 Goal/Feature acceptance。
- 将架构、额外质量门槛和非必要依赖标为 **derived plan hypothesis**，
  除非通过 reviewed Feature 路径显式提升。
- 在计划发布前检查 outcome、invariants、non-goals、authority、环境假设
  和 closure oracle 是否一致。
- 只有用户确认、被证伪的假设、依赖/候选/闭合 oracle 变化，才允许产生
  新的 plan revision；没有变化时转 Supervisor 或 Grill。

## 回归断言

1. 计划 admission 明确区分四类 requirement provenance。
2. Agent 自行添加的要求不会仅因出现在 draft 中而变成 acceptance。
3. 无新证据的重复 revision 不会被当作进展或新的 Task 状态。
4. 最后有效的 reviewed plan 和证据仍可恢复，未决冲突有明确 handback。
