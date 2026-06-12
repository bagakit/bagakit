<!-- BAGAKIT:LIVING-KNOWLEDGE:START -->
This is a managed block for `bagakit-living-knowledge`. Do not hand-edit the
managed region directly; refresh it through the skill operator instead.

Resolve the installed skill dir before using the operator directly:

- `export BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR="<repo-relative-installed-skill-dir>"`

Progressive loading:

- Read `{{SYSTEM_ROOT}}/must-guidebook.md` only when the task needs shared
  knowledge navigation; ordinary edits may stay on local sources.
- Read `must-authority.md`, `must-sop.md`, or `must-recall.md` only when the
  task needs that specific contract, route, or prior fact.
- Use the `bagakit-living-knowledge` skill for recall, indexing, publication,
  and path-protocol details; do not duplicate those rules here.

If the surrounding workflow explicitly asks for `living-knowledge` task
reporting, the response footer may use:

- `[[BAGAKIT]]`
- `- LivingKnowledge: Surface=<updated shared surfaces or none>; Evidence=<commands/checks>; Next=<one deterministic next action>`
<!-- BAGAKIT:LIVING-KNOWLEDGE:END -->
