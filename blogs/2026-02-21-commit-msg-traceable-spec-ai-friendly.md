# Commit Msg 作为可追溯 Spec：从 AI Friendly 到 Agent 原住民协作

## 摘要

在多 Agent 协作成为常态后，`git diff` 只告诉我们“改了什么”，却很难回答“为什么改、边界在哪里、下一手该从哪接”。  
如果 commit message 仍停留在一句话摘要，历史就会退化成不可追溯的碎片。

这篇文章讨论一个更务实的目标：

> 把 commit message 提升为可检索、可校验、可接力的 Spec 单元，让任何 Agent 在接手时都能快速恢复上下文。

核心观点很简单：  
**好的 commit 不是“写得漂亮”，而是“能形成未来故事线的最小可执行证据包”。**

## 问题本质：历史里缺的不是代码，而是意图

很多仓库在代码层面并不混乱，但交接依然慢，原因通常有三类：

1. 粒度失真：一个 commit 混了多个意图，回滚边界不清。  
2. 语义缺失：message 只有结果，没有目标、状态和验证证据。  
3. 链路断裂：commit 与 task/spec/skill 活动没有稳定映射。

在人类协作里，这些问题靠口头补充还能勉强兜底；在 Agent 协作里，会直接变成上下文重建成本。

## 先定义：什么叫 AI Friendly 的 commit

对 Agent 友好的 commit，至少要满足三件事：

1. 可检索：机器能稳定解析关键信息。  
2. 可推断：读完 message 就能判断当前状态与下一步。  
3. 可接力：新 Agent 不依赖作者记忆也能继续推进。

这决定了 commit message 不该只是“叙述文本”，而应是“结构化 Spec + 人类可读解释”的组合。

## 故事线模型：从单点提交到长期演进

要形成未来可追溯故事线，可以把历史看成三层：

1. Episode（单个 commit）  
一个明确意图 + 明确验证 + 明确回滚边界。
2. Arc（一组 commit）  
围绕同一 task/spec 的阶段推进（如 structure -> behavior -> test/docs）。
3. Saga（长期演进）  
跨迭代的能力建设主线（例如 skill 演进、规范升级、基础设施收敛）。

当每个 commit 都是可解析的 Episode，Arc 与 Saga 才能被自动重建。

## 粒度原则：一条 commit 只表达一个可回滚意图

推荐的最小门槛：

1. 一个行为意图（不要混 unrelated concern）。  
2. 一个回滚边界（revert 时影响可预测）。  
3. 一组验证证据（命令、检查结果或明确理由）。  

如果不满足这三条，就不应提交，或应先拆分。

## 拆分顺序：先结构，再行为，后验证与叙述

实操中，最稳定的拆分顺序通常是：

1. 结构/机械层（重命名、目录、脚手架、无行为变化）。  
2. 行为变更层（功能/修复主逻辑）。  
3. 验证与说明层（tests、docs、spec 对齐、收口）。

这样做的价值：

- review 成本更低：每个 commit 的检查焦点单一。  
- 失败恢复更快：能精准回退到某一层。  
- Agent 接手更顺：可按层恢复上下文，而不是在混合 diff 中猜意图。

## Commit Msg 设计：把 message 写成“可解析 Spec”

推荐结构：

1. Subject：`<type>(<scope>): <summary>`  
2. TOML frontmatter：稳定键、稳定值模式。  
3. GFM body：面向人类的“目的-状态-变更-验证-上下文”解释。

下面是一个可落地样例（节选）：

