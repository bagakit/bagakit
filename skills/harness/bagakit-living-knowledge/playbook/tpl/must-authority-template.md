# Authority

This page defines where truth lives for the shared knowledge substrate.

## Shared Checked-In Knowledge

- root:
  - `{{SHARED_ROOT}}`

## Runtime Roots Declared By Protocol

- researcher:
  - `{{RESEARCHER_ROOT}}`
- selector:
  - `{{SELECTOR_ROOT}}`
- evolver:
  - `{{EVOLVER_ROOT}}`

## Rules

- shared durable project knowledge belongs under the shared root
- path-local `AGENTS.md` may narrow execution guidance, but must not redefine the
  shared knowledge root
- shared pages, managed bootstrap text, and durable examples use repo-relative
  paths only
- absolute filesystem paths are forbidden in durable shared surfaces
- if one imported reference needs a durable handle, prefer a short opaque id
  such as `k-2ab7qxk9`
- do not carry forward timestamp-derived names, raw source file names, raw
  source file contents, or raw source-path/action-time metadata into shared
  knowledge pages
- research runtime is not shared knowledge by default
- evolver memory is not shared knowledge by default
- selector runtime is not shared knowledge by default
