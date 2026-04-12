# Schema Contract

This is the starter schema vocabulary for `bagakit-decision-harness`.

## Signal

```toml
schema = "decision_signal/v0"
signal_id = ""
created_at = ""
input_type = "typed_note"
privacy_class = "private"
status = "raw"
```

Allowed `input_type` values:

- `typed_note`
- `chat_excerpt`
- `agent_trace`
- `transcript`
- `manual_retro`

Allowed `status` values:

- `raw`
- `promoted_to_decision`
- `ignored`
- `redacted`

## Decision Receipt

```toml
schema = "decision_receipt/v0"
decision_id = ""
created_at = ""
decision_type = "choice"
risk_tier = "low"
confidence = ""
reversibility = "two_way_door"
review_date = ""
```

Allowed `decision_type` values:

- `forecast`
- `argument_audit`
- `choice`
- `plan`
- `policy_update`

## Pattern

```toml
schema = "decision_pattern/v0"
pattern_id = ""
status = "candidate"
confidence = "low"
```

Allowed `status` values:

- `candidate`
- `accepted`
- `rejected`
- `merged`
- `expired`

## AI Update Receipt

```toml
schema = "ai_update_receipt/v0"
update_id = ""
update_type = "memory"
activation_status = "candidate"
```

Allowed `update_type` values:

- `memory`
- `prompt`
- `rubric`
- `tool_policy`
- `skill`
- `workflow`

Allowed `activation_status` values:

- `candidate`
- `active`
- `probation`
- `expired`
- `rolled_back`
