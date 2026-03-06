# Eval

`dev/eval/` is the maintainer-only shared eval toolkit for this repo.

It exists to keep `gate_eval/` slices thin and consistent without turning
`dev/validator/` into a second eval control plane.

## Boundary

`dev/eval/` owns shared mechanics only:

- temp workspace lifecycle
- output sanitization
- run-id and output-dir handling
- normalized `summary.json` and `cases/*.json` packets
- shared CLI entrypoints for running code-defined eval suites
- curated maintainer references for Bagakit eval design

`dev/eval/` does not own:

- eval registration
- skill-specific fixtures, cases, or scoring truth
- release-blocking gate policy
- runtime skill semantics

Those remain in:

- `gate_eval/`
- `gate_validation/`
- `skills/`
- `docs/specs/`

## Layout

- `references/`
  - curated source notes and Bagakit design implications
- `src/cli.ts`
  - shared eval runner entrypoint
- `src/lib/`
  - reusable mechanics for suite loading, temp workspaces, command execution,
    output sanitization, and packet writing

## Runner Contract

The shared CLI expects one suite module that exports `SUITE`.

Suite modules stay under `gate_eval/...` and provide:

- suite identity
- default result output root
- ordered cases
- code-defined deterministic assertions

The shared runner writes:

- `summary.json`
- `cases/<case-id>.json`

The stable packet shape is documented in:

- `docs/specs/eval-run-packet.md`

## Design Rule

Use `dev/eval/` when multiple eval slices need the same mechanics.

Do not move case truth, fixture truth, or skill-owned protocol meaning into
this tool just to reduce file count.
