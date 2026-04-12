# Host Harnesses

`host-harnesses/` contains Bagakit L4 host harness source units.

This is not a skill family tree.

Use this directory when a Bagakit unit defines the purpose, root layout,
long-running loop, review gates, and promotion paths of a dedicated host
workspace.

## Rule

Keep this directory flat:

```text
host-harnesses/<harness-id>/
```

Do not add family directories under `host-harnesses/`.

Classification belongs in each unit's `harness.toml`.

## Current Host Harnesses

- `bagakit-decision-harness`

## CLI

The monorepo helper exposes host-harness operations beside skill operations:

```bash
bash scripts/skill.sh host-harness-list
bash scripts/skill.sh host-harness-init --selector bagakit-decision-harness --repo <host-root>
bash scripts/skill.sh host-harness-distribute-package --selector bagakit-decision-harness
```

`host-harness-init` materializes a dedicated host root. It does not install a
small helper skill into an existing project.

## Relationship To Skills

Host harnesses may ship `SKILL.md` files because agents need an entrypoint, but
host harnesses are not ordinary skills.

- `skills/` adds capabilities to an existing host.
- `host-harnesses/` defines what a dedicated host is for.

The stable contract lives in:

- `docs/specs/host-harness-contract.md`
