# Session Source Adapters

Use this reference to decide what “all project sessions” means before writing a
chronicle.

## Boundary Rule

Completeness is always relative to a declared source boundary.

Record:

- project identity or root
- time or milestone window, if any
- definition of a session
- adapters attempted
- access and retention limits
- discovered, included, excluded, and unreadable counts

Do not infer that one adapter sees every host, account, worktree, archived
thread, deleted session, or external conversation.

## Discovery Order

Use the first available sources in this order, then continue through every
adapter named in the boundary:

1. Host-native session or thread listing
   - filter by project identity or working directory
   - include archived sessions when the user asked for project lifetime history
   - retain an opaque host ref instead of copying private transport metadata
2. Project-owned session artifacts
   - inspect declared runtime roots and runner-session directories
   - prefer manifests, result receipts, prompts, and bounded outputs over loose
     filesystem chronology
3. Explicit transcript or export bundles
   - inventory every file before reading selectively
   - record duplicates and partial exports
4. User-supplied session list
   - treat it as complete only when the user declares it authoritative for the
     chosen scope

Never search unrelated home or account storage merely because the project root
is known. Use only sources within the user's task scope and current authority.

## Registration

Register one row per discovered session:

- `session_id`
  - stable within the chronicle run; do not encode user identity
- `title`
  - short source-facing label
- `source_kind`
  - `host-session`, `transcript`, `runner-session`, `log-bundle`, or `other`
- `ref_kind`
  - `repo-file` or `host-session`
- `source_ref`
  - repo-relative file ref or opaque host ref
- `disposition`
  - `included`, `excluded`, or `unreadable`
- `disposition_reason`
  - required for excluded or unreadable sources

Deduplicate by source identity, not title similarity. When two exports represent
the same session, keep one included record and register the duplicate as
excluded with an explicit reason.

## Coverage Status

Use `complete` only when:

- the definition of a session is explicit
- every named adapter was attempted
- discovered items were all registered
- every exclusion or unreadable item has a reason
- no known inaccessible source could change the project lineage materially

Use `partial` when:

- one adapter is unavailable
- project association is ambiguous
- an export is truncated
- sessions are deleted, inaccessible, or outside retention
- time or budget limits prevented full reading

Partial coverage does not invalidate the chronicle. It narrows its claim.

## Evidence And Privacy

- Keep raw transcripts with their owning host or runtime.
- Put compressed observations in session cards.
- Use bounded locators such as turn, event, line, or receipt ids.
- Redact secrets, personal data, and irrelevant private conversation.
- Do not quote dialogue unless the source permits it and the quote is necessary.
- Do not materialize approved source slices solely to make a literary passage
  more vivid.
- For external evolution handoff, create only the minimum source-bounded,
  privacy-approved projection required by that exchange contract.
