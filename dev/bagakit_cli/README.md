# Bagakit CLI

`dev/bagakit_cli` is the maintainer-facing aggregator for Bagakit skill CLIs
and project-local runtime surfaces.

It does not own skill behavior. Each skill that wants an independently usable
CLI declares it through:

- `references/skill-cli.toml`

The central CLI reads those declarations, reports status, and dispatches to the
skill-owned entrypoint.

## Commands

```bash
bash dev/bagakit_cli/bagakit-cli.sh skills --root .
bash dev/bagakit_cli/bagakit-cli.sh skill bagakit-living-knowledge --root .
bash dev/bagakit_cli/bagakit-cli.sh surfaces --root .
bash dev/bagakit_cli/bagakit-cli.sh status --root .
bash dev/bagakit_cli/bagakit-cli.sh run bagakit-living-knowledge --root . -- doctor --root .
```

Use `--json` on read-only commands for machine-readable output.

## Boundary

`bagakit-cli` may:

- discover skills
- read CLI declarations
- list runtime surfaces
- dispatch to skill-owned CLIs

It must not:

- reimplement skill-owned command semantics
- replace skill-owned CLIs
- become the source of runtime-surface ownership
- centralize skill process or result files into one state root

Stable contract:

- `docs/specs/skill-cli-contract.md`
