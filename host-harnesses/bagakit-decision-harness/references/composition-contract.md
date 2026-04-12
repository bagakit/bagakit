# Composition Contract

`bagakit-decision-harness` may compose neighboring skills, but it must not make
them hidden hard dependencies.

## Optional Interfaces

| Skill | Use |
| --- | --- |
| `bagakit-spark` | deep deliberation for ambiguous decisions |
| `bagakit-brainstorm` | options and trade-offs |
| `bagakit-researcher` | source-bound evidence |
| `bagakit-living-knowledge` | reviewed stable principle promotion |
| `bagakit-skill-evolver` | Bagakit or skill behavior update candidates |
| `bagakit-feature-tracker` | downstream project planning |
| `bagakit-flow-runner` | repeated execution after a decision becomes work |

## Rule

The harness owns:

- decision loop state
- host layout
- review and pattern status
- AI update receipts

Peer skills own their native artifacts.

The harness should reference those artifacts rather than copying their internal
state.
