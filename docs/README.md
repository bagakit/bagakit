# Docs

This directory holds repository-owned documentation for the Bagakit skills
monorepo.

Current split:

- `architecture/`
  - repository-level architecture design and system structure
- `specs/`
  - durable Bagakit semantics and shared format rules
- `stewardship/`
  - maintainer-facing stewardship guidance for this repo

Related repository surfaces:

- `dev/`
  - executable maintainer tooling
- `mem/`
  - evolving memory with future reuse value

Local working areas:

- first-level hidden directories under `docs/`
  - ignored from git tracking
  - reserved for local research capture, source preservation, and working notes

Rules:

- keep runtime-facing skill instructions inside skill payloads
- keep maintainer-only explanation outside runtime skill payloads
- keep complete architecture design under `docs/architecture/`
- keep documentation naming clean-room and Bagakit-native
- keep local research workspaces under suitable hidden first-level `docs/`
  directories instead of mixing them into stable docs
