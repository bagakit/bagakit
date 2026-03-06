# Anthropic Map

This note keeps the Anthropic-side sources that most directly shaped the
current Bagakit eval design.

## Official Sources

### Define your success criteria

- url:
  - <https://docs.anthropic.com/en/docs/test-and-evaluate/define-success>
- date:
  - not listed on page
- why it matters:
  - strongest Anthropic doc for clarifying what is being measured before any
    test is written
- Bagakit takeaways:
  - every eval slice needs named dimensions and explicit failure meaning
  - vague “good output” suites are not enough

### Develop tests

- url:
  - <https://docs.anthropic.com/en/docs/test-and-evaluate/develop-tests>
- date:
  - not listed on page
- why it matters:
  - concrete advice on building task-specific test sets and representative edge
    cases
- Bagakit takeaways:
  - skill suites should start from the real task shape
  - case packs should include both representative and adversarial rows

### Strengthen empirical evaluations

- url:
  - <https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-evals>
- date:
  - not listed on page
- why it matters:
  - focuses on improving trustworthiness rather than only increasing case count
- Bagakit takeaways:
  - review grader quality, not only model quality
  - compare repeated runs and inspect surprising passes as carefully as fails

### Building effective agents

- url:
  - <https://www.anthropic.com/engineering/building-effective-agents>
- date:
  - 2024-12-19
- why it matters:
  - clean articulation of when workflows beat one-shot prompting
- Bagakit takeaways:
  - skill eval should reflect the real workflow boundary of the skill
  - multi-step skills need trajectory evidence, not final-answer-only checks

### Demystifying evals for AI products

- url:
  - <https://www.anthropic.com/engineering/demystifying-evals-for-ai-products>
- date:
  - 2025-06-03
- why it matters:
  - practical product-eval framing with judge design, transcript review, and
    failure analysis
- Bagakit takeaways:
  - keep a transcript-friendly case packet
  - combine automatic review with manual spot checks when quality is fuzzy

### Infrastructure noise in AI coding benchmarks

- url:
  - <https://www.anthropic.com/engineering/infrastructure-noise>
- date:
  - 2025-04-18
- why it matters:
  - shows how bad harness design can mismeasure good agents
- Bagakit takeaways:
  - record environment details in run packets
  - distinguish product failures from harness failures

## Representative Non-Anthropic Sharpeners

### LangSmith trajectory evaluations

- url:
  - <https://docs.langchain.com/langsmith/trajectory-evals>
- why it matters:
  - useful operational vocabulary for strict, subset, and unordered trajectory
    checks
- Bagakit takeaways:
  - some skill traces should accept more than one valid order

### tau2-bench

- url:
  - <https://arxiv.org/abs/2406.12045>
- why it matters:
  - focuses on tool-agent-user interaction and final-state evaluation
- Bagakit takeaways:
  - some Bagakit skills should be judged by resulting state, not prose
  - repeated-run reliability is more honest than one-shot success

### GAIA

- url:
  - <https://arxiv.org/abs/2311.12983>
- why it matters:
  - integrated assistant benchmark with reasoning, tools, and browsing
- Bagakit takeaways:
  - keep one small cross-skill challenge surface in addition to per-skill suites
