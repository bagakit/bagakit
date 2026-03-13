# Benchmark Map

This note keeps the benchmark and framework references that most directly shape
Bagakit's eval-system design beyond vendor docs.

## Core References

### BrowseComp

- url:
  - <https://openai.com/index/browsecomp/>
- date:
  - 2025-04-10
- why it matters:
  - strong lesson on hard-to-solve but easy-to-verify tasks plus contamination
    defenses
- Bagakit takeaways:
  - prefer asymmetric verification
  - treat public challenge sets as contamination-prone

### Why SWE-bench Verified no longer measures frontier coding capabilities

- url:
  - <https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/>
- date:
  - 2026-02-23
- why it matters:
  - direct warning on benchmark contamination and false-negative test suites
- Bagakit takeaways:
  - keep private or refreshed holdouts
  - audit test defects before concluding capability regression

### tau-bench

- url:
  - <https://arxiv.org/abs/2406.12045>
- date:
  - 2024-06-17
- why it matters:
  - strongest primary-source case for state-based grading and repeated-trial
    reliability in tool use
- Bagakit takeaways:
  - score resulting state, not only prose
  - add repeated-run reliability for risky tool workflows

### LangSmith trajectory evaluations

- url:
  - <https://docs.langchain.com/langsmith/trajectory-evals>
- date:
  - not listed on page
- why it matters:
  - useful operational matcher vocabulary for trajectory checks
- Bagakit takeaways:
  - not every valid trace needs one exact order
  - distinguish required steps from flexible ordering
