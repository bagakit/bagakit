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
