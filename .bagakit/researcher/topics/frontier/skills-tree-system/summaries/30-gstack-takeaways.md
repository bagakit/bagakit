# Gstack Takeaways

## What `gstack` Optimizes For

`gstack` optimizes for one operator shipping like a small cross-functional
software team.

Its center of gravity is:

- one explicit sprint chain
- persistent tool capabilities
- strong review and QA gates
- multi-host distribution
- workflow productization rather than a neutral architecture framework

Reference snapshot:

- repo created: 2026-03-11
- repo pushed: 2026-04-19
- `package.json` version at inspection: `1.3.0.0`

## What Bagakit Should Borrow

### 1. Treat workflow as a first-class product surface

Borrow:

- `think -> plan -> build -> review -> test -> ship -> reflect`
- explicit stage handoff
- upstream artifact feeds for downstream stages

Bagakit implication:

- expose clearer end-to-end operating paths across existing harness skills

### 2. Keep heavy capability in code

Borrow:

- browser daemon pattern
- code-backed operators for nontrivial capability
- markdown as orchestration and usage surface, not as the whole product

Bagakit implication:

- runtime surfaces that matter repeatedly should become stable operators, not
  growing prose blocks

### 3. Generate docs from templates plus resolvers

Borrow:

- SKILL generation from reusable blocks
- freshness checks in CI
- shared method blocks that do not drift skill by skill

Bagakit implication:

- Bagakit can harden canonical `SKILL.md` quality without sacrificing
  repository-native authoring

### 4. Keep host integration declarative

Borrow:

- host config generation
- thin per-host projection
- no major logic fork for each target host

Bagakit implication:

- keep canonical monorepo truth in one place and project outward

### 5. Externalize checklists and rubrics

Borrow:

- reusable review checklists
- reusable QA taxonomies
- method assets that outlive one skill

Bagakit implication:

- move more review and quality knowledge into reusable assets and contracts

### 6. Build a tiered eval stack

Borrow:

- cheap static checks
- expensive real-agent E2E
- optional judge-style quality scoring

Bagakit implication:

- connect `gate_validation`, `gate_eval`, and `skill-evolver` with one clearer
  artifact ladder

### 7. Keep orchestrator integration thin

Borrow:

- methodology layer instead of reimplementing the system inside each host
- projection-focused OpenClaw integration

Bagakit implication:

- future host integrations should stay adapters, not become parallel Bagakit
  forks

## What Bagakit Should Not Copy

### 1. Do not copy the flat top-level repo layout

`gstack` optimizes for one branded product repo.
Bagakit needs family boundaries and runtime-versus-maintainer boundaries more.

### 2. Do not copy giant per-skill preambles

`gstack` often solves cross-cutting behavior by injecting a lot into every
skill. Bagakit should prefer smaller common contracts plus thinner runtime
payloads.

### 3. Do not copy the browser-first worldview

The browser daemon is a strong implementation pattern, but it should not become
Bagakit's default center of gravity.

### 4. Do not copy a heavy home-directory control plane as primary truth

`~/.gstack/...` fits a personal operating system model.
Bagakit's advantage is better repo portability and auditable local truth.

### 5. Do not copy the persona branding literally

`CEO`, `CSO`, `SRE`, and similar branding help `gstack` packaging, but Bagakit
is stronger when boundaries stay contract-oriented rather than roleplay-first.

## Bottom Line

`gstack` is a very good pressure-test for Bagakit because it proves that:

- workflow productization matters
- host integration matters
- generated docs matter
- persistent tool capabilities matter

But Bagakit should borrow the mechanisms, not the persona stack and not the
global-control-plane worldview.
