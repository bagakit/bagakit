---
name: qihan-writing
version: 0.8.0
description: |
  写作与改写技能（qihan 风格）：用于把技术/研究/计划类内容写得“犀利、客观、严谨、低 AI 味”，并适配飞书云文档排版。

  适用场景：
  - 产出研究精读/荟萃分析/技术方案/周报复盘/执行计划
  - 对已有草稿进行去 AI 味、去空话、增强证据链与可执行性
  - 需要同时满足：结构清晰 + 最小闭环实验导向 + 飞书富排版

  不适用：纯营销软文、小说散文。
---

# qihan-writing

## Runtime Contract

- 用户交互遵循 `references/workflow/INTERACTION_CONTRACT.md`。
- 这个 contract 只约束 agent 如何和用户说话、如何组织 reasoning、如何处理不确定性与错误。
- 最终文稿怎么写，看 `references/writing/VOICE.md`、`references/writing/AI_SMELLS.md`、`references/writing/STRUCTURE_PYRAMID.md` 等 output docs。

## 使用总原则
1) **先完成再建议**：如果任务要求“看完全部材料再给结论”，必须在完成后再输出结论。
2) **过程状态必须引用（quote）**：同步进度时，所有过程状态放在引用里，便于与结论区分。
3) **低 AI 味**：禁用空洞形容词和“宏大叙事”，多用事实/阈值/反例/权衡。
4) **少罗列，多叙述**：默认写连续段落；列表只用于“结果清单/对比/决策点”。
5) **列表也要有结构**：如果一层 bullet 真有必要，默认控制在 **3–7 项**；少于 3 优先回到段落，超过 7 要拆组、转表格或下钻成子标题。inventory / rubric / casebook 可例外，但必须有标签或分组。
6) **分析→思考→拆解→过程→实例**：研究/方案类输出必须遵循这个链条；每个关键结论至少给 1 个具体例子（或反例）。
7) **叙事优先**：当写“skill/系统/方法”的说明文时，必须写清楚 **创建过程**（动机→材料→方案空间→取舍→迭代→最终规则），而不是只写“我这次改了什么”。
8) **排版克制**：标题后不加括号；分割线只用于章节切换（避免滥用）。
9) **金字塔结构（注意力 3–7 原则）**：任何方案/方法论/研究类文章必须满足：
   - 结构化以 H2/H3/H4 为主。
   - **H2 数量 3–7**。
   - **H3/H4 不是强制**；但一旦某个标题层级使用了子标题，则该父标题的直接子标题数应在 **3–7**（少于 3 合并，多于 7 拆分）。
   - 避免“每个标题下面只有一句话”的空壳结构：每个标题块至少 1 段自然段展开。
10) **段落主句稳定（防水平漂移）**：每个自然段的第一句必须是三选一：
   - 读者收益：读者会获得/经历什么
   - 可信机制：我们用什么机制保证可持续（评测/回归/灰度/观测等只能作为机制，不要当正文主体）
   - 可验证证据：我们已经证明了什么（数字/交付件/结论）
   其余句子最多补 **1–2 个证据型细节**（数字、交付件、机制），禁止堆”名词链流水账”。
11) **丰富度门槛**：任何”测试集/方法论”文档必须包含：
   - 至少 1 张结构图（Mermaid）
   - 至少 1 个逐段/逐句的改写实例（含解释）
   - 至少 1 段”权衡与反例”（为什么不选另一路）
12) **防回归（内容不丢失）**：重写/改写时，除非用户明确要求删减，否则不得”写短了就算优化”。必须保留原文的关键信息块（参考/技能调研/评测标准/脚本设计等），以追加或合并方式优化表达，而不是直接删掉。
13) **最小闭环**：任何建议必须落到”下一步动作 + 触发条件 + 验收指标”。
14) **核心概念要早出场**：如果一个概念解释了全文的世界观和结构，就要尽早出现，不要等到中后段才补定义。
15) **用户改写是高信号监督**：当用户直接给出句子级改写时，必须先抽象成通用规则，再回扫全文同类问题，不允许只做局部替换。
16) **不要有口癖**：避免使用很多”不是…而是…”，避免一篇文章里头类似表达反复出现。一旦发现超过 3 次，全文回扫统一改掉。
17) **不要回答没人问的问题**：每写一句话，先问”读者现在的问题是什么”。回答一个读者没有问过的问题是噪音，通常来自写作过程中某个内部讨论的残留，对读者没有价值，直接删。
18) **标题要是命题，不是描述**：描述性标题（”XX 的模型”）只告诉读者这节讲什么；命题性标题本身就是一个有立场的判断。标题要覆盖文章的核心命题，不是某个有冲击力的推论。
19) **术语命名要克制**：中文概念 + 技术名词优先写成“概念（`Term`）”或“概念，所谓 `Term`”；如果这个技术名词后文不会复用，就不要引入。
20) **核心句要前置显影**：当一个判断足以独立承载整段重心时，优先放在段首；必要时单独成行，证据另起一段。
21) **不要写作者自评式元话**：少写“很硬的判断”“要回答的问题更具体”“最容易被说轻”“把这个区别钉住”这类作者在场评论。优先把这层评价压成对象判断，例如把“这篇文章要回答的问题更具体”改成“这篇文章回答的是……”，把“这是个很硬的判断”改成判断本身，把“把这个区别钉住”改成“先把这个区别说清”。
22) **禁止无依据的人群泛化和拉踩表达**：不要写“很多团队会把…”“很多人会犯…”这类没有证据和边界的人群判断，也不要靠“低估/说轻/犯错”给模糊群体贴标签。优先改成对象失败模式、文本失败模式或机制后果；如果确实要保留群体判断，必须给出来源、样本边界或明确语境。
23) **少用黑箱吞吐比喻**：像“被系统接住”“下游接得住”这类说法，听起来像机制，实际没有说清动作。优先改成更具体的词：记录、沉淀、进入 artefact、形成稳定落点、可重复消费。