```text
refactor(commit-spec): switch to semantic driver keys and TOML frontmatter

+++
schema = "bagakit.commit-spec/v2"
kind = "commit_message_spec"
generated_at = "2026-02-21T10:00:00Z"
session = "2026-02-21-commit-spec-migration"
goal_target = "reduce workflow-coupled metadata keys"
goal_status = "complete"
goal_completion = "driver_* migrated to driver+driver_meta; docs/tests updated"
driver = "ftharness"
driver_meta = "feat=f-20260221-audit-fixes-tests; task=T-001; status=done; completion=1/1"
activity_brainstorm = "none"
activity_spec = "meta schema upgraded to v2"
activity_skill = "bagakit-git-commit-spec + bagakit-skill-maker"
activity_docs = "README/SKILL/references updated"
module_count = "3"
+++

## Purpose
- Make metadata contract semantic-first and standalone-safe.

## Goal Status
- Target: reduce workflow-coupled metadata keys
- Status: complete
- Completion: driver_* migrated to driver+driver_meta

## Changes by Module
- **scripts** (commit-spec)
  - Change: draft/lint parser migrated from YAML-like keys to TOML + semantic driver keys.
  - Key refs: scripts/bagakit-git-commit-spec.py:520

## Validation
- bash scripts_dev/test.sh

## Driver Context
- Driver: ftharness
- Driver-Meta: feat=f-20260221-audit-fixes-tests; task=T-001; status=done; completion=1/1

## Knowledge Activities
- Brainstorm: none
- Spec: meta schema upgraded to v2
- Skill: bagakit-git-commit-spec + bagakit-skill-maker
- Docs: README/SKILL/references updated
```

## Agent 原住民视角：哪些信号最关键

在 Agent 接手场景里，下面几类信号最有价值：

1. `goal_*`：目标与完成态，不用反推。  
2. `driver/driver_meta`：与上游执行系统对齐，但保持通用键，避免硬耦合。  
3. `activity_*`：明确这次提交是否涉及 brainstorm/spec/skill/docs。  
4. `module_count + key refs`：快速定位关键文件与阅读入口。  
5. `validation`：让“是否可信”可复现，而不是靠语气判断。

注意一个原则：  
**强调 skill/spec，不等于把 message 绑死在某个系统键名上。**  
语义通用键 + 可解析元数据，才是真正可迁移的 Agent-native 设计。

## 如何让“任何 Agent 接手都快”

可以把接手过程设计成 3 个时间档：

1. 30 秒：看 subject + `goal_status` + `driver`，判断这条 commit 在故事线中的角色。  
2. 5 分钟：看 `Changes by Module` + `Validation`，判断是否可继续推进。  
3. 30 分钟：按 `session/spec/task` 串联相邻 commits，恢复 Arc 级上下文。

如果这三档都能走通，说明你的 commit 历史已经具备“交接即运行”的能力。

## 反模式（高频踩坑）

1. 一次提交混合行为变更、重构、测试、文档且无拆分。  
2. frontmatter 键按系统无限扩张（`driver_xxx` 泛滥）。  
3. 只写“done/fix/update”，不写目标与完成边界。  
4. 没有验证证据，或证据不可复现。  
5. 关键变更没有 `path:line` 引用，接手者只能全文搜索。

## 一个落地清单

在团队内推行时，可以先只做这 6 条：

1. 强制 subject 语法。  
2. 强制结构化 frontmatter（推荐 TOML）。  
3. 强制 `Goal Status` + `Validation` 两节。  
4. 强制每条 commit 至少一个 `Key refs`。  
5. 约束拆分顺序（structure -> behavior -> test/docs）。  
6. 让 lint gate 失败即拒绝提交。

这 6 条足以让历史从“可读”提升到“可接力”。

## 结语

面向 AI Friendly 协作，commit 的价值已经从“记录变更”升级为“承载可追溯 Spec”。  
当 commit 粒度稳定、拆分有序、message 结构化且可校验时，仓库会自然长出一条可复盘、可接手、可自动重建的故事线。

最终目标不是写更长的 message，而是让任何 Agent 在最短时间内回答三个问题：

1. 这一步想达成什么？  
2. 现在达成到哪一步？  
3. 我下一步该接哪里？

能稳定回答这三个问题，才是“可追溯历史”真正的完成态。
