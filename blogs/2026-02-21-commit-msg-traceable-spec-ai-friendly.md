# Commit Message 应该写成可追溯 Spec，Agent 交接才不会退化成考古

凌晨接手一个仓库时，真正危险的情况常常是上一条提交只留下 `refactor: cleanup`。`git diff` 能告诉你文件改了什么，却不会告诉你这次改动想完成什么、已经完成到哪一步、下一手还能不能直接继续。接手方只能从目录、变量名和测试结果里倒推上下文，这一步本质上是在做考古。

在多 Agent 串行协作里，commit message 已经是一份稳定的 handoff artifact。它最靠近代码，又最稳定地跟着 hash 一起流转。只要发生一次交接、一次 cherry-pick、一次回滚，这条 message 就要承担“让后来者继续执行”的职责。

这也是现在必须重写 commit message 习惯的原因。代码评审越来越依赖机器检索和自动化回放，作者在线解释的时间越来越短，真正能长期留在仓库里的信号只剩提交本身。如果 message 还停留在 `fix bug`、`update docs` 这一层，协作成本会直接转移到交接和故障恢复。

## 一条提交先回答一个可回滚意图

一条提交先要说清一个判断：这次改动究竟要完成什么。这个判断越单一，回滚边界越清楚，交接成本越低。把结构调整、行为变更、文档更新塞进同一条提交，短期看像是省事，长期看会让任何一次定位都变成拆炸弹。

所谓“单一可回滚意图”，至少要让提交回答三件事：目标是什么，状态到哪一步，下一步能不能直接继续。上一位作者离线后，接手 Agent 只看到 `fix bug`，就无法判断这是临时止血、根因修复，还是只补了一层验证。这个不确定性会传导到 review、回滚和后续分支合并。

具体失败模式通常很朴素。一次提交里同时混入目录挪动、核心逻辑改写和文档更新，reviewer 很容易把它当成“清理型提交”。真正出故障时，回滚动作却会连无关改动一起带走。提交边界写轻了，恢复边界也会跟着模糊。

同样一次 semantic driver key 迁移，坏 handoff 只会留下 `refactor: cleanup`。接手方 30 秒后仍然答不出三件事：这次迁移是否已经完成，下一步该继续拆还是先复核，回滚会不会误伤别的字段。好 handoff 至少会把 `goal_status`、`goal_completion` 和 `Validation` 写出来，让接手方在同样 30 秒内判断自己该继续、暂停还是回滚。

## 结构让这条意图能被人和机器继续消费

建议采用 `Subject + TOML frontmatter + GitHub Flavored Markdown body` 这种结构，因为它把三类信号分开放稳。`Subject` 负责让人一眼看出这条提交扮演什么角色，frontmatter 负责机器检索，正文负责把机制、证据和下一步动作串起来。结构一旦稳定，交接和检索就不必每次从自然语言里重新猜。

```text
refactor(commit-spec): migrate metadata keys to semantic driver fields

+++
schema = "bagakit.commit-spec/v2"
kind = "commit_message_spec"
session = "2026-02-21-semantic-driver-key"
goal_target = "reduce workflow-coupled metadata keys"
goal_status = "complete"
goal_completion = "driver_* replaced by driver + driver_meta"
driver = "ftharness"
driver_meta = "feat=f-20260221-audit-fixes-tests; task=T-001; status=done"
module_count = "3"
+++

## Validation
- bash scripts_dev/test.sh
```

这套结构的价值不在于“信息更多”，而在于“信息各归其位”。`goal_status`、`goal_completion` 说明完成态，`driver`、`driver_meta` 说明上游上下文，`Validation` 和 `Key refs` 给出继续追索的入口。执行器从 A 切到 B，甚至从人工切到 Agent，只要这些字段的语义不变，历史提交仍然可检索、可汇总、可回放。

如果 frontmatter 写成一堆流程私有键，问题会很快出现。工作流一改，解析协议就得跟着重写，旧提交会立刻变成半失效档案。消息结构本来是为了保留上下文，最后却跟着流程一起老化，这就失去了“可追溯”的价值。

## 拆分顺序会直接改变 review 和故障恢复

对混合风险变更，最稳妥的默认顺序是 `structure -> behavior -> test/docs`。第一层先隔离目录、命名和语义映射，reviewer 可以快速确认“没有行为变化”。第二层再看运行时逻辑，故障定位会短很多。第三层补测试和文档，交付证据才完整。

