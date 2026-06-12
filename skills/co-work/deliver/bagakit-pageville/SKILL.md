---
name: bagakit-pageville
description: Manage stable HTML/static page projections with immutable versions, retrieval, and human annotations. Use when a preview or tool needs a reusable page URL.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Pageville

`bagakit-pageville` is the shared page hosting and management surface for
Bagakit. Its first adapter gives page-producing skills one loopback server per
repository, while the page identity, semantic links, immutable versions, and
annotation protocol remain independent of where the host is deployed.

The public project and CLI name is `Pageville` / `pageville`; `bagakit-pageville`
is the Bagakit integration skill name.

## Ownership

The page host owns:

- page registration and semantic slug identity
- one reusable loopback server and port for the host repository
- immutable version directories and the `latest` route
- page metadata, optional data payloads, and append-only annotations
- link, list, status, version, fetch, and archive operations

Page-producing skills own:

- page content and its source-of-truth data
- when a page should be published or refreshed
- the page's domain semantics, interaction, and browser evidence

The host never edits a published page in place, infers domain status from
HTML, or turns annotations into source truth. The v0 adapter is loopback-only
and read-only at the HTTP surface; deployment location is a host policy, not
page identity.

## Runtime Surface

When materialized, the service owns `.bagakit/pageville/` in the host project.
`init` creates its `surface.toml`, registry, immutable page store, server
metadata, and log location. The runtime surface is local state and may remain
ignored by the host repository.

Do not put generated pages inside the installable skill directory. A page's
source may live anywhere the caller is allowed to read, but the host stores
only a copied version and a non-absolute source label.

## Golden Path

Run from the host project root:

```bash
export BAGAKIT_PAGEVILLE_SKILL_DIR="skills/co-work/deliver/bagakit-pageville"

sh "$BAGAKIT_PAGEVILLE_SKILL_DIR/scripts/pageville.sh" init --root .
sh "$BAGAKIT_PAGEVILLE_SKILL_DIR/scripts/pageville.sh" start --root .
sh "$BAGAKIT_PAGEVILLE_SKILL_DIR/scripts/pageville.sh" publish \
  --root . \
  --slug <semantic-page-slug> \
  --title "<human page title>" \
  --kind <design|tracker|hitl|other> \
  --source <html-file-or-directory>
```

`publish` allocates `v1`, `v2`, and so on when no version is supplied. A
published version is immutable; publish a new version for a changed page.

The service returns semantic links shaped like:

```text
http://127.0.0.1:<one-host-port>/pages/<slug>/latest/
http://127.0.0.1:<one-host-port>/pages/<slug>/v2/
```

The path shape remains stable when a remote or self-hosted adapter is added;
only the origin and host lifecycle differ. The port belongs to the host
service, not to an individual page. Starting the v0 adapter again reuses the
existing healthy process and port.

## Commands

- `init` — create or repair the project Pageville runtime surface
- `start` — start or reuse one loopback server for the project
- `stop` — stop the server after verifying its host token
- `status` — inspect server health and registered page counts
- `publish` — copy one HTML file or static directory into a new immutable page
  version
- `link` — resolve a semantic page link for `latest` or one version
- `list` — list registered pages and their latest versions
- `get` — read one page manifest and annotations
- `versions` — list all retained versions for one page
- `fetch` — return manifest, optional payload, and annotations for tooling or
  human review
- `annotate` — append a human note/label tied to one page version and optional
  anchor without changing page content
- `archive` — hide a page from the active index while retaining its versions

Use `--json` on management commands when another tool needs structured output.
Use `fetch --json` for an annotation or review tool to recover page context
without scraping rendered HTML.

## Version And Link Rules

- Slugs are stable semantic ids, not timestamps or process ids.
- Versions are caller-supplied semantic tokens or monotonic `vN` values.
- `latest` resolves through the registry and never copies or rewrites content.
- Old versions remain directly reachable until the host's retention policy
  removes them; `archive` does not delete history.
- Source paths are execution inputs only. Persist a logical source label or
  basename, never an absolute machine-local path.
- Page metadata must identify the producing kind and owner without exposing
  private host details.

## Annotations And Retrieval

Annotations are append-only records with page id, version, optional anchor,
label, note, logical author, and creation time. They are review context, not
page or domain truth.

`fetch` returns the same stable manifest/version identity used by `get` and the
annotation records used by `annotate`. A downstream tool should cite the page
slug, version, and anchor rather than depend on a transient port or HTML
position.

## Safety And Resource Rules

- The v0 adapter binds HTTP only to loopback (`127.0.0.1`); a remote adapter
  must supply its own authentication, tenancy, and exposure policy.
- Serve only registered page-version directories; reject traversal and unknown
  slugs or versions.
- Expose health, page listing, and page data through read-only endpoints.
- Require the host token for shutdown; do not kill an unverified process.
- Serialize registry and lifecycle mutations with the host lock.
- Reuse one server/port per project instead of one process per page.
- Keep annotations and metadata bounded to the selected page version; never
  scrape arbitrary local files from a browser request.

## Composition Rules

- Design and HITL skills publish generated pages here and keep their own
  content semantics.
- Feature Tracker may use this host for its HTML projection; canonical Tracker
  JSON remains the source of truth.
- Explain may publish an explanation page here; pageville management does not
  turn that page into a mastery or judgment record.
- The host service is standalone-first. A producer can still emit a static
  file when this skill is unavailable, but must report that no managed link or
  version registry exists.

## References

- `references/pageville-contract.toml` — runtime, registry, link, version, and
  annotation contract
- `references/skill-cli.toml` — CLI discovery inventory
- `references/frontdoor-rule.toml` — activation trigger
- `references/bagakit-driver.toml` — compact host receipt
- `scripts/pageville.py` — deterministic zero-dependency implementation
- `scripts/pageville.sh` — shell entrypoint

The implementation uses Python's standard library because a local static HTTP
server, atomic JSON files, and process lifecycle need no external dependency.
