set -euo pipefail

ROOT="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      ROOT="$2"
      shift 2
      ;;
    *)
      echo "unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
SKILL_DIR="$ROOT/skills/harness/bagakit-brainstorm"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

extract_created_dir() {
  printf '%s\n' "$1" | sed -n 's/^created=//p' | head -n1
}

assert_output_line() {
  local output="$1"
  local expected="$2"
  printf '%s\n' "$output" | grep -Fx "$expected" >/dev/null
}

assert_contains_line() {
  local output="$1"
  local expected="$2"
  printf '%s\n' "$output" | grep -F "$expected" >/dev/null
}

assert_no_shared_knowledge_surface() {
  local scenario_root="$1"
  test ! -e "$scenario_root/.bagakit/knowledge_conf.toml"
  test ! -e "$scenario_root/.bagakit/living-knowledge"
  test ! -e "$scenario_root/.bagakit/knowledge"
}

init_artifact() {
  local scenario_root="$1"
  local topic="$2"
  local slug="$3"
  shift 3

  local init_output
  init_output="$(python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" init --topic "$topic" --slug "$slug" --root "$scenario_root" "$@")"

  local artifact_dir
  artifact_dir="$(extract_created_dir "$init_output")"
  [[ -n "$artifact_dir" ]] || {
    echo "error: failed to capture brainstorm artifact dir" >&2
    exit 1
  }

  printf '%s\n' "$artifact_dir"
}

