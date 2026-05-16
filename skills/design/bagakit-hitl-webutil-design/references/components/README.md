# Components

Components are reusable page modules for HITL web utility implementations.

They are not a new purpose taxonomy. A component binds:

- one local UI or interaction module
- the mechanisms it serves
- the artifact or payload shape it presents
- implementation handoff boundaries

Use components to prevent every HITL page from becoming one large custom HTML
surface that cannot be recomposed.

## Component Rules

- Keep purpose semantics in `../mechanisms/`.
- Keep durable output schemas in `../artifacts/`.
- Keep scene composition in `../templates/`.
- Name reusable component boundaries in the page brief and implementation
  handoff.
- Prefer host-native reusable modules when the host has a component system.
- If a standalone HTML artifact is required, still separate named regions,
  state helpers, payload builders, and controls so the design can be lifted into
  components later.

## V0 Components

- `copy-result-control.md`
  - for copy/download actions that turn human interaction state into a
    reusable result packet
