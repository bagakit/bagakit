# Design Origin

Read this reference when evolving `bagakit-set-loop-goal` or when the original
intent behind Goal files is unclear.

## Source Request

The user wanted a skill that helps agents create a high-quality Goal file.
Once that file is set as an agent's Goal, the agent should be able to finish
the work even after restart, compact, or handoff.

The Goal file is not a plan dump. It is an execution control plane or steering
index.

## Original Discussion Excerpts

1. "最近我想到一件事儿, 就是优化 loop 的最好方式就是 loop in the loop
即用 loop 具体的执行 session, 让另一个 loop 保持分析, 并持续的微调 goal, 减少和目标的偏移, 并把问题带回正轨"

2. "我刚才想到这个技能最好可以追加一个小的巧思：一旦加载了这个技能，用户在过程中讨论的问题都会并发地被 Grok 处理，并且最终都不是直接实现，而是补充进 goal 的描述中。(所以 goal 的描述从一开始都应该是要求读一个 goal 文件 (可以放在 .bagakit/goal/ , 同时具体的 goal 以 pasted text file: xxx. Read this file before continuing. 的方式进行)"

3. "当然有一点是：不要事无巨细地全部写入到 Go 的那个文件里面。比如有一些和执行原则、执行的关键信息、执行的关键索引无关的内容，就应该写到对应的 Feature 或者一些 Plan 的文件里面去，让 Agent 自行判断"

4. "还是要保持 skill 精简, 一些并非最重要的东西, 可以卸载到 ref 里头去, 在 Skill 里头只要引用就行"

5. "现在给我写一段话，这段话我把它设置为 Goal。

  这个 Goal 是设置给一个 Agent 的任务执行，要保证 Goal 的内容表达清楚背后的目标和重要性。具体要求如下：

  1. 每一个执行动作都让 CodexL 去执行，由 Agent 自己进行逻辑留意。
  2. 在执行方式上，要确保 Agent 可以经历任意多次迭代。
  3. Agent 需要保持找回上下文，读好代码并顺水推进，直到达到彻底完成的状态。

  所以这个 Go 必然要写一个文件，并且在这段话中主要说明如何使用这个文件"

6. "那么在这些 Go 文件的 front matter 里面，是不是也得有这个 Go 是否完成的标记？以及会自动写上：完成了以后，要把这个标记给勾上。"

7. "感觉这个目录里面还得有一个 current 文件指向当前的 goal。

如果有多个 goal 的话，这个文件可能会是一个简易的执行拓扑。它一定不是一个 DAG，因为没法同时去执行两个 goal，但那可以是一个链。"

8. "现在 Goose 的设计有一个问题：有的时候我们可能会有多个 Goal，但在 current 里面只能有一个。

而且 current 应该叫 current.md 或者 current.yaml 才对。现在的设计是不是有点太局限了？之前我设定一个新 Goal，它就直接把原来的 Goal 给 abandon 了，但原来的其实还没做完。

在这种情况下，我们是不是应该把 current 扩展成一个状态文件，或者一个类似 DAG 的结构？"

9. "我觉得应该这样改，而且我们还得考虑一个已经完成的 goal 就不应该形成干扰，所以在 goal 的目录下应该还有一个 archive 的目录，对吧？"

## FAQ

### Q1: Goal 文件是不是要包含所有上下文？

A: 不是。Goal 文件是控制面，不是仓库、日志、完整计划或研究笔记。它应该包含会影响执行方向的信息：最终目标、原则、约束、验收标准、当前状态、关键索引、下一步策略、停止条件、风险和开放问题。细节应放到对应 Feature、Plan、Research、Runner、Spec 或 Handoff 文件中，Goal 只保留指针和摘要。

### Q2: 用户在执行过程中提出新想法怎么办？

A: 不应直接触发实现。新想法应先被理解、分析，必要时并发交给 Grok 或其他外部或侧向分析工具处理。最终产物应该是 Goal delta：比如更新目标、补充原则、增加非目标、添加验收标准、加入风险、或者指向某个 Feature/Plan 文件。

### Q3: Grok 的角色是什么？

A: Grok 是 sidecar analysis，不是 executor。它可以并发分析用户的新问题、新疑虑、新方向，但它的输出不能直接变成代码改动，只能被蒸馏成 Goal 的候选更新或指向其他文件的建议。

### Q4: Skill 本身应该写多厚？

A: 主 Skill 要保持精简，只写触发条件、核心合同、最小循环和何时读取 reference。复杂协议、Goal 文件模板、placement rule、Grok sidecar 规则、supervisor packet schema、runtime surface 设计，都应卸载到 references 里。