| 层次 | 这条提交回答什么 | 最重要的检查点 |
| --- | --- | --- |
| `structure` | 名称、目录、语义映射是否整理完成 | 是否保持行为不变 |
| `behavior` | 运行时逻辑是否改变 | 变更范围是否单一 |
| `test/docs` | 证据和说明是否补齐 | 验证是否足够支撑结论 |

一个常见误判链条是这样的：问题出在行为改动，提交却先把目录挪动和逻辑修改绑在一起。reviewer 只能整体看过，无法快速圈定风险。回滚时又把无关的文档和测试一起撤掉。把顺序拆开以后，问题、误判、后果、修复都能落在不同层里，排查成本会明显下降。

这套顺序适合大多数混合风险变更。一个只改文案的微小提交，或者必须先止血的紧急修复，完全可以压缩层次。关键在于让每条提交的回滚边界和验证边界保持清楚，不要机械复刻三段式。

## 门禁与归档会把写法变成系统行为

规范只有进入门禁，才会从“写得好的人偶尔会做”变成稳定流程。单靠口头约定，message 质量往往会在几轮提交后回到最省力的写法。把 `lint-message`、验证命令和归档证据放进同一条提交流程，才能把结构约束变成默认动作。

```bash
sh scripts/bagakit-commit-craft.sh init --root . --topic "semantic driver key migration"
sh scripts/bagakit-commit-craft.sh draft-message --root . --dir .bagakit/commit-spec/2026-02-21-semantic-driver-key --split split-01
sh scripts/bagakit-commit-craft.sh lint-message --message .bagakit/commit-spec/2026-02-21-semantic-driver-key/draft-refactor-commit-spec.txt
bash scripts_dev/test.sh
```

这条流程最终要稳定住五个检查点：`Subject` 采用 `<type>(<scope>): <summary>`，frontmatter 明确 `goal_status` 和 `goal_completion`，正文给出 `Validation` 与关键路径引用，拆分顺序遵循 `structure -> behavior -> test/docs`，归档记录里带上 commit hash 和检查证据。少掉其中任一项，交接链路都会出现盲点。

归档的价值，在于把“这条提交后来到底好不好接手”变成可复盘事实。最小记录甚至不需要复杂格式，下面这类回放样本就足够开始周度抽样：

```text
replay_owner=agent-oncall
replay_duration_min=7
entry_path=.bagakit/commit-spec/2026-02-21-semantic-driver-key
blocked_step=missing_goal_completion
fix_commit=abc1234
```

这里真正值得盯的是两个结果。第一，交接重建时长，也就是接手方从打开提交到能说明目标、状态和下一步所花的时间。第二，回滚误伤率，也就是一次回滚是否顺手撤掉了无关改动。当 `replay_duration_min` 连续偏高，或者 `blocked_step` 总落在同一字段缺失上，问题就不在作者个人习惯，而在模板和 lint 阈值。

## 这套规范有明确边界

Commit message 可以承担可追溯 spec 的职责，但它不适合承载完整设计史。一次提交只对应一个可回滚意图，所以 message 只需要保存让后来者继续执行所必需的上下文。跨多个提交的方案争议、实验过程和大段背景，仍然应该落在设计文档、议题系统或专门的报告里，再从 `Key refs` 回链过来。

字段设计也要克制。键太少，message 只剩模糊情绪词。键太多，schema 会被具体工作流拖着跑，日志很快变成半废弃表单。稳定做法是保留少量高复用语义键，把会频繁变化的流程细节写进 `driver_meta` 或外部引用。这样才能同时保住可检索性和演进空间。

更重要的边界在于，这套规范解决的是交接、回滚和审计问题。它不会替代设计判断，也不会自动让提交拆分得更合理。团队仍然要先有“一条提交只表达一个判断”的纪律，message 结构才有地方落地。下一次出现跨人或跨 Agent 交接时，可以先试运行一版 `Subject + TOML + Body` 模板。如果连续两次缺失 `goal_completion` 或 `Validation`，就把 lint 接进提交流程。优化是否生效，看两个结果就够了：接手方能否在 5 分钟内说清目标、状态和下一步，回滚时误伤无关改动的比例是否持续下降。
