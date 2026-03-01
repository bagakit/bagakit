# Skill Eval Cases

Case files bind a fixture to ordered CLI probes and exact expectations.

Current cases:

- `selector-resolution`
  - list ordering, family precedence, exact selector lookup, and unknown
    selector failure
- `layout-safety`
  - directory-protocol drift, forbidden payload manifest detection, and symlink safety
- `link-behavior`
  - link creation, idempotence, conflict detection, and force replacement
- `packaging-policy`
  - archive generation, archive hygiene, and explicit selector handling
