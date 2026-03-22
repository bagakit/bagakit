---
name: qihan-writing
version: 0.9.2
description: |
  写作与改写技能（qihan 风格）：用于把技术、研究、计划类内容写得“犀利、客观、严谨、低 AI 味”，并适配飞书云文档排版。

  适用场景：
  - 产出研究精读、荟萃分析、技术方案、周报复盘、执行计划
  - 对已有草稿进行去 AI 味、去空话、增强证据链与可执行性
  - 需要同时满足：结构清晰 + 最小闭环实验导向 + 飞书富排版

  不适用：纯营销软文、小说散文。
---

# qihan-writing

## Runtime Contract

- 用户交互遵循 `references/workflow/INTERACTION_CONTRACT.md`。
- 这个 contract 只约束 agent 如何和用户说话、如何组织 reasoning、如何处理不确定性与错误。
- 最终文稿怎么写，看 `references/writing/VOICE.md`、`references/writing/INLINE_CODE_USAGE.md`、`references/writing/NARRATIVE_ANGLE_SELECTION.md`、`references/writing/NARRATIVE_ANGLE_REVIEW_HEURISTIC.md`、`references/writing/AI_SMELLS.md`、`references/writing/STRUCTURE_PYRAMID.md` 等 output docs。

## Entry Control Points

- **Mandatory control points**
  - 先看 `references/workflow/OPERATING_SURFACE_MATRIX.md`，判断这次任务是直接起草、局部改写、洞察问答，还是已经该进入 depth escalation。
  - 全程遵守 `references/workflow/INTERACTION_CONTRACT.md`；它约束的是 agent 行为，不替代写作路线。
- **Must-read before non-trivial drafting**
  - 权威清单由 `references/workflow/OPERATING_SURFACE_MATRIX.md` 定义，不在这里重复抄一份。
- **Conditional surfaces**
  - route 触发条件和条件分支也以 `references/workflow/OPERATING_SURFACE_MATRIX.md` 为准。

## Escalate When

不要靠强行选 narrative angle 来掩盖基础薄弱。出现下面任一信号，先停在 route 层，按 matrix 决定是否进入 depth escalation：

- 文章承诺写不成一句不含猜测的话
- 第一问题需要靠补定义、补对象边界才能成立
- 候选卡片看起来都能写，但没有一张拿得到足够证据
- 现有材料只能给观点，给不出可复核的机制、样本边界或关键例子
- reverse outline 一跑就发现原材料自身没有稳定主线

## Runtime Surface Declaration

- top-level Bagakit runtime surface roots:
  - none by default
- 这个 skill 通过安装载荷、参考资料和显式输出目标工作，而不是依赖一个
  Bagakit 持久 runtime root
- stable contract:
  - `docs/specs/runtime-surface-contract.md`

## Quick Workflow

1) 先看 `references/workflow/OPERATING_SURFACE_MATRIX.md`。
2) 如果是非 trivial drafting，先写 `references/knowledge/PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md`。
3) 如果基础不稳，转 `references/workflow/DEPTH_ESCALATION_LOOP.md`。
4) 只有基础稳定后，才做 `NARRATIVE_ANGLE_SELECTION` 和 `NARRATIVE_ANGLE_REVIEW_HEURISTIC`。
5) 最后才进入起草、改写、lint 和长文 review。

## 使用总原则
这里只保留 operator 级别最该记住的规则。句子、段落、结构、反模式的细粒度规则，交给 `VOICE.md`、`AI_SMELLS.md`、`STRUCTURE_PYRAMID.md` 等专门文档。

1) **先完成再建议**：如果任务要求“看完全部材料再给结论”，必须在完成后再输出结论。
2) **过程状态必须引用（quote）**：同步进度时，所有过程状态放在引用里，便于与结论区分。
3) **起草前先过 route，而不是直接写**：先 route、再看基础、再选卡，不要拿文风补基础层缺口。
4) **防回归（内容不丢失）**：重写、改写时，除非用户明确要求删减，否则不得“写短了就算优化”。
5) **用户改写是高信号监督**：当用户直接给出句子级改写时，必须抽象成通用规则，再回扫全文同类问题。
6) **最小闭环**：任何建议必须落到“下一步动作 + 触发条件 + 验收指标”。
7) **核心概念要早出场**：如果一个概念解释了全文世界观和结构，就要尽早出现。
8) **标题要是命题，不是描述**：标题要覆盖文章的核心判断，不只标记主题。
9) **把判断写在对象上，不写在作者姿态上**：少写作者自评式元话，也少拿模糊群体当论证替身。
10) **优先具体机制，少用黑箱比喻**：像“接住”“接得住”这类词不算机制，机制要写成动作和落点。

## 工作流
### A. 路由与定标
- **Step 0：先过 operating surface**
  先看 `references/workflow/OPERATING_SURFACE_MATRIX.md`，决定这次是直接写、局部改写、走 insight loop，还是先做 depth escalation。不要一上来就翻 narrative-angle 卡。
- **Step 0：识别写作任务类型**
  研究精读 / 荟萃分析 / 技术方案 / 执行计划 / 复盘总结 / 通知公告。
- **Step 0：轻量素材集单独对待**
  头像 / 海报 / 图片集这类材料，以“可直接复用”为目标，减少废话；用表格或卡片概览 + 清晰的命名 / 尺寸 / 用途说明。
- **Step 0：先选主 lane**
  先用 `references/workflow/SCENARIO_ROUTER.md` 选择主场景，再按 `references/workflow/SOP_LANES.md` 走对应 lane；route 判定要和 operating surface 保持一致。
