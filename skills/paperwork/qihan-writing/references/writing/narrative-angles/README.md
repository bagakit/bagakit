# Narrative Angle Cards

这里放的是“正文主轴卡”，不是场景 lane。

场景 lane 解决的是工作流顺序，例如从零起草、洞察问答、终稿收束。叙事视角卡解决的是正文命题怎么立、对象怎么出场、证据怎么排。

每张卡都带 frontmatter，用来声明：

- `id`
- `title`
- `summary`
- `fit_scenarios`
- `fit_signals`
- `non_fit_signals`
- `reader_promise`
- `confirmation_needed_when`

卡片正文现在至少包含：

- 什么时候用
- 推荐开篇动作
- 推荐 H2 骨架
- 代表范文与短句
- mini reverse outline

## 当前卡片

- `claim-define-boundary-mechanism.md`
  先立主张，再定义对象，再证明边界，再展开机制
- `problem-misjudgment-mechanism-fix.md`
  先钉住真正问题，再拆误判、机制和修复
- `compare-options-make-decision.md`
  先给决策结论，再解释标准、比较和取舍
- `difficulty-map.md`
  先拎出真正难点，再把全文写成一张难点地图
- `governing-question-spine.md`
  用一个总问题把长文拴住
- `signals-to-rules.md`
  先讲起点压力，再讲材料、取舍和规则沉淀
- `sample-to-thesis.md`
  先交代样本边界，再把共性压成可复用判断

## 使用规则

1. 起草前先挑一张主卡，不要同时背两张卡写正文。
2. 如果两个候选卡都会显著改写标题承诺、首屏主张或 H2 顺序，就先和用户确认。
3. 如果任务只是局部改写、终稿收束或格式化文稿，不必强行套卡。
4. 如果挑不准，先跑 `references/writing/NARRATIVE_ANGLE_REVIEW_HEURISTIC.md`。

## 这一轮补充怎么用

这一轮补的是两层东西：一层是前沿编辑实践和长文结构方法，另一层是能直接借动作的代表文章。

卡片里的短句只保留很短的原文，不追求大段摘抄。目的不是攒金句，而是让你一眼看见某种开篇动作、边界句、诊断句或收束句到底长什么样。

## 前沿实践来源

- [How to write for Works in Progress](https://worksinprogress.co/issue/how-to-write-for-works-in-progress/)
- [Reasoning Transparency](https://coefficientgiving.org/research/reasoning-transparency/)
- [Structured-Prompt-Driven Development](https://martinfowler.com/articles/structured-prompt-driven/)
- [Debugging Tech Journalism](https://asteriskmag.com/issues/06/debugging-tech-journalism)

这些来源更适合拿来学骨架、证据安排和 summary 写法，不一定适合直接模仿句子表面。

## 代表文章池

- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html)
- [Hallucinations in code are the least dangerous form of LLM mistakes](https://simonwillison.net/2025/Mar/2/hallucinations-in-code/)
- [Many of us can save a child’s life, if we rely on the best data](https://ourworldindata.org/cost-effectiveness)
- [Getting materials out of the lab](https://worksinprogress.co/issue/getting-materials-out-of-the-lab/)

如果这一批还不够，再补下一轮时优先找两类来源：一类是像 Orwell、Gopen/Swan、Bret Victor、Sandi Metz 这种结构辨识度极高的经典文章，另一类是近两年的一线编辑或实验室写作实践。
