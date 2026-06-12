---
name: topdown-image2-sprite-pipeline
description: Create and validate image2-derived top-down sprite sheets. Use for source strips, alpha/runtime sheets, action families, or provenance and motion review; do not use for ordinary game UI or non-image2 assets.
---

# Top-Down Image2 Sprite Pipeline

Use this skill to run an image2/img2img asset experiment from a blank directory to a prototype-usable top-down character sprite package.

The key rule: image generation owns the visual character pixels. Scripts may remove chroma, slice strips, crop, normalize, assemble, preview, and validate. Scripts must not draw or fabricate character frames.

Historical experiment evidence and negative samples live in
`references/round-history.md`; load it only when selecting or reviewing an
escalation route. The current source-layout and provenance gates remain below.

## Runtime Surface Declaration

This skill has no persistent Bagakit runtime surface by default.

The sprite workspace created for a run is user-chosen output, not skill-owned
durable state. Keep it outside the consuming game project until technical
validation, visual metrics, and reviewer disposition are complete.

Related contract:

- `docs/specs/runtime-surface-contract.md`

## Workflow

Choose the smallest declared asset scope before running the pipeline:
`single-action`, `action-family`, `full-package`, or `structural-control`.
Run only the stages and validators that prove that scope; do not create the
full package or structural-control ledgers for a single-action request.

1. Create an isolated workspace outside the game project.
2. Copy or write an asset contract from `references/asset-contract-template.md`.
3. Generate only the source strips declared by that contract. A full package
   may use the default set:
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
6. Run source layout validation before processing:

```bash
sh scripts/topdown-image2-sprite-pipeline-cli.sh validate-source-layout --root <workspace>
```

7. Process accepted source strips:

```bash
python scripts/process_image2_sprite_package.py --root <workspace>
```

8. Run independent validation:

```bash
python scripts/validate_image2_sprite_package.py --root <workspace>
```

9. Run visual-semantic metrics:

```bash
python scripts/analyze_sprite_motion.py --root <workspace>
```

For a `single-action` scope or as a hard gate before wider package assembly,
run:

```bash
sh scripts/topdown-image2-sprite-pipeline-cli.sh validate-single-action \
  --strip <rgba-strip.png> \
  --frames-manifest <frames-manifest.json> \
  --state running-right \
  --expected-frames 8 \
  --near-key-hex '#FF00FF' \
  --pose-manifest <pose-labels.json>
```

This validator stays within one row. It reports `pass`, `conditional`, or
`fail`, separates raw vs significant component counts so tiny matte islands do
not fail a valid row, checks strip equality against direct frame concatenation,
and keeps motion semantics conditional until a complete pose-label manifest is
present.

For a `paper-doll` or structural-rig scope, run:

```bash
sh scripts/topdown-image2-sprite-pipeline-cli.sh validate-paper-doll-source-kit \
  --slot-manifest <slot-manifest.json> \
  --sheet core=<generated/core.png> \
  --sheet arms=<generated/arms.png> \
  --sheet legs=<generated/legs.png> \
  --guide core=<source/core-slot-guide.png> \
  --guide arms=<source/arms-slot-guide.png> \
  --guide legs=<source/legs-slot-guide.png> \
  --manual-gates <manual-gates.json> \
  --provenance <provenance.json> \
  --report-out <paper-doll-validation.json>
```

`manual-gates.json` must provide:

- `exact_part_ownership`
- `hidden_mating_surface_completeness`
- `identity_style_consistency`
- `camera_material_coherence`

Only `pass` in all four fields unblocks promotion. Missing fields produce
`conditional`; explicit non-pass fields produce `fail`. The CLI exits `0` for
`pass`, `3` for `conditional`, and `1` for `fail`.

Before installing or executing a `structural-control` route, run:

```bash
sh scripts/topdown-image2-sprite-pipeline-cli.sh preflight-structural-control \
  --comfy-root <ComfyUI-root> \
  --manifest <install-manifest.json> \
  --canonical <identity-reference.png> \
  --guides-dir <openpose-guides-dir> \
  --accelerator mps \
  --report-out <preflight-report.json>
```

This command is offline. It checks ComfyUI, Python 3.11, the local virtual
environment, Torch, the requested accelerator, `ComfyUI_IPAdapter_plus`, model
file presence and plausible size, free disk, the canonical identity image, and
the required pose guides. Missing requirements produce a valid `blocked` JSON
report and exit `0`; readiness is expressed by `status`, not by treating an
uninstalled stack as a command failure.

