# Plan-Shaping Antipatterns

This catalog names plan shapes that look productive but make execution hard to
verify, parallelize, or recover.  Each entry has one observable symptom and a
corrective shape.  Apply the correction while drafting `tasks.json`; do not
turn the catalog into an unconditional checklist.

## 1. Phase-Shaped Mega-Task

- **Name:** Phase-shaped mega-Task
- **Observable symptom:** One Task spans a whole phase (for example, “finish
  the backend”), accumulates a large mixed diff, and requires re-planning before
  its first independently verifiable result can close.
- **Corrective plan shape:** Split at the four too-big signals into bounded
  implementation slices.  Give each slice one result, one intent-sized change,
  and its own narrow command gate; use explicit integration-join and
  acceptance/regression nodes for work that is genuinely cross-slice.

## 2. Regression Stuffed into the Last Implementation Task

- **Name:** Regression stuffed into the last implementation Task
- **Observable symptom:** The final implementation Task carries full-suite or
  cross-tree regression commands, so it is much slower and more likely to block
  even though those checks cover earlier slices too.
- **Corrective plan shape:** Keep an implementation slice's gate scoped to its
  owned behavior.  Add one downstream acceptance/regression node as the DAG
  sink (or an integration join when shared assembly is the actual boundary),
  with dependencies on the candidate it consumes.

## 3. Pseudo-Parallel Branches

- **Name:** Pseudo-parallel branches
- **Observable symptom:** Two Tasks have no `depends_on` path but both edit the
  same file, shared contract, or undeclared hotspot; writers collide or are
  forced to serialize during execution.
- **Corrective plan shape:** Make the shared-contract change one owning
  implementation slice, declare each Task's owned surface and hotspots, and
  add a deliberate serialization edge when the same surface truly needs two
  steps.  Only independent slices with independent gates remain parallel.

## 4. Fake Ordering Dependencies

- **Name:** Fake ordering dependencies
- **Observable symptom:** A long `depends_on` chain mirrors the author's
  writing order even though later Tasks do not consume earlier outputs, leaving
  the runnable frontier artificially narrow.
- **Corrective plan shape:** Retain only causal prerequisites in `depends_on`;
  missing edges mean graph roots.  Let the derived runnable frontier schedule
  independent implementation slices, and use an integration join only where a
  candidate must actually co-exist.

## 5. Fan-Out Without a Spine

- **Name:** Fan-out without a spine
- **Observable symptom:** The plan starts with many parallel branches and ends
  in one oversized integration Task that must discover the missing baseline and
  reconcile every branch at once.
- **Corrective plan shape:** Close the smallest end-to-end path first as a
  spine implementation slice.  Then fan out into isolated slices, converge at
  the earliest coherent integration join, and finish with an independent
  acceptance/regression sink rather than a catch-all integration Task.

## 6. Ceremony Nodes Without an Independent Oracle

- **Name:** Ceremony nodes without an independent oracle
- **Observable symptom:** A Task says “write docs”, “review”, or “verify” but
  has no executable gate of its own, or merely repeats a sibling's gate; its
  completion adds no independently falsifiable evidence.
- **Corrective plan shape:** Remove the ceremony node and place its evidence in
  the owning implementation slice.  Keep a separate acceptance/proof node only
  when it consumes an integrated candidate and can go red against a settled
  contract without reading the implementation diff.

## 7. Absent Restore Points

- **Name:** Absent restore points
- **Observable symptom:** A mid-Feature failure leaves only “discard
  everything” or “finish everything” as choices; no named, gate-verified
  candidate identifies where to return.
- **Corrective plan shape:** Put a restore-point attribute on the relevant
  integration join (or on a deliberately bounded wave boundary): require a
  named Git tag or branch and a passing gate, while keeping the SHA in Git
  rather than Tracker truth.  The surrounding Tasks stay normal
  implementation or acceptance nodes, not rollback ceremony.

## 8. Untracked Ad Hoc Worktrees

- **Name:** Untracked ad hoc worktrees
- **Observable symptom:** A Task-level temporary worktree has no Host ownership
  or cleanup path, and its result is marked done before it is integrated into
  the Feature workspace and gated there.
- **Corrective plan shape:** Keep workspace creation, attribution, and cleanup
  with the Host/Supervisor.  Treat the Feature workspace as the integration
  boundary: copy or merge the implementation slice there, run its reviewed
  gate there, and only then close the Task.

## 9. Ritual SSOT Audit Without Detector

- **Name:** Ritual SSOT Audit Without Detector
- **Observable symptom:** A plan adds a “check SSOT” or “review drift” Task that
  only asks an Agent to read files and report confidence; no executable
  detector remains to fail when links, registrations, or owning-surface sets
  diverge.
- **Corrective plan shape:** When a Feature touches an owning contract or doc
  surface, use the SSOT drift-audit proof-node variant.  Its deliverable is an
  executable set-consistency detector (for example, child files ↔ GUIDE links
  ↔ suite registrations), with one fan-out only when detector oracle kinds
  differ; otherwise keep one bounded proof node.

## 10. Oracle-less Decision Task

- **Name:** Oracle-less Decision Task
- **Observable symptom:** A node such as “decide when to integrate” has no
  settled contract, no command gate, and no independent result that can go red;
  completion records a meeting or preference rather than evidence.
- **Corrective plan shape:** Delete the decision node when it only names
  integration timing: encode timing as join placement at the earliest coherent
  candidate in the DAG, and leave runtime re-decisions to the Supervisor.  If
  a real reviewed decision remains, make it a bounded proof/acceptance node
  with a concrete oracle and executable command gate.
