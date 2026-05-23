# Human Judgment Guidance

## Owns

- Turn evidence into one explicit human decision at a time.
- State why human judgment is needed, what answer is expected, what evidence is
  relevant, and what the answer changes.
- Select a review mode and Agent-advice reveal policy.

## Does Not Own

- The QA strategy, experiment design, or evidence generation.
- The visual treatment of panes, badges, or history.

## Review Modes

- `independent`
  - collect a provisional human judgment before revealing Agent conclusions
  - use when independence is part of the evaluation contract
- `adjudication`
  - show the human and Agent positions together after the human position exists
  - make disagreement, missing evidence, and resolution explicit
- `approval`
  - show the recommendation, consequences, costs, and irreversible effects
    before approval

Do not use one reveal rule for every mode. Record the chosen mode and reveal
policy in the page manifest and exported result.

If the mode is unstated, infer it from downstream use:

- choose `independent` when the human answer is intended as independent
  evidence or the Agent output itself is under evaluation
- choose `adjudication` when the job is to resolve disagreement
- choose `approval` when the human authorizes a consequential action

If the purpose still does not distinguish the mode, expose the ambiguity in the
page brief before showing Agent advice.

## Decision Contract

Each case should define:

- `decision_question`
- `why_human`
- `allowed_judgments`
- `evidence_sufficiency_rule`
- `review_mode`
- `reveal_policy`
- `downstream_effect`

Related experiment outputs are evidence items or subchecks when they support
the same decision. Do not promote each output into a peer case merely because
it was generated separately.

## Review Flow

1. orient to the decision and its consequence
2. inspect the relevant evidence
3. commit a provisional or final human judgment
4. reveal Agent advice or adjudicate when the mode requires it
5. export the judgment, evidence refs, disagreement, and next action

## Failure Signals

- The page asks the human to infer the real question from raw outputs.
- Agent verdicts visually pre-answer an independent review.
- The human cannot mark evidence as insufficient.
- The exported packet omits the review mode or the judgment's downstream effect.