write_complete_artifact() {
  local artifact_dir="$1"
  local topic="$2"

  python3 - "$artifact_dir" "$topic" <<'PY'
from pathlib import Path
from textwrap import dedent
import sys

artifact_dir = Path(sys.argv[1])
topic = sys.argv[2]


def write(name: str, content: str) -> None:
    (artifact_dir / name).write_text(dedent(content).strip() + "\n", encoding="utf-8")


write(
    "input_and_qa.md",
    f"""
    # Input and QA: {topic}

    - Status: complete
    - Clarification status: complete

    ## Goal Snapshot
    - Deliver a route-ready brainstorm package for {topic}.

    ## Source Markdown
    - Product notes, route expectations, and archive constraints were provided.

    ## Scope and Success Criteria
    - Scope: Validate route handling, archive behavior, and handoff evidence for this brainstorm run.
    - Success criteria: Produce a complete archive-ready handoff with explicit destinations and review approval.
    - Out of scope: Implementing the downstream execution workflow.

    ## Assumptions and Constraints
    - Assumptions: The downstream owner can consume Markdown handoff files.
    - Constraints: Brainstorm must remain standalone-first and avoid auto-writing shared knowledge surfaces.

    ## Questioning Strategy

    - Clarification gate:
      - ask only when the answer changes the plan, recommendation, constraint set, or handoff
      - if the agent can resolve it by research, do that instead of asking the user
    - First ask core framing questions:
      - objective
      - success bar
      - hard constraints
    - Then ask dependency-unlocking questions:
      - questions whose answers change multiple downstream choices
    - Then ask detail-expansion questions:
      - preferences, examples, implementation taste, optional nice-to-haves
    - Finally ask confirmation questions:
      - delivery format
      - review mode
      - final prioritization
    - Ordering rule:
      - ask the highest-dependency, highest-branching questions first
      - avoid style or formatting questions before direction-setting questions
    - Questions the agent should self-resolve instead of asking:
      - exact route-manifest parsing details once the lifecycle gate is known

    ## Question Cards

    ---

    [[Brainstorm]]

    - **Q-001**: Which completion signal matters most for this brainstorm run? 可以考虑：one sentence naming the lifecycle gate plus one sentence explaining why

      > 问这个是因为，archive completion should capture analysis and handoff readiness, not downstream delivery.
      > 得到答案后，我们就能确定 smoke coverage should stop at init/status 还是继续 through archive.

    ---

    ## No-Question Path

    - Use only when no clarification question is needed.
    - No clarification questions needed because: not used in this run; one high-impact clarification question was required and answered above.

    ## Clarification Coverage (High-Impact Dimensions)
    | Dimension | Status (`answered`/`deferred`/`not_needed`) | Evidence |
    |-----------|---------------------------------------------|----------|
    | Audience and primary reader intent | answered | Team lead consumes the handoff artifact. |
    | Success/acceptance criteria | answered | Completion requires archive status `complete`. |
    | Scope boundaries (in/out) | answered | Implementation stays outside brainstorm scope. |
    | Constraints/resources/timeline | answered | Runtime files stay untouched and only validation harness changes are allowed. |
    | Deliverable form and review preference | answered | Markdown handoff plus archive evidence is required. |

    ## Clarification Loop
    - Missing details scan: Routed output path, review expectation, and archive boundary were the only high-impact unknowns.
    - Questions asked to user: see `Question Cards`
    - User answers captured: see `Question Cards`
    - Remaining ambiguity (if any): None.
    - Exit rule:
      - Clarification status is complete because all high-impact unknowns were answered explicitly.

    ## Quality Review Prompt (Agent/Human)
    - Review focus: question quality and decision readiness.
    - Suggested checklist:
      - Questions are concrete, user-answerable, and decision-relevant.
      - Coverage spans audience, success criteria, scope, constraints, and review preference.
      - Remaining ambiguities are explicit with rationale.

    ## Intake Decisions
    | Decision | Rationale |
    |----------|-----------|
    | Archive lifecycle is the hard gate. | It is the point where route selection, move behavior, and handoff outputs converge. |
    | Shared knowledge writes stay out of scope. | That boundary belongs to a separate knowledge system, not brainstorm runtime. |

    ## Completion Gate
    - [x] Scope and success criteria are explicit.
    - [x] Each user-facing clarification question uses the question-card template or `No-Question Path` explains why none were needed.
    - [x] Critical unknowns are tracked with owner/date.
    - [x] Clarification coverage table is closed (`answered/deferred/not_needed` with evidence).
    - [x] Clarification loop completed (`Clarification status: complete`).
    - [x] Stage status updated before moving to analysis.
    """,
)

write(
    "raw_discussion_log.md",
    f"""
    # Raw Discussion Log: {topic}

    - Status: complete
    - Capture status: active

    ## Capture Rules
    - Record every user clarification question and raw answer.
    - Record every major expert观点、质疑、反驳、收敛结论和方向切换。
    - Keep entries append-only and chronological; do not overwrite earlier raw statements.
    - When a later结论修正 earlier观点, add a new entry that references the earlier entry id.
    - Link entries to `input_and_qa.md`, `finding_and_analyze.md`, `expert_forum.md`, or `outcome_and_handoff.md` when possible.

    ## Clarification QA Bundle Template

    ### Q-001
    - Asked at:
    - Asked by:
    - User-facing question:
    - Suggested answer shape:
    - Why this question was asked:
    - What this unlocks next:
    - Current answer:
    - Answered at:
    - Answered by:
    - Answer evidence:
    - Memory-safe restatement:
    - Canonical entities:
    - Resolved references:
    - Time anchors:
    - Source refs:
    - Follow-up:

    ## Clarification QA Bundles

    ### Q-001
    - Bundle kind: `clarification`
    - Question pass: `frame`
    - Decision at stake: whether archive behavior is the real brainstorm completion gate for this run
    - Current hypotheses: init/status-only smoke may be enough; archive-aware smoke may be necessary
    - Asked at: 2026-04-20T09:00:00Z
    - Asked by: validation-owner
    - User-facing question: Which completion signal matters most for this brainstorm run?
    - Suggested answer shape: one sentence naming the lifecycle gate plus one sentence explaining why
    - Why this question was asked: Archive completion should capture analysis and handoff readiness, not downstream delivery.
    - What this unlocks next: It determines whether smoke coverage should stop at init/status or continue through archive.
    - Current answer: Archive completion is the main gate because it exposes route resolution, move state, and final handoff destinations.
    - Answered at: 2026-04-20T09:02:00Z
    - Answered by: product-lead
    - Answer evidence: product-owner-clarification
    - State update: archive-aware route validation became mandatory; init/status-only smoke was downgraded
    - Confidence after: high
    - Question useful: yes
    - Answer useful: yes
    - Memory-safe restatement: The product lead stated that archive completion is the decisive lifecycle gate for this run.
    - Canonical entities: archive completion gate; route resolution; move state; handoff destinations
    - Resolved references: `this brainstorm run` -> the current lifecycle smoke validation task
    - Time anchors: question asked 2026-04-20T09:00:00Z; answer recorded 2026-04-20T09:02:00Z
    - Source refs: input_and_qa.md#Q-001; raw_discussion_log.md#Q-001
    - Next action: Compare route-aware options in `finding_and_analyze.md`.
    - Follow-up: Use the answer to compare route-aware options in `finding_and_analyze.md`.

    ## Discussion Entry Template

    ### Entry <id>
    - Timestamp:
    - Recorder:
    - Stage: `finding_and_analyze` | `expert_forum_review` | `outcome_and_handoff`
    - Participants:
    - Entry type: `expert_claim` | `expert_challenge` | `convergence` | `decision_update`
    - Speaker id:
    - Source artifact:
    - Related question card:
    - Raw content (keep original wording as faithfully as practical):
    - Memory-safe restatement:
    - Canonical entities:
    - Resolved references:
    - Time anchors:
    - Source refs:
    - Why it mattered:
    - Decision impact:
    - Follow-up:

    ## Discussion Log

    ### Entry 001
    - Timestamp: 2026-04-20T09:20:00Z
    - Recorder: validation owner
    - Stage: `expert_forum_review`
    - Participants: Lin, Maya, Ravi
    - Entry type: `expert_challenge`
    - Speaker id: expert-panel
    - Source artifact: `expert_forum.md`
    - Related question card: `Q-001`
    - Raw content (keep original wording as faithfully as practical): The panel challenged the idea of keeping init/status-only smoke because that path would miss blocked adapter behavior and shared-boundary regressions.
    - Memory-safe restatement: The expert panel rejected init/status-only smoke because it would miss blocked adapter behavior and brainstorm/shared-knowledge boundary failures.
    - Canonical entities: init/status-only smoke; blocked adapter behavior; shared knowledge boundary
    - Resolved references: `that path` -> init/status-only smoke
    - Time anchors: challenge recorded at 2026-04-20T09:20:00Z
    - Source refs: expert_forum.md#Source-Trace-And-Memory-Safety; raw_discussion_log.md#Q-001
    - Why it mattered: It surfaced the core disagreement that changed the recommended scope.
    - Decision impact: Ruled out minimal smoke coverage as the primary recommendation.
    - Follow-up: Record convergence once the route matrix is agreed.

    ### Entry 002
    - Timestamp: 2026-04-20T09:35:00Z
    - Recorder: validation owner
    - Stage: `outcome_and_handoff`
    - Participants: validation owner
    - Entry type: `decision_update`
    - Speaker id: validation-owner
    - Source artifact: `outcome_and_handoff.md`
    - Related question card: `Q-001`
    - Raw content (keep original wording as faithfully as practical): Final decision is to cover blocked adapter plus complete local/auto/adapter archive routes while keeping shared knowledge promotion out of brainstorm runtime.
    - Memory-safe restatement: The final implementation boundary is route-aware archive smoke coverage plus explicit protection of the shared-knowledge boundary.
    - Canonical entities: blocked adapter route; complete local route; complete auto route; complete adapter route; shared knowledge promotion
    - Resolved references: none
    - Time anchors: decision updated at 2026-04-20T09:35:00Z
    - Source refs: outcome_and_handoff.md#Memory-and-Provenance; expert_forum.md#Source-Trace-And-Memory-Safety; raw_discussion_log.md#Q-001
    - Why it mattered: It is the final mutation that downstream validation and handoff need to follow.
    - Decision impact: Locked the smoke implementation boundary and the archive assertions.
    - Follow-up: Route the final package into archive and validate completion.

    ## Coverage Checklist
    - [x] User clarification questions and answers captured in QA bundles.
    - [x] Material option changes captured.
    - [x] Expert disagreements and convergence captured.
    - [x] Final decision update captured before archive.
    """,
)

write(
    "finding_and_analyze.md",
    f"""
    # Finding and Analyze: {topic}

    - Status: complete

    ## Inputs Linked to Source
    - Key source snippets: The user requested deeper lifecycle smoke coverage for archive, adapter, and route handling.
    - Evidence quality note: Runtime contract and validation expectations were inspected directly from the brainstorm skill.

    ## Frontier Context
    - Recent frontier signal 1 (prefer last 12 months): 2026 validation work is shifting from init-only checks toward route-complete lifecycle coverage.
    - Recent frontier signal 2 (prefer last 12 months): Archive metadata now carries driver resolution, move state, and blocking reasons in one record.
    - Optional frontier signal 3: Adapter manifests allow external routing without embedding those systems in brainstorm core.
    - Known failure case or anti-pattern: A smoke test that only checks init/status misses blocked archive routes and incorrect handoff destinations.
    - Why this frontier context changes the option space: The useful boundary is no longer file scaffolding alone; it is whether archive routing behaves correctly under both fallback and forced-driver paths.

    ## Extracted Findings
    | Finding | Evidence | Confidence (1-5) | Notes |
    |---------|----------|------------------|-------|
    | Archive is the completion gate. | Runtime archive payload records status, move state, and destinations. | 5 | This is where complete vs blocked behavior becomes observable. |
    | Auto routing tolerates inactive adapters. | Auto mode records warnings and falls back to the next route. | 5 | That behavior deserves explicit smoke coverage. |
    | Shared knowledge should remain external. | Brainstorm writes local outcome/summary files only. | 5 | Knowledge promotion belongs to a different skill boundary. |

    ## Option Set (3-7)
    | Option | Summary | Expected Impact | Complexity | Risks |
    |--------|---------|-----------------|------------|-------|
    | Keep init/status-only smoke | Preserve the current minimal check. | Low | Low | Misses archive regressions. |
    | Add one happy-path archive case | Cover local completion only. | Medium | Medium | Leaves adapter and blocked flows untested. |
    | Add route-aware lifecycle scenarios | Cover blocked adapter plus complete local/auto/adapter flows. | High | Medium | Slightly larger smoke harness surface. |

    ## Decision Matrix
    | Option | Impact(1-5) | Effort(1-5) | Risk(1-5) | Confidence(1-5) | Score |
    |--------|-------------|-------------|-----------|------------------|-------|
    | Keep init/status-only smoke | 1 | 5 | 5 | 5 | 6 |
    | Add one happy-path archive case | 3 | 4 | 3 | 4 | 8 |
    | Add route-aware lifecycle scenarios | 5 | 4 | 2 | 5 | 12 |

    ## Recommended Direction
    - Primary: Add route-aware lifecycle scenarios with blocked adapter and complete local/auto/adapter coverage.
    - Fallback: Add a local-only completion case if the harness becomes unstable.
    - Why: It covers the archive contract deeply while keeping runtime boundaries intact.

    ## Open Questions
    - None for this bounded smoke scenario.

    ## Source Trace and Memory Safety
    - Question cards: `Q-001`
    - Raw discussion entry refs: `Entry 001`, `Entry 002`, `Entry 003`, `Entry 004`
    - Canonical entity names: archive completion gate; blocked adapter route; shared knowledge boundary
    - Time anchors or absolute dates: 2026-04-20 clarification and decision cycle

    ## Quality Review Prompt (Agent/Human)
    - Review focus: frontier grounding and option quality.
    - Suggested checklist:
      - Frontier Context captures recent signals plus at least one failure case or anti-pattern.
      - Options respond to the frontier context instead of repeating generic solution families.
      - Recommended direction explains why the chosen path fits current evidence better than the fallback.

    ## Completion Gate
    - [x] Frontier Context contains recent signals and at least one failure case or anti-pattern.
    - [x] At least 3 materially different options were compared.
    - [x] Primary and fallback choices are explicit.
    - [x] Stage status updated before moving to handoff.
    """,
)

write(
    "expert_forum.md",
    """
    ---
    stage_status: complete
    forum_mode: deep_dive_forum
    discussion_clear: true
    final_one_liner: "Proceed with route-aware smoke coverage and keep shared knowledge promotion outside brainstorm runtime."
    user_review_status: approved
    user_review_note: "Archive behavior and route outputs match the intended boundary."
    participants:
      - name: "Lin"
        domain_identity: "workflow maintainer"
        frontier_focus: "recent archive lifecycle regressions and smoke blind spots"
        decision_frame: "contract fidelity over convenience"
        thinking_tilt: "rigorous systems thinker"
      - name: "Maya"
        domain_identity: "delivery operator"
        frontier_focus: "handoff routing that keeps implementation drivers decoupled"
        decision_frame: "operational clarity and fallback safety"
        thinking_tilt: "creative frontier explorer"
      - name: "Ravi"
        domain_identity: "risk reviewer"
        frontier_focus: "boundary violations between planning tools and durable knowledge systems"
        decision_frame: "failure conditions and containment"
        thinking_tilt: "skeptical boundary challenger"
    key_issues:
      - "How do we cover blocked and complete archive behavior without touching runtime code?"
      - "Which route combinations best protect the standalone-first boundary?"
      - "How do we prove brainstorm does not auto-write shared knowledge?"
    key_insights:
      - "Archive is the real lifecycle gate, so smoke coverage must validate route outputs and move semantics."
      - "Auto routing should warn and fall back instead of hard-blocking when one adapter is inactive."
      - "Shared knowledge promotion should stay out of brainstorm and remain an explicit outer decision."
    references: []
    scoring_rules:
      peer_score_scale: "0~10"
      experiment_bonus_scale: "1~5"
      experiment_root: ".bagakit/brainstorm/<discussion-id>/experimental/<expert>-<experiment>/"
    ---

    # 详细结论

    - 一句话结论：把生命周期烟雾测试扩展到 archive 路由，而不是停留在 init/status。
    - 适用边界：适用于需要验证 route 选择、archive move、handoff 落点的 brainstorm 运行时。
    - 暂不纳入范围：下游执行系统真正完成任务的验证。

    # 背景和专家组介绍

    ## 议题背景

    - 主题：Lifecycle smoke coverage
    - 目标：验证 blocked 与 complete archive 行为，并保持 shared knowledge 边界不被突破。
    - 资料范围：brainstorm runtime contract, validation harness, and route adapter schema.

    ## 决策目标与准出条件

    - 决策目标：确定最小但足够的 route-aware smoke 场景集合。
    - 准出条件（必须全部满足）：
      - 条件1：覆盖 `auto`、`local`、`adapter` 三类 route handling。
      - 条件2：至少 1 个 blocked archive 与 1 个 complete archive 被验证。
      - 条件3：证明 brainstorm 未自动写入 shared knowledge surface。

    ## 讨论方法选择（Method Pack）

    - 主方法（必选）：
      - [x] Double Diamond（先澄清问题再收敛方案）
      - [ ] Nominal Group Technique（独立产出 + 轮询 + 排序）
      - [ ] Creative Problem Solving（Clarify -> Ideate -> Develop -> Implement）
      - [ ] Delphi（异步多轮专家收敛）
    - 辅助方法（可选）：轻量红队 review。
    - 选择理由（必须写“该方法解决了什么当前瓶颈”）：该方法解决了“只看模板初始化、看不到 archive 路由行为”的当前瓶颈。

    ## 专家组介绍

    | 专家 | 领域身份 | 前沿认知装备（近期关注与代表观点） | 核心判断框架 | 思维倾向 | 在本议题中的职责 |
    |------|----------|----------------------------------|--------------|----------|------------------|
    | Lin | workflow maintainer | 关注 archive 生命周期盲区与验证断点 | contract fidelity over convenience | rigorous systems thinker | 审核 archive contract |
    | Maya | delivery operator | 关注 route fallback 与 handoff 可消费性 | operational clarity and fallback safety | creative frontier explorer | 评估 route 输出设计 |
    | Ravi | risk reviewer | 关注 planning tool 与 shared knowledge 的边界泄漏 | failure conditions and containment | skeptical boundary challenger | 审核 boundary 风险 |

    # 讨论过程

    ## 论坛议程（按模式执行）

    1. 议题拆解与因果链假设
    2. 专家检索与证据陈述
    3. 交叉评分（0~10）
    4. 本地 MVP 实验提案与执行
    5. 结论收敛与边界声明

    ## 专家检索与证据陈述

    | 专家 | 检索关键词 | 最有用参考 | published_at | authority | 该参考如何支持观点 |
    |------|------------|------------|--------------|-----------|--------------------|
    | Lin | archive lifecycle smoke validation | https://docs.python.org/3/library/argparse.html | 2026-03-01 | official_doc | 说明 CLI contract 应该通过参数化场景被直接验证。 |
    | Maya | route fallback and handoff path contracts | https://git-scm.com/docs/git-worktree | 2025-11-05 | practice_report | 说明显式路径与状态迁移对操作稳定性的重要性。 |
    | Ravi | workflow boundary and knowledge separation | https://packaging.python.org/en/latest/specifications/core-metadata/ | 2026-01-15 | paper | 说明契约边界需要独立验证，不能靠隐式耦合。 |

    ## 认知边界声明

    - Lin：若 archive payload 不再暴露 driver 和 move state，这套 smoke 的适用边界会失效。
    - Maya：若下游 handoff 改为非文件型接口，当前 destination 条件需要调整，不确定性在输出介质。
    - Ravi：若 brainstorm 开始承担 shared knowledge promotion，当前边界前提会变化，必须重新划分条件。

    ## 交叉评分（0~10）

    | 评分人 | 被评分专家 | 分数(0~10) | 评分理由 |
    |--------|------------|------------|----------|
    | Lin | Maya | 8 | 充分覆盖 route fallback 与 handoff 可消费性。 |
    | Maya | Ravi | 9 | 清楚指出 shared knowledge 边界与失效条件。 |
    | Ravi | Lin | 8 | 把 archive contract 作为主验证面，判断稳健。 |

    ## 实验设计与本地 MVP

    - 推荐路径（实验根目录）：`.bagakit/brainstorm/<discussion-id>/experimental/<expert>-<experiment>/`
    - 假设：多场景 smoke 可以在不改 runtime 的前提下覆盖 blocked 与 complete archive。
    - 最小实现：用隔离 scenario root 分别运行 local、auto、adapter lifecycle。
    - 观点成立验证：检查 archive.json、archive move、route-specific outputs。
    - 工具可用验证：确认 smoke harness 可以稳定生成最小合法 artifact 并断言结果。
    - 验证信号：complete route 输出存在、blocked route 输出被抑制、shared knowledge surface 仍为空。
    - 结果：可行。
    - 对结论影响：支持扩展 smoke 覆盖。

    ## MVP验证结果（观点成立与工具可用）

    | 实验 | 观点成立验证 | 工具可用验证 | 结论 |
    |------|--------------|--------------|------|
    | route-aware smoke harness | archive metadata and filesystem outputs match expectations | isolated roots keep scenarios deterministic | pass |

    ## 实验改动边界（强制）

    - 源文改动：禁止
    - 实验副本路径：`.bagakit/brainstorm/<discussion-id>/experimental/<expert>-<experiment>/`
    - 版本约束：版本产物必须放在实验目录内的 `vN-<semantic-description>/` 子目录。
    - 约束声明：所有改动仅限 `experimental/` 目录内产物；原始文档与源码不直接修改。
    - 额外说明：本次 smoke harness 不创建实验目录，因为验证目标是 archive route 行为本身。

    ## 结论收敛记录

    - 共识：最有价值的新增覆盖是 blocked adapter、complete local、complete auto、complete adapter。
    - 分歧：是否还需要再补一个 auto->local fallback 场景。
    - 需后续验证项：如果 archive payload 结构变化，需同步更新 smoke 断言。

    ## Source Trace And Memory Safety

    - 原始讨论条目引用（`Entry ###`）：`Entry 001`, `Entry 002`, `Entry 003`, `Entry 004`
    - 关键 question card 引用（`Q-###`）：`Q-001`
    - 关键实体的 canonical 名称与消歧说明：`archive completion gate` 指 brainstorm lifecycle archive gate，不指 downstream execution completion
    - 相对时间短语及其绝对锚点：`recent`/`now` in this run refer to the 2026-04-20 review cycle
    - 引述与转述说明（quote / paraphrase）：结论段和 handoff 段为 paraphrase；原始措辞保留在 `raw_discussion_log.md`

    ## 会议结论清晰度判定

    - [x] 关键问题与关键洞察已沉淀到 frontmatter
    - [x] `final_one_liner` 已更新为明确结论句
    - [x] `discussion_clear` 已设置为 `true`
    - [x] 若议题属于快变领域，至少 1 位专家明确写出当前结论的时效边界。

    ## 用户评判与确认

    - 评判人：validation owner
    - 评判结论（`approved` / `changes_requested`）：approved
    - 评判意见摘要：场景覆盖深度已足够，且 shared knowledge 边界保持清晰。
    - 回填要求：frontmatter `user_review_status` 已更新为最终状态，并填写 `user_review_note`。

    ## Quality Review Prompt (Agent/Human)

    - Review focus: forum depth and convergence quality.
    - Suggested checklist:
      - 关键议题会改变结论而不是停留在格式项。
      - 证据与观点映射清晰，可追溯到参考或实验信号。
      - 结论收敛记录明确写出共识、分歧、后续验证项。
    """,
)

write(
    "outcome_and_handoff.md",
    f"""
    # Outcome and Handoff: {topic}

    - Status: complete

    ## Outcome Summary
    - Chosen direction: Expand smoke coverage to blocked adapter plus complete local/auto/adapter archive routes.
    - Why now: Current smoke only validates initialization and misses the actual lifecycle gate.
    - Expected outcome: Route handling and archive move behavior become regression-visible.

    ## Handoff Package
    | Item | Destination Path/ID | Owner | Notes |
    |------|----------------------|-------|-------|
    | Action handoff | Route-specific file selected by the archive command | validation harness | Assert per-driver destination after archive. |
    | Memory handoff | Brainstorm-owned local outcome or summary file | validation harness | Must stay under `.bagakit/brainstorm/outcome/`. |
    | Unified local handoff artifact | `.bagakit/brainstorm/outcome/brainstorm-handoff-<slug>.md` | validation harness | Used only when local fallback is selected. |

    ## Action Checklist (Analysis Scope)
    - [x] Decision rationale captured.
    - [x] Expert forum reviewed and discussion is marked clear.
    - [x] User review completed and `user_review_status=approved`.
    - [x] Risks and guardrails listed.
    - [x] Validation steps and signals defined.
    - [x] If MVP had multiple versions, each version would stay under `experimental/<expert>-<experiment>/vN-<semantic-description>/`.

    ## Risks and Mitigations
    | Risk | Trigger | Mitigation | Owner |
    |------|---------|------------|-------|
    | Route coverage becomes stale | Archive payload changes | Keep smoke assertions aligned with current payload fields. | validation owner |
    | Boundary leakage | Brainstorm starts writing outside its outcome/archive surfaces | Assert knowledge surfaces remain absent. | risk reviewer |

    ## Memory and Provenance
    - Raw discussion entry refs: `Entry 002`, `Entry 003`, `Entry 004`
    - Question card refs: `Q-001`
    - Forum refs: `final_one_liner`, `key_issues`, `key_insights`, `Source Trace And Memory Safety`
    - Canonical entity names: archive completion gate; route-aware smoke coverage; shared knowledge promotion
    - Time anchors or absolute dates: 2026-04-20 review cycle
    - Quote/paraphrase note: this artifact is a paraphrased handoff summary; raw wording remains in `raw_discussion_log.md`

    ## Completion Definition
    - Brainstorm completion means analysis and handoff are done.
    - Downstream implementation execution is tracked elsewhere.

    ## Completion Gate
    - [x] `expert_forum.md` frontmatter includes clear participants/issues/insights/one-liner.
    - [x] `expert_forum.md` sets `discussion_clear: true`.
    - [x] `expert_forum.md` sets `user_review_status: approved`.
    - [x] Handoff destinations are explicit.
    - [x] Archive command is ready to run.
    - [x] Stage status set to `complete` when analysis/handoff closes.
    """,
)
PY
}

