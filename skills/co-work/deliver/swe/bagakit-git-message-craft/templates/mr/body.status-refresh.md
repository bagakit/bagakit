# MR Body Template: Status Refresh

Use when:

- the MR is still pending, running, or blocked
- the body needs a current progress block without pretending the gate is green

Managed block:

```md
<!-- bagakit:git-message-craft:start -->
## Summary
<2-4 sentences naming the primary systems changed and why this MR exists.>

## Why
<the prior gap, ambiguity, or blocker this MR is addressing>

## Current Status
- Gate revision: `<sha>`
- MR checks: `<pending|running|blocked>`
- Main blocker: <one concrete blocker or `none`>

## What Changed
- <group one behavior, contract, boundary, or workflow change>
- <group another high-signal change>

## Next Step
- Owner: <agent|human|specific team>
- Action: <one deterministic next step>

## Non-goals / Open Questions
- Non-goals: <none or one explicit scope boundary>
- Open questions: <none or one concrete unresolved point>
<!-- bagakit:git-message-craft:end -->
```
