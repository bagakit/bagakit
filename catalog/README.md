# Catalog

This directory is reserved for Bagakit repository metadata.

Current stance:

- legacy submodule-era catalogs have been removed
- new metadata should be reintroduced only when it serves future projection or
  non-authoritative reporting needs
- do not recreate catalogs that depend on external standalone repositories as a
  hidden source of truth

Typical future candidates:

- family-level metadata
- projection metadata for legacy distribution targets

Current active skill discovery and packaging do not read anything from this
directory.

Installability and package archive generation now come directly from the
directory protocol:

- `skills/<family>/<skill-id>/`
- `SKILL.md`

This directory may remain empty until Bagakit has a future non-authoritative
metadata need that does not conflict with that rule.
