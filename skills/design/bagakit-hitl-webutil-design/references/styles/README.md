# Style References

Styles own visual route, density behavior, pane treatment, control treatment,
and scene-specific scan feel.

Style files should not redefine mechanism semantics.

Shared control baseline: selected/current case, pane, tab, and mode states
must not default to a thin single-edge rail as the only signal or repeat that
rail as generic chrome. Use the selected-state rule in
`bagakit-design-core` for the semantic exception and paired non-color cue.

Each style file should answer:

- what the page should feel like
- what layouts and controls fit the route
- what the route is good for
- what visual failure signals to watch
