# Session evidence contract

The analyzer accepts one normalized JSON object per line. It is intentionally
independent of any agentic harness. A source adapter may map a chat turn, tool
call, code diff, browser action, environment transition, evaluator event, or
human correction into the same record shape. The minimal record is:

```json
{"session_id":"s-01","episode_id":"e-01","record_id":"r-01","step":0,"action":"search","outcome":"unknown","terminal":false}
```

Fields used by the downstream replay and ratchet skills:

| Field | Type | Meaning |
| --- | --- | --- |
| `session_id` | string | Source session identity. |
| `episode_id` | string | Replay unit; it must remain stable across exports. |
| `record_id` | string | Stable source-event identity retained for provenance. |
| `step` | integer | Monotonic step within an episode. |
| `action` | string/object | Action taken by the agent. |
| `outcome` | enum | `success`, `failure`, or `unknown`. |
| `terminal` | boolean | Explicitly marks the episode's terminal event; do not infer it from position. |
| `source_kind` | string | Optional producer class, such as `chat`, `tool-use`, `coding`, `research`, `workflow`, `embodied`, or `human-in-loop`. |
| `harness_id` | string | Optional producer/harness identity; never required for analysis. |
| `actor` | string | Optional `agent`, `tool`, `environment`, `human`, or other event owner. |
| `score` | number | Optional evaluator score; retain the evaluator name. |
| `state_hash` | string | Optional state checkpoint for branch matching. |
| `branch_id` | string | Optional branch/discovery-tree identity. |
| `alternative_actions` | array | Objects with `action` and optional `observed_record_id`; only a matching state and record can be labelled observed. |
| `artifact_refs` | array | Paths or immutable ids for outputs, diffs, or test receipts. |
| `evaluator` | object/string | Who or what judged the outcome. |
| `provenance` | object | Source URI, timestamp, model, and export digest when available. |

The emitted packet contains a `source_digest`, `episodes`, `branch_candidates`,
`source_kinds`, and `warnings`. A warning is evidence metadata, not a failure;
adoption gates must decide whether it blocks a candidate.
