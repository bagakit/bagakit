#!/usr/bin/env python3
"""Validate harness-neutral session evidence; never invent counterfactual outcomes."""
import argparse
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path


def text(value):
    return isinstance(value, str) and bool(value.strip())


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def candidate_update(value, session, episode, record_id, index, branch_status):
    """Normalize an optional update without treating a branch as a proposal."""
    if value is None:
        return None
    if not isinstance(value, dict):
        return {"candidate_id": f"{session}/{episode}/{record_id}/{index}",
                "status": "invalid", "error": "candidate_update must be an object"}
    required = ("target", "mechanism", "falsification", "holdout_plan")
    missing = [key for key in required if not value.get(key)]
    normalized = dict(value)
    normalized.setdefault("candidate_id", f"{session}/{episode}/{record_id}/{index}")
    normalized["affected_episodes"] = list(normalized.get("affected_episodes") or [episode])
    normalized["branch_status"] = branch_status
    normalized["status"] = "ready" if not missing else "incomplete"
    if missing:
        normalized["missing"] = missing
    return normalized


def analyze(raw):
    rows, errors, warnings, candidate_updates = [], [], [], []
    keys, record_ids = set(), set()
    last_steps = {}
    for n, line in enumerate(raw.splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
            assert isinstance(row, dict), 'record must be an object'
            assert all(text(row.get(k)) for k in ('session_id', 'episode_id', 'record_id')), 'missing string identity'
            assert type(row.get('step')) is int and row['step'] >= 0, 'step must be a nonnegative integer'
            assert isinstance(row.get('action'), (str, dict)) and bool(row['action']), 'missing action'
            assert row.get('outcome') in ('success', 'failure', 'unknown'), 'invalid outcome'
            assert 'terminal' in row, 'missing terminal'
            assert type(row['terminal']) is bool, 'terminal must be boolean'
            assert 'score' not in row or finite(row['score']), 'score must be finite'
            assert isinstance(row.get('alternative_actions', []), list), 'alternatives must be a list'
            key = (row['session_id'], row['episode_id'], row['step'])
            record = (row['session_id'], row['record_id'])
            assert key not in keys and record not in record_ids, 'duplicate step or source record identity'
            previous = last_steps.get((row['session_id'], row['episode_id']))
            assert previous is None or row['step'] > previous, 'step must increase within an episode'
            keys.add(key)
            record_ids.add(record)
            last_steps[(row['session_id'], row['episode_id'])] = row['step']
            if not row.get('provenance'):
                warnings.append(f'line {n}: source provenance missing')
            if row['outcome'] != 'unknown' and not row.get('evaluator'):
                warnings.append(f'line {n}: outcome is unverified (no evaluator)')
            rows.append(row)
        except (ValueError, TypeError, AssertionError) as exc:
            errors.append(f'line {n}: {exc}')
    if not rows:
        errors.append('no valid records')
    by_record = {(r['session_id'], r['record_id']): r for r in rows}
    groups = defaultdict(list)
    for row in rows:
        groups[(row['session_id'], row['episode_id'])].append(row)
    episodes, branches = [], []
    for (session, episode), events in sorted(groups.items()):
        events.sort(key=lambda r: r['step'])
        terminal = [r for r in events if r.get('terminal')]
        if len(terminal) != 1 or terminal[0] is not events[-1]:
            errors.append(f'{session}/{episode}: terminal must be the single last event')
        end = terminal[0] if len(terminal) == 1 else {}
        episodes.append({'session_id': session, 'episode_id': episode,
                         'final_outcome': end.get('outcome', 'unknown'),
                         'score': end.get('score'), 'evaluator': end.get('evaluator'),
                         'steps': len(events),
                         'record_ids': [event['record_id'] for event in events]})
        for row in events:
            for alt in row.get('alternative_actions', []):
                if not isinstance(alt, dict) or not alt.get('action'):
                    errors.append(f"{session}/{row['record_id']}: alternative needs action and optional observed_record_id")
                    continue
                observed = by_record.get((session, alt.get('observed_record_id')))
                supported = bool(observed and row.get('state_hash') and
                                 observed.get('state_hash') == row['state_hash'] and
                                 observed['action'] == alt['action'])
                if alt.get('observed_record_id') and not supported:
                    warnings.append(f"{session}/{row['record_id']}: unverified alternative reference")
                branches.append({'session_id': session, 'episode_id': episode,
                                 'source_record_id': row['record_id'], 'alternative': alt,
                                 'status': 'observed' if supported else 'proposed',
                                 'state_hash': row.get('state_hash')})
                update = candidate_update(
                    alt.get('candidate_update'), session, episode, row['record_id'],
                    len(branches), 'observed' if supported else 'proposed')
                if update is not None:
                    candidate_updates.append(update)
            update = candidate_update(
                row.get('candidate_update'), session, episode, row['record_id'],
                len(candidate_updates) + 1, 'terminal' if row.get('terminal') else 'step')
            if update is not None:
                candidate_updates.append(update)
    digest = 'sha256:' + hashlib.sha256(raw).hexdigest()
    return {'schema': 'bagakit.session-analysis.v2', 'analysis_id': digest,
            'source_digest': digest, 'episodes': episodes, 'branch_candidates': branches,
            'candidate_updates': candidate_updates,
            'source_kinds': sorted({r['source_kind'] for r in rows if text(r.get('source_kind'))}),
            'harness_ids': sorted({r['harness_id'] for r in rows if text(r.get('harness_id'))}),
            'errors': errors, 'warnings': sorted(set(warnings)),
            'counts': {'records': len(rows), 'episodes': len(episodes), 'branches': len(branches)}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    try:
        packet = analyze(args.input.read_bytes())
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('x', encoding='utf-8') as handle:
            json.dump(packet, handle, indent=2, ensure_ascii=False, allow_nan=False)
            handle.write('\n')
        print(json.dumps({'errors': packet['errors'], 'counts': packet['counts']}))
        return 1 if packet['errors'] else 0
    except (OSError, ValueError) as exc:
        parser.exit(1, f'error: {exc}\n')


if __name__ == '__main__':
    raise SystemExit(main())
