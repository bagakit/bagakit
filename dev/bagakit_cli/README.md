# Bagakit CLI

`dev/bagakit_cli` is the maintainer-facing aggregator for Bagakit skill CLIs
and project-local runtime surfaces.

It does not own skill behavior. Each skill that wants an independently usable
CLI declares it through:

- `references/skill-cli.toml`

The central CLI reads those declarations, reports status, and dispatches to the
skill-owned entrypoint.

It also manages local install projections from canonical skill directories into
an agent skills directory. Projection targets are machine-local and are never
recorded as repository truth.

## Commands

```bash
bash dev/bagakit_cli/bagakit-cli.sh skills --root .
bash dev/bagakit_cli/bagakit-cli.sh skill bagakit-living-knowledge --root .
bash dev/bagakit_cli/bagakit-cli.sh surfaces --root .
bash dev/bagakit_cli/bagakit-cli.sh status --root .
bash dev/bagakit_cli/bagakit-cli.sh run bagakit-living-knowledge --root . -- doctor --root .
bash dev/bagakit_cli/bagakit-cli.sh install status all --root . --target "$HOME/.agents/skills"
bash dev/bagakit_cli/bagakit-cli.sh install link bagakit-spark --root . --target "$HOME/.agents/skills"
```

Use `--json` on supported commands for machine-readable output.

Use `install link all --dry-run` to preview projection changes. Use
`install unlink <selector>` only for symlinks that currently point back to the
selected repository skill.

## Boundary

`bagakit-cli` may:

- discover skills
- read CLI declarations
- list runtime surfaces
- dispatch to skill-owned CLIs
- link canonical skill directories into a target skills directory
- report target install status for canonical skill projections
- remove symlinks that point back to selected canonical skills

It must not:

- reimplement skill-owned command semantics
- replace skill-owned CLIs
- become the source of runtime-surface ownership
- centralize skill process or result files into one state root
- treat target agent skills directories as authoritative source
- hide distribution packaging or remote fetch behavior inside local link flows

Stable contract:

- `docs/specs/skill-cli-contract.md`
