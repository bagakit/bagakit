# Learning Loop

## Sequence

1. `orient`
   - show the bounded goal, target application, course map, and evidence bar
2. `diagnose`
   - use short unaided tasks to find demonstrated, fragile, and missing
     capabilities
3. `model`
   - teach the smallest generative explanation that repairs the current gap
4. `retrieve`
   - ask the learner to reconstruct the model without looking
5. `explain`
   - require teach-back, comparison, prediction, or causal explanation
6. `apply`
   - solve a close variant with minimal support
7. `transfer`
   - change context, surface form, constraints, or goal
8. `correct`
   - identify the gap, preserve the attempt, and retry
9. `fade`
   - remove hints and worked steps before a demonstrated claim
10. `re-enter`
   - schedule no-help retrieval relative to the retention horizon

## Course Graph Rules

- Generate child nodes from parent problems, prerequisites, constraints, and
  failure modes.
- Keep examples subordinate to the capability they teach.
- Use diagrams and media only when they reduce mental transformation or expose
  a relation the learner must reconstruct.
- Let a diagnostic skip a node only when its evidence task is passed unaided.
- Stop expanding when every in-scope capability has an evidence route.

## Diagnostic Integrity

- Keep core answers, source anchors that reveal the answers, and worked examples
  behind the learner's first attempt.
- Do not prefill the response format with correct option keys.
- Ask for reasoning or construction where recognition could pass by guessing.
- Treat the initial result as current evidence only; delayed retention remains
  `not_assessed` until re-entry occurs.

## Question Handling

Treat learner questions as evidence, not a chat transcript.

Classify each question as:

- missing prerequisite
- unclear model
- contradiction
- boundary or exception
- application
- transfer
- confidence or metacognitive gap

Route high-value questions into the affected objective, next task, or source
closure map. Compress or discard noise according to the privacy contract.

## Completion

A session can complete when it has a stable next action. A course can complete
when every in-scope objective is demonstrated, explicitly blocked, or assigned
a retest. Delayed retention may remain pending after the page closes.
