# Brainstorm Action Adapter Contract

## Goal

Keep brainstorm standalone-first while allowing project-specific action handoff routing without hard-coding external systems in brainstorm core.

## Registry Location

- Adapter manifests live under:
  - `.bagakit/brainstorm/adapters/action/*.json`
- Each manifest declares one candidate route.
- `archive --driver auto` tries adapters by descending `priority`.

## Minimal Schema

```json
{
  "id": "my-delivery-adapter",
  "priority": 100,
  "path_template": ".bagakit/my-flow/items/brainstorm-handoff-{item_id}-{slug}.md",
  "target_template": "my-flow:{item_id}",
  "required_meta": ["item_id"],
  "when_paths_exist": [".bagakit/my-flow/items"]
}
```

## Field Rules

- `id`:
  - required string; unique within registry.
- `priority`:
  - optional int (default `100`); higher first.
- `path_template`:
  - required string; output path for action handoff.
  - relative paths are resolved from project root.
- `target_template`:
  - optional string (default `id`); written into archive as action target label.
- `required_meta`:
  - optional string list; each key must be provided via `--meta key=value`.
- `when_paths_exist`:
  - optional string list; all listed paths must exist or the adapter is skipped.

## Template Variables

- Built-in:
  - `{slug}` from artifact slug
  - `{topic}` from artifact topic
- User provided:
  - any key from repeated `--meta key=value`

If any required variable is missing:
- `auto` mode: warning + fallback to next adapter.
- `adapter` mode: hard-blocked.

## CLI Usage

- Auto route with fallback:
  - `sh scripts/bagakit-brainstorm.sh archive --driver auto --meta item_id=ITEM-123`
- Force one adapter:
  - `sh scripts/bagakit-brainstorm.sh archive --driver adapter --adapter-id my-delivery-adapter --meta item_id=ITEM-123`
