# Tool Orchestration

Use this reference when a Goal file must coordinate project-specific planning,
spec, research, sidecar, or execution tools.

## Core Rule

The Goal coordinates tools; it does not replace them.

For each tool, record only:

- whether the tool is active, unavailable, or not needed
- the authoritative file or id
- the current state that changes execution
- the next action or stop condition

## Team Mode And Parallelism

Use parallel or Team-mode execution when:

- independent research, review, implementation, or validation branches can run
  without writing the same files
- a sidecar analysis can evaluate user concerns while the main agent inspects
  local state
- an executor/reviewer split would improve quality

Do not use parallelism when:

- branches would edit the same files without a merge plan
- privacy, cost, publication, or irreversible actions need user approval
- the Goal lacks a clear acceptance bar

Record Team-mode decisions in the Goal as:

```markdown
- Team mode: <not_needed|recommended|active|blocked>
- Parallel branches: <branch -> owner/output/ref>
- Merge rule: <how branch outputs become Goal deltas or owner-file updates>
```

## Grok Sidecar

Grok sidecar is analysis, not execution.

Use sidecar analysis for:

- new user ideas that may widen, narrow, or redirect the target
- doubts about whether the current path still matches the final goal
- risk statements, counterarguments, or alternate strategies
- questions where an external reasoning pass can surface hidden assumptions

Rules:

- Grok output must not directly become code or implementation.
- Distill output into a Goal delta, open question, risk, non-goal, acceptance
  criterion, or pointer to an owner file.
- If Grok is unavailable, record `grok_pending` or `grok_unavailable` instead
  of pretending the review happened.

## OpenSpec Or Spec Tools

When an OpenSpec-like tool exists:

- specs own formal requirements, proposals, accepted changes, and compatibility
  constraints
- the Goal records spec ids, status, and which spec gates affect execution
- Goal deltas that change promised behavior should route into the spec tool
  before execution proceeds

Goal entry:

```markdown
- Specs: <spec id/path/status>
- Spec gate: <what must be accepted or checked before implementation>
```

## Plan On Fire, Brainstorm, And Planning Notes

Use planning tools for details and alternatives.

- Brainstorm owns raw discussion, option exploration, trade-offs, and expert
  review.
- Plan files own concrete implementation decomposition.
- Plan on Fire or equivalent task tools own volatile planning state.

The Goal records the accepted planning principle, selected option, and pointer
to the owning plan.

## Feature Tracker

Use Feature Tracker when durable feature or task truth is needed.

The Goal should include:

- active feature id or task id
- workspace mode if it changes execution
- gate evidence required before completion
- archive/closeout condition

Do not copy the feature task list into the Goal.

## Flow Runner

Use Flow Runner when repeated bounded execution sessions are needed.

The Goal should include:

- active runner item or session id
- latest checkpoint or incident ref
- next-action payload ref
- resume-candidate rule
- stop or escalation condition

Do not rewrite runner checkpoints in the Goal.

## Other Project-Specific Tools

For any other local tool, use the same adapter shape:

```markdown
- Tool: <name>
- Role: <what this tool owns>
- Truth ref: <repo-relative file/id>
- Goal relevance: <why it changes execution>
- Next action: <one command or decision>
```