### Round 15 route (only when the approved structural-control experiment is selected)

Load the historical round evidence and apply this camera-control rule only for
that route. Ordinary sprite generation does not need these preregistration,
committee, or approval steps.

- keep the Round 14 normalized square foreground-only identity reference
- authorize `depth` as the only execution route; `normal` and `lineart` remain
  preregistration comparisons only
- allow only `models/controlnet/control_v11f1p_sd15_depth.pth` as the added
  camera-bearing model, with the pinned manifest identity
- explicitly forbid `models/controlnet/control_v11p_sd15_depth.pth`
- allow only `scripts/render_capsule_depth_guides.py` plus
  `scripts/guide-spec.json` to produce the four depth guides from the frozen
  pose manifest
- build Round 15 workflows only through `scripts/build_round15_workflows.py`;
  freeze depth strength at `0.65`, start at `0.0`, and end at `0.85`
- require each phase to load its own `round15-depth-{phase}.png`; never share
  one depth map across contact, recoil, passing, and high-point
- compare each generated workflow against its Round 14 B baseline and reject
  any delta outside depth loader/image/apply nodes, KSampler conditioning
  wiring, and the Round 15 output prefix
- require an explicit approval receipt with the frozen scope id plus a `ready`
  preflight before staging any ComfyUI input; gate failure must perform zero
  target writes
- do not let the execution runner start ComfyUI or mutate the frozen workflow;
  it may only submit an already validated workflow and preserve input,
  workflow, history, and output hashes
- construct committee inputs through a deterministic twelve-image three-arm
  blind package: Round 13 A, failed Round 14 B, and Round 15 C; keep the A/B/C
  mapping separate from reviewer templates and reject any source
  image that is not a real `512x512` PNG
- freeze independent labels for all 12 images before opening four hidden-arm
  same-phase triads; each triad must record a winner plus structure and
  usability rankings, and the A/B/C mapping stays sealed until both stages end
- reject any triad review before synthesis unless all four phases have a valid
  winner and complete structure/usability permutations matching the sealed
  blind ids; empty or partially filled comparison templates are not evidence
- before committee review, verify every generated frame against its API receipt
  and reject outputs whose pixels equal Round 13 A, Round 14 B, the OpenPose
  guide, or the depth guide
- reject minimal or hand-written receipts: require the exact runner schema,
  approval scope, ready preflight, complete nine-role input hash set, matching
  OpenPose/depth hashes, workflow and history hashes, and the frozen depth
  model/guide/strength/schedule before semantic review
- require all four C phases to receive at least `2/3` intended-pose votes, have
  exactly one complete character, pass identity/camera/structure gates, and
  contain no extra or missing limbs; high-point must not repeat the third-leg
  failure
- reject C if it loses to A on any phase, or if it only ties failed B on
  structure or overall usability; a valid causal improvement must beat B while
  remaining at least as usable as A phase by phase
- before user approval, do not download, install, generate the guides, or run
  image generation
- after user approval, do only this sequence: obtain the exact depth model,
  generate `contact`, `recoil`, `passing`, and `high-point` depth guides, then
  rerun preflight after each declared remediation; if it remains blocked without
  a new state change, stop and report the missing requirement

10. Inspect `preview-contact-sheet.png` manually or with an independent reviewer using `references/review-checklist.md`.
11. Write `review-disposition.md` with the verdict and accepted warnings.
12. Run handoff validation:

```bash
sh scripts/topdown-image2-sprite-pipeline-cli.sh check-handoff --root <workspace>
```

13. Only call the package usable after source layout validation, technical validation, visual metrics, and visual review pass.

## Source Generation Rules

Generate flat green-screen source strips unless true alpha output is explicitly available. Use one action/view per strip. Keep large gaps between figures.

Prefer reference-fixture-driven img2img when possible: use an existing walk-cycle/model-sheet reference as the layout and motion anchor, then ask the provider to transform style or identity while preserving cell count, cell order, and camera. If a provider cannot preserve an existing reference layout, do not trust it to invent a reliable walk cycle from text alone.

