# Case Inventory

## Owns

- Present the stable cases or verification units the human must browse.
- Support grouping, priority, attention state, and scan order.
- Distinguish one case from its current and prior runs.

## Does Not Own

- Case/run persistence fields, which belong to `../artifacts/case-catalog.md`.
- Per-case instructions, judgment policy, or report typography.

## Design Checks

- The human can tell what to work on next.
- One case maps to one execution unit or one human decision.
- Related evidence outputs stay inside the case instead of becoming peer cases.
- Current attention is prominent while resolved history remains reachable.
- Inventory state is scannable without opening every item.

## Outputs Or Evidence

- Visible ordering, grouping, attention state, and current-run identity.

## Failure Signals

- The list is only a dump of generated labels.
- The human cannot tell case scope, priority, or why several outputs are grouped.
- A new run replaces the prior run instead of extending the case history.
