# Gate Decision Tree

Use this tree for every proposed test, review, preview, user check, or other
verification. The word “verification” means evidence; it does not by itself
mean a start gate, a completion gate, or a Feature gate.

```text
Does this evidence protect a confirmed user goal/invariant or prove an
accepted result?
├─ No → observation / learning
│      Keep it out of Task completion gates. Record it in an existing
│      progress, artifact, or owner receipt when it is useful.
└─ Yes → If it fails, which action must be forbidden?
         ├─ No specific action → observation / diagnostic
         │      Run it without serializing unrelated work.
         └─ A named action → Is the action this Task declaring its own result?
                  ├─ Yes → Task gate
                  │      Put only the smallest sufficient command in this
                  │      Task's `verification`; a pass closes this Task's
                  │      accepted result, not the whole Feature.
                  └─ No → Is an exact integrated candidate required?
                           ├─ No → downstream consumer check
                           │      Keep it with the first Task that consumes
                           │      that result; do not make producers wait for
                           │      unrelated evidence.
                           └─ Yes → final integration / acceptance gate
                                  Make it a sink for the candidate evidence.
                                  Only Tasks that consume that candidate wait.
```

The named action is the boundary. “The test is important”, “the check is
expensive”, “a reviewer should see it”, or “the Feature is not finished” is not
enough to create a dependency or a Task gate.

## Apply the result

- **Task gate:** `verification` contains the command and its `proves` text.
  Keep the command local to the Task's owned result. A full-suite, browser,
  performance, or release check belongs here only when this Task owns that
  proof boundary.
- **Final acceptance gate:** make a downstream acceptance or integration Task
  consume the exact candidate. It blocks final sign-off or publication, not
  independent implementation, preview, or diagnosis.
- **Non-gating evidence:** do not put it in `verification` merely because it
  is useful. Use an existing artifact, progress receipt, owner receipt, or
  provisional lane. Bind expensive checks to a candidate and state when they
  must be rerun.
- **User preview:** if a candidate gives the user independently useful value,
  deliver it at the earliest coherent join. User feedback is an observation or
  a requirement decision; it blocks only the work that actually depends on
  that decision.

## Two safety checks

1. If a check is the only reason a downstream Task waits, ask: “Does that Task
   consume the checked result, or only the implementation input?” If it only
   needs the input, remove the edge through a reviewed plan revision.
2. If development continues while a check runs, isolate the pinned candidate
   from the mutable development worktree. A non-gating check may inform later
   work, but a stale result cannot close a Task or final acceptance.

When uncertain, keep the smallest Task-local gate and leave broader evidence
as non-gating until a named action and consumer are identified. Do not make
every useful check a Feature-wide gate by default.
