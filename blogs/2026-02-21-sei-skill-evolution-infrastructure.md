# SEI：构建可回归的技能演进基建

**SEI = Skill Evolution Infrastructure**

## 摘要

这篇文章记录一次典型的自举：我们用 `bagakit-skill-maker` 迭代 `bagakit-skill-maker` 本身。目标不是“优化文案”，而是建立一套可持续的技能演进基建：规则可表达、可执行、可回归。

核心结论：技能系统要想长期稳定，不应把“最佳实践”停留在说明文档，而要把它们编译进 gate、测试和完成态定义。

本文的中心命题是：

> 如果一个技能框架不能稳定评估和迭代自己，它就不可能稳定评估和迭代别的技能。

## 背景：为什么要把重点放在 Evolution

技能工程的主要风险不是功能不足，而是语义漂移：

- 原本通用的规则，逐步变成生态强耦合。
- 原本明确的完成态，退化为“有产物但无去向”。
- 原本统一的响应协议，最终只剩“口头约定”。

这类问题本质上都是演进问题（evolution problem），不是一次性设计问题（design-time problem）。

所以我们把“能否自评、自改、自回归”作为第一性约束，而不是把它当成额外优化项。

## 设计目标

本轮把 `bagakit-skill-maker` 的演进目标收敛为四点：

1. **通用优先**：默认输出 portable skill 规则。  
2. **生态兼容**：Bagakit 系列 skill 保持统一协议。  
3. **完成可审计**：所有完成态都有 handoff destination + archive evidence。  
4. **可回归**：策略变化必须进入 validator 与 tests。

这四点本质上都服务同一个目标：先让框架对自己成立，再让它对其他技能成立。

## SEI 架构：三层闭环

我们把演进基建拆成三层：

- **Policy Layer**：Core 规则 + Profile 叠加规则。
- **Execution Layer**：validator、lint、runtime contracts。
- **Feedback Layer**：failure-first tests + 回归结果。

这三层必须联动；单独增强任意一层，都不足以长期抑制漂移。

## 本轮自举中最有价值的实践

### 1) Core / Profile 分层（可移植性与一致性的平衡点）

`bagakit-skill-maker` 现在明确区分：

- **Core（始终必选）**：standalone-first、触发边界、输出闭环、fallback。
- **Bagakit Profile（条件必选）**：当 skill 名是 `bagakit-*` 时强制启用。

这条分层规则避免了两个常见失败模式：

- 过度通用，导致生态内协作语义不一致；
- 过度耦合，导致框架失去跨项目可移植性。

### 2) RFDP 协议化（把“驱动语句”变成工程协议）

统一 footer 机制定义为：

- **RFDP (Response Footer Driven Protocol)**

并且固定结构不允许漂移：

- anchor 行必须是 `[[BAGAKIT]]`
- 后续必须是 peer `- ...` 行
- 禁止嵌套 bullet

这使得响应协议从“写作风格”升级为“可机检结构”。

### 3) 输出闭环模型（action / memory / archive）

完成态不再用“任务结束”表达，而用三类输出状态表达：

- `action-handoff`
- `memory-handoff`（允许 `none`，但必须给理由）
- `archive`（必须有 destination evidence）

这是把“交付”与“沉淀”同时纳入完成定义，避免只交付不沉淀，或只沉淀不落地。

### 4) Progressive Disclosure（把大文档压力转化为结构优势）

文档结构从单文件说明改为：

- `SKILL.md`：执行地图
- `references/core-design-guide.md`：通用规则
- `references/bagakit-profile-guide.md`：Profile 规则

这不是文档拆分技巧，而是上下文治理策略：

- 主流程保持短路径；
- 细则按需展开；
- 审核和维护定位更快。

### 5) Validator 作为策略编译器（Policy Compiler）

关键改动不在“新增规则”，而在“规则进入可执行判定”：

- `bagakit-*` 缺失 RFDP -> error
- generic skill 缺失 RFDP -> warning
- output/archive 缺失关键信息 -> error
- 强耦合检查从“词命中”升级为“语义命中”