write_adapter_manifest() {
  local scenario_root="$1"
  local file_name="$2"
  local adapter_id="$3"
  local priority="$4"
  local path_template="$5"
  local target_template="$6"
  local required_meta_csv="${7:-}"
  local when_paths_csv="${8:-}"

  python3 - "$scenario_root" "$file_name" "$adapter_id" "$priority" "$path_template" "$target_template" "$required_meta_csv" "$when_paths_csv" <<'PY'
import json
import sys
from pathlib import Path

scenario_root = Path(sys.argv[1])
file_name = sys.argv[2]
adapter_id = sys.argv[3]
priority = int(sys.argv[4])
path_template = sys.argv[5]
target_template = sys.argv[6]
required_meta = [item for item in sys.argv[7].split(",") if item]
when_paths_exist = [item for item in sys.argv[8].split(",") if item]

registry = scenario_root / ".bagakit" / "brainstorm" / "adapters" / "action"
registry.mkdir(parents=True, exist_ok=True)
(registry / file_name).write_text(
    json.dumps(
        {
            "id": adapter_id,
            "priority": priority,
            "path_template": path_template,
            "target_template": target_template,
            "required_meta": required_meta,
            "when_paths_exist": when_paths_exist,
        },
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
PY
}

INIT_ROOT="$TMP_DIR/init"
INIT_ARTIFACT="$(init_artifact "$INIT_ROOT" "Init smoke demo" "init-smoke" --with-review-quality --with-eval-effect-review)"

[[ -f "$INIT_ARTIFACT/input_and_qa.md" ]]
[[ -f "$INIT_ARTIFACT/raw_discussion_log.md" ]]
[[ -f "$INIT_ARTIFACT/finding_and_analyze.md" ]]
[[ -f "$INIT_ARTIFACT/expert_forum.md" ]]
[[ -f "$INIT_ARTIFACT/outcome_and_handoff.md" ]]
[[ -f "$INIT_ARTIFACT/review_quality.md" ]]
[[ -f "$INIT_ARTIFACT/eval_effect_review.md" ]]

INIT_STATUS_OUTPUT="$(python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" status --root "$INIT_ROOT" --dir "$INIT_ARTIFACT")"
assert_output_line "$INIT_STATUS_OUTPUT" "artifact_scope=runs"
assert_output_line "$INIT_STATUS_OUTPUT" "required_total=4"
assert_output_line "$INIT_STATUS_OUTPUT" "required_complete=0"
assert_output_line "$INIT_STATUS_OUTPUT" "next_stage=input_and_qa"
assert_output_line "$INIT_STATUS_OUTPUT" "support_raw_discussion_log=in_progress"
assert_output_line "$INIT_STATUS_OUTPUT" "raw_discussion_log_gate=fail"
assert_output_line "$INIT_STATUS_OUTPUT" "archive_status=missing"

BLOCKED_ROOT="$TMP_DIR/blocked-adapter"
BLOCKED_ARTIFACT="$(init_artifact "$BLOCKED_ROOT" "Blocked adapter demo" "blocked-route")"
write_complete_artifact "$BLOCKED_ARTIFACT" "Blocked adapter demo"
mkdir -p "$BLOCKED_ROOT/.bagakit/tickets"
write_adapter_manifest \
  "$BLOCKED_ROOT" \
  "ticket-route.json" \
  "ticket-route" \
  "150" \
  ".bagakit/tickets/{item_id}-{slug}.md" \
  "ticket:{item_id}" \
  "item_id" \
  ".bagakit/tickets"

if BLOCKED_ARCHIVE_OUTPUT="$(
  python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" archive \
    --root "$BLOCKED_ROOT" \
    --dir "$BLOCKED_ARTIFACT" \
    --driver adapter \
    --adapter-id ticket-route
)"; then
  echo "error: adapter archive without required meta unexpectedly passed" >&2
  exit 1
