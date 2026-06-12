# Bundled layout dependency

`dagre.min.js` is the unmodified browser build from `@dagrejs/dagre` 3.1.1,
distributed under MIT. The adjacent license and legal notice accompany it.
It includes Graphlib. Source: https://github.com/dagrejs/dagre/tree/v3.1.1

Dagre supplies dependency-aware node placement. It was chosen over ELK's
larger worker runtime because this read-only projection needs synchronous
layered geometry and a small, portable offline HTML export. The owner routes
edges through bounded rank gutters and verifies node clearance separately.

Update by unpacking the pinned npm distribution in repository scratch space,
copying its `dist/dagre.min.js`, `LICENSE`, and `dist/dagre.min.js.LEGAL.txt`,
then running the topology geometry oracle and browser interaction checks.
No npm install, network fetch, or CDN is needed by a Tracker page.
