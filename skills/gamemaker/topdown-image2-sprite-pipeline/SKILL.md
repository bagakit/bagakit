---
name: topdown-image2-sprite-pipeline
description: Generate, process, and validate image2-derived top-down 2D character sprite sheets for games. Use when creating prototype or production-candidate top-down/3-4-view pixel-action assets, image2 sprite source strips, chroma-key-to-alpha runtime sheets, front/back action families, Dead-Cells-inspired sprite workflows, or when verifying that generated sprite sheets are truly image-source-derived and not procedurally drawn.
---

# Top-Down Image2 Sprite Pipeline

Use this skill to run an image2-only asset experiment from a blank directory to a prototype-usable top-down character sprite package.

The key rule: image generation owns the visual character pixels. Scripts may remove chroma, slice strips, crop, normalize, assemble, preview, and validate. Scripts must not draw or fabricate character frames.

## Runtime Surface Declaration

This skill has no persistent Bagakit runtime surface by default.

The sprite workspace created for a run is user-chosen output, not skill-owned
durable state. Keep it outside the consuming game project until technical
validation, visual metrics, and reviewer disposition are complete.

Related contract:

- `docs/specs/runtime-surface-contract.md`

## Workflow

1. Create an isolated workspace outside the game project.
2. Copy or write an asset contract from `references/asset-contract-template.md`.
3. Generate image2 source images into `source/`:
   - `model-sheet-source.png`
   - `idle-front-source.png`
   - `idle-back-source.png`
   - `walk-front-source.png`
   - `walk-back-source.png`
   - `shoot-front-source.png`
   - `shoot-back-source.png`
   - `hit-front-source.png`
   - `hit-back-source.png`
4. Record prompts and replacements in `generation-log.md`.
5. Reject bad source strips before processing. Keep rejected sources with `*-rejected-*.png` names as evidence.
6. Process accepted source strips:

```bash
python scripts/process_image2_sprite_package.py --root <workspace>
```

7. Run independent validation:

```bash
python scripts/validate_image2_sprite_package.py --root <workspace>
```

8. Run visual-semantic metrics:

```bash
python scripts/analyze_sprite_motion.py --root <workspace>
```

9. Inspect `preview-contact-sheet.png` manually or with an independent reviewer using `references/review-checklist.md`.
10. Write `review-disposition.md` with the verdict and accepted warnings.
11. Run handoff validation:

```bash
sh scripts/topdown-image2-sprite-pipeline-cli.sh check-handoff --root <workspace>
```

12. Only call the package usable after technical validation, visual metrics, and visual review pass.

## Source Generation Rules

Generate flat green-screen source strips unless true alpha output is explicitly available. Use one action/view per strip. Keep large gaps between figures.

For shoot strips, prefer no muzzle flash or projectile in the source. Add firing VFX at runtime. Detached effects and cross-cell muzzle flashes are common image2 failure modes.
Use `references/prompt-patterns.md` when writing prompts or regenerating a failed strip.

Every action strip must preserve:

- same character identity
- same outfit and exposed-skin ratio
- same cybernetic arm / weapon / visor / hair
- complete full-body character in every source cell
- top-down 3/4 camera, not side-view platformer posture

## Default Runtime Contract

The bundled scripts expect this default contract:

- `final/hero-image2-idle-front.png`: 6 frames, 768x128
- `final/hero-image2-idle-back.png`: 6 frames, 768x128
- `final/hero-image2-walk-front.png`: 8 frames, 1024x128
- `final/hero-image2-walk-back.png`: 8 frames, 1024x128
- `final/hero-image2-shoot-front.png`: 6 frames, 768x128
- `final/hero-image2-shoot-back.png`: 6 frames, 768x128
- `final/hero-image2-hit-front.png`: 4 frames, 512x128
- `final/hero-image2-hit-back.png`: 4 frames, 512x128

Each runtime frame is `128x128` RGBA PNG with transparent corners and no green-screen leakage.

## Review Gates

Treat validation as necessary but insufficient. A package can have zero technical warnings and still fail if the source semantics are wrong.

Reject or regenerate source art when:

- any cell is projectile-only, effect-only, empty, or cropped
- muzzle flash crosses into the next cell
- front/back are just flips
- walk frames read as static standing poses
- standing shoot shows walking legs
- side-view posture dominates the top-down read
- action sheets look like different characters

See `references/failure-modes.md` for examples and mitigation.

## Paired Review Packet

For prototype or production-candidate assets, hand off a compact review packet
instead of just the final PNGs:

- `asset-contract.md`
- `generation-log.md`
- `validation-report.json`
- `independent-image2-validation-report.json`
- `visual-metrics-report.json`
- `preview-contact-sheet.png`
- `review-disposition.md`

`review-disposition.md` must include:

- `verdict: pass`, `verdict: conditional`, or `verdict: fail`
- reviewer identity or role
- accepted warnings with rationale, or `none`
- rejected warnings with regeneration notes, or `none`
- any runtime-contract deviations and who accepted them

Use two reviewers when the package will be integrated into a game branch or
used as a benchmark fixture. One reviewer should inspect source provenance and
script outputs; the other should inspect visual semantics and runtime
readability. Do not let the same agent both create and approve a conditional
package without explicit user acceptance.

Use `references/review-packet-template.md` when the review should be handed to
another agent or merged across two reviewers. The packet follows
`docs/specs/review-packet-contract.md` and should be filled before final
handoff.

## Bundled Scripts

- `scripts/process_image2_sprite_package.py`: process accepted image2 source strips into runtime sheets, contact sheet, README, and validation report.
- `scripts/validate_image2_sprite_package.py`: independent validator for source presence, final dimensions, RGBA alpha, green leakage, bbox drift, and required artifacts.
- `scripts/analyze_sprite_motion.py`: visual-semantic analyzer for gait motion, standing shoot lower-body stability, detached components, and front/back silhouette differences.
- `scripts/topdown-image2-sprite-pipeline-cli.sh`: skill-owned CLI entrypoint for package processing, validation, motion analysis, and handoff checks.

Image-processing commands require Pillow.
