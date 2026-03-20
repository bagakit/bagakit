# OpenAI Map

This note keeps the OpenAI-side sources that most directly shaped the current
Bagakit eval design.

## Official Sources

### Evaluate agent workflows

- url:
  - <https://developers.openai.com/api/docs/guides/agent-evals>
- date:
  - not listed on page
- why it matters:
  - frames agent eval as one layered system made of datasets, traces, graders,
    and eval runs rather than one pass/fail check
- Bagakit takeaways:
  - keep task rows, traces, graders, and result packets as separate concepts
  - treat skill eval as workflow measurement, not only final-output review

### Evaluation best practices

- url:
  - <https://developers.openai.com/api/docs/guides/evaluation-best-practices>
- date:
  - not listed on page
- why it matters:
  - strongest OpenAI source on dimensions and process
- Bagakit takeaways:
  - measure final correctness, tool selection, argument precision, and handoff
    quality separately
  - grow evals as new failures appear

### Getting started with datasets

- url:
  - <https://developers.openai.com/api/docs/guides/evaluation-getting-started>
- date:
  - not listed on page
- why it matters:
  - practical dataset construction guidance
- Bagakit takeaways:
  - keep expected outcome beside input
  - convert failures into new rows instead of freezing one static benchmark

### Working with evals

- url:
  - <https://developers.openai.com/api/docs/guides/evals>
- date:
  - not listed on page
- why it matters:
  - concrete eval object model for dataset rows, testing criteria, and runs
- Bagakit takeaways:
  - one reusable run packet format should exist across eval slices
  - a suite should keep case truth local while still emitting a normalized run
    summary

### Graders

- url:
  - <https://developers.openai.com/api/docs/guides/graders>
- date:
  - not listed on page
- why it matters:
  - lays out narrow grader types and warns about judge hacking
- Bagakit takeaways:
  - prefer deterministic or executable graders first
  - use one fuzzy judge only where deterministic checks are not enough

### Trace grading

- url:
  - <https://developers.openai.com/api/docs/guides/trace-grading>
- date:
  - not listed on page
- why it matters:
  - makes trajectory review a first-class eval surface
- Bagakit takeaways:
  - preserve step-level command evidence in case reports
  - wrong order or wrong argument should be measurable even when the final
    artifact looks acceptable

### Safety in building agents

- url:
  - <https://developers.openai.com/api/docs/guides/agent-builder-safety>
- date:
  - not listed on page
- why it matters:
  - ties tool approvals, structured outputs, and trace review into agent safety
- Bagakit takeaways:
  - risky tool paths should have explicit eval families
  - safety belongs in eval scope when a skill can write or route external state

### Building resilient prompts using an evaluation flywheel

- url:
  - <https://developers.openai.com/cookbook/examples/evaluation/building_resilient_prompts_using_an_evaluation_flywheel>
- date:
  - 2025-10-06
- why it matters:
  - best official description of the qualitative-review to dataset-growth loop
- Bagakit takeaways:
  - Bagakit should treat failure review as input to shared eval growth
  - `gate_eval/` should stay non-gating but decision-relevant

### Evals API Use-case - Tools Evaluation

- url:
  - <https://developers.openai.com/cookbook/examples/evaluation/use-cases/tools-evaluation>
- date:
  - 2025-06-09
- why it matters:
  - clearest official example of grading structured tool calls
- Bagakit takeaways:
  - skill eval should inspect structured behavior, not only human-facing text
  - tool arguments and selected tool ids are valid first-class eval targets

### Evals API Use-case - MCP Evaluation

- url:
  - <https://developers.openai.com/cookbook/examples/evaluation/use-cases/mcp_eval_notebook>
- date:
  - 2025-06-09
- why it matters:
  - shows small prompt or tooling changes compared through one shared eval
- Bagakit takeaways:
  - keep A/B-friendly case packs
  - changing one skill should not require inventing a new eval format

### BrowseComp

- url:
  - <https://openai.com/index/browsecomp/>
- date:
  - 2025-06-26
- why it matters:
  - benchmark-design lessons are directly relevant for agent evaluation
- Bagakit takeaways:
  - favor tasks that are hard for the model but easy to verify
  - add contamination defenses when building stronger skill challenge sets

### Why we no longer evaluate on SWE-bench Verified

- url:
  - <https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/>
- date:
  - 2025-08-26
- why it matters:
  - sharp warning against stale or overfit public benchmarks
- Bagakit takeaways:
  - do not confuse public benchmark familiarity with true capability
  - keep some Bagakit-local challenge cases private or freshly authored
