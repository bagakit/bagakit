# MR Body Template: Green Refresh

Use when:

- required MR checks are green on the current gate revision
- the MR needs one concise merge-ready summary block

Managed block:

```md
<!-- bagakit:git-message-craft:start -->
## Summary
<2-4 sentences naming the primary systems changed and the repo-level effect.>

## Why
<the prior gap, ambiguity, or failure mode this MR closes>

## What Changed
- <group one behavior, contract, boundary, or workflow change>
- <group another high-signal change>

## Validation
- Gate revision: `<sha>`
- MR checks: `green`
- Local checks: <command set or `not applicable`>

## Non-goals / Follow-ups
- Non-goals: <none or one explicit scope boundary>
- Follow-up: <none or one concrete next step>
<!-- bagakit:git-message-craft:end -->
```
