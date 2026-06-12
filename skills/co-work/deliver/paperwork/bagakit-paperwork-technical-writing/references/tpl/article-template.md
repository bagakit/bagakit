# <Article Title>

> Use this file for publish narrative only. Planning contract, process fields, and stage metadata belong in `outline.md` / `execution_appendix.md` / `review_report.md`.

## 1. Why This Matters Now

短命题（<=16 units，可复述）：

### Current failure pattern
Describe one concrete recurring failure and who is blocked by it.

### What breaks if unchanged
Describe operational consequence and one explicit boundary where this does not apply.

### Field case (recommended)
Add one concrete scenario with role, symptom, and consequence timeline.

## 2. Core Mechanism

短命题（<=16 units，可复述）：

### How the mechanism works
Explain the approach in 2-4 paragraphs. Keep one local claim per paragraph.

### Why this trade-off is acceptable now
Compare at least two alternatives and state why this choice is practical now.

### Diagram for decision flow (recommended)
Use one Mermaid diagram when sequence/loop/rollback matters for review speed.

## 3. Evidence and Validation

短命题（<=16 units，可复述）：

### Evidence path
Map claim to evidence (`experiment`, `docs`, `observed signal`).

### Concrete artifact anchor (recommended for medium/high complexity)
Include at least one concrete artifact in body text:
- command chain
- path/hash/sample output
- metric formula with threshold

### Full sample anchor (recommended for protocol/infrastructure topics)
Keep one longer concrete sample in body text (for example a 12+ line message/template, or a 3+ command chain with expected signal).

### Validation signal
State how the result is measured and what threshold counts as pass.

### Sampling protocol metadata (required for brainstorm profile)
State:
- sampling object
- sample size / sampling count
- sampling window
- review role(s)

### Memory anchor line (recommended)
Add one recall-friendly anchor line around every 350-450 words (contrast line, recap line, or tri-question line).

## 4. Adoption Path

短命题（<=16 units，可复述）：

### Minimal rollout steps
Describe the smallest viable rollout sequence and owner responsibilities.

### Rollout checklist (recommended)
List 5+ checks that define "ready to publish/adopt" and include at least one rollback trigger.

### Fallback and recovery
Describe rollback trigger and recovery action.

## 5. Final Decision and Next Action

短命题（<=16 units，可复述）：

### Before/after contrast (required)
Document one concrete `Before` and `After` contrast and explain decision impact.

### Anti-pattern and guardrail (recommended)
Name one high-frequency anti-pattern and the guardrail/check that prevents it.

### Scope boundary and portability note (recommended)
State where this approach does not apply and how to migrate/adapt in other teams or repositories.

### Immediate next action
Write one-line decision and first deterministic action.

### Ending closure (required)
Use either:
- three-question close: `goal / status / next step`
- one-line key-claim recap for retellability
