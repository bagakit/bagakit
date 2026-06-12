# Fixture：约束作用域泄漏

## 输入情境

一个 Feature 的目标是“整体减少系统熵，同时保持功能正确”。计划草稿把它改写成：每个 Task 在自己的代码范围内都必须 `deleted_lines > added_lines`。某个 Task 为修复真实行为增加少量生产代码和最小验证，因此局部 diff 为正。

## 错误结果

执行器把局部净删不满足直接记为 `blocked`，整个 Feature 看起来无法继续；但没有检查 Feature 累计结果，也没有确认该限制是否是用户硬约束。该节点实际上仍有可执行恢复，`block` 分类错误。

## 期望判定

- 识别为 **constraint leakage / over-constrained decomposition**。
- 将“整体净减”保留为 Feature 级目标或 review 信号。
- 保持 Task `active`，或在门禁假设被证伪时标记 `failed` 并安装 successor plan；不得伪装成资源或依赖 blocker。
- 最终由 Feature 级 join 验证功能正确性、公共契约和整体熵变化。

## 回归断言

1. 计划检查清单先询问每条限制属于 Feature 还是 Task、是硬规则还是目标。
2. 局部代理指标失败不会自动产生 `blocked`。
3. 如果局部正确改动达不到目标，计划必须写清继续、修复还是升级复核。
4. 约束例外必须留下原因、影响范围和 Feature 级补偿证据。
