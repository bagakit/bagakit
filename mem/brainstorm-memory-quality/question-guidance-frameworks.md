# Question Guidance Frameworks

This note collects primary-source guidance for structuring brainstorm questions
so they are:

- high-signal
- dependency-aware
- tied to downstream decisions

It is an evolving reference surface, not yet stable spec truth.

## Source Groups

Anthropic-owned primary sources:

- [Trustworthy agents in practice](https://www.anthropic.com/research/trustworthy-agents)
- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Be clear and direct](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct)
- [Use XML tags to structure your prompts](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags)
- [Long context prompting tips](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips)
- [When should I use web search, extended thinking, and Research?](https://support.claude.com/en/articles/11095361-when-should-i-use-web-search-extended-thinking-and-research)
- [Using Research on Claude](https://support.claude.com/en/articles/11088861-using-research-on-claude)
- [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [About Anthropic Interviewer](https://www.anthropic.com/about-anthropic-interviewer)
- [Introducing Anthropic Interviewer](https://www.anthropic.com/research/anthropic-interviewer)

Framework-origin or official sources:

- [Double Diamond](https://www.designcouncil.org.uk/our-resources/the-double-diamond/)
- [IDEO Human-Centered Design](https://www.designkit.org/human-centered-design.html)
- [Create Insight Statements](https://www.designkit.org/methods/create-insight-statements.html)
- [How Might We](https://www.designkit.org/methods/how-might-we.html)
- [Stanford d.school method cards](https://dschool.stanford.edu/s/METHODCARDS-v3-slim.pdf)
- [Stanford How Might We Questions](https://dschool.stanford.edu/tools/how-might-we-questions)
- [Stanford Map the Problem Space](https://dschool.stanford.edu/tools/map-the-problem-space)
- [Barbara Minto](https://www.barbaraminto.com/)
- [McKinsey seven-step problem solving](https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/how-to-master-the-seven-step-problem-solving-process)
- [Kepner-Tregoe situation appraisal](https://kepner-tregoe.com/training/intro-to-situation-appraisal/)
- [Cynefin official wiki](https://cynefin.io/index.php/Cynefin)
- [Toyota Production System](https://global.toyota/en/company/vision-and-philosophy/production-system/)

Academic primary sources:

- [Learning to Ask Good Questions: Ranking Clarification Questions using Neural Expected Value of Perfect Information](https://aclanthology.org/P18-1255/)
- [Asking Clarification Questions in Knowledge-Based Question Answering](https://aclanthology.org/D19-1172/)
- [Ask what’s missing and what’s useful](https://aclanthology.org/2021.naacl-main.340/)
- [Open-domain clarification question generation without question examples](https://aclanthology.org/2021.emnlp-main.44/)
- [Conversational Search with Mixed-Initiative](https://aclanthology.org/2022.dialdoc-1.7/)
- [FOLLOWUPQG](https://aclanthology.org/2023.ijcnlp-main.17/)
- [An Analysis of Clarification Dialogue for Question Answering](https://aclanthology.org/N03-1007/)
- [Clarifying the Path to User Satisfaction](https://openreview.net/forum?id=P5kWPIcoIT)
- [Estimating the Usefulness of Clarifying Questions and Answers for Conversational Search](https://openreview.net/forum?id=F0rWukwFz3)
- [Asking More Informative Questions for Grounded Retrieval](https://aclanthology.org/2024.findings-naacl.276/)
- [Uncertainty of Thoughts](https://arxiv.org/abs/2402.03271)

## Confirmed Synthesis

Across these source groups, the strongest stable pattern is:

1. do not ask just because something is unknown
2. ask only when the answer changes a real downstream decision
3. ask the highest-dependency questions first
4. keep each question-answer pair tied to an explicit state update

## Encodable Rules

- First gate whether the question should be asked at all:
  - if the agent can resolve it by research, do that instead of asking the user
  - if the answer will not change the plan, recommendation, or constraints, do
    not ask it
- Ask in this order:
  1. goal and success criterion
  2. hard constraints and permissions
  3. branch-splitting uncertainties
  4. tie-breaker preferences and formatting
- Distinguish:
  - `clarification`
    - blocks or rewrites the main plan
  - `exploration`
    - useful but not gating
  - `diagnosis`
    - root-cause or stall-resolution question
- Preserve one top question or point of view.
  Later questions should refine it, test it, or branch from it.
- Batch independent questions together.
  Keep dependent questions sequential.
- Reject low-value questions that are:
  - generic
  - already inferable
  - too early
  - solution-leading
  - unrelated to the current decision

## Bagakit Design Consequence

`bagakit-brainstorm` should maintain:

- one explicit questioning strategy
- one ordered question ladder
- QA bundles organized around one decision or ambiguity cluster
- one state update per answered bundle

That is the cleanest bridge between brainstorming practice and durable agent
memory.
