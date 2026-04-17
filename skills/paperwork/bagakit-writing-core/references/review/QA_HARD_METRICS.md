# Hard Metrics for bagakit-writing-core Draft

目标：把“AI 味 / 散 / 不结构化 / 排版过度”变成可自动检查或稳定复核的指标。

这份文档只放两类东西：

- 适合 `writing_core_lint.py` 这类脚本去做的底层体检
- 适合人工 / LLM review 去做的补充项

100 分制长文评审不在这里定义，改看 `references/review/LONGFORM_RUBRIC.md`。

## 1. 标题结构

- H2/H3/H4 形成树。
- **H2 数量 ∈ [3,7]**。
- H3/H4 可选；但若父节点存在子节点，则其直接子节点数 ∈ [3,7]。
- 若某层只有 1–2 个子节点：建议合并。
- 若某层 > 7：建议拆分。

## 2. 段落与零散程度

- 句子总数、段落总数。
- 平均每段句子数：过低通常意味着“切得太碎 / 像罗列”。
- **段落 / 标题比**：过低意味着“每个标题只有一句话”。
- 列表行占比：过高通常意味着“PPT 腔”。
- 单个连续列表块长度：超过 7 说明这一层可能还没拆开；超过 10 通常值得直接报警。

### 2.1 列表机械感 advisory

`writing_core_lint.py` 还会输出一组 `ADVISORY` 级别的 prose-shape 指标。它们不直接判定文章失败，只提示 reviewer：这篇可能已经从“有人带你理解问题”滑向“连续操作说明”。默认 CLI 会把 `ADVISORY` 写进 JSON，但不会因为只有 advisory 而返回非零；`WARN` 和 `FAIL` 仍然按 `--fail-on` 策略处理。

脚本会统计 content line 中的列表占比、列表绝对行数、中型列表块数量、同一标题区段内的相邻列表块数量、开篇窗口里的列表密度，以及 H2/H3 section 内部是否由列表行主导。典型触发码包括 `LIST_DENSITY_ADVISORY`、`LIST_BLOCK_CLUSTER`、`OPENING_MANUAL_FEEL` 和 `SECTION_LIST_DOMINANT`。

这些指标的解释顺序是：

- 命令步骤、协议字段、验收 checklist、状态分类和对照表可以保留更高列表密度。
- 开篇场景、机制解释、为什么需要某个设计、读者如何理解当前状态，更应该用段落承接。
- 如果一篇主线文章反复出现 4 到 7 行的中型列表，即使没有任何超长列表，也要检查它是不是在用列表替代因果句和铰链句。

回归样本属于验证层，不属于安装后的 runtime payload。样本应使用脱敏合成文本，不允许复制真实项目文档、机器本地路径或外部 guidebook 的原句。

### 2.2 更广义的机械感 advisory

列表不是唯一的机械感来源。脚本还会输出一组 `proseMechanics` 指标，用来提示 reviewer 关注五类更高层的写作退化：

- `COHESION_DEBT_ADVISORY`：显式承接标记偏少，并伴随短段连发。看到它时，先问哪两个段落之间缺了关系句。
- `CUE_FLATNESS_ADVISORY`：标题、列表项或固定句式在同一段落块里长时间同构。看到它时，先问这些提示是否应该合并、分组或改成段落。
- `META_WRITING_ADVISORY`：正文在讲“本文、本节、下面会怎么写”，而不是直接写对象、问题和判断。看到它时，先把一句元叙述改成一句对象判断。
- `READER_MOVEMENT_ADVISORY`：开篇没有足够快地给出对象、问题、判断和下一步。看到它时，先补读者进入正文前必须知道的一句话。
- `SEMANTIC_REPETITION_ADVISORY`：相同句子或高度相似的开头重复出现。看到它时，先检查重复处是否真的有新增信息。

这些指标仍然是 `ADVISORY`，不是硬失败。它们只能提示 review 入口，不能替代人工判断。验证层可以为这些指标维护脱敏合成样本，但 runtime 文档不依赖具体验证目录。

## 3. AI 味反模式

- 命中禁词 / 高风险词。
- 命中模板句式（例如“通过…从而…进而…”）。
- 命中 `不是…而是…` 这类对比口癖；以及整篇 `不是` 负定义过密的情况。
- 命中作者自评式元话（例如“很硬的判断”“要回答的问题更具体”“最容易被…”“钉住”）。
- 命中把写作过程写进正文的元话（例如“这篇文章会先讲……再讲……”“后文分三部分展开”“下面先解释为什么这样写”）。
- 命中黑箱吞吐比喻（例如“被系统接住”“下游接得住”）。
- 命中过度分点、术语噪音、重点埋后半段这类结构性问题。

## 4. 排版比例

- callout 数量与正文行数比例。
- mermaid 数量。
- 分割线数量（---）。
- 加粗占比：过高通常意味着“靠排版做结构”。

## 5. review-backed 补充项

这些项不一定适合泛化成通用 lint，但评审时要看：

- 标题承诺是否在首屏 3 段内兑现
- 关键判断是否采用了 `claim -> support`
- 每个 H2 是否真的带来增量，而不是重复 taxonomy
- citation / 理论背书是否回答了读者当前真正关心的问题
- 是否存在值得单独显影的铰链句，却被埋在长段内部
- 是否存在 cohesion、cue flatness、meta-writing、reader movement、semantic repetition 之外的语义问题；脚本只给入口，reviewer 仍要判断文本是否真的需要改
- 是否存在无依据的人群泛化或拉踩表达；这类问题默认不交给脚本，由独立 reviewer 或 blind subagent 判定
- 是否把“这篇文章怎么写”误写成正文内容，而不是写对象、问题和判断

## 6. package-doc 完整性

当评审对象是 skill 说明文、方法论资产包或写作规范文档时，再额外看：

- 是否给出来源、吸收点、评测标准、脚本设计
- 是否明确区分“脚本能查什么”和“review 要看什么”
- 是否把长期演化材料放在独立 reference 中，而不是混进正文

## 7. 配套文档

- `references/review/LONGFORM_RUBRIC.md`：长文 hard gate / weighted review / bonus / penalty / distribution
- `references/review/LONGFORM_REVIEW_TEMPLATE.md`：评分记录模板
