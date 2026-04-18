# Brand Tonality Synthesis

Source note:

- `github:dominikmartn/hue@0c2914742d52fcf09aa2834893e187bd48eaeea3`

This file records Bagakit's local synthesis from the reference project. It is
not a runtime dependency and does not preserve the reference project's file
structure.

## Bagakit Takeaways

Brand tone should become design behavior that can be checked later.

Use a tone-axis map instead of a style adjective list:

- palette temperature, chroma, and contrast
- typography role, rhythm, and weight
- density, whitespace, and first-screen information load
- surface depth, material, radius, shadow, and border behavior
- motion tempo and reveal personality
- icon geometry and semantic load
- image subject, crop, texture, and asset honesty
- copy voice, label length, capitalization, and state language

Each major design choice should say whether it is observed, derived, or a
fallback. Fallback fonts, icons, imagery, and generated assets must not imply
that they are the original brand assets.

For first-screen work, record the background field, focal subject, relation
layer, safe text zone, density, motion expectation, and mobile transformation.
The first screen should express the brand or product without hiding the next
useful section or state.

## Runtime Use

When `bagakit-design-core` is selected, turn this synthesis into:

- `source-evidence.md`
- `tone-axis-map.toml`
- `first-frame-composition.md`
- `design-packet.toml`

When `bagakit-codex-webpage-design` consumes a design packet, it should preserve
these axes in the image prompt, design spec, CSS tokens, assets, and result
review.