The reference fixture must already satisfy the contract being tested. A `6x7`
animation atlas may test whether a provider preserves pose order and layout, but
it cannot prove a `4x2` eight-frame walk contract. Label such evidence
`layout-baseline-only`, and keep runtime acceptance blocked until a fixture with
the exact target grid, frame count, action, view, and ordering passes.

Before generation, record a provider preflight in `generation-log.md`:

- provider and exact model or Space revision when available
- credential or public-access status
- whether reference-image input is actually supported
- accepted input and output dimensions and formats
- output persistence path
- alpha strategy: native alpha, chroma key, segmentation, or diagnostic only
- expected grid, frame count, action, view, and reference-fixture contract

Before IP-Adapter identity conditioning, normalize the identity reference itself:

- use a square, full-body reference so the CLIP image processor does not silently center-crop important anatomy
- remove or mask background, floor, and baked shadow signals before identity encoding
- record the normalized reference hash separately from the original canonical hash
- treat OpenPose as a joint-layout control, not a camera contract; top-down projection may require an additional depth, normal, lineart, or camera-consistent rendered control

For every provider call used as evidence, preserve a receipt:

- input file path and SHA-256
- prompt, negative prompt, seed, strength, guidance, and other material settings
- upload response or provider asset id
- request, job, or event id
- raw provider response under `raw/inbox/`
- original downloaded output path and SHA-256 before post-processing

An in-chat preview without a recoverable original file and receipt is useful for
ideation only. It is not durable experiment evidence.

Do not bake runtime-owned layers into body frames:

- body sheet: character pixels only, no floor shadow
- shadow/blob: separate layer or runtime-owned effect
- muzzle flash, projectile, hit effect: separate VFX layer or runtime-owned effect
- weapon layer: separate only when independent aim/animation is required

Do not treat black-background keying as the default alpha pipeline. It can
delete dark outlines, hair, clothes, and internal shading, or merge the whole
sheet into one foreground component. Use it only as a labeled diagnostic unless
the asset contract explicitly reserves pure black for background and validates
that the character contains no conflicting dark pixels. Prefer native alpha,
chroma key with a reserved color, or a segmentation backend verified on the
actual frames.

For shoot strips, prefer no muzzle flash or projectile in the source. Add firing VFX at runtime. Detached effects and cross-cell muzzle flashes are common image2 failure modes.
Use `references/prompt-patterns.md` when writing prompts or regenerating a failed strip.

### Hard escalation rule for full-row walk generation

Enter this branch only after the selected walk contract has failed the paired
guided/no-guide check. Ordinary idle, shoot, hit, and single-action work stops
at its own validator.

- after paired guided/no-guide full-row failures against the same walk contract, stop resampling full eight-frame rows
- switch to a clearly labeled `candidate per-phase pose-reference` workflow instead
- generate one phase per call with an explicit pose reference for `contact`, `recoil`, `passing`, or `high-point`
- generate and blind-review the first four-frame half-cycle before any alpha extraction or runtime packaging
- only after that half-cycle clears a blinded phase gate, complete the opposite-foot half under the same contract
- treat this workflow as a candidate fallback only; Round 5 recommends it, but it is not proven yet

### Hard escalation rule for per-phase generation

Enter this branch only after the selected per-phase walk experiment fails; do
not load it for a normal action-family package.

- after simple skeleton or stick-figure pose guides fail blinded phase adherence, do not keep rewriting phase names in the prompt
- replace the weak guide with a license-clear rendered or sprite pose exemplar whose body geometry visibly matches the required phase
- generate a small candidate pool, then blind-label actual poses before seeing the intended mapping
- a candidate-pool workflow may select and order frames by their observed phase only when that selection contract was declared before generation and all required phases are covered
- do not retroactively rename a failed strict per-call experiment as a pass; retain it as negative evidence and start a new candidate-pool experiment
- if actual pose exemplars still fail to provide phase coverage, move to stronger structural control such as OpenPose ControlNet plus identity conditioning, or a deterministic 2D/3D rig
- Round 8 reached this escalation point: do not run another prompt-only or ordinary-exemplar gait round without a new structural control mechanism
- do not promote single-raster paper-cut rigging as a generic fallback; require either a generated complete part kit with independently visible limb surfaces, or structural pose generation
- a generated paper-doll sheet must prove clean part ownership and covered mating surfaces; visually plausible hollow sockets or fused joint chains are source failures, not repair tasks
- after grouped core/arms/legs generation fails, treat one-part-per-call as an unproven higher-cost candidate, not an automatic next step
- after the controlled one-part angle ablation fails to produce a dominant angle or a source pass, retire direct-layer prompt/angle tuning and move to the preregistered structural-control branch
- do not install a structural-control stack from an ad hoc command list; freeze the manifest, budget, guides, identity reference, accelerator, and hard gates, then require an offline preflight report

