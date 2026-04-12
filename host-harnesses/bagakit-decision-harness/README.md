# Bagakit Decision Harness

`bagakit-decision-harness` is the first Bagakit L4 host harness.

It defines a dedicated local workspace for compounding personal decision
capability through decision capture, reviews, patterns, drills, metrics, and AI
update receipts.

## Identity

- source unit: `host-harnesses/bagakit-decision-harness/`
- identity contract: `harness.toml`
- agent entrypoint: `SKILL.md`
- host template: `host-template/`
- layer: `l4-host-harness`

## Runtime Meaning

When initialized into a host, this harness changes the host's purpose.

The host is no longer a generic repository with one extra skill. The host
becomes a decision-improvement workspace.

Primary decision materials live at the host root. Runtime indexes and
bookkeeping live under `.bagakit/decision-harness/`.

## Non-Goals

- no Lark integration in the core harness
- no voice transcription in the core harness
- no broad chat scanning
- no automatic high-stakes decision authority
- no hidden AI self-upgrade

## Init

The preferred monorepo entrypoint initializes a target host:

```bash
bash scripts/skill.sh host-harness-init --selector bagakit-decision-harness --repo <host-root>
```

The source-local helper can do the same after the harness source has been
copied or packaged:

```bash
sh host-harnesses/bagakit-decision-harness/scripts/decision-harness.sh init --root <host-root>
```

Use `--force` only when replacing `harness.toml` and `README.md` template files
in an existing host root.

## Local Commands

The local helper writes TOML receipts into the host root:

```bash
sh host-harnesses/bagakit-decision-harness/scripts/decision-harness.sh add-signal --root <host-root> --input-type typed_note --text "<text>"
sh host-harnesses/bagakit-decision-harness/scripts/decision-harness.sh create-decision --root <host-root> --question "<question>"
sh host-harnesses/bagakit-decision-harness/scripts/decision-harness.sh review-decision --root <host-root> --decision <decision-id> --actual-outcome "<outcome>"
sh host-harnesses/bagakit-decision-harness/scripts/decision-harness.sh propose-pattern --root <host-root> --condition "<condition>" --default-action "<action>"
sh host-harnesses/bagakit-decision-harness/scripts/decision-harness.sh add-ai-update --root <host-root> --update-type workflow --candidate-change "<change>"
sh host-harnesses/bagakit-decision-harness/scripts/decision-harness.sh metric-action --root <host-root> --metric <name> --value "<value>" --action "<action>"
```

These commands are intentionally local-first. They create structured artifacts
for later review rather than making autonomous high-stakes choices.