fi

assert_output_line "$BLOCKED_ARCHIVE_OUTPUT" "status=blocked"
assert_output_line "$BLOCKED_ARCHIVE_OUTPUT" "artifact_moved=false"
assert_output_line "$BLOCKED_ARCHIVE_OUTPUT" "selected_driver=adapter"
assert_output_line "$BLOCKED_ARCHIVE_OUTPUT" "resolved_driver=adapter"
assert_output_line "$BLOCKED_ARCHIVE_OUTPUT" "resolved_adapter=none"
assert_output_line "$BLOCKED_ARCHIVE_OUTPUT" "action_path=<unresolved>"
assert_output_line "$BLOCKED_ARCHIVE_OUTPUT" "action_target=<unresolved>"
assert_output_line "$BLOCKED_ARCHIVE_OUTPUT" "memory_target=<unresolved>"
assert_output_line "$BLOCKED_ARCHIVE_OUTPUT" "memory_path=<unresolved>"
assert_contains_line "$BLOCKED_ARCHIVE_OUTPUT" "blocked_reason=adapter route: adapter ticket-route missing required meta: item_id"
test -f "$BLOCKED_ARTIFACT/archive.json"
test ! -f "$BLOCKED_ROOT/.bagakit/tickets/blocked-route.md"
test ! -f "$BLOCKED_ROOT/.bagakit/brainstorm/outcome/brainstorm-handoff-blocked-route.md"
test ! -f "$BLOCKED_ROOT/.bagakit/brainstorm/outcome/brainstorm-summary-blocked-route.md"

