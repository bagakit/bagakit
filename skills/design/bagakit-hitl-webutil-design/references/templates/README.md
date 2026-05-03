# Templates

Templates are repeatable HITL page blueprints.

They are not a fourth taxonomy. A template binds:

- one scene or page family
- selected mechanisms
- one primary style route
- required artifacts
- data contracts and parameterization rules

Use a template when prior evidence shows that one page family recurs often
enough to need a stable starting shape.

## Template Rules

- Keep product data, local paths, run commands, and case lists as parameters.
- Keep reusable behavior in `../mechanisms/`.
- Keep visual route and layout rules in `../styles/`.
- Keep exported shapes in `../artifacts/`.
- Name the source evidence that justified the template.

## V0 Templates

- `manual-test-console.md`
  - for pages where a human executes cases, records results, and returns a
    copyable report to an agent
