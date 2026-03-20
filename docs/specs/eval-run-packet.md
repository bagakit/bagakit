# Eval Run Packet

This document defines the stable packet shape for Bagakit eval runs that use
the shared maintainer harness.

It is not the place for skill-specific case truth.

## Purpose

Bagakit needs one shared packet shape so maintainers can inspect different
non-gating eval slices without relearning a new result format each time.

## Summary Packet

Each run writes:

- `summary.json`
- `cases/<case-id>.json`

`summary.json` must include:

- stable schema id
- suite identity
- owner
- run id
- generation timestamp
- output directory
- command summary
- environment snapshot
- case totals
- focus index
- case index with per-case report paths

## Case Packet

Each `cases/<case-id>.json` packet must include:

- stable schema id
- suite id
- run id
- case identity
- summary text
- focus dimensions
- pass or fail status
- assertions
- warnings
- command trace summary
- artifact refs
- optional structured outputs
- optional error message when the case fails

## Sanitization Rule

Machine-local temporary paths must not be written as durable result text.

If a case needs to expose temp-workspace evidence, it must replace the
machine-local path with a stable placeholder before writing the packet.

## Boundary Rule

This packet spec defines the shared result shape only.

It does not define:

- skill-specific fixtures
- skill-specific score meaning
- release-blocking gate policy
- validator discovery semantics