## 工作流
### A. 路由与定标
- **Step 0：识别写作任务类型**
  研究精读 / 荟萃分析 / 技术方案 / 执行计划 / 复盘总结 / 通知公告。
- **Step 0：轻量素材集单独对待**
  头像 / 海报 / 图片集这类材料，以“可直接复用”为目标，减少废话；用表格或卡片概览 + 清晰的命名 / 尺寸 / 用途说明。
- **Step 0：先选主 lane**
  先用 `references/workflow/SCENARIO_ROUTER.md` 选择主场景，再按 `references/workflow/SOP_LANES.md` 走对应 lane。
- **Step 1：确定读者与交付物**
  先回答两个问题：读者是谁，交付物要驱动什么动作。
- **Step 1.5：必要时进入洞察问答环**
  按 `references/workflow/INSIGHT_INTERVIEW_LOOP.md` 执行；这是一个**条件分支**，不是默认必跑。如果 Step 0 已经把任务路由到 `S4_insight_loop`，就把它当主 lane，而不是当中途插入的一小步。

### B. 起草与改写
- **Step 2：套用 qihan 风格约束**
  按 `references/writing/VOICE.md` 执行，默认要求句子短、结论前置、可证据化，并持续追问“这句话是否信息密度足够、是否可被反驳”。
- **Step 2.5：吸收用户改写并生成可复用规则**
  按 `references/workflow/REWRITE_FEEDBACK_LOOP.md` 执行；先记录原句与改写句，再做四维分析、抽规则、回扫全文。需要找成熟句型时，先查 `references/knowledge/REWRITE_CASEBOOK.md`。
- **Step 3：去 AI 味**
  按 `references/writing/AI_SMELLS.md` 执行，优先删掉模板化连接词和空转动词，把判断改成动词 + 阈值 + 例子 / 反例，同时回扫黑话动词、后台口吻、分号硬切、静态清单句。

### C. 排版与评审
- **Step 4：飞书文档排版**
  按 `references/writing/FEISHU_LAYOUT.md` 执行；控制标题层级、callout、表格、流程图，并避免正文开头重复 title。
- **Step 4.5：硬性校验**
  当输出要进入飞书 / 对外分享 / 进入长期沉淀时，先跑 `scripts/qihan_write_lint.py`。它会检查标题括号、结构树 3–7、罗列比例、超长列表块、AI 词命中、`不是…而是…` 口癖与负定义过密、作者自评式元话（如“很硬的”“要回答的问题更具体”“最容易被…”“钉住”）、黑箱吞吐比喻（如“被系统接住”“接得住”）、callout / hr / mermaid 比例等；指标说明见 `references/review/QA_HARD_METRICS.md`。
- **Step 4.6：长文终稿评审**
  当输出是博客 / 公众号 / 内部专题长文时，再按 `references/review/LONGFORM_RUBRIC.md` 做一轮 review，并用 `references/review/LONGFORM_REVIEW_TEMPLATE.md` 记录 hard gate、weighted review、craft bonus、anti-pattern penalty。涉及“无依据的人群泛化 / 拉踩表达 / 语气过界”的问题，不用脚本裁决；要求独立 reviewer 做静室打分，优先使用 subagent blind review。

### D. 交付与回扫
- **Step 5：交付结构**
  交付必须包含 1–3 条结论、可追溯证据、取舍 / 风险、以及下一步动作 / 触发 / 验收指标。
- **Step 6：同类问题全文回扫**
  任何一句被用户重写后，都不要只改命中处；至少再检查同类句式、同类叙事误位、同类概念层级错误、同类黑话或节奏问题。如果只是改了一句，没有做全文回扫，默认视为未完成。

## 参考资料

目录总索引：

- `references/README.md`

Workflow：

- `references/workflow/SCENARIO_ROUTER.md`
- `references/workflow/SOP_LANES.md`
- `references/workflow/INTERACTION_CONTRACT.md`
- `references/workflow/INSIGHT_INTERVIEW_LOOP.md`
- `references/workflow/REWRITE_FEEDBACK_LOOP.md`

Writing：

- `references/writing/VOICE.md`
- `references/writing/AI_SMELLS.md`
- `references/writing/TONE_HUMBLE_TOUGH.md`
- `references/writing/POV_FIRST_PERSON.md`
- `references/writing/STRUCTURE_PYRAMID.md`
- `references/writing/FEISHU_LAYOUT.md`
- `references/writing/NO_REGRESSION.md`

Knowledge：

- `references/knowledge/EVIDENCE_ARCHITECTURE.md`
- `references/knowledge/RESEARCH_TEMPLATE.md`
- `references/knowledge/REWRITE_CASEBOOK.md`

Review：

- `references/review/QA_HARD_METRICS.md`
- `references/review/LONGFORM_RUBRIC.md`
- `references/review/LONGFORM_REVIEW_TEMPLATE.md`
