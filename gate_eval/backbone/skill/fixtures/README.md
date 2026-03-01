# Skill Eval Fixtures

Fixture files describe temporary repositories that the eval runner can
materialize without touching the real `skills/` repo.

The checked-in source of truth is the JSON under this directory. No committed
fixture repo copies are kept here; the runner expands each fixture into a fresh
temporary directory for every eval run.