这使 validator 从格式检查器转变为策略执行器。

### 6) Failure-First 测试设计（先证明会失败，再证明可通过）

`scripts_dev/test.sh` 的价值是：

- 先构造缺失 section / 缺失 footer / 硬耦合等失败样例；
- 再恢复到合法状态并验证通过。

这种测试方式比“只验证 happy path”更适合演进阶段，因为它能持续锁住边界条件。

### 7) 负担控制规则（防止技能再次膨胀）

看似细节，但对自举很关键：

- `SKILL.md` 行数预算（防止主协议膨胀）
- runtime payload 边界（避免仓库噪声进入运行时）
- runtime 命名规范（避免“临时文件名”长期化）

这些规则减少了系统熵增速度，是长期演进可持续的基础。

### 8) 约束升级准则（Guidance Pack -> SOP/程序化校验）

这次我们明确了一条实用判断：

- 如果 agent 和人执行方式本应一致，且高质量主要依赖清晰标准/示例，优先用 guidance pack。  
- 如果不论谁执行都必须严格门禁，且“发挥自主性”不会带来更好结果，就升级为程序化校验或严格 SOP。  

这条准则避免了两种常见误区：

- 该灵活的地方被过度程序化；
- 该严格的地方只靠口头 guidance。

## 结果：为什么这套方法有效

本轮之后，`bagakit-skill-maker` 的变化不只体现在“内容更好”，而体现在“演进能力更强”：

- 规则可以分层表达；
- 规则可以自动执行；
- 规则变更可以回归验证；
- 完成态可以被审计追踪。

这四点共同构成了 SEI 的最小闭环。

换句话说，这次不是在“写一个更好的技能说明”，而是在验证前面的中心命题：  
框架先证明自己可以被自己稳定评估与迭代，才有资格成为其他技能的演进基础设施。

## 可复用模板（给其他 Bagakit skill）

如果要把这套方法推广到其他 skill，建议按这个顺序推进：

1. 先定 Core/Profile 边界。  
2. 先用本 skill 对自己跑一轮“自评 -> 自改 -> 回归”。  
3. 定义统一响应协议并做结构化校验。  
4. 定义 action/memory/archive 完成态模型。  
5. 把关键规则写进 validator（不是只写在文档里）。  
6. 补 failure-first 回归测试。  
7. 加入预算与命名规则控制长期熵增。

## 下一步

SEI 目前有两个优先方向：

### A) Guidance-First 的 output/archive 强化（不走重 schema）

这里不建议上“重结构 schema 约束”。更高上限的做法是：

1. 在 `bagakit-skill-maker` 中补齐 guidance pack（模式库 + 反模式 + 样例）。  
2. validator 仅校验硬不变量（section 存在、destination evidence、协议形状）。  
3. 语义细节由 Agent 按 guidance 推理，不强制压成固定字段。  

这样既保留灵活性，也能维持最低可靠边界。

### B) 单 skill 回归与元仓回归打通（具体实现）

可按下面顺序落地：

1. 约定每个 skill repo 都有稳定回归入口：`./scripts_dev/test.sh`。  
2. 在 `skills` 元仓新增“变更子模块优先验证”脚本，先只跑变更 skill。  
3. 变更 skill 全通过后，再跑元仓 `./scripts/validate.sh` 做全量集成验证。  
4. CI 拆成两层 gate：`changed-skill-regression` -> `meta-integration-regression`。  
5. 只有两层都通过，才允许合并 submodule pointer 更新。  

这条链路的关键价值是：先在本地语义闭环，再在集成层防止跨 skill 失配。

## 结语

这次自举的意义不在“工具自我迭代”本身，而在于验证了一条工程路径：

> 先把演进规则变成可执行策略，再把可执行策略变成可回归基建。

同样重要的是，这条路径以“先能评估和迭代自己”为入口条件。没有这个入口条件，SEI 只会停留在口号层。

当技能体系进入长期维护周期，真正决定上限的不是模板数量，而是 SEI 的质量。