BLOCKED_STATUS_OUTPUT="$(python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" status --root "$BLOCKED_ROOT" --dir "$BLOCKED_ARTIFACT")"
assert_output_line "$BLOCKED_STATUS_OUTPUT" "artifact_scope=runs"
assert_output_line "$BLOCKED_STATUS_OUTPUT" "required_complete=4"
assert_output_line "$BLOCKED_STATUS_OUTPUT" "archive_status=blocked"
assert_output_line "$BLOCKED_STATUS_OUTPUT" "expert_forum_gate=pass"
assert_output_line "$BLOCKED_STATUS_OUTPUT" "input_and_qa_gate=pass"

python3 - "$BLOCKED_ARTIFACT/archive.json" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert payload["status"] == "blocked"
assert payload["artifact_moved"] is False
assert payload["driver"]["selected"] == "adapter"
assert payload["driver"]["resolved"] == "adapter"
assert payload["driver"]["route_kind"] == "adapter"
assert payload["driver"]["resolved_adapter"] is None
assert payload["handoff"]["action"]["target"] == "<unresolved>"
assert payload["handoff"]["action"]["path"] == "<unresolved>"
assert payload["handoff"]["memory"]["target"] == "<unresolved>"
assert payload["handoff"]["memory"]["path"] == "<unresolved>"
assert payload["checks"]["action_destination_resolved"] is False
assert payload["checks"]["memory_destination_resolved"] is False
assert any("missing required meta: item_id" in item for item in payload["blocking_reasons"])
PY

if python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" check-complete --root "$BLOCKED_ROOT" --dir "$BLOCKED_ARTIFACT" >/dev/null 2>&1; then
  echo "error: blocked brainstorm artifact unexpectedly passed check-complete" >&2
  exit 1
fi

assert_no_shared_knowledge_surface "$BLOCKED_ROOT"

