# Human Writing Patterns (Guidance Overlay)

Use this guide to improve narrative quality inside the existing skill.
Do not split into child skills for this purpose.

## 1. Why This Overlay Exists

- Keep one skill boundary: technical-writing remains the only runtime skill.
- Borrow proven writing practices as reusable guidance, not extra runtime dependencies.
- Keep hard gates focused on objective invariants; keep narrative quality in review/self-check.

## 2. Advanced Patterns to Borrow

### 2.1 Structured Co-Authoring Loop

Borrow from staged co-authoring workflows:

- context gathering before drafting,
- section-by-section option curation,
- blind reader testing before publish.

Reference:

- [Anthropic `doc-coauthoring`](https://raw.githubusercontent.com/anthropics/skills/main/skills/doc-coauthoring/SKILL.md)

### 2.2 Audience-First Format Selection

Borrow from internal communication playbooks:

- choose format by audience and decision need,
- avoid single-tone generic writing across different readers.

Reference:

- [Anthropic `internal-comms`](https://raw.githubusercontent.com/anthropics/skills/main/skills/internal-comms/SKILL.md)

### 2.3 Concrete, Operational Style

Borrow from technical writing style guides:

- concrete verbs over abstract slogans,
- short judgment sentence + evidence sentence,
- explicit boundary and next action.

References:

- [Google Technical Writing](https://developers.google.com/tech-writing/one)
- [Microsoft Writing Style Guide](https://learn.microsoft.com/en-us/style-guide/welcome/)

## 3. In-Skill Application Pattern

Run this lightweight loop before strict gate checks:

1. Context transfer card (`reader`, `task`, `scope`, `non-goal`, `success signal`).
2. Section option curation (5-12 candidate points; keep/remove/combine).
3. Draft and run one blind-reader test:
   - can a new reader restate the core claim in 30 seconds,
   - can they find one evidence chain in 5 minutes,
   - can they identify next action and owner.
4. Revise weak sections and then run strict checks.

## 4. Weighted Self-Check (Recommended, Non-Blocking)

Use the same comparison formula as a drafting self-check:

`Final = 0.35*专业性 + 0.30*可验证性 + 0.20*社区美誉度 + 0.15*(10 - AI嫌疑风险)`

Mapping:

- 专业性: execution clarity + trigger precision + standalone integrity.
- 可验证性: evidence package density + validation/threshold linkage.
- 社区美誉度: publish suitability + portability/adoptability.
- AI嫌疑风险: template smell / slogan density / abstraction without evidence.

Recommended interpretation:

- `<7.0`: revise before strict gate.
- `7.0-7.8`: proceed only with targeted fixes recorded.
- `>=7.8`: acceptable to enter strict-gate stage.

Guardrail:

- Do not optimize by lowering AI-risk alone.
- Any AI-risk reduction that drops evidence density is a regression.

## 5. Recording Contract

Record self-check results in `review_report.md`:

- dimension scores and notes,
- weighted final score,
- assumptions and confidence,
- one deterministic next improvement.

## 6. Non-Goals

- Not a detector-evasion guide.
- Not a replacement for hard gates.
- Not a substitute for baseline regression checks.
