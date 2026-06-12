# Asset Pipeline

Use this when a design reference needs generated or provided image assets for
material craft.

The goal is not to add decoration. The goal is to turn visual craft into
browser assets that can scale, crop, mask, load, and fail without breaking the
UI.

## Asset Roles

Classify every asset before implementation:

- `texture_tile`: repeatable grain, noise, scratches, paper, fabric, metal, or
  background field
- `alpha_mask`: torn edge, cutout, burn, reveal, stamp, irregular clip, or glow
  boundary
- `nine_slice_frame`: scalable panel, parchment, ornamental frame, rift border,
  or card shell with protected corners and scalable edges
- `sprite_or_glyph_sheet`: icons, marks, emblems, stamps, cursors, or repeated
  small visuals
- `responsive_art`: illustration, poster, hero, viewport-specific composition,
  or art-directed image
- `overlay`: glow, dust, vignette, scanline, crack, haze, or atmosphere layer

If an asset has no role, remove it or keep it in the rejected-variant ledger.

## Required Fields

For each accepted asset, record in `asset-generation-ledger.md`:

- source or generation prompt
- role
- accepted file ref
- rejected variants and why
- format requirement: transparent PNG, SVG, mask, repeatable tile,
  nine-slice/frame, responsive image, or opaque illustration
- crop manifest when cut from a sheet: source ref, crop rectangle, output size,
  trim threshold if used, and extraction command or tool
- transparency or mask semantics: alpha, luminance mask, opaque, or not needed
- slice or patch metadata for scalable frames: slice margins, border widths,
  fill behavior, edge stretch or tile, content padding, and minimum size
- density and responsive behavior: `srcset`, `image-set`, breakpoint swap,
  repeat, crop, scale, or replacement
- selector or component usage map
- fallback behavior if the asset fails to load
- asset-level acceptance result: no halo, no seam, no unreadable overlay, no
  clipped control, no mobile-only breakage

## Fixed Sprites

Reference-specific icons, glyphs, stamps, and small marks are the positive
asset case when they remain atomic browser assets.

Record:

- target rendered size and density
- alpha or SVG transparency semantics
- selector or component owner
- hover, selected, disabled, and fallback treatment when applicable
- reference comparison showing the custom glyph language is preserved

Do not regress an accepted custom sprite into a generic icon library or an
oversized sheet crop unless the reference intent has changed.

## Nine-Slice Panel Rendering

`nine_slice_frame` means a renderer strategy, not just a bitmap. A scalable
panel, card shell, parchment frame, ornamental border, or torn inspector must
choose one of:

- `css_border_image`: rectangular DOM panels; record `border-image-source`,
  `slice`, `width`, `outset`, `repeat`, `fill`, content padding, and minimum
  size
- `dom_patch_component`: a custom `NineSlicePanel`, CSS grid, or absolute patch
  component with separate corners, edges, center, masks, and hit-target-safe
  content
- `canvas_nine_slice`: Pixi, Phaser, or equivalent only when the rendered
  surface is canvas or game UI

Record `renderer_strategy`, slice margins, border widths, edge stretch or tile
mode, center fill policy, content padding, minimum panel size, selector usage,
and fallback. If any of these are unknown, the asset is not ready for live UI.

Before using a frame asset in real components, create a specimen sheet or
screenshots at minimum, normal, wide, tall, dense-content, and mobile sizes.
Block completion if corners scale, edge texture warps, repeated seams appear,
the center muddies text, content clips, focus rings or hit targets break, or
the layout uses the frame below its slice-safe minimum.

Specimen review must inspect the screenshot, not only assert that specimen
elements exist. Text contrast, labels, disabled captions, focus rings, and
sample dense content must remain readable on the rendered material. A specimen
with low-contrast copy or muddy center fill is `needs_iteration` even when the
frame corners and edges are geometrically stable.

## Acceptance Rules

- A black-background or RGB asset sheet is not acceptable for transparent UI
  edges unless a reproducible extraction creates clean alpha and the screenshots
  show no halo.
- A full decorative panel bitmap is not acceptable for dynamic component sizes
  unless it is intentionally opaque and non-scalable. Use nine-slice,
  `border-image`, masks, or component patch logic for scalable frames.
- A texture tile must prove repeat behavior. Large-scale repetition, visible
  seams, blurry low-resolution density, or pattern banding are blockers.
- A mask must preserve shape while leaving live text, controls, focus rings,
  and hit targets as browser UI.
- A responsive asset must be checked in the actual selected desktop and mobile
  states. One desktop crop does not prove mobile parity.
- A generated asset may support the UI, but it must not replace the UI. Text,
  controls, states, layout, and interactions remain inspectable browser
  elements.
- A reference-specific sprite that already works should be preserved as an
  accepted asset case. Replacing it with a generic icon, font glyph, or
  rescaled sheet crop is a regression unless explicitly accepted.
- A frame-like asset may not pass material parity until its nine-slice specimen
  proves stable corners, controlled edges, readable center fill, valid minimum
  size, and responsive behavior.
- A passing browser assertion that a specimen exists is not enough. The
  specimen screenshot must be reviewed for readable foreground content,
  spatial overlap, focus treatment, and material-caused contrast loss.

## Material Parity Rows

`material-parity-checklist.md` should include rows for:

- asset inventory coverage
- crop manifest completeness
- alpha or mask integrity
- nine-slice or patch behavior
- nine-slice specimen coverage
- reference-specific sprite retention
- texture tiling and density
- responsive art direction
- component selector usage
- fallback behavior
- desktop screenshot material fit
- mobile screenshot material fit
- asset-caused bugs: clipping, halos, seams, low contrast, unreadable text,
  broken hit targets, accidental scrollbars, and overlay collisions

Any asset-caused visible bug keeps parity at `needs_iteration`.
