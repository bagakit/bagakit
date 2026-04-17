# Rewrite Protocol

## Detect Mode

Return:

1. Issues found, grouped by P0/P1/P2.
2. Assessment: which findings are real release risks and which are judgment
   calls.

Do not rewrite in detect mode.

## Rewrite Mode

Return:

1. Issues found, with short offending excerpts.
2. Rewritten version, preserving intent, facts, examples, and useful structure.
3. Change summary, focused on meaningful structural edits.
4. Second-pass audit. Re-read the rewrite and either fix remaining AI tells or
   state that no blocking AI-tone issue remains.

## Rewrite Threshold

Prefer patching when the draft has isolated word or phrase issues.

Recommend full paragraph rebuild when all of these are true:

- five or more always-rewrite lexicon hits
- three or more structural pattern categories
- uniform rhythm or list-heavy scaffolding

For a rebuild, first state the core point in one sentence, then rewrite around
that point.

## Conflict-Bait Guard

Do not create tension by turning the topic into a staged fight:

- `该做 vs 不该做`
- `塌方式 vs 体面`
- `赢面高 vs 赢面低`
- `老路 vs 新路`

These frames look clear, but they often manufacture conflict and invite
argument. Replace them with the actual decision boundary, trade-off, or failure
mode.

Also avoid vague group dunking:

- `人们往往...`
- `大多数人...`
- `很多团队会...`

Use those forms only when a source, sample, or explicit context is visible.
Otherwise write the concrete behavior: `把 rollout 写成发布，会漏掉验证完成`
is stronger than `大多数团队会误解 rollout`。

## Context Exceptions

Technical and docs profiles prioritize clarity over voice. Domain terms are
allowed when they carry precise meaning.

Do not flag quoted examples when the text is explicitly discussing AI writing
patterns. Only flag the author's own prose.
