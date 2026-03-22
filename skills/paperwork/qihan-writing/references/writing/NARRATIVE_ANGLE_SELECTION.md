# Narrative Angle Selection

场景 lane 解决的是“这轮工作怎么推进”，叙事视角解决的是“正文按什么命题和顺序推进”。

很多稿子败在正文开头主轴选错。材料未必差，句子也未必假，但读者先收到的是错误的第一问题，于是后面每一节都在补救开头没有说清的东西。

所以，非 trivial 的长文、方案、研究、方法论说明，在起草前都要先选一个主叙事视角。

但先选视角，不等于拿视角去硬撑一份基础薄弱的稿子。选卡之前，先确认这篇文章已经有资格进入“正文主梁选择”。

## 先过基础门，再选卡

先看 `references/workflow/OPERATING_SURFACE_MATRIX.md`，再用 `references/knowledge/PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md` 压一版最小 route memo。

如果下面任一项还不稳，不要继续翻 narrative-angle 卡，直接转去 `references/workflow/DEPTH_ESCALATION_LOOP.md`：

- 文章承诺写不成一句不含猜测的话
- 第一问题要靠补对象定义、补边界、补样本边界才能成立
- 证据形状说不清，或者只能靠空泛判断撑结论
- 原材料一做 reverse outline 就散，说明主线还没长出来

这条支线需要时，再打开：

- `references/knowledge/DEPTH_RESEARCH_PACKET_TEMPLATE.md`
- `references/knowledge/REVERSE_OUTLINE_TEMPLATE.md`

不要把“选卡困难”一律理解成“需要更会写”。很多时候，真正缺的是更扎实的材料底座。

## 叙事视角决定什么

它至少决定 5 件事：

1. 标题和首屏先兑现什么承诺
2. 第一段先回答哪个问题
3. H2 的主支柱按什么顺序排
4. 哪些证据必须前置，哪些可以延后
5. 哪些材料应该进入正文，哪些材料只配做附录、例子或删掉

如果这 5 件事没有先选定，正文往往会同时背着多个“其实也能写”的版本，最后写成结构正确但命题发虚的稿子。

## 标准选择动作

### 1. 先写一句文章承诺

不要先列材料。先写一句话：

- 这篇文章最终想让读者接受什么判断

这句话写不出来，要先判断原因。如果只是主张还没压实，可以继续往下收缩候选；如果是因为对象边界、证据或材料本身不稳，回到 depth escalation，不要继续选卡。

### 2. 先定义读者此刻的第一问题

同一组材料，读者的第一问题可能完全不同：

- 它是什么对象
- 为什么不能按旧办法做
- 这几个方案该选哪个
- 这个系统是怎么长出来的
- 这些案例背后真正共通的判断是什么

第一问题不同，正文骨架就不同。

### 3. 在卡片里先缩到 1 到 2 个候选

只有 route memo 已经稳定后，才去 `references/writing/narrative-angles/` 里找最像的卡，再决定是否需要自己改骨架。卡片提供的是常见结构判断，能把主轴选择前移到起草之前；它们不是 research substitute。

### 4. 跑一轮视角复核

按 `references/writing/NARRATIVE_ANGLE_REVIEW_HEURISTIC.md` 做一轮复核。

这一步的目标不是重新发明新卡，而是逼自己说明：

- 这张卡为什么对
- runner-up 卡为什么不对
- 标题承诺和第一问题有没有真的对齐

如果复核结果暴露的问题不是“主梁竞争”，而是“证据根本撑不住任何主梁”，就退出选卡流程，回到 depth escalation。

### 5. 给自己写一个最小视角摘要

至少写出 4 行：

- `angle_id`
- 一句话主命题
- 为什么这张卡比另一个候选更对
- 这张卡会把哪些材料降级成例子、附录或不写

### 6. 决定要不要向用户确认

默认动作是先选视角。只有多个强候选都会显著改写正文时，才需要向用户确认。

如果真正的问题是材料基础不够，不要把 research 缺口伪装成“请用户二选一”的视角确认题。

## 什么情况下必须确认

如果多个候选视角都会成立，但它们会改写下面任一项，就要先和用户确认：

- 标题承诺
- 首屏前三段的核心主张
- H2 顺序
- 第一人称力度或作者在场感
- 关键证据前置顺序

常见例子：

- 一篇 system 说明文，既能写成“对象定义与边界”，也能写成“创建过程与规则沉淀”
- 一篇 research synthesis，既能写成“模式归纳”，也能写成“决策建议”
- 一篇用户观点稿，既能写成“我为什么这样判断”，也能写成“这个误判会导致什么后果”

## 什么情况下不用确认

下面这些情况，不要为了形式感打断用户：

- 任务只是 `S6_final_polish`
- 任务只是局部重写或去 AI 味
- 一眼只有一个自然视角
- 用户已经明确给出标题承诺、第一问题或命题顺序
- 文稿类型本来就高度格式化，例如公告、API 文档、说明清单

## 推荐确认句式

当你真的需要确认，不要直接问“你想怎么写”。给出两个真实可选角度，并说明代价。

可用模板：

> 我现在看到两个可行视角。  
> A 会先讲 `...`，这样读者先拿到的是 `...`。  
> B 会先讲 `...`，这样读者先拿到的是 `...`。  
> 如果走 A，后面的结构会更偏 `...`。  
> 如果走 B，后面的结构会更偏 `...`。  
> 你更想让读者先拿到哪种判断？

## 常见失败

1. 先写了很多，再回头补视角
   - 结果：越写越舍不得删，最后正文背着两套结构
2. 把场景路由误当成叙事视角
   - 结果：知道这轮是 `S2_synthesis`，但仍然不知道正文到底先讲什么
3. 明明有多个强候选，却不确认
   - 结果：用户最后否定的是整篇文章的主轴，不只是句子
4. 凡事都问用户确认
   - 结果：把本该由 agent 先收缩的问题空间，重新甩回给用户

## 和其他文档的关系

- operating route：看 `references/workflow/OPERATING_SURFACE_MATRIX.md`
- depth escalation：看 `references/workflow/DEPTH_ESCALATION_LOOP.md`
- 写前 route memo：看 `references/knowledge/PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md`
- 场景路由：看 `references/workflow/SCENARIO_ROUTER.md`
- 场景 SOP：看 `references/workflow/SOP_LANES.md`
- 视角复核：看 `references/writing/NARRATIVE_ANGLE_REVIEW_HEURISTIC.md`
- 句子和段落风格：看 `references/writing/VOICE.md`
- 具体可选卡：看 `references/writing/narrative-angles/README.md`