### Q5: Goal 文件和 Feature / Plan / Spec 的关系是什么？

A: Goal 文件负责“为什么、到哪里、按什么原则走、当前走到哪、去哪找细节”。Feature / Plan / Spec 负责“具体拆解、实现细节、任务状态、技术方案、研究材料”。Goal 文件应该编排这些工具，而不是替代它们。

### Q6: Goal 文件默认放在哪里？

A: 默认放在目标项目自己的 `.bagakit/goal/<goal-id>.md`。这是 project-local runtime/control-plane surface，不是安装后的 skill 目录，也不是全局 agent 目录。项目可以选择 ignore `.bagakit/goal/`，因为很多 Goal 是私有执行状态；只有明确要共享给团队或后续执行者的 Goal 才应该提交。

### Q7: Goal 文件 frontmatter 里是否需要完成标记？

A: 需要，但应使用单一 `status` 字段作为机器可读的生命周期真源，而不是另加一个容易冲突的 `complete: true`。生成 Goal 文件和 Goal wrapper 时，都应写明：完成后把 frontmatter 更新为 `status: complete`，并补充简短 `completion_evidence`；如果只是 paused、blocked、ready_for_review 或 abandoned，就写对应状态，不能假装完成。

### Q8: `.bagakit/goal/` 目录里是否需要 `current.md`？

A: 需要，但 `current.md` 应该是 agent-facing 入口，不应该承载完整状态。机器可读的当前前景 Goal、未完成 Goal 注册表和拓扑关系应放在 `.bagakit/goal/state.yaml`。一个 agent loop 同一时刻仍然只能推进一个 foreground Goal，但 registry 可以保留多个 paused、blocked、backlog 或 ready_for_review Goal。创建或切换新 Goal 不等于 abandon 旧 Goal。

### Q9: Goal 拓扑应该是链还是 DAG？

A: 执行游标不是 DAG，因为同一个执行 loop 只能有一个 foreground Goal。状态拓扑可以是 DAG-like，用来表达 depends_on、blocks、interrupts、resumes_after 或 supersedes 等调度关系；这些边只帮助恢复和排程，不表达并发执行。

### Q10: 已完成的 Goal 应该如何处理？

A: 已完成或明确 abandoned 的 Goal 不应该继续干扰当前工作集。完成时先把 Goal frontmatter 改为 `status: complete` 并记录 `completion_evidence`，然后把它移入 `.bagakit/goal/archive/`，同步更新 `truth_surface`，并从 `state.yaml` 的 active `goals` registry 中移除，最多保留一个短历史指针。要恢复归档 Goal 时，应显式恢复到主 Goal 目录并重新登记状态。

## Design Answers

1. A high-quality Goal file is a compact, recoverable steering index.
2. The minimum structure is prime directive, current state, principles,
   acceptance and stop rules, orchestration index, next instruction, delta log,
   and open questions.
3. Direction-changing context belongs in the Goal; detailed task substance
   belongs in Feature, Plan, Spec, Research, Runner, or Handoff surfaces.
4. Restart, compact, and handoff are supported by a fresh-executor check and by
   keeping refs to owner files in the Goal.
5. Grok sidecar, Team mode, OpenSpec, Brainstorm, Feature Tracker, and Runner
   are adapters in the Goal's orchestration index, not content buckets.
6. The main skill stays short; templates, placement rules, packet schema, and
   evolution intent live in references.
7. Loop-off-loop means the outer loop edits the control plane and next
   instruction when drift appears, rather than directly changing the inner
   implementation.
8. Some requests need a Goal wrapper: a short paragraph to set as the live
   Agent Goal. The wrapper should point to the Goal file, require CodexL for
   concrete execution actions when desired, preserve the agent's logic
   supervision role, and allow repeated iterations until true completion.
9. Durable Goal files default to the target project's `.bagakit/goal/`, with
   project-controlled ignore/commit semantics.
10. Goal files should carry frontmatter lifecycle state. `status` is the single
    completion source of truth, and `status: complete` requires concise
    completion evidence.
11. `.bagakit/goal/current.md` is the agent-facing entrypoint, while
    `.bagakit/goal/state.yaml` is the machine-readable foreground cursor,
    registry, and topology.
12. Multiple incomplete Goals may exist without being abandoned. The state
    topology may be DAG-like for scheduling and recovery, but execution still
    has exactly one foreground Goal.
13. Completed or explicitly abandoned Goals should move under
    `.bagakit/goal/archive/` so historical work does not interfere with the
    active registry.
