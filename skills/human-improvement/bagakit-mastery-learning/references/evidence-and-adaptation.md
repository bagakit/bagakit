# Evidence And Adaptation

## Diagnostic Express Lane

Use the diagnostic to save time, not to create an easy score.

- test prerequisites and generative capabilities, not every source sentence
- accept skips only from unaided evidence
- record confidence before feedback so calibration can be checked
- route errors by likely cause: missing knowledge, wrong model, execution slip,
  transfer failure, or source ambiguity

## Support Ladder

Use the least sufficient support:

1. independent attempt
2. strategy prompt
3. hint
4. worked step
5. model answer

After support, require a changed no-help task. A corrected answer copied from
the explanation is not new evidence.

## Evidence Task Readiness

Before a task reaches the learner, check:

- the requested output directly exercises the declared capability
- the learner role, situation, available evidence, and constraints are concrete
- every required detail can change the rubric decision or next action
- functional requirements are used instead of arbitrary names, tools, or
  implementation choices
- the learner does not need to infer an author-internal taxonomy
- multiple valid solutions remain possible
- the response shape does not reveal the keyed answer

Memory anchors and mnemonics are useful for retrieval after teaching. They are
not automatically valid application or transfer prompts.

## Prompt Defect Handling

Classify learner confusion before escalating support:

- missing scenario facts, undefined labels, or contradictory constraints
  - mark the task `repair_without_scoring`
  - clarify only the missing task contract
  - record the replaced task, affected attempts, attempt treatment, and
    `support_delta=0`
  - do not score negative results or raise support when no solution cue is added
  - preserve positive evidence only when it remains interpretable
- clarification that supplies solution strategy, decomposition, or answer
  structure
  - record the corresponding support level
  - require a materially changed no-help task before `demonstrated`
- a prompt whose construct cannot be repaired without changing the task
  - mark it `retire_and_replace`
  - bind the replacement task to the retired version and affected attempts
  - do not score prompt-caused negative results or consume support budget
  - preserve the attempt and positive evidence that remains interpretable

Ask only for missing evidence. Do not make the learner rewrite already-satisfied
parts or supply a nominal detail that the rubric does not need.

## Adaptation Rules

- repeated misconception
  - repair the model and vary the next representation
- retrieval failure with correct recognition
  - reduce cues and schedule another retrieval
- near-transfer pass with far-transfer failure
  - vary context and ask the learner to identify the invariant
- high confidence with failure
  - surface the calibration gap before the next attempt
- low confidence with repeated success
  - preserve evidence and reduce unnecessary remediation
- missing or conflicting source
  - block the claim instead of inventing certainty

Revise the affected branch rather than regenerating the whole course.

## False Mastery Audit

Before reporting `demonstrated`, check:

- Was the successful attempt unaided?
- Was the task materially different from the teaching example?
- Was the rubric known before judging the answer?
- Is the original attempt still preserved?
- Is the transfer distance named?
- Is confidence calibrated to the result?
- Is delayed retention required but still pending?

If any required answer is no, use `supported`, `fragile`, `retest_due`, or
`blocked`.

## Stop Rules

- stop remediation when the declared evidence bar is met
- stop source expansion when unresolved dependencies no longer affect in-scope
  capabilities
- stop personalization when a simpler shared branch performs equally well
- mark uncertainty instead of adding opaque learner-model complexity
