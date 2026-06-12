# Brand Tonality Method

Use this reference when a design task has a brand, product, website,
screenshot, generated design, or user-described visual direction.

## First Principle

Tone is not a list of adjectives. Treat tone as a set of observable design
axes that can be checked later in a draft, concrete plan, and final result.

## Evidence Tiers

Prefer direct visual evidence in this order:

1. rendered site, app, Figma frame, screenshot, or approved mockup
2. existing tokens, components, CSS, asset files, or design-system docs
3. public product pages, docs, changelogs, or social previews
4. generated design references
5. user description only

Record lower confidence when computed layout, authenticated product views,
motion, or production tokens are unavailable.

## Context Before Direction

Before choosing a new aesthetic, decide whether the task is extending an
existing visual system or creating one. Existing-system work should extract the
available tokens, components, content patterns, accessibility behavior, and
brand constraints before proposing changes. Greenfield work should state the
intended reference family or aesthetic premise explicitly, so the design is a
deliberate bet rather than a default style.

## Design Read

Before mapping taste, write a compact `design-read.md` in one short block:

- surface kind: brand page, product screen, tool, editorial, game, data, or
  mixed
- audience and likely intent
- primary object, task, or story the design must make legible
- current or desired vibe in plain words
- reference family, design system family, or industry archetype it sits near
- constraints: host stack, assets, content truth, accessibility, device, time,
  brand/legal, and known unknowns

The design read is not a moodboard. It is the first sanity check that the
agent understands what kind of surface it is designing before choosing visual
language.

## Tone Axes

Map each meaningful tone word into concrete choices:

- palette temperature, chroma, contrast, and neutral undertone
- typography role, scale, weight, and reading rhythm
- density, whitespace, row height, and first-screen information load
- surface depth, material, shadow, border, divider, and elevation behavior
- radius and shape language
- icon geometry, stroke, fill, corner behavior, and semantic load
- motion tempo, easing, reveal style, and reduced-motion fallback
- imagery subject, crop, lighting, texture, and asset honesty
- copy voice, label length, capitalization, and empty/error-state tone

If a tone word cannot be mapped to one of these axes, remove it or mark it as
unproven.

## Taste Dials

For high-craft or opinionated work, record explicit dials in
`tone-axis-map.toml` or the design packet:

- `variance`
  - low, medium, high, or extreme variation across layout rhythm, section
    shape, imagery, controls, and surface treatment
- `motion`
  - none, restrained, expressive, or central-to-experience, with reduced-motion
    fallback
- `density`
  - sparse, balanced, dense, or expert-dense, with the user reason

Each dial should include a rationale and an `override_reason` when it bends the
default expectation for the register. For example, a product tool can be
visually expressive when the expression clarifies object relationships; a
brand page can be dense when the audience needs fast comparison.

## Provenance Split

Every important design choice should be marked as one of:

- `observed`
  - directly seen in source evidence
- `derived`
  - inferred from observed patterns and target register
- `fallback`
  - substituted because the real asset, font, icon, or token is unavailable

Fallbacks must say what they approximate and what they do not claim to be.

## First Frame

For first-view or first-screen work, record:

- background field
- focal subject or primary object
- relationship between subject, text, controls, and data
- safe text zone
- density and scroll hint
- motion or state expectation
- mobile transformation
- whether assets are user-provided, generated, observed reference, or fallback

The first frame should make the brand or product legible without hiding the
next useful section or state.

## Brand System Board

When the task asks for brand identity, a new visual system, or a design that
must transfer beyond one page, create `brand-system-board.md` before detailed
execution. Cover:

- strategy: audience, promise, category tension, and what the brand refuses
- metaphor: the design idea that can survive across screens and materials
- logo or mark logic when relevant, including shape, grid, and misuse limits
- palette with role, contrast, and emotional temperature
- typography with voice, hierarchy, and fallback behavior
- application examples: page shell, card/list, control, editorial, social,
  presentation, or product-state usage as relevant
- image direction: subject, crop, lighting, texture, and avoidance zones
- transfer limits: which reference qualities are allowed to migrate and which
  would be misleading, derivative, inaccessible, or off-brand

Do not let a board become decorative wallpaper. It should explain how the same
brand logic changes concrete interface choices.