LOCAL_ROOT="$TMP_DIR/local-complete"
LOCAL_ARTIFACT="$(init_artifact "$LOCAL_ROOT" "Local route demo" "local-route")"
write_complete_artifact "$LOCAL_ARTIFACT" "Local route demo"

LOCAL_ARCHIVE_OUTPUT="$(
  python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" archive \
    --root "$LOCAL_ROOT" \
    --dir "$LOCAL_ARTIFACT" \
    --driver local
)"
LOCAL_ARTIFACT_NAME="$(basename "$LOCAL_ARTIFACT")"
LOCAL_ARCHIVE_DIR="$LOCAL_ROOT/.bagakit/brainstorm/archive/$LOCAL_ARTIFACT_NAME"
LOCAL_ARCHIVE_JSON="$LOCAL_ARCHIVE_DIR/archive.json"
LOCAL_OUTCOME_PATH="$LOCAL_ROOT/.bagakit/brainstorm/outcome/brainstorm-handoff-local-route.md"

assert_output_line "$LOCAL_ARCHIVE_OUTPUT" "status=complete"
assert_output_line "$LOCAL_ARCHIVE_OUTPUT" "artifact_moved=true"
assert_output_line "$LOCAL_ARCHIVE_OUTPUT" "selected_driver=local"
assert_output_line "$LOCAL_ARCHIVE_OUTPUT" "resolved_driver=local"
assert_output_line "$LOCAL_ARCHIVE_OUTPUT" "resolved_adapter=none"
assert_output_line "$LOCAL_ARCHIVE_OUTPUT" "action_target=local-outcome"
assert_output_line "$LOCAL_ARCHIVE_OUTPUT" "memory_target=local-outcome-unified"
assert_output_line "$LOCAL_ARCHIVE_OUTPUT" "warning_count=0"
test -d "$LOCAL_ARCHIVE_DIR"
test ! -d "$LOCAL_ARTIFACT"
test -f "$LOCAL_OUTCOME_PATH"
test ! -f "$LOCAL_ROOT/.bagakit/brainstorm/outcome/brainstorm-summary-local-route.md"
grep -q ".bagakit/brainstorm/archive/$LOCAL_ARTIFACT_NAME" "$LOCAL_OUTCOME_PATH"

LOCAL_STATUS_OUTPUT="$(python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" status --root "$LOCAL_ROOT" --dir "$LOCAL_ARTIFACT")"
assert_output_line "$LOCAL_STATUS_OUTPUT" "artifact_scope=archive"
assert_output_line "$LOCAL_STATUS_OUTPUT" "required_complete=4"
assert_output_line "$LOCAL_STATUS_OUTPUT" "archive_status=complete"

python3 - "$LOCAL_ARCHIVE_JSON" "$LOCAL_ARTIFACT_NAME" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
artifact_name = sys.argv[2]
assert payload["status"] == "complete"
assert payload["artifact_moved"] is True
assert payload["source_artifact"] == f".bagakit/brainstorm/runs/{artifact_name}"
assert payload["archived_artifact"] == f".bagakit/brainstorm/archive/{artifact_name}"
assert payload["driver"]["selected"] == "local"
assert payload["driver"]["resolved"] == "local"
assert payload["driver"]["resolved_adapter"] is None
assert payload["handoff"]["action"]["target"] == "local-outcome"
assert payload["handoff"]["action"]["path"] == ".bagakit/brainstorm/outcome/brainstorm-handoff-local-route.md"
assert payload["handoff"]["memory"]["target"] == "local-outcome-unified"
assert payload["handoff"]["memory"]["path"] == ".bagakit/brainstorm/outcome/brainstorm-handoff-local-route.md"
assert payload["checks"]["artifact_moved_on_complete"] is True
assert payload["blocking_reasons"] == []
assert payload["non_blocking_warnings"] == []
PY

python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" check-complete --root "$LOCAL_ROOT" --dir "$LOCAL_ARTIFACT" >/dev/null
assert_no_shared_knowledge_surface "$LOCAL_ROOT"

AUTO_ROOT="$TMP_DIR/auto-complete"
AUTO_ARTIFACT="$(init_artifact "$AUTO_ROOT" "Auto route demo" "auto-route")"
write_complete_artifact "$AUTO_ARTIFACT" "Auto route demo"
mkdir -p "$AUTO_ROOT/.bagakit/workflow/items"
write_adapter_manifest \
  "$AUTO_ROOT" \
  "sleeping-route.json" \
  "sleeping-route" \
  "300" \
  ".bagakit/sleeping/items/{item_id}-{slug}.md" \
  "sleeping:{item_id}" \
  "item_id" \
  ".bagakit/sleeping/items"
write_adapter_manifest \
  "$AUTO_ROOT" \
  "workflow-route.json" \
  "workflow-route" \
  "200" \
  ".bagakit/workflow/items/handoff-{item_id}-{slug}.md" \
  "workflow:{item_id}" \
  "item_id" \
  ".bagakit/workflow/items"

AUTO_ARCHIVE_OUTPUT="$(
  python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" archive \
    --root "$AUTO_ROOT" \
    --dir "$AUTO_ARTIFACT" \
    --driver auto \
    --meta item_id=ITEM-200
)"
AUTO_ARTIFACT_NAME="$(basename "$AUTO_ARTIFACT")"
AUTO_ARCHIVE_DIR="$AUTO_ROOT/.bagakit/brainstorm/archive/$AUTO_ARTIFACT_NAME"
AUTO_ARCHIVE_JSON="$AUTO_ARCHIVE_DIR/archive.json"
AUTO_ACTION_PATH="$AUTO_ROOT/.bagakit/workflow/items/handoff-ITEM-200-auto-route.md"
AUTO_SUMMARY_PATH="$AUTO_ROOT/.bagakit/brainstorm/outcome/brainstorm-summary-auto-route.md"

assert_output_line "$AUTO_ARCHIVE_OUTPUT" "status=complete"
assert_output_line "$AUTO_ARCHIVE_OUTPUT" "artifact_moved=true"
assert_output_line "$AUTO_ARCHIVE_OUTPUT" "selected_driver=auto"
assert_output_line "$AUTO_ARCHIVE_OUTPUT" "resolved_driver=adapter"
assert_output_line "$AUTO_ARCHIVE_OUTPUT" "resolved_adapter=workflow-route"
assert_output_line "$AUTO_ARCHIVE_OUTPUT" "action_target=workflow:ITEM-200"
assert_output_line "$AUTO_ARCHIVE_OUTPUT" "memory_target=local-summary"
assert_output_line "$AUTO_ARCHIVE_OUTPUT" "warning_count=1"
assert_contains_line "$AUTO_ARCHIVE_OUTPUT" "warn=auto route: adapter sleeping-route inactive: required path missing (.bagakit/sleeping/items); fallback to next adapter"
test -d "$AUTO_ARCHIVE_DIR"
test -f "$AUTO_ACTION_PATH"
test -f "$AUTO_SUMMARY_PATH"
test ! -f "$AUTO_ROOT/.bagakit/brainstorm/outcome/brainstorm-handoff-auto-route.md"
grep -q ".bagakit/brainstorm/archive/$AUTO_ARTIFACT_NAME" "$AUTO_ACTION_PATH"
grep -q ".bagakit/brainstorm/archive/$AUTO_ARTIFACT_NAME" "$AUTO_SUMMARY_PATH"

