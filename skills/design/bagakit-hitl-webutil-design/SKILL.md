---
name: bagakit-hitl-webutil-design
description: Design human-in-the-loop web utility pages that help a person understand, inspect, test, compare, or report back to an agent. Use when Codex should decompose a HITL page into reusable mechanisms, style routes, artifact contracts, and scene crosswalks; define copyable human-to-agent handoff outputs; or prepare a HITL page brief before handing frontend implementation to bagakit-codex-webpage-design.
---

# Bagakit HITL Webutil Design

`bagakit-hitl-webutil-design` is the purpose-first design skill for HITL web
pages.

It owns page-purpose decomposition, not frontend implementation. Use it to
decide what a HITL page must do for the human and the agent, how that page
should scan in a concrete scene, and what durable artifact should round-trip
back to the agent.

## Explicit Invocation Contract

When the user explicitly invokes `bagakit-hitl-webutil-design`, treat that as a
request for a HITL page, not merely a request to discuss HITL principles.

Default output:

- design a concrete page brief
- choose the scene route when one fits
- bind mechanisms, style, artifacts, and any matching template
- hand off to `bagakit-codex-webpage-design` when the user expects a built
  frontend page

If one crosswalk scene or template strongly matches the request, design from
that scenario first. Do not stay at mechanism-only abstraction unless the user
explicitly asks for taxonomy work, critique, or planning without a page.

Scenario pages are cross-products, not atomic modules.

- `mechanisms/`
  - reusable jobs such as knowledge transfer, runbooks, result capture, local
    session state, or interaction-result packaging
- `styles/`
  - visual and interaction routes such as verification console, learning atlas,
    repo workbench, or intelligence briefing
- `artifacts/`
  - durable outputs such as page manifests, report exports, and agent handoff
    packets
- `components/`
  - reusable page modules such as copy/export controls that should compose
    across templates and scenes
- `templates/`
  - reusable page blueprints that bind mechanisms, style, artifacts, and data
    contracts for one repeatable HITL page family
- `composition-crosswalk.md`
  - the bridge from scene to mechanism set, style route, artifacts, audience
    mode, and minimum eval

## Operating Spine

1. Write the page brief.
   - clarify scene, operator mode, success bar, and what the human must return
     to the agent
2. Select or compose the scene route.
   - start from `references/composition-crosswalk.md`
   - if no row fits, extend the crosswalk instead of inventing a scene-first
     mechanism
3. Select mechanisms.
   - load only the mechanism files that materially shape the page job
4. Select one style route.
   - style owns layout, density, pane treatment, scanning behavior, and visual
     language
   - keep cognitive and export semantics in mechanisms or artifacts
5. Select artifacts.
   - define what the human will copy, export, or hand back to the agent
6. Select reusable components.
   - name component boundaries for the implementation handoff
   - avoid treating a monolithic single-page HTML file as the durable design
     target when the host can implement reusable modules
7. Run HITL hardening.
   - use `references/workflow-contract.toml`
   - keep v0 guards explicit for status/error semantics, provenance labeling,
     local persistence lifetime/reset, information-load budget, and audience
     mismatch
8. Hand off implementation when needed.
   - if the page should be built as a frontend surface, compose with
     `bagakit-codex-webpage-design`

## Reference Routing

Always read:

- `references/composition-crosswalk.md`
- `references/workflow-contract.toml`
- the relevant `README.md` under `references/mechanisms/`,
  `references/styles/`, `references/artifacts/`, `references/components/`, and
  `references/templates/`

Read by route:

- explanation, briefing, or repo-understanding page
  - `references/mechanisms/knowledge-transfer.md`
  - `references/mechanisms/evidence-context.md`
  - `references/mechanisms/interaction-result-packet.md`
  - `references/components/copy-result-control.md`
  - one of:
    - `references/styles/learning-atlas.md`
    - `references/styles/repo-reading-workbench.md`
    - `references/styles/intelligence-briefing-desk.md`
- manual execution or verification page
  - `references/templates/manual-test-console.md`
  - `references/mechanisms/case-inventory.md`
  - `references/mechanisms/procedure-runbook.md`
  - `references/mechanisms/copyable-reproduction.md`
  - `references/mechanisms/result-capture.md`
  - `references/mechanisms/evidence-context.md`
  - `references/mechanisms/local-session-state.md`
  - `references/mechanisms/interaction-result-packet.md`
  - `references/components/copy-result-control.md`
  - `references/styles/ide-verification-console.md`
  - `references/artifacts/report-export.md`
- report-heavy review route
  - `references/styles/dense-test-report.md`
  - `references/artifacts/report-export.md`

## Composition Boundaries

- `bagakit-hitl-webutil-design`
  - owns HITL page decomposition, crosswalk choice, artifact contracts, and
    HITL-specific hardening
- `bagakit-codex-webpage-design`
  - owns frontend implementation, visual reference workflow, browser evidence,
    and parity iteration
- `bagakit-design-core`
  - owns brand or tone review when a design packet or design-rule pass is
    needed
- `bagakit-spark`
  - use when the page purpose, scene boundary, or eval meaning is still too
    unclear to scaffold

## Lean V0 Rule

Keep every reference file short and contract-like.

Do not split cross-cutting concerns into more files unless repeated eval
failures prove the current guard is too weak. In v0:

- export control behavior stays in
  `references/mechanisms/interaction-result-packet.md`
- concrete copy/download component treatment stays in
  `references/components/copy-result-control.md`
- output shapes stay in `references/artifacts/`
- status/error semantics and provenance labeling stay in
  `references/workflow-contract.toml`
