# Precision And Reader Burden

Use this reference when a draft contains procedures, technical descriptions,
stable domain terms, decorative indirection, or a material consequence of
misunderstanding.

The goal is proportionate clarity. It is not full ASD-STE100 compliance and it
is not a universal short-sentence style.

## Core Invariants

- Keep one stable term for one concept unless a defined alias helps the reader.
- Name the actor, referent, condition, and action when omission creates
  ambiguity.
- In procedures, keep each numbered step centered on one primary action and
  put its condition before the action when order matters.
- Set sentence complexity from reader burden and consequence, not one global
  word limit.
- Preserve technical terms, qualifiers, causal direction, and rationale during
  simplification.

## Pressure By Route

| Route | Default pressure |
| --- | --- |
| ordinary prose | Intervene only when ambiguity or terminology drift is visible. |
| Core clarity | Review terms, referents, actors, and sentence load without flattening voice. |
| controlled technical | Apply stronger procedure and terminology review in the owning technical-writing skill. |

Long sentences, passive voice, pronouns, synonyms, and nuanced argument are not
failures by themselves. Review them only when they increase resolution cost,
hide responsibility, blur sequence, or change meaning.

## Literal Wording

Core owns `literal-wording-before-flourish`. Judge wording by the reader's work
and the accuracy of the resulting understanding. An image earns no quality
credit merely for being fluent, memorable, or distinctive.

When a literal phrase conveys the meaning clearly, use it. Decorative metaphors
make readers translate an image back into a claim and can imply properties the
claim does not support. State the parameter, action, result, or reason directly.
Check that imagery has not changed the actor, action, causal relationship,
degree, or scope. Preserve established technical names and attributed
quotations.

For an explanatory analogy, first state the literal relationship. Retain the
analogy only if it makes that relationship easier for this audience to
understand, and make its limits clear. If the literal version is equally clear,
prefer it. Review the reader's understanding, not how distinctive the wording
sounds; intentional literary effects remain a genre or user choice.

## Source Basis

- ASD-STE100 Issue 9 official overview: writing rules, controlled vocabulary,
  technical-term exceptions, and intended technical-documentation scope.
  `https://www.asd-ste100.org/about_STE.html`
- ASD STEMG checker guidance: sentence length, passive voice, and noun clusters
  are partially automatable, but checkers cannot decide whether text makes
  sense. `https://www.asd-ste100.org/STEsoftware.html`
- Chervak, Drury, and Ouellette found higher comprehension for Simplified
  English aircraft workcards, especially for difficult workcards and non-native
  readers. `https://doi.org/10.1177/154193129604000502`
- Stewart found no significant overall advantage in a smaller study, while
  lower-reading-level participants showed a favorable trend.
  `https://doi.org/10.14288/1.0078187`
- The STEMG AI white paper requires human oversight, terminology control,
  traceability, and benchmark-based evaluation for AI-assisted STE work.
  `https://www.asd-ste100.org/assets/files/WhitePaper-ASD-STE100_and_AI.pdf`

These sources support a bounded transfer into Bagakit. They do not prove that
STE removes AI tone, improves every genre, or should replace author judgment.
Do not redistribute the controlled dictionary or describe partial checks as
STE compliance.