AUTO_STATUS_OUTPUT="$(python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" status --root "$AUTO_ROOT" --dir "$AUTO_ARTIFACT")"
assert_output_line "$AUTO_STATUS_OUTPUT" "artifact_scope=archive"
assert_output_line "$AUTO_STATUS_OUTPUT" "archive_status=complete"

python3 - "$AUTO_ARCHIVE_JSON" "$AUTO_ARTIFACT_NAME" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
artifact_name = sys.argv[2]
assert payload["status"] == "complete"
assert payload["source_artifact"] == f".bagakit/brainstorm/runs/{artifact_name}"
assert payload["archived_artifact"] == f".bagakit/brainstorm/archive/{artifact_name}"
assert payload["driver"]["selected"] == "auto"
assert payload["driver"]["resolved"] == "adapter"
assert payload["driver"]["resolved_adapter"] == "workflow-route"
assert payload["handoff"]["action"]["target"] == "workflow:ITEM-200"
assert payload["handoff"]["action"]["path"] == ".bagakit/workflow/items/handoff-ITEM-200-auto-route.md"
assert payload["handoff"]["memory"]["target"] == "local-summary"
assert payload["handoff"]["memory"]["path"] == ".bagakit/brainstorm/outcome/brainstorm-summary-auto-route.md"
assert payload["checks"]["artifact_moved_on_complete"] is True
assert len(payload["non_blocking_warnings"]) == 1
assert "sleeping-route inactive" in payload["non_blocking_warnings"][0]
PY

python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" check-complete --root "$AUTO_ROOT" --dir "$AUTO_ARTIFACT" >/dev/null
assert_no_shared_knowledge_surface "$AUTO_ROOT"

ADAPTER_ROOT="$TMP_DIR/adapter-complete"
ADAPTER_ARTIFACT="$(init_artifact "$ADAPTER_ROOT" "Adapter route demo" "adapter-route")"
write_complete_artifact "$ADAPTER_ARTIFACT" "Adapter route demo"
mkdir -p "$ADAPTER_ROOT/.bagakit/tickets"
write_adapter_manifest \
  "$ADAPTER_ROOT" \
  "ticket-route.json" \
  "ticket-route" \
  "200" \
  ".bagakit/tickets/{item_id}-{slug}.md" \
  "ticket:{item_id}" \
  "item_id" \
  ".bagakit/tickets"

ADAPTER_ARCHIVE_OUTPUT="$(
  python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" archive \
    --root "$ADAPTER_ROOT" \
    --dir "$ADAPTER_ARTIFACT" \
    --driver adapter \
    --adapter-id ticket-route \
    --meta item_id=TICKET-9
)"
ADAPTER_ARTIFACT_NAME="$(basename "$ADAPTER_ARTIFACT")"
ADAPTER_ARCHIVE_DIR="$ADAPTER_ROOT/.bagakit/brainstorm/archive/$ADAPTER_ARTIFACT_NAME"
ADAPTER_ARCHIVE_JSON="$ADAPTER_ARCHIVE_DIR/archive.json"
ADAPTER_ACTION_PATH="$ADAPTER_ROOT/.bagakit/tickets/TICKET-9-adapter-route.md"
ADAPTER_SUMMARY_PATH="$ADAPTER_ROOT/.bagakit/brainstorm/outcome/brainstorm-summary-adapter-route.md"

assert_output_line "$ADAPTER_ARCHIVE_OUTPUT" "status=complete"
assert_output_line "$ADAPTER_ARCHIVE_OUTPUT" "artifact_moved=true"
assert_output_line "$ADAPTER_ARCHIVE_OUTPUT" "selected_driver=adapter"
assert_output_line "$ADAPTER_ARCHIVE_OUTPUT" "resolved_driver=adapter"
assert_output_line "$ADAPTER_ARCHIVE_OUTPUT" "resolved_adapter=ticket-route"
assert_output_line "$ADAPTER_ARCHIVE_OUTPUT" "action_target=ticket:TICKET-9"
assert_output_line "$ADAPTER_ARCHIVE_OUTPUT" "memory_target=local-summary"
assert_output_line "$ADAPTER_ARCHIVE_OUTPUT" "warning_count=0"
test -d "$ADAPTER_ARCHIVE_DIR"
test -f "$ADAPTER_ACTION_PATH"
test -f "$ADAPTER_SUMMARY_PATH"
test ! -f "$ADAPTER_ROOT/.bagakit/brainstorm/outcome/brainstorm-handoff-adapter-route.md"
grep -q ".bagakit/brainstorm/archive/$ADAPTER_ARTIFACT_NAME" "$ADAPTER_ACTION_PATH"
grep -q ".bagakit/brainstorm/archive/$ADAPTER_ARTIFACT_NAME" "$ADAPTER_SUMMARY_PATH"

ADAPTER_STATUS_OUTPUT="$(python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" status --root "$ADAPTER_ROOT" --dir "$ADAPTER_ARTIFACT")"
assert_output_line "$ADAPTER_STATUS_OUTPUT" "artifact_scope=archive"
assert_output_line "$ADAPTER_STATUS_OUTPUT" "archive_status=complete"

python3 - "$ADAPTER_ARCHIVE_JSON" "$ADAPTER_ARTIFACT_NAME" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
artifact_name = sys.argv[2]
assert payload["status"] == "complete"
assert payload["source_artifact"] == f".bagakit/brainstorm/runs/{artifact_name}"
assert payload["archived_artifact"] == f".bagakit/brainstorm/archive/{artifact_name}"
assert payload["driver"]["selected"] == "adapter"
assert payload["driver"]["resolved"] == "adapter"
assert payload["driver"]["resolved_adapter"] == "ticket-route"
assert payload["handoff"]["action"]["target"] == "ticket:TICKET-9"
assert payload["handoff"]["action"]["path"] == ".bagakit/tickets/TICKET-9-adapter-route.md"
assert payload["handoff"]["memory"]["target"] == "local-summary"
assert payload["handoff"]["memory"]["path"] == ".bagakit/brainstorm/outcome/brainstorm-summary-adapter-route.md"
assert payload["checks"]["artifact_moved_on_complete"] is True
assert payload["blocking_reasons"] == []
assert payload["non_blocking_warnings"] == []
PY

python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" check-complete --root "$ADAPTER_ROOT" --dir "$ADAPTER_ARTIFACT" >/dev/null
assert_no_shared_knowledge_surface "$ADAPTER_ROOT"

COLLISION_ROOT="$TMP_DIR/adapter-label-collision"
COLLISION_ARTIFACT="$(init_artifact "$COLLISION_ROOT" "Collision route demo" "collision-route")"
write_complete_artifact "$COLLISION_ARTIFACT" "Collision route demo"
mkdir -p "$COLLISION_ROOT/.bagakit/collision/items"
write_adapter_manifest \
  "$COLLISION_ROOT" \
  "collision-route.json" \
  "collision-route" \
  "250" \
  ".bagakit/collision/items/{item_id}-{slug}.md" \
  "local-outcome" \
  "item_id" \
  ".bagakit/collision/items"

