# Review Checklist

Use this after scripts pass.

## Source Provenance

- required `source/*.png` files exist
- `generation-log.md` records image2 prompts or prompt summaries
- rejected source attempts are preserved as evidence
- final sheets visibly derive from accepted source strips
- scripts did not draw or synthesize character pixels

## Technical Validation

- run `python scripts/validate_image2_sprite_package.py --root <workspace>`
- run `python scripts/analyze_sprite_motion.py --root <workspace>`
- final sheets exist under `final/`
- all final sheets are RGBA PNG
- dimensions match frame count times `128x128`
- alpha corners are clear
- green opaque ratio is `0.0`
- required reports and preview exist
- visual metrics report exists at `visual-metrics-report.json`
- visual metrics warnings are either fixed by regeneration or explicitly accepted with a reviewer note

## Visual Review

Pass for prototype only if:

- every final frame has a full character, except optional runtime-owned VFX sheets outside this contract
- front/back are authored views, not simple flips
- walk has visible gait motion
- shoot is a standing shoot and does not walk
- shoot source has no bullets, projectiles, muzzle flash, weapon trail, or detached VFX unless the consuming runtime explicitly wants baked VFX
- action families preserve identity
- top-down 3/4 read is stronger than side-view read

## Verdict Labels

- `pass`: usable for prototype integration
- `conditional`: technically usable but needs targeted regeneration before runtime integration
- `fail`: source provenance, frame semantics, or final runtime contract is broken
