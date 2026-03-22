# Operating Surface Matrix

这份表只做表面分层，避免把 workflow control 和写作 craft 混在一起。

## 0. First Route Decision

| If This Is True | Next Surface | Outcome |
| --- | --- | --- |
| 用户给的是句子级改写，或问题明显只是文风 / 节奏 / 局部表达 | `references/workflow/REWRITE_FEEDBACK_LOOP.md` 或 `S6_final_polish` | 继续 rewrite / polish |
| 用户的真实判断比草稿深，但材料基础已经够 | `references/workflow/INSIGHT_INTERVIEW_LOOP.md` | 进入 insight loop |
| 文章 promise、对象边界、样本边界或证据底座不稳 | `references/workflow/DEPTH_ESCALATION_LOOP.md` | 先停写，重建基础 |
| 基础稳定，只是还没锁正文主梁 | `references/knowledge/PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md` -> `references/writing/NARRATIVE_ANGLE_SELECTION.md` | 继续 drafting route |
| 正在做终稿判断或对外评审 | `references/review/QA_HARD_METRICS.md`、`references/review/LONGFORM_RUBRIC.md` | 进入 review route |

## 1. Must Follow Runtime Rules

| Surface | When | Why |
| --- | --- | --- |
| `references/workflow/INTERACTION_CONTRACT.md` | 所有任务 | 约束 agent 怎么和用户说话，不约束正文怎么写 |
| `references/workflow/SCENARIO_ROUTER.md` | 非 trivial 写作任务起步时 | 先选主场景，避免一上来用错工作流 |
| `references/workflow/SOP_LANES.md` | 场景选定后 | 给出该场景的最小正确顺序 |
| `references/workflow/DEPTH_ESCALATION_LOOP.md` | 用户说“浅”或正文反复抬不起来时 | 强制区分“句子弱”与“基础层缺失” |

## 2. Must Read Before Drafting

| Surface | When | Why |
| --- | --- | --- |
| `references/knowledge/PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md` | 非 trivial 起草前 | 先把 promise、first question、evidence shape 压成最小 route memo |
| `references/writing/NARRATIVE_ANGLE_SELECTION.md` | route memo 稳定后 | 先锁正文主命题和第一问题 |
| `references/writing/NARRATIVE_ANGLE_REVIEW_HEURISTIC.md` | 候选卡缩到 1 到 2 张后 | 防止多个候选视角混写 |
| `references/writing/VOICE.md` | 进入正式 drafting 前 | 先看段落主句、判断姿态和 low-AI-smell 底线 |
| `references/writing/STRUCTURE_PYRAMID.md` | 进入正式 drafting 前 | 先看 H2/H3 的结构约束，避免边写边涨层级 |
| `references/knowledge/EVIDENCE_ARCHITECTURE.md` | synthesis、综述、复盘、需要可审计时 | 先分正文和附录的证据职责 |

这里的意思不是“这些文档全是硬规则”。

它们里有些是 craft surfaces，但在非 trivial 写作里，必须先读过再写，不然 route 很容易漂。

## 3. Conditional Branches

| Surface | Trigger | Not For |
| --- | --- | --- |
| `references/workflow/INSIGHT_INTERVIEW_LOOP.md` | 用户心里有判断，但没完全说出来 | 证据、理论、时代背景缺口 |
| `references/workflow/REWRITE_FEEDBACK_LOOP.md` | 用户直接给“原句 -> 改写句” | 从零搭命题或补研究基础 |
| `references/review/QA_HARD_METRICS.md` | 进入飞书、对外分享、长期沉淀前 | 判定文章命题是否成立 |
| `references/review/LONGFORM_RUBRIC.md` | 博客、公众号、内部专题长文终稿 | 早期研究或基础重建阶段 |
| `references/review/AUDIENCE_PANEL_REVIEW.md` | 每次文章评审 | 只做内部机制自证，不看无上下文读者体验 |
| `references/knowledge/DEPTH_RESEARCH_PACKET_TEMPLATE.md` | 进入 depth escalation 时 | 局部润色或单句改写 |
| `references/knowledge/REVERSE_OUTLINE_TEMPLATE.md` | 需要把代表文章压成结构地图时 | 直接模仿 prose 或囤摘抄 |
| `references/knowledge/RESEARCH_TO_DRAFT_HANDOFF_TEMPLATE.md` | research 已经做完、准备回正文时 | research 仍在发散或命题未锁定 |

## 4. Advisory Craft References

这些文档帮助“写得更好”，但不该决定 workflow。

| Surface | Main Use |
| --- | --- |
| `references/writing/AI_SMELLS.md` | 去模板腔、去黑话、去假力度 |
| `references/writing/FEISHU_LAYOUT.md` | 飞书版式与可读性 |
| `references/writing/TONE_HUMBLE_TOUGH.md` | 语气边界 |
| `references/writing/POV_FIRST_PERSON.md` | 第一人称使用边界 |
| `references/writing/NO_REGRESSION.md` | 重写时防信息块丢失 |
| `references/knowledge/REWRITE_CASEBOOK.md` | 查成熟改写例子 |
| `references/writing/narrative-angles/README.md` | 视角卡索引和可复用骨架 |

## 5. Token-Saving And Anti-Drift

### Already Present

| Surface | Value |
| --- | --- |
| `SCENARIO_ROUTER.md` + `SOP_LANES.md` | 防止在错误 lane 里消耗 token |
| `DEPTH_ESCALATION_LOOP.md` | 防止拿润色掩盖基础问题 |
| `NARRATIVE_ANGLE_SELECTION.md` + `NARRATIVE_ANGLE_REVIEW_HEURISTIC.md` | 防止正文同时背两套主轴 |
| `PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md` | 防止 title promise、first question、evidence shape 各自乱跑 |
| `DEPTH_RESEARCH_PACKET_TEMPLATE.md` | 防止“再调研一点”无限膨胀成资料堆 |
| `RESEARCH_TO_DRAFT_HANDOFF_TEMPLATE.md` | 防止 research 做完后回稿时重新想一遍命题和视角 |
| `REVERSE_OUTLINE_TEMPLATE.md` | 防止看范文只抄句子、不抄结构 |
| `qihan_route_tools.py` | 低成本做 foundation check，并把 handoff 自动压成 route state |
| `REWRITE_FEEDBACK_LOOP.md` | 把局部改句变成全文规则 |
| `EVIDENCE_ARCHITECTURE.md` | 防止把证据 dump 进正文 |
| `qihan_write_lint.py` + `references/review/QA_HARD_METRICS.md` | 低成本抓结构和口癖漂移 |

### Still Missing

| Gap | Effect |
| --- | --- |
| 更深一层的 content-aware foundation sufficiency grader | 现有 route tool 能查 artifact 是否齐全，但还不能判断理论、背景、证据是否真的“够深” |
| 从原始 draft 直接推导 route state 的小工具 | 现在 route tool 只能从 handoff 压 route，不能直接从 draft 反推 route |

这些缺口先显式标出来，不在这里继续加装饰性文档。
