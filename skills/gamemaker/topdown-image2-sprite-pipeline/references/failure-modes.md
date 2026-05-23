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

## Assumed Grid Only

Symptom:

- a script can force the source into a runtime-looking strip
- the original source is a model sheet, turnaround, collage, or wrong row/column count
- empty, partial, or fragment-only cells appear after packing

Mitigation:

- run `validate-source-layout` before processing
- reject sources without a strict accepted grid
- preserve the rejected source and regenerate from a reference-layout prompt or img2img reference

## Baked Shadow Or Layer Fusion

Symptom:

- floor shadow, background patch, weapon trail, muzzle flash, or projectile is fused into body frames
- post-hoc removal also removes shoes, dark clothing, or prop details
- runtime cannot independently control hitboxes, VFX, or contact shadow

Mitigation:

- regenerate body frames with no baked floor shadow and no detached VFX
- add a runtime-owned blob/contact shadow
- keep projectile, muzzle flash, and hit effects in separate VFX sheets
- accept baked layers only with explicit runtime-owner signoff in `review-disposition.md`

## Single Hero Render Bias

Symptom:

- one isolated character render looks useful
- a small roster reveals inconsistent camera, outline thickness, palette, proportions, or shadow convention
- the method cannot produce a coherent game cast

Mitigation:

- run a batch style-consistency review with 4-8 characters
- use a multi-character reference fixture before judging provider quality
- reject methods that only work for single-character concept art

## Subtle Or Static Walk

Symptom:

- walk passes dimensions and alpha checks
- legs barely change, or only upper-body pixels move
- in-game movement feels like sliding
- paired guided/no-guide full-row retries still miss the bilateral contact-recoil-passing-high-point loop

Mitigation:

- regenerate walk with explicit alternating lower-body gait language
- run `scripts/analyze_sprite_motion.py`
- reject if visual metrics and preview both show static lower-body motion
- after paired guided/no-guide full-row failures, stop resampling full rows
- switch to a clearly labeled `candidate per-phase pose-reference` workflow: one phase per generation, four-frame half-cycle first, blinded phase gate, then opposite-foot completion
- do not represent the per-phase fallback as proven until a blinded half-cycle and completed loop both pass

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
# Phase-name / pose-guide mismatch

**Symptom:** The character identity is stable and the output is a plausible
walk pose, but blind reviewers consistently call it a different gait phase than
the requested `contact`, `recoil`, `passing`, or `high-point` label.

**Why it matters:** Attractive and mutually different poses can still assemble
into the wrong order or omit a required phase. Alpha extraction and packing do
not repair motion semantics.

**Mitigation:** Stop prompt-only retries. Use a license-clear full-body pose
exemplar instead of a simple skeleton guide. Declare either a strict per-call
contract or a candidate-pool-and-blind-selection contract before generation.
Escalate to structural pose control or a deterministic rig if coverage still
fails.

## Flattened-Raster Rig Fragmentation

Symptom:

- rotating a limb crop reveals detached feet, duplicated armor, holes, or body
  fragments that belonged to the original overlap
- phase order becomes more controllable, but the transformed character no
  longer reads as one continuous body

Why it matters:

- one flattened render does not contain the hidden surfaces behind arms, legs,
  torso, cloth, or equipment
- masking and affine transforms can move existing pixels but cannot recover
  missing surfaces without repainting

Mitigation:

- keep the result as a negative fixture
- generate a complete paper-doll kit with each part fully visible and separated
  before rigging, or use a model with structural pose control
- validate part count, ownership, overlap margins, style consistency, and source
  provenance before any animation transform

## Paper-Doll Guide Residue

Symptom:

- generated sheet still contains slot borders, labels, or guide-colored strokes
- output only "passes" because the guide remains visible in the declared slot

Why it matters:

- the kit is not a clean generated source layer
- residual guides distort ownership, bbox, and future rig surfaces

Mitigation:

- run `validate-paper-doll-source-kit` with the actual guide images
- reject any sheet with guide residue above the declared threshold
- regenerate the sheet; do not paint over guide artifacts and call it source-clean

## Paper-Doll Manual Gate Missing

Symptom:

- machine checks pass, but no explicit human gate exists for ownership, hidden
  mating surfaces, identity/style consistency, or camera/material coherence

Why it matters:

- pixels alone cannot prove the kit is riggable
- promotion would overclaim structural safety that the validator cannot see

Mitigation:

- keep the validator result at `conditional` until all manual fields are filled
- fail promotion if any manual gate is explicit non-pass
- require the manual gate record in the review packet before rig preview

## Part-Ownership Failure Survives Angle Changes

Symptom:

- orthographic views look cleaner than game-camera views, but torso still owns
  shoulder armor, upper leg still owns the knee chain, or lower leg still owns
  the foot
- pairwise angle review has mixed winners and no angle produces a complete
  source pass

Why it matters:

- camera readability and semantic part ownership are different variables
- another prompt or angle retry does not introduce the missing structural
  control mechanism

Mitigation:

- keep the angle ablation as a negative fixture
- stop direct-layer prompt and angle micro-tuning
- move to a preregistered OpenPose plus identity-conditioning route

## Structural Stack Is Assumed Ready

Symptom:

- a workflow is written before confirming Python, Torch, accelerator support,
  custom nodes, model files, disk, identity reference, and control guides
- missing dependencies are reported as a failed image experiment

Why it matters:

- startup failure is not evidence about motion or identity quality
- ad hoc installs make the experiment hard to reproduce and hard to clean up

Mitigation:

- freeze an install manifest and disk/network budget
- run `preflight-structural-control` without network before installation and
  again after installation
- treat `blocked` as environment truth; generate only when the report is
  `ready`