COLLISION_ARCHIVE_OUTPUT="$(
  python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" archive \
    --root "$COLLISION_ROOT" \
    --dir "$COLLISION_ARTIFACT" \
    --driver adapter \
    --adapter-id collision-route \
    --meta item_id=ITEM-777
)"
COLLISION_ACTION_PATH="$COLLISION_ROOT/.bagakit/collision/items/ITEM-777-collision-route.md"
COLLISION_SUMMARY_PATH="$COLLISION_ROOT/.bagakit/brainstorm/outcome/brainstorm-summary-collision-route.md"
assert_output_line "$COLLISION_ARCHIVE_OUTPUT" "status=complete"
assert_output_line "$COLLISION_ARCHIVE_OUTPUT" "resolved_driver=adapter"
assert_output_line "$COLLISION_ARCHIVE_OUTPUT" "resolved_adapter=collision-route"
assert_output_line "$COLLISION_ARCHIVE_OUTPUT" "action_target=local-outcome"
assert_output_line "$COLLISION_ARCHIVE_OUTPUT" "memory_target=local-summary"
test -f "$COLLISION_ACTION_PATH"
test -f "$COLLISION_SUMMARY_PATH"
test ! -f "$COLLISION_ROOT/.bagakit/brainstorm/outcome/brainstorm-handoff-collision-route.md"

CONFLICT_ROOT="$TMP_DIR/archive-conflict"
CONFLICT_ARTIFACT="$(init_artifact "$CONFLICT_ROOT" "Conflict route demo" "conflict-route")"
write_complete_artifact "$CONFLICT_ARTIFACT" "Conflict route demo"
mkdir -p "$CONFLICT_ROOT/.bagakit/brainstorm/archive/$(basename "$CONFLICT_ARTIFACT")"
CONFLICT_OUTPUT_PATH="$CONFLICT_ROOT/.bagakit/brainstorm/outcome/brainstorm-handoff-conflict-route.md"
rm -f "$CONFLICT_OUTPUT_PATH"
if CONFLICT_ARCHIVE_OUTPUT="$(
  python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" archive \
    --root "$CONFLICT_ROOT" \
    --dir "$CONFLICT_ARTIFACT" \
    --driver local
)"; then
  echo "error: archive with preexisting destination unexpectedly passed" >&2
  exit 1
fi
assert_output_line "$CONFLICT_ARCHIVE_OUTPUT" "status=blocked"
assert_output_line "$CONFLICT_ARCHIVE_OUTPUT" "resolved_driver=local"
assert_output_line "$CONFLICT_ARCHIVE_OUTPUT" "artifact_moved=false"
assert_contains_line "$CONFLICT_ARCHIVE_OUTPUT" "blocked_reason=archive destination already exists:"
test ! -f "$CONFLICT_OUTPUT_PATH"
test -d "$CONFLICT_ARTIFACT"
test -f "$CONFLICT_ARTIFACT/archive.json"

FORGED_ROOT="$TMP_DIR/forged-archive"
FORGED_ARTIFACT="$(init_artifact "$FORGED_ROOT" "Forged archive demo" "forged-route")"
write_complete_artifact "$FORGED_ARTIFACT" "Forged archive demo"
cat >"$FORGED_ARTIFACT/archive.json" <<'JSON'
{
  "version": 2,
  "status": "complete",
  "checks": {
    "required_stages_complete": true,
    "input_and_qa_gate_clear": true,
    "raw_discussion_log_gate_clear": true,
    "expert_forum_gate_clear": true,
    "action_destination_resolved": false,
    "memory_destination_resolved": false,
    "archive_written": true
  }
}
JSON
if FORGED_OUTPUT="$(
  python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" check-complete \
    --root "$FORGED_ROOT" \
    --dir "$FORGED_ARTIFACT"
)"; then
  echo "error: forged archive unexpectedly passed check-complete" >&2
  exit 1
fi
assert_output_line "$FORGED_OUTPUT" "TASK NOT COMPLETE"
assert_output_line "$FORGED_OUTPUT" "archive_check_action_destination_resolved=False"

STALE_ROOT="$TMP_DIR/stale-archive"
STALE_ARTIFACT="$(init_artifact "$STALE_ROOT" "Stale archive demo" "stale-route")"
write_complete_artifact "$STALE_ARTIFACT" "Stale archive demo"
STALE_ARCHIVE_OUTPUT="$(
  python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" archive \
    --root "$STALE_ROOT" \
    --dir "$STALE_ARTIFACT" \
    --driver local
)"
assert_output_line "$STALE_ARCHIVE_OUTPUT" "status=complete"
STALE_HANDOFF="$STALE_ROOT/.bagakit/brainstorm/outcome/brainstorm-handoff-stale-route.md"
rm -f "$STALE_HANDOFF"
if STALE_CHECK_OUTPUT="$(
  python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" check-complete \
    --root "$STALE_ROOT" \
    --dir "$STALE_ARTIFACT"
)"; then
  echo "error: stale archive unexpectedly passed check-complete" >&2
  exit 1
fi
assert_output_line "$STALE_CHECK_OUTPUT" "TASK NOT COMPLETE"
assert_contains_line "$STALE_CHECK_OUTPUT" "archive_handoff_action_missing="

DUPLICATE_ROOT="$TMP_DIR/duplicate-adapter"
DUPLICATE_ARTIFACT="$(init_artifact "$DUPLICATE_ROOT" "Duplicate adapter demo" "duplicate-route")"
write_complete_artifact "$DUPLICATE_ARTIFACT" "Duplicate adapter demo"
mkdir -p "$DUPLICATE_ROOT/.bagakit/dup/items"
write_adapter_manifest \
  "$DUPLICATE_ROOT" \
  "duplicate-a.json" \
  "dup-route" \
  "200" \
  ".bagakit/dup/items/a-{item_id}-{slug}.md" \
  "dup:{item_id}" \
  "item_id" \
  ".bagakit/dup/items"
write_adapter_manifest \
  "$DUPLICATE_ROOT" \
  "duplicate-b.json" \
  "dup-route" \
  "100" \
  ".bagakit/dup/items/b-{item_id}-{slug}.md" \
  "dup:{item_id}" \
  "item_id" \
  ".bagakit/dup/items"
DUPLICATE_OUTPUT_FILE="$TMP_DIR/duplicate-adapter.out"
if python3 "$SKILL_DIR/scripts/bagakit-brainstorm.py" archive \
  --root "$DUPLICATE_ROOT" \
  --dir "$DUPLICATE_ARTIFACT" \
  --driver adapter \
  --adapter-id dup-route \
  --meta item_id=ITEM-2 >"$DUPLICATE_OUTPUT_FILE" 2>&1; then
  DUPLICATE_STATUS=0
else
  DUPLICATE_STATUS=$?
fi
DUPLICATE_OUTPUT="$(cat "$DUPLICATE_OUTPUT_FILE")"
if [[ "$DUPLICATE_STATUS" -eq 0 ]]; then
  echo "error: duplicate adapter ids unexpectedly passed" >&2
  exit 1
fi
assert_contains_line "$DUPLICATE_OUTPUT" "error: duplicate adapter id dup-route declared in"

echo "ok: bagakit-brainstorm lifecycle smoke passed"
