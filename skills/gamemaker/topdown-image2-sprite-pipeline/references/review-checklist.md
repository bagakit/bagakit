# Review Checklist

Use this after scripts pass.

## Source Provenance

- required `source/*.png` files exist
- `generation-log.md` records image2 prompts or prompt summaries
- rejected source attempts are preserved as evidence
- final sheets visibly derive from accepted source strips
- scripts did not draw or synthesize character pixels
- `source-layout-report.json` exists and passed before processing

## Technical Validation

- run `sh scripts/topdown-image2-sprite-pipeline-cli.sh validate-source-layout --root <workspace>`
- run `python scripts/validate_image2_sprite_package.py --root <workspace>`
- run `python scripts/analyze_sprite_motion.py --root <workspace>`
- for paper-doll kits, run `sh scripts/topdown-image2-sprite-pipeline-cli.sh validate-paper-doll-source-kit ...`
- final sheets exist under `final/`
- all final sheets are RGBA PNG
- dimensions match frame count times `128x128`
- alpha corners are clear
- green opaque ratio is `0.0`
- required reports and preview exist
- visual metrics report exists at `visual-metrics-report.json`
- visual metrics warnings are either fixed by regeneration or explicitly accepted with a reviewer note
- `review-disposition.md` exists and records `verdict: pass|conditional|fail`
- for paper-doll kits, machine checks pass for expected sheets/slots, dimensions, per-slot significant component count, margins, outside-slot pixels, chroma leakage, and guide residue
- for paper-doll kits, manual gates for exact ownership, hidden mating surfaces, identity/style, and camera/material coherence are complete and all `pass` before any rig promotion

## Visual Review

Pass for prototype only if:

- every final frame has a full character, except optional runtime-owned VFX sheets outside this contract
- front/back are authored views, not simple flips
- walk has visible gait motion
- shoot is a standing shoot and does not walk
- shoot source has no bullets, projectiles, muzzle flash, weapon trail, or detached VFX unless the consuming runtime explicitly wants baked VFX
- action families preserve identity
- top-down 3/4 read is stronger than side-view read
- body frames have no baked floor shadow unless the runtime owner accepted it
- shadow/blob, projectile, muzzle flash, and hit effects are separate layers or runtime-owned
- a small roster or batch reference preserves camera, outline weight, palette, and body proportions
- paper-doll kits do not expose hollow joint cuts, borrowed neighboring ownership, or guide-border/text residue

## Verdict Labels

- `pass`: usable for prototype integration
- `conditional`: technically usable but needs targeted regeneration before runtime integration
- `fail`: source provenance, frame semantics, or final runtime contract is broken

## Review Packet

The reviewer should receive only the isolated package workspace and verify:

- source strips and rejected attempts under `source/`
- `source-layout-report.json`
- final sheets under `final/`
- `preview-contact-sheet.png`
- `validation-report.json`
- `independent-image2-validation-report.json`
- `visual-metrics-report.json`
- `review-disposition.md`
- optional `review-packet.md` filled from
  `references/review-packet-template.md` when paired or independent review is
  used

If two reviewers are available, split the review:

- provenance reviewer: source lineage, generation log, script scope, report consistency
- visual reviewer: silhouette, gait, action identity, top-down readability, runtime fit