Every action strip must preserve:

- same character identity
- same outfit and exposed-skin ratio
- same cybernetic arm / weapon / visor / hair
- complete full-body character in every source cell
- top-down 3/4 camera, not side-view platformer posture
- no baked floor shadow unless the asset contract explicitly accepts it

## Default Runtime Contract

For the `full-package` route, the bundled scripts expect this default contract:

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

Use the full package gates below for prototype/production candidates. For a
single-action or exploratory scope, stop after the declared source validator,
the relevant visual check, and a compact disposition; add the remaining gates
only when the asset will be integrated, benchmarked, or reused.

Reject or regenerate source art when:

- `source-layout-report.json` fails or is missing
- any cell is projectile-only, effect-only, empty, or cropped
- source grid is only assumed after the fact
- muzzle flash crosses into the next cell
- body, floor shadow, VFX, or weapon trails are fused into one layer in a way the runtime cannot control
- front/back are just flips
- walk frames read as static standing poses
- standing shoot shows walking legs
- side-view posture dominates the top-down read
- action sheets look like different characters
- a single character looks good but a small roster does not preserve one camera, outline, palette, and proportion system
- the reference fixture does not match the target grid/frame/action contract and the result is presented as more than `layout-baseline-only`
- provider provenance is missing the recoverable original output, request receipt, or input/output hashes
- paper-doll source-kit validation reports missing sheets, wrong dimensions, fused or split significant slot components, touching slot boundaries, outside-slot pixels, guide residue, or reserved chroma leakage
- paper-doll manual gates are missing or non-passing; pixel checks alone do not prove the kit is riggable
- post-processing is the only reason a continuous background appears to become separate valid frames
- a `shadow-only` request still contains body-colored blocks, costume details, or character silhouettes
- a roster request produces many figures but not a coherent, reusable character family

See `references/failure-modes.md` for examples and mitigation.

## Paired Review Packet

For production-candidate, integrated, or benchmark assets, hand off a compact
review packet instead of just the final PNGs. A single-action prototype may
use the validator report plus a compact disposition until integration is in
scope:

- `asset-contract.md`
- `generation-log.md`
- `provider-receipt.json` or equivalent receipt fields in `generation-log.md`
- `source-layout-report.json`
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
used as a benchmark fixture. Otherwise one reviewer may cover provenance,
script outputs, visual semantics, and runtime readability. Do not let the same
agent both create and approve a conditional package without explicit user
acceptance.

Use `references/review-packet-template.md` when the review should be handed to
another agent or merged across two reviewers. The packet follows
`docs/specs/review-packet-contract.md` and should be filled before final
handoff.

## Bundled Scripts

- `scripts/process_image2_sprite_package.py`: process accepted image2 source strips into runtime sheets, contact sheet, README, and validation report.
- `scripts/validate_source_layout.py`: pre-processing validator for source grid/cell completeness before alpha removal and packing.
- `scripts/validate_image2_sprite_package.py`: independent validator for source presence, final dimensions, RGBA alpha, green leakage, bbox drift, and required artifacts.
- `scripts/validate_single_action_row.py`: single-row validator for frame count, significant component count, chroma leakage, bbox/scale/baseline/heading consistency, strip equality, and pose-label completeness.
- `scripts/preflight_structural_control_stack.py`: offline readiness report for ComfyUI, Python/Torch/accelerator, IP-Adapter node, model files, disk, identity reference, and pose guides.
- `scripts/analyze_sprite_motion.py`: visual-semantic analyzer for gait motion, standing shoot lower-body stability, detached components, and front/back silhouette differences.
- `scripts/topdown-image2-sprite-pipeline-cli.sh`: skill-owned CLI entrypoint for package processing, validation, motion analysis, and handoff checks.

Image-processing commands require Pillow.

If the default `python3` does not have Pillow, run the CLI with:

```bash
PYTHON_BIN=.venv/bin/python sh scripts/topdown-image2-sprite-pipeline-cli.sh <command> --root <workspace>
```
