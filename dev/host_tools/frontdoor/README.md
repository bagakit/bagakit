# Bagakit Frontdoor Tool

Maintainer-only operator for the Bagakit grouped frontdoor contract.

It reads each installable skill's:

- `references/frontdoor-rule.toml`

and renders the managed `AGENTS.md` region defined by:

- `docs/specs/frontdoor-index-contract.md`

## Commands

```bash
node --experimental-strip-types dev/host_tools/frontdoor/src/cli.ts check --root .
node --experimental-strip-types dev/host_tools/frontdoor/src/cli.ts render --root .
node --experimental-strip-types dev/host_tools/frontdoor/src/cli.ts apply --root .
```

Use `apply` only after the declarations are ready. It inserts the managed
region on first run and refuses invalid existing frontdoor marker layouts.