- **Step 1：确定读者与交付物**
  先回答两个问题：读者是谁，交付物要驱动什么动作。
- **Step 1.1：先写 route memo**
  对非 trivial 长文、方案、研究、方法论说明，先按 `references/knowledge/PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md` 写最小 route memo，把标题承诺、第一问题、证据形状、退出动作压实。
- **Step 1.15：先判定基础够不够写**
  如果 route memo 暴露出对象边界不稳、样本边界不稳、关键证据缺失，或 reverse outline 说明原材料本身没有稳定主线，就不要继续选卡；转去 `references/workflow/DEPTH_ESCALATION_LOOP.md`，并按需补 `references/knowledge/DEPTH_RESEARCH_PACKET_TEMPLATE.md`、`references/knowledge/REVERSE_OUTLINE_TEMPLATE.md`、`references/knowledge/RESEARCH_TO_DRAFT_HANDOFF_TEMPLATE.md`。需要快速判断时，可先跑 `python3 scripts/qihan_route_tools.py check-foundation <artifact.md>`。
- **Step 1.2：先选主叙事视角**
  只有基础稳定后，才按 `references/writing/NARRATIVE_ANGLE_SELECTION.md` 先选一个主叙事视角，再加载对应卡片。至少要明确：这篇文章先立什么主张、先回答哪个问题、按什么 H2 骨架推进。
- **Step 1.25：跑一轮视角复核**
  按 `references/writing/NARRATIVE_ANGLE_REVIEW_HEURISTIC.md` 做一轮写前复核。至少要回答：这篇文章的标题承诺是什么、第一问题是什么、证据如何移动、章节如何推进、为什么不是 runner-up 卡。
- **Step 1.3：必要时确认视角**
  如果两个以上视角都说得通，但它们会改写标题承诺、首屏主张、章节顺序、第一人称力度或证据负担，就先和用户确认。不要把“必须选视角”误写成“每次都必须打断用户提问”。
- **Step 1.5：必要时进入洞察问答环**
  按 `references/workflow/INSIGHT_INTERVIEW_LOOP.md` 执行；这是一个**条件分支**，不是默认必跑。它解决的是“用户判断还没被压成好命题”，不是“材料底子不够”。如果 Step 0 已经把任务路由到 `S4_insight_loop`，就把它当主 lane，而不是当中途插入的一小步；如果暴露的是证据和材料问题，回到 depth escalation，而不是继续追问用户。

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
- **Step 4.65：audience panel review**
  每次文章评审都要补一轮 `references/review/AUDIENCE_PANEL_REVIEW.md`。这是一道 publish-blocking gate，不是附加意见。默认启动 3 个静室 reviewer：小白、相关领域、该领域专家，并用 `references/review/AUDIENCE_PANEL_REVIEW_TEMPLATE.md` 留下独立 artifact。每个 reviewer 都必须给一篇对照文章、来自当前稿件的证据句或证据段，并写出“相比对照文章，这篇更强和更弱在哪里”。

### D. 交付与回扫
- **Step 5：交付结构**
  交付必须包含 1–3 条结论、可追溯证据、取舍 / 风险、以及下一步动作 / 触发 / 验收指标。
- **Step 6：同类问题全文回扫**
  任何一句被用户重写后，都不要只改命中处；至少再检查同类句式、同类叙事误位、同类概念层级错误、同类黑话或节奏问题。如果只是改了一句，没有做全文回扫，默认视为未完成。

## 参考资料

目录总索引：

- `references/README.md`

Workflow：

- `references/workflow/OPERATING_SURFACE_MATRIX.md`
- `references/workflow/SCENARIO_ROUTER.md`
- `references/workflow/SOP_LANES.md`
- `references/workflow/INTERACTION_CONTRACT.md`
- `references/workflow/DEPTH_ESCALATION_LOOP.md`
- `references/workflow/INSIGHT_INTERVIEW_LOOP.md`
- `references/workflow/REWRITE_FEEDBACK_LOOP.md`

Writing：

- `references/writing/VOICE.md`
- `references/writing/INLINE_CODE_USAGE.md`
- `references/writing/NARRATIVE_ANGLE_SELECTION.md`
- `references/writing/NARRATIVE_ANGLE_REVIEW_HEURISTIC.md`
- `references/writing/narrative-angles/README.md`
- `references/writing/AI_SMELLS.md`
- `references/writing/TONE_HUMBLE_TOUGH.md`
- `references/writing/POV_FIRST_PERSON.md`
- `references/writing/STRUCTURE_PYRAMID.md`
- `references/writing/FEISHU_LAYOUT.md`
- `references/writing/NO_REGRESSION.md`

Knowledge：

- `references/knowledge/EVIDENCE_ARCHITECTURE.md`
- `references/knowledge/PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md`
- `references/knowledge/DEPTH_RESEARCH_PACKET_TEMPLATE.md`
- `references/knowledge/RESEARCH_TO_DRAFT_HANDOFF_TEMPLATE.md`
- `references/knowledge/REVERSE_OUTLINE_TEMPLATE.md`
- `references/knowledge/RESEARCH_TEMPLATE.md`
- `references/knowledge/INTERVIEW_RECORD_TEMPLATE.md`
- `references/knowledge/REWRITE_CASEBOOK.md`

Review：

- `references/review/QA_HARD_METRICS.md`
- `references/review/AUDIENCE_PANEL_REVIEW.md`
- `references/review/AUDIENCE_PANEL_REVIEW_TEMPLATE.md`
- `references/review/LONGFORM_RUBRIC.md`
- `references/review/LONGFORM_REVIEW_TEMPLATE.md`
