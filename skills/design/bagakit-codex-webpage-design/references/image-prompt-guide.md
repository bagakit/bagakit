# Image Prompt Guide

Use this when creating or revising the design reference image.

Image2 is the default reference generator when the user has no stronger visual
or design context. Do not implement directly from text requirements with no
design reference. If a stronger Figma frame, screenshot, approved mockup, real
asset set, design system, or structured content context exists, record why that
reference replaces or constrains image2.

If a stronger reference exists, every later image2 prompt must use that
reference as the anchor. Do not use screenshots of a failed or under-review
implementation as the visual source for new state boards. A failed screenshot
may be attached as bug evidence only if the prompt explicitly says not to copy
its drift.

## Prompt Shape

```text
Create a high-fidelity webpage design mockup or coherent design set.

Purpose:
- <what the page must accomplish>

Audience:
- <who it is for and what they need to feel/do>

Viewport:
- <desktop/mobile/landing hero/full page>

Content:
- <real copy, sections, data, product facts>

Reference survey:
- <3+ comparable products/pages and the design qualities this draft must meet or beat>

Design core:
- <target register, tone axes, observed/derived/fallback constraints, rule
  coverage priorities, and accepted uncertainty when a design packet exists>

Visual direction:
- <style, era, mood, density, material, lighting, texture>

Section reference set:
- <when the page has multiple generated sections, planned count and one
  horizontal implementation-readable frame per section>
- <ordered section names, section jobs, frame anchors, background/material
  treatment, image role, CTA role, and density/tempo for each frame>
- <shared palette, type scale, spacing cadence, CTA family, radius/material
  language, imagery grade, icon style, and copy tone across the frame set>
- <one visual throughline and any single delayed-recognition detail that helps
  scan order or brand recall>

Layout:
- <grid, surface areas, navigation, content order, focal hierarchy, density>

Information design:
- <core object/state/action model, compression strategy, copy/icon budget>

Typography:
- <display/body/mono direction, scale, contrast>

Color and imagery:
- <palette, image subjects, asset refs, background treatment>

Signature details:
- <2-4 details that make the design memorable>

State set:
- <default or happy path>
- <selected/focused object>
- <search/filter results>
- <empty/loading/error when relevant>
- <modal, drawer, expanded panel, or review queue when relevant>
- <hover/focus-visible/disabled treatment for primary controls>
- <mobile responsive frame>

Implementation constraints:
- browser-renderable shapes, responsive-safe spacing, readable text, no
  impossible micro-detail

Negative constraints:
- no generic gradient blobs, bland SaaS cards, stock-photo mood boards,
  unreadable text, irrelevant decoration, crowded layout, fake UI chrome,
  wireframe-like outlined box stacks, oversized padding used as polish,
  duplicate content modules, verbose explanatory copy, or weak reference-tier
  craft
```

## Prompt Rules

- Use real copy and real assets when available.
- For high-craft work, ground the prompt in a `reference-survey-ledger.md`
  rather than asking image2 to invent the design tier from scratch.
- When a `design-core-design-packet.toml` exists, include its target register,
  tone axes, observed/derived/fallback constraints, rule priorities, and
  accepted uncertainty. The generated draft should preserve the packet rather
  than inventing a new visual identity.
- State whether the prompt is creating the primary design reference or only a
  style/exploration variant.
- Specify the page as a webpage mockup, not an abstract poster.
- Name the target viewport and whether the image should show the full page or a
  first viewport.
- Include constraints that make the design implementable in HTML/CSS.
- Ask for surface-led composition: regions should be organized by planes,
  material, density, hierarchy, and state, not only by thin outlines.
- Include a density target. Avoid large padding, empty hero space, and
  low-information cards unless the design brief gives a concrete reason.
- Include a copy/icon budget. Ask for concise labels, status, counts, grouping,
  and meaningful icons instead of explanatory paragraphs.
- Ask for one strong direction at a time; variants belong in separate prompts.
- If text fidelity matters, keep text short and expect to implement exact text
  in code rather than trusting generated image text.
- If the interface has meaningful states, ask image2 for a coherent set of
  frames with the same grid, typography, art direction, components, and spacing.
  Do not let each state become a separate redesign.
- If the page itself has multiple generated sections, prefer a section frame
  set: one focused horizontal frame per planned section. A tall full-page
  overview may supplement the set, but it should not replace per-section frames
  when section-level craft, imagery, hierarchy, and implementation detail
  matter.
- Record the planned section count before generation. The accepted reference
  set should have one generated frame per planned section, labeled by section
  order and job. If the count is ambiguous, choose an explicit count from the
  brief and record the rationale instead of silently returning one "best"
  frame.
- Vary section rhythm across the generated set. Do not repeat the same frame
  anchor, card slab, hero split, CTA treatment, image-to-text ratio, or
  background intensity throughout the scroll unless the reference survey
  supports that restraint.
- Keep split frames visually continuous. Palette, typography, CTA family,
  border radius, material language, image treatment, icon style, and copy tone
  should read as one brand system even when composition and density vary.
- Use imagery as structure when the brief calls for visual direction. Product
  crops, editorial media, full-bleed visuals, material textures, or generated
  assets can carry hierarchy; tiny decorative thumbnails and fake dashboards
  should not.
- For state boards derived from a strong reference, say explicitly that the new
  states must preserve the strong reference's layout, proportions, material,
  component density, typography, and signature details.
- When image2 cannot produce every state, preserve the missing state prompt and
  mark that state as a blocking or accepted gap before implementation.

## Critique After Generation

Before coding, answer:

- What is the visual point of view?
- Which comparable references define the target tier, and where is this draft
  stronger or weaker?
- If a design-core packet exists, did the draft preserve target register,
  brand tone axes, source confidence, and rule coverage?
- Did the design integrate duplicate concepts into one clear object-flow model?
- Does the page read as surface-led product design rather than a wireframe or
  stack of outlined boxes?
- Is the first viewport dense enough to communicate useful state without
  feeling crowded?
- Which explanatory text should become an icon, count, status, label, grouping,
  tooltip, or removed element?
- Which details must be preserved exactly?
- Which generated details are not web-feasible or not worth matching?
- What assets are missing?
- What responsive behavior is implied?
- Does the design set cover all meaningful branch states?
- Do branch-state frames stay visually coherent with the primary frame?
- If this is a section frame set, does the number of frames equal the planned
  section count, and does each frame show exactly one focused section?
- Does the ordered frame set vary rhythm while preserving one palette,
  typography system, CTA family, material language, image treatment, and voice?
- Does the first viewport avoid a reflexive template composition unless the
  brief or reference tier supports it?
- Did the generated board drift toward a failed implementation instead of the
  strong reference?
- Which states are missing and should block implementation or be governed by a
  reusable component-state rule?
- Would the page still work if the hero image or decoration failed to load?

## Current Docs Rule

When building API-backed image tooling, verify current OpenAI image generation
model and API details through official docs first. Do not bake current model
names or parameters into this reference.
