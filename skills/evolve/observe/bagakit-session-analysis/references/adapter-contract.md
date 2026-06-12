# Source adapter contract

Session analysis has ports and adapters rather than a required agent harness.

```text
source export -> source adapter -> canonical session JSONL -> analysis packet
```

The adapter is responsible for:

- mapping a producer's turns, tool calls, state transitions, diffs, or human
  interventions to `action`, `observation`, and optional `artifact_refs`
- retaining the producer record id in `provenance`
- assigning stable `session_id`, `episode_id`, and `step`
- assigning a unique `record_id` within each source session and marking exactly
  one explicit terminal event per episode when the producer knows the outcome
- preserving unknown outcomes as `unknown`
- declaring `source_kind` and optional `harness_id` without making either a
  routing or acceptance requirement

The analyzer is responsible for validation, source digesting, episode grouping,
branch evidence, and warnings. It must not know whether the source was a chat
transcript, a tool loop, a coding workspace, a research notebook, a workflow
engine, an embodied simulator, or a human-assisted run.

An adapter is complete when the same canonical export can be analyzed without
loading the adapter implementation and a reviewer can trace every normalized
record back to its producer record.
