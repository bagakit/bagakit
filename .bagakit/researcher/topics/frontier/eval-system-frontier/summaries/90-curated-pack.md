# Curated Frontier Pack

## Scope

This pack keeps the shortest Bagakit-ready frontier reading set for the eval
system topic.

## Must Read First

1. `summaries/a01.md`
   - Anthropic's clearest operating model for agent eval systems
2. `summaries/o02.md`
   - OpenAI's clearest official held-out and continuous-eval guidance
3. `summaries/o01.md`
   - best official decomposition of traces, graders, datasets, and runs
4. `summaries/a03.md`
   - strongest warning that harness quality can swamp model or skill deltas
5. `summaries/b03.md`
   - strongest benchmark lesson on repeated-trial reliability and state-based
     grading

## Why This Pack Matters

- it covers system decomposition
- it covers dataset and holdout discipline
- it covers reliability instead of one-shot success
- it covers benchmark contamination and infrastructure noise

## Bagakit Reading Route

1. read `a01` and `o01` to get the system split right
2. read `o02` to get dataset and holdout policy right
3. read `a03` and `b02` to avoid invalid benchmark claims
4. read `b03` when deciding whether a skill needs repeated trials
