# Failure Modes

## Projectile-Only Shoot Frames

Symptom:

- one shoot source cell contains only a projectile, muzzle flash, or detached VFX
- the final runtime sheet has an empty/effect-only frame

Mitigation:

- reject the source strip
- regenerate the shoot strip with "no bullets, no muzzle flash, no projectile, full-body character in every cell"
- add muzzle effects at runtime

## Cross-Cell Effects

Symptom:

- muzzle flash or weapon trail crosses into the next figure cell
- final sheet shows detached pixels at the edge of a neighboring frame

Mitigation:

- reject the source strip
- ask image2 for a no-effect standing shoot strip
- preserve rejected source as `*-rejected-vN.png`

## Technical Pass, Visual Fail

Symptom:

- dimensions, alpha, and green leakage checks pass
- walk still reads as static standing poses, or front/back only differ by internal details

Mitigation:

- require preview contact sheet inspection
- use an independent reviewer
- regenerate source strips rather than patching final sheets

## Subtle Or Static Walk

Symptom:

- walk passes dimensions and alpha checks
- legs barely change, or only upper-body pixels move
- in-game movement feels like sliding

Mitigation:

- regenerate walk with explicit alternating lower-body gait language
- run `scripts/analyze_sprite_motion.py`
- reject if visual metrics and preview both show static lower-body motion

## Walking Shoot

Symptom:

- standing shoot has leg cycling or body translation
- runtime cannot combine move and aim states cleanly

Mitigation:

- regenerate shoot as a planted standing upper-body action
- handle locomotion with the walk sheet and aim/shoot overlay logic in runtime
- run `scripts/analyze_sprite_motion.py` and inspect lower-body drift

## Source Identity Drift

Symptom:

- outfit, exposed skin, cybernetic arm, weapon, hair, or visor changes between actions

Mitigation:

- regenerate from a stronger model sheet prompt
- keep action prompts explicit about identity invariants
- do not use runtime offsets or color tweaks to hide identity drift

## Chroma Key Leakage

Symptom:

- final sheet has green corners, green fringe, or opaque green rectangle

Mitigation:

- rerun processing with chroma removal
- validate `greenOpaqueRatio == 0.0`
- never reference `source/*.png` directly from runtime

## Side-View Drift

Symptom:

- source art looks like a platformer character, not top-down 3/4

Mitigation:

- regenerate with explicit top-down camera language: shoulder planes, boot tops, back plate, head viewed from above
- avoid prompts like side view, concept art miniature, realistic action pose
