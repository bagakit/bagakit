# Split Strategy Guide

## Goal

Decompose one large diff into commits that can each be explained in 1-5 ranked
facts.

## Split Axes

Prefer intent boundaries over file buckets:

1. behavioral change
2. tests that validate that behavior
3. docs that explain the new behavior
4. tooling or config support
5. mechanical groundwork such as renames or mass formatting

## Ordering

1. groundwork
2. behavior
3. validation and docs

## Fact Compression Check

Before committing, ask:

- Can I name one `P0` fact for this commit?
- Can I keep the whole message to 1-5 facts?
- If not, is the commit still mixing intents?

If the answer is no, split again.

## Practical Staging Techniques

- use `git add -p` for mixed hunks
- stage docs/config separately when they can stand alone
- do not mirror every changed file in the final message

## Common Failure Modes

- kitchen-sink commits from long sessions
- splitting by directory instead of reviewer intent
- writing a long module inventory instead of a ranked fact list
- relying on chat context to explain what `this` or `it` refers to
