Run lint:
  python3 scripts/qihan_write_lint.py <markdown_file>

The script prints JSON with ratios, list-block stats, paragraph stats, and findings.

Route tools:
  python3 scripts/qihan_route_tools.py check-foundation <artifact.md>
  python3 scripts/qihan_route_tools.py derive-route <handoff.md> [--output route-state.md]

`derive-route` emits a non-authoritative route-state view derived from the handoff.
The handoff remains the source of truth.
