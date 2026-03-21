# Referential Clarity And Time Anchoring

This note summarizes sources that matter most for future readability of stored
brainstorm records.

## Sources

- [OntoNotes English Co-reference Guidelines](https://catalog.ldc.upenn.edu/docs/LDC2007T21/coreference/english-coref.pdf)
- [LongtoNotes: OntoNotes with Longer Coreference Chains](https://aclanthology.org/2023.findings-eacl.105/)
- [TimeML Specification](https://timeml.github.io/site/publications/timeMLdocs/timeml_1.2.1.html)
- [RFC 3339](https://datatracker.ietf.org/doc/html/rfc3339)
- [TEI P5 `<u>` utterance](https://tei-c.org/release/doc/tei-p5-doc/en/html/ref-u.html)
- [PROV-O](https://www.w3.org/TR/prov-o/)
- [Web Annotation Data Model](https://www.w3.org/TR/annotation-model/)
- [Wikidata Help:Items](https://www.wikidata.org/wiki/Help:Items/en)
- [Wikidata Help:Label](https://www.wikidata.org/wiki/Help:Label)
- [RFC 8259](https://datatracker.ietf.org/doc/html/rfc8259)

## What These Sources Say In Practice

- Referential clarity is not just “good writing”.
  It is the difference between one note being retrievable later and becoming
  context-dependent noise.
- Longer documents increase reference-chain difficulty.
  That means brainstorm artifacts should periodically re-anchor entities and not
  assume that one distant antecedent stays recoverable.
- Time expressions need two forms:
  - original surface form such as `today` or `last week`
  - normalized anchored form such as RFC 3339 timestamp or explicit date range
- Speaker identity, recorder identity, and source attribution should be kept
  separate.
- Quotes and paraphrases should not look identical in storage.

## Concrete Rules For Brainstorm Records

- every durable entry should have stable ids:
  - `record_id`
  - `turn_id`
  - `speaker_id`
- every durable entry should keep:
  - raw text
  - memory-safe restatement
  - canonical entity references
  - time anchors
  - source references
- first durable mention should use the full entity name, not only `it`, `they`,
  `this`, or `that`
- relative time should never be stored alone
- provenance should be explicit enough that a future reader can reopen the
  original source material

## Confirmed Design Delta

The earlier brainstorm design had fidelity, but not enough future readability.
The confirmed delta is:

- raw wording remains
- normalized referential clarity is stored beside it
- timestamps and time references are anchored explicitly
- later artifacts reference the raw or normalized source rather than silently
  absorbing it
