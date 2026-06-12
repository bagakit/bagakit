---
id: problem-misjudgment-mechanism-fix
title: 先钉住真正问题，再拆误判、机制和修复
summary: 先说清问题不是表面现象，再解释常见误判、失效机制和修复路径。
fit_scenarios:
  - S1_from_scratch
  - S2_synthesis
  - S5_rewrite
fit_signals:
  - 文章在解释一个失败模式、诊断结论或复盘后的规则
  - 读者最需要的是“问题到底出在哪里”
  - 文稿要纠正一种流行但错误的理解
non_fit_signals:
  - 文章重心是系统对象定义
  - 文章重心是多个方案之间的选择
  - 文稿只是终稿收束或语气打磨
reader_promise: 读者会先知道真正的问题是什么，再知道常见误判为什么会害人，以及正确修复路径是什么。
confirmation_needed_when:
  - 另一个强候选是“对象定义与边界”，而这会让问题诊断退到后文
  - 用户显式想写成“我的观点稿”，而不是“问题诊断稿”
---

# 先钉住真正问题，再拆误判、机制和修复

## 什么时候用

当文章的价值主要来自纠错，而不是来自介绍对象时，用这张卡。

这类稿子通常面对一种已经存在的误判。正文应该先告诉读者“真正的问题是什么”，而不是先讲一大段背景。

## 推荐开篇动作

第一段写清主诊断。

第二段指出最常见的误判或表面解释。

第三段开始拆机制，说明为什么这个误判会稳定地产生错误动作。

## 推荐 H2 骨架

1. 真正问题
2. 常见误判
3. 失效机制
4. 修复动作
5. 边界与代价

## 这张卡解决什么结构问题

它能让文章直接进入 stakes。读者会先知道该防什么错，再去看细节。

## 证据要求

- 至少给一个具体失败场景
- 至少说明误判为什么看起来像对的
- 修复动作后面要跟条件、代价或边界

## 常见失败

1. 一上来先介绍背景，三段以后读者还不知道问题是什么
2. 把误判写成情绪化吐槽，而不是对象失败模式
3. 给了修复动作，却没解释为什么这能修掉上面的机制

## 代表范文与短句

**例 1：[Simon Willison《Hallucinations in code are the least dangerous form of LLM mistakes》](https://simonwillison.net/2025/Mar/2/hallucinations-in-code/)**

这篇文章一开头就反转读者最常见的恐惧：真正的问题不是“模型会瞎说”，而是人会不会在错误位置放过检查。误判、机制和修法的顺序都很干净。

> “Hallucinations in code are the least harmful hallucinations”

可借用动作：先改写错误直觉，再把真正风险落到动作链和检查位点上。

**例 2：[Asterisk《Debugging Tech Journalism》](https://asteriskmag.com/issues/06/debugging-tech-journalism)**

这篇文章不是空泛抱怨“报道不好”，而是拆出 lead、context、startup frame、scandal frame 这些具体失效点。诊断因此能往下走到结构修复，而不是停在情绪判断。

> “A lead needs to accomplish two things”

可借用动作：先给症状，再拆冲突目标和失效机制，最后再给修复动作。

## Mini Reverse Outline

以 Simon Willison 这篇 LLM 文章为例：

1. 开头先反转默认恐惧，指出大家盯错了风险对象。
2. 紧接着说清真正的问题落在什么动作链上。
3. 中段解释这个误判为什么诱人，以及它如何稳定地产生坏后果。
4. 结尾把诊断收成一套更可靠的检查姿势和行动建议。
