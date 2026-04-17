---
id: compare-options-make-decision
title: 先给决策结论，再解释标准、比较和取舍
summary: 适合方案、架构或策略文，先告诉读者结论是什么，再解释标准和 tradeoff。
fit_scenarios:
  - S1_from_scratch
  - S2_synthesis
  - S6_final_polish
fit_signals:
  - 文章在多个候选方案之间做选择
  - 读者真正关心的是“该选哪个”
  - 需要同时交代标准、比较与残余风险
non_fit_signals:
  - 文章更像对象定义文
  - 文章更像失败诊断文
  - 文章重点是创建过程和规则沉淀
reader_promise: 读者会先知道推荐结论，再知道标准、比较逻辑、代价和触发条件。
confirmation_needed_when:
  - 另一个强候选是“样本归纳到判断”，而这会让开头先讲材料而不是结论
  - 用户更想写成“为什么这个对象值得这样理解”，而不是“该怎么选”
---

# 先给决策结论，再解释标准、比较和取舍

## 什么时候用

当文章最终要驱动一个选择时，用这张卡。

这类稿子最怕把选项都介绍完了，读者还不知道作者推荐什么。结论必须前置，否则后面的比较全是悬空信息。

## 推荐开篇动作

第一段直接给推荐。

第二段交代决策标准，说明为什么用这些标准，而不是别的标准。

第三段再进入选项比较，不要反过来。

## 推荐 H2 骨架

1. 决策结论
2. 决策标准
3. 候选比较
4. 为什么选这个
5. 代价、边界与下一步

## 这张卡解决什么结构问题

它能把“方案介绍”压成“可执行决策”。读者读完后，知道该怎么选，也知道在什么条件下要改选。

## 证据要求

- 标准必须能解释最终推荐，不要写成装饰
- 至少列出一个没选方案的真实优势
- 必须给出触发换挡的条件

## 常见失败

1. 选项介绍很全，但作者自己的结论太晚
2. 标准写成人人都同意的空话，无法真正区分候选
3. 只有推荐，没有边界，读者不知道什么时候不该照做

## 代表范文与短句

**例 1：[Anthropic《Building effective agents》](https://www.anthropic.com/engineering/building-effective-agents)**

这篇文章的决策动作非常清楚：先给推荐，再解释什么时候该上 workflow、什么时候才该上 agent。读者先拿到方向，后面比较才不是悬空信息。

> “finding the simplest solution possible”

可借用动作：第一屏先写推荐，再写换挡条件，不要先把所有方案平铺再给结论。

**例 2：[Our World in Data《Many of us can save a child’s life, if we rely on the best data》](https://ourworldindata.org/cost-effectiveness)**

这篇文章先把 stakes 写明：不是“做不做善事”，而是“同样的投入差得可以非常远”。后面的数据比较因此都在服务一个明确决策。

> “their cost-effectiveness varies immensely.”

可借用动作：先把决策后果说清，再给比较维度和证据链，避免把正文写成信息展板。

## Mini Reverse Outline

以 OWID 这篇 cost-effectiveness 文章为例：

1. 开场先把决策 stakes 写明，不让比较变成“多看一些信息”。
2. 很快说明核心推荐和比较对象，让读者知道本文在帮谁选。
3. 再交代标准、数据口径和为什么这些标准足够区分候选。
4. 中段按标准推进比较，末段补不确定性和残余边界。
