# Verdict Policy

Use this policy to decide how reviewer output changes the main agent's next
action.

## Verdicts

- `pass`
  - proceed with the selected rung and proof plan
- `pass_with_advisory`
  - proceed, but include the advisory notes in residual risk or cleanup
    suggestions
- `needs_correction`
  - revise the gate, ladder, implementation, or proof before proceeding
- `reroute`
  - stop coding and route to a better level
- `blocked`
  - ask the user or gather missing evidence before implementation

## Blocking Findings

Treat these as blocking:

- level mismatch
- unconfirmed protected goal that changes implementation direction
- invalid ladder stop rule
- proof plan insufficient for public behavior or owner-owned contract
- required behavior dropped for a smaller patch
- safety, data, production, accessibility, or privacy risk without approval
- SSOT break that creates conflicting truth

## Advisory Findings

Treat these as advisory unless they affect the protected goal or proof:

- local readability improvement
- minor DRY opportunity
- SOLID concern outside the touched boundary
- optional cleanup
- stronger naming
- future eval or validation improvement

## Main-Agent Response

- For `pass`, implement or continue.
- For `pass_with_advisory`, continue and report residual risk.
- For `needs_correction`, patch the gate, ladder, or proof plan before editing
  more code.
- For `reroute`, stop coding and switch to the named branch.
- For `blocked`, ask or gather evidence. Do not invent certainty.

## Reporting Shape

```text
Review verdict:
Blocking:
Advisory:
Correction made:
Residual risk:
Next action:
```
