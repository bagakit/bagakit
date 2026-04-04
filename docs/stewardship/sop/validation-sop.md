# Validation SOP

## Purpose

This SOP explains how to add or extend repository validation without collapsing
tool semantics, skill semantics, and framework mechanics into one place.

## Default Procedure

1. Decide whether the new check is release-blocking validation or non-gating
   evaluation.
2. If it is release-blocking, place it under `gate_validation/`.
3. If it is informative, comparative, or benchmark-oriented, place it under
   `gate_eval/`.
4. Register new validation through one `validation.toml` under the matching
   `gate_validation/` subtree.
5. Prefer built-in validator runners first.
6. Only add a script extension when the built-in runners are clearly not enough.

## Path Selection

Use these path rules:

- repo backbone rules -> `gate_validation/backbone/`
- maintainer tool validation -> `gate_validation/dev/<tool-id>/`
- skill validation -> `gate_validation/skills/<family>/<skill-id>/`

Do not place release-blocking validation scripts inside `dev/` or `skills/`
unless that script is also a real runtime dependency of the owning skill.

User-facing command-language target:

- `gate validate`
- `gate eval`

Implementation remains under `dev/validator/`.

## Preferred Progression

Prefer this order:

1. `validation.toml` with built-in `fs`
2. `validation.toml` with built-in `command`
3. a helper script under the same `gate_validation/` subtree, called by a
   `command` suite

Avoid reaching immediately for ad hoc files like:

- `validate.sh`
- `validation.py`
- `check_repo.py`

Those patterns are acceptable only when the validator framework boundary is
insufficient and the owning registration still lives under `gate_validation/`.

## Steward Rule

When adding a validation extension:

- keep the framework generic
- keep repo-owned semantics in `gate_validation/backbone/`
- keep tool- or skill-specific semantics out of `dev/validator/`
- keep eval assets out of `gate_validation/`
- keep compatibility logic out of the validation architecture

## Assertion Choice Rule

Before writing a new validation assertion, choose the proof surface in this
order:

1. canonical structured state
2. generated artifact structure
3. explicit CLI boundary summaries
4. free-form prose as last resort

Ask these questions:

1. does the owning surface already emit json, toml, ndjson, or another stable
   machine-readable payload
2. if yes, why is the check not validating that payload directly
3. if no, is the current string match proving a real boundary or only checking
   wording
4. if the check is wording-heavy, should the owner expose a smaller structured
   artifact instead

Default stance:

- use string matching sparingly
- keep exact stdout matching at thin command-smoke boundaries
- avoid making long markdown or large shell output the primary gate surface
- move rich semantic checks toward structured owner-owned state whenever
  feasible

## Behavior Proof Rule

Before adding or changing a validation assertion, name three things:

1. the behavior or boundary being protected
2. the independent oracle that proves it
3. the public or owned boundary being exercised

Good validation failures should say which behavior contract broke. They should
not merely say that an implementation string, private method name, import,
comment, heading, or broad source-code pattern changed.

Prefer proof through:

- public commands, public APIs, or exported helper boundaries
- generated argv, generated prompts, parsed payloads, receipts, or resulting
  state
- fake transports, fake processes, fake stores, and deterministic fixtures
- structured artifacts owned by the surface under test

Source inspection is valid only when the inspected text is itself the published
contract. Examples include installable skill instructions, managed frontdoor
text, generated prompt text, explicit template payloads, or wording that users
and agents consume directly.

When source text is the contract:

- use `proof_mode = "wording_contract"` when the suite is registered in
  `gate_validation/validation.toml`, or use explicit text-contract wording in
  comments and failure messages for local helper assertions
- keep the match narrow to the contract phrase or generated payload
- state what runtime behavior the wording assertion does not prove

For tool and runtime behavior, source grep is usually a change-detector test.
Do not read implementation source and assert private strings, method names,
headings, imports, comments, or broad absence regexes as runtime proof.
Patterns such as broad `writeFile|mkdir|rm` absence checks are not safety
proofs; prove safety through the command boundary, fake filesystem or store
results, parsed receipts, or denied operation outcomes.

If a private refactor that preserves externally meaningful behavior would fail
the validation, rewrite the assertion or explicitly classify it as a wording
contract. This matters especially in Bagakit because skill authoring and tool
development have different proof surfaces: skill text may be runtime payload,
while tool source code is usually implementation detail.

Reference anchors:

- Google Testing Blog, "Change-Detector Tests Considered Harmful"
- Testing Library Guiding Principles
- Software Engineering at Google, "Unit Testing"

## Timing Review Rule

Before proposing:

- more parallelism
- prepared repo templates
- changed-scope execution

collect the current timing summary from the validator first.

Reason:

- Bagakit should optimize against the real current key path
- per-suite timings are the current primary signal
- wall-clock total confirms whether aggregate suite cost matches operator pain
- class totals cluster mutually exclusive suite ownership
- group totals help cluster cost without inventing fake lane
  semantics

Interpretation rule:

- treat skipped suites as scheduling information, not executed timing proof
- treat group totals as overlapping clustering, not as a second additive total
- do not propose new lane metadata just to make one timing table prettier
