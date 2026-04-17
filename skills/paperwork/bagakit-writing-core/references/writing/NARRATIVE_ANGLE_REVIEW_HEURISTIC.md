# Narrative Angle Review Heuristic

这不是文稿质量 rubric。

它只解决一件事：起草前，agent 怎么更稳定地判断该选哪张 narrative-angle card。

它不负责拯救基础薄弱的稿子。材料、边界、证据底座不够时，应该退出选卡，改走 depth escalation。

## 什么时候用

当你已经缩到 1 到 2 个候选卡，但还不确定哪张才是正文主梁时，用这份 heuristic。

如果任务只是局部改写、终稿收束、公告或 API 文档，可以跳过。

如果你连稳定候选都缩不出来，而且原因是对象边界、样本边界、证据底座或原材料主线本身不稳，先看：

- `references/workflow/OPERATING_SURFACE_MATRIX.md`
- `references/workflow/DEPTH_ESCALATION_LOOP.md`
- `references/knowledge/DEPTH_RESEARCH_PACKET_TEMPLATE.md`
- `references/knowledge/REVERSE_OUTLINE_TEMPLATE.md`

不要拿这份 heuristic 代替 research。

## 先写 5 行路由底稿

在选卡之前，先拿到一份 route surface：

- 普通起草：`references/knowledge/PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md`
- depth escalation 回稿：`references/knowledge/RESEARCH_TO_DRAFT_HANDOFF_TEMPLATE.md`

route surface 里至少要有这 5 行：

1. 标题承诺：这篇文章最终要让读者接受什么判断
2. 第一问题：读者进入正文时最先想问什么
3. 证据运动：证据是先给定义、先给难点、先给案例，还是先给结论
4. 章节运动：各节是在推进一个问题、走一张地图、做几种比较，还是讲规则如何长出来
5. 退出动作：读者读完后是更会判断对象、更会避错、更会做选择，还是更会复用一条规则

如果这 5 行写不出来，先判断为什么写不出来：

- 主张还没压实，但材料基础足够：转 `references/workflow/INSIGHT_INTERVIEW_LOOP.md`
- 材料、证据、对象边界或样本边界不稳：转 `references/workflow/DEPTH_ESCALATION_LOOP.md`

不要在这个状态下继续比较卡片。

## 先判定 foundation problem

下面这些信号一旦出现，说明当前更像基础层缺口，不是主卡和 runner-up 的竞争：

- 标题承诺只能写成模糊立场，无法落到可复核判断
- 第一问题还依赖补定义、补对象边界、补样本边界
- `evidence_shape` 说不清，或者任何卡都拿不到够硬的前置证据
- reverse outline 暴露出原材料没有稳定主线，只有零散观点或样本堆叠

这时应该停止选卡，进入 depth escalation。

## 快速路由问题

按顺序问，命中就优先进入对应卡。

### 1. 读者首先需要认清对象和边界吗

如果是，优先选：

- `claim-define-boundary-mechanism`

典型信号：

- 术语被混用
- 相邻对象总被写成一回事
- 文章价值主要来自“对象是什么”和“为什么不能混”

### 2. 读者首先需要纠正一个诱人的误判吗

如果是，优先选：

- `problem-misjudgment-mechanism-fix`

典型信号：

- 有一个看起来很合理、其实很害人的错误直觉
- 文章要先把“真正的问题”从表面诊断里剥出来

### 3. 文章最终要驱动一个选择吗

如果是，优先选：

- `compare-options-make-decision`

典型信号：

- 读者离开时必须知道该选哪个
- 候选方案、评价标准和触发换挡条件都必须交代

### 4. 文章主要在把几个关键难点显影出来吗

如果是，优先选：

- `difficulty-map`

典型信号：

- 如果不开头先讲难点，后文都会像补充 caveat
- 这些难点可以组成一张稳定地图

### 5. 长文其实都在回答同一个总问题吗

如果是，优先选：

- `governing-question-spine`

典型信号：

- 段落不少，但真正主线只有一根
- 各节都在推进、修正或收束同一个问题

### 6. 文章的价值在于说明规则是怎么被逼出来的吗

如果是，优先选：

- `signals-to-rules`

典型信号：

- 起点压力、材料信号、方案空间和取舍都很重要
- 如果只写结果，不写生成史，正文会变轻

### 7. 输入主要是一组样本吗

如果是，优先选：

- `sample-to-thesis`

典型信号：

- 材料很多
- 正文任务是从样本里压出一个可复用判断
- 样本边界必须明确，不然结论会飘

## 最常见的 4 组混淆

### `difficulty-map` vs `governing-question-spine`

看正文的驱动器是什么：

- 多个关键 obstacle 组成地图：选 `difficulty-map`
- 一个总问题把全篇拴住：选 `governing-question-spine`

### `claim-define-boundary-mechanism` vs `signals-to-rules`

看文章的主判断落在哪：

- 对象是什么、边界在哪：选 `claim-define-boundary-mechanism`
- 规则是如何被压力和取舍逼出来：选 `signals-to-rules`

### `compare-options-make-decision` vs `sample-to-thesis`

看读者离开时带走什么：

- 一个选择：选 `compare-options-make-decision`
- 一个从样本压出来的判断：选 `sample-to-thesis`

### `problem-misjudgment-mechanism-fix` vs `difficulty-map`

看真正主角是一个错，还是一组难点：

- 一个反复复发的诱人误判：选 `problem-misjudgment-mechanism-fix`
- 多个共同决定理解深度的难点：选 `difficulty-map`

## 写前输出格式

在正式起草前，至少写出这 5 行：

- `chosen_card`: 主卡
- `runner_up`: 第二候选
- `why_chosen`: 为什么主卡更对
- `why_not_runner_up`: 为什么 runner-up 不该做主梁
- `evidence_shape`: 证据会如何移动

如果这 5 行写完还摇摆，分两种处理：

- 是用户判断还没被压成更好的标题承诺或第一问题：优先进入 `S4_insight_loop`
- 是材料、边界或证据底座仍然撑不住任何卡：退出并进入 depth escalation

## 什么时候必须问用户

如果主卡和 runner-up 会显著改写下面任一项，就先和用户确认：

- 标题承诺
- 首屏前三段
- H2 顺序
- 第一人称力度
- 证据前置顺序

## 和卡片的关系

这份 heuristic 只负责路由。

真正的开篇动作、H2 骨架、代表范文和 mini reverse outline，回到：

- `references/writing/narrative-angles/README.md`
