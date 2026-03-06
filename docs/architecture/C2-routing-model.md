# Routing Model

## Purpose

This document defines how Bagakit routes learning before durable promotion.

Every promotion candidate should route through one of three outcomes:

- `host`
- `upstream`
- `split`

This routing belongs to `evolver.decision_plane`.

In this document, those short words name routing outcomes.

So:

- `host` means the host-side route
- it does not mean the repository-identity concept `host repository`

## Self-Hosting Rule

The self-hosting boundary itself is defined in:

- `docs/architecture/A2-governance-structure.md`

This routing document only adds one consequence:

- self-hosting does not bypass routing
- co-location in one repository does not turn host-local learning into
  automatic upstream truth

## `host`

`host` means the learning mainly belongs to how one host repository adopts or
operates Bagakit.

It should remain host-side unless later evidence shows repository-wide value.

## `upstream`

`upstream` means the learning exposes a reusable Bagakit capability gap or
contract gap.

It is a candidate for durable Bagakit truth.

## `split`

`split` means the lesson has both:

- one reusable upstream part
- one host-specific adoption part

This route exists because many real lessons contain both.

## `host` Route In Self-Hosting

In self-hosting scenarios, `host` still means:

- keep the learning in the host-side adoption context

It does not mean:

- treat everything inside the canonical repository as upstream Bagakit truth

## Routing Rule

The simple routing rule is:

- if the conclusion still holds after removing host-specific context, it is a
  strong upstream candidate
- if the conclusion only makes sense inside one host repository, it should stay
  host-side
- if both are true, split the promotion
