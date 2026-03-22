---
id: signals-to-rules
title: 先讲起点压力，再讲材料、取舍和规则沉淀
summary: 适合 skill、系统、方法的创建说明文，重点不是“我做了什么”，而是“规则是如何被逼出来的”。
fit_scenarios:
  - S1_from_scratch
  - S2_synthesis
  - S4_insight_loop
fit_signals:
  - 文章在解释一个 skill、系统、流程或方法是怎么长出来的
  - 读者需要知道规则来源，而不只是最终结果
  - 你手上有材料、试错、取舍和迭代过程
non_fit_signals:
  - 文章要先钉住对象定义与边界
  - 文章重点是方案选择
  - 文章只是局部改写或最后一轮收束
reader_promise: 读者会先知道为什么必须造这套东西，再知道它是如何从信号、取舍和迭代里长成规则的。
confirmation_needed_when:
  - 另一个强候选是“主张-对象-边界-机制”，而这会把创建过程降到后文
  - 用户更想写成“成熟定义文”，不想让过程成为正文主梁
---

# 先讲起点压力，再讲材料、取舍和规则沉淀

## 什么时候用

当文章最该解释的不是终态本身，而是终态为什么会这样长出来时，用这张卡。

这类稿子不该写成“这次我做了什么”。真正要交代的是：起点压力是什么，材料给了什么信号，方案空间里为什么排除了别的路，最后哪些规则被沉淀下来。

## 推荐开篇动作

第一段先讲起点压力。

第二段讲如果沿用旧办法，会卡在哪里。

第三段再把材料、方案空间和取舍抬上来。

## 推荐 H2 骨架

1. 起点压力
2. 材料与信号
3. 方案空间与取舍
4. 规则沉淀
5. 最终形态与边界

## 这张卡解决什么结构问题

它能把“过程描述”抬成“规则生成史”。读者读完之后，不只知道结果，还知道哪些规则是可复用的，哪些只是这次任务的偶然产物。

## 证据要求

- 至少给一个被排除的方案
- 至少给一个关键取舍点
- 最终规则要能回溯到前面的信号，而不是凭空出现

## 常见失败

1. 写成流水账，看完只知道做了很多事
2. 只讲最终规则，不讲它是被什么压力逼出来的
3. 方案空间一笔带过，读者看不见取舍强度

## 代表范文与短句

**例 1：[Martin Fowler《Structured-Prompt-Driven Development》](https://martinfowler.com/articles/structured-prompt-driven/)**

这篇文章的强点不是“我用了什么新方法”，而是把 prompt、spec、review loop 都写成维护中的 artefact。规则因此不是口号，而是被工作流逼出来的稳定动作。

> “The prompt is a maintained artifact.”

可借用动作：不要只说“我们形成了一套方法”，要写清楚哪种 artefact 在变、谁在维护、如何回写规则。

**例 2：[Anthropic《How we built our multi-agent research system》](https://www.anthropic.com/engineering/multi-agent-research-system)**

这篇文章先有明确压力，再有系统形态，最后才落成可复用原则。它写的不是“我们做了一个系统”，而是“为什么这套角色分工被逼出来”。

> “The essence of search is compression”

可借用动作：先写起点任务和压力，再写分工与取舍，最后把规则单列出来，不要反过来。

## Mini Reverse Outline

以 Anthropic 的 multi-agent 研究系统文章为例：

1. 开场先交代起点压力，说明单 agent 方案卡在什么地方。
2. 再说明为什么旧形态不足以继续推进，而不是直接晒架构图。
3. 中段写角色分工、取舍和压缩逻辑，解释最终形态如何被逼出来。
4. 结尾把过程沉淀成可复用规则和 lessons，而不是停在 build log。
