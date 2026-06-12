# RIFTBOARD Material Asset Retry Evidence

## Case

The RIFTBOARD material-asset retry used generated assets for parchment grain,
dark scratched board texture, torn paper edges, glyphs, signal strips, and
glow/noise overlays.

## Observed Improvement

- material richness improved compared with CSS-only boxes
- desktop composition retained the intended dark board and parchment identity
- the reference-specific left-rail glyph icons were the clearest asset success:
  they behaved as small fixed-size sprite assets with recognizable shape,
  stable alpha edges, and concrete component usage
- browser checks reported no console or interaction failures

## Observed Failure

- some cropped assets retained dark halos because the source sheet did not
  provide clean transparent assets
- material parity was treated as acceptable even though crop, alpha/mask, and
  slice behavior were not fully recorded as an asset pipeline
- mobile still compressed the board like a desktop miniature, with clipped
  primary content and over-dense card placement
- automation passed despite visible desktop/mobile defects
- a later asset-pipeline rerun produced stronger material assets and real
  interactions, but still failed because mobile kept the board as a shrunken
  desktop pin-wall with fragmented text and because the manifest lacked slice
  and responsive metadata
- UI panel and card backgrounds still stretched or deformed at different
  component sizes because frame-like material was treated as a background image
  instead of a nine-slice renderer with protected corners, controlled edges,
  center fill, content padding, and minimum size
- the same rerun also showed an execution-risk pattern: reference and asset
  artifacts can be completed before implementation evidence exists, so long
  runs need a checkpoint instead of silent waiting

## Bench Implication

Generated assets need a role-specific browser asset contract:

- asset role
- crop manifest
- alpha or mask semantics
- slice or patch metadata, including renderer strategy and specimen screenshots
- density and responsive behavior
- selector usage
- fallback behavior
- desktop and mobile material parity screenshots

Material richness cannot override visible UI blockers.

Successful fixed-size glyph sprites should become a positive transfer pattern:
preserve the accepted asset, alpha semantics, target size, selector usage, and
visual comparison instead of regressing to generic library icons or oversized
sheet crops in later iterations.

Scalable UI panels need a separate specimen gate. Before using a frame asset in
live UI, render it at minimum, normal, wide, tall, dense-content, and mobile
sizes. Block completion if corners scale, edge texture warps, the center muddies
text, content clips, or the panel is used below its slice-safe minimum.

## Follow-Up Experiment Observation

A later hard-task experiment showed the next gap after adding the specimen
gate: the workflow produced all required artifacts, custom glyph sprites,
browser checks, mobile screenshots, and a reusable patched DOM panel, but the
ledger still missed defects visible in screenshots.

Observed misses:

- the visual bug ledger treated "no browser-detected overflow" as equivalent
  to "no visual bugs"
- a graph/map label cluster visibly overlapped in the main desktop screenshot
  even though browser checks passed
- shallow specimen text on parchment panels had poor contrast, but the
  specimen ledger marked readability as pass

Bench implication:

- visual bug ledgers need an explicit parent or judge screenshot-review row
  separate from automation
- graph, map, and spatial labels need overlap/readability checks, even when no
  drag behavior is claimed
- frame specimen sheets must judge text contrast and content readability, not
  only specimen existence and minimum size
