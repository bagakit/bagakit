# Prompt Patterns

Use these patterns when source generation quality is the main risk.

## Model Sheet

Generate one locked character identity first:

- top-down 3/4 action sprite model sheet
- front and back views, same scale
- strong black silhouette outline
- chunky cel-shaded color planes
- limited palette
- same white asymmetric cyber top
- same black techwear pants
- same blue cybernetic right arm
- same visor, hair, boots, and compact weapon
- flat chroma green or transparent background

Avoid:

- realistic fabric micro-detail
- side-view platformer posture
- outfit changes between views
- tentacles, extra limbs, exposed-skin changes, or eye motifs

## Action Strip

For each action/view strip, repeat the locked identity and camera rules:

- one action and one view only
- full-body character in every cell
- equal spacing between figures
- no cropped feet, head, weapon, or backpack
- no camera change between frames
- no change to outfit, hair, visor, weapon, or cybernetic arm
- no baked floor shadow
- no background props or ground tiles

When using img2img or an image editing provider with a reference sheet:

- preserve the reference sheet cell count
- preserve the reference sheet cell order
- preserve the pose sequence and action timing
- transform only character identity/style details requested by the asset contract
- do not add extra characters, heads, props, labels, or decorative fragments

## Walk

Ask for readable top-down gait:

- 8 frame walk cycle
- legs alternate clearly in the lower half
- torso stays grounded and stable
- front walk faces screen, back walk faces away from screen

Avoid:

- standing poses with only coat/hair movement
- side-view run cycles
- frames facing the opposite direction from the requested view

If paired guided/no-guide full-row attempts fail the same contract, stop retrying
full eight-frame rows. Switch to a clearly labeled `candidate per-phase
pose-reference` workflow:

- generate one phase per call with an explicit pose reference
- build the first half-cycle as `contact`, `recoil`, `passing`, `high-point`
- send that half-cycle through a blinded phase gate before opposite-foot completion
- do not claim the fallback is proven until the completed loop passes review

## Shoot

Prefer character-only source strips:

- 6 frame standing shoot cycle
- upper body aims and recoils
- legs stay planted
- no bullets
- no projectile
- no muzzle flash
- no weapon trail
- no detached VFX

Add muzzle flash, projectiles, and hit effects at runtime or in separate VFX sheets.

## Layer Prompts

For body sources:

- character body only
- transparent background or flat chroma green background
- no baked shadow
- no floor contact ellipse
- no projectile, muzzle flash, hit spark, smoke, or trail

For shadow sources, if the runtime does not own shadows:

- simple soft oval contact shadow only
- same size and direction convention across the whole character set
- no character pixels

For batch style checks:

- 4 to 8 characters in the same camera angle
- same outline weight
- same palette family
- same body proportions
- no mixed render styles

## Hit

Ask for a short readable reaction:

- 4 frame hit reaction
- full-body character remains visible
- no dismemberment
- no transformation into an effect cloud
# Per-phase pose exemplar candidate

Use after simple skeleton guides fail. Image 1 is the canonical identity and
style reference. Image 2 is a license-clear full-body pose exemplar.

```text
Create one complete full-body instance of the character from Image 1.
Preserve its identity, outfit, markings, proportions, materials, camera, and
rendering style. Copy only the body geometry and weight distribution from Image
2. Do not copy Image 2's character identity, costume, palette, texture, or
background. Use a flat reserved chroma background. No floor shadow, VFX,
motion trail, crop, extra subject, text, or prop changes.
```

For candidate-pool runs, do not put the target phase name in the reviewer
packet. Reviewers label the observed phase first; selection happens only after
the blind labels are frozen.

Round 8 status: negative fixture. Eight candidates preserved identity but the
selected four-frame sequence failed three independent continuity reviewers.
Use this pattern only as a baseline or provider diagnostic. For the next
production-candidate gait test, use structural pose conditioning or a
deterministic rig.
