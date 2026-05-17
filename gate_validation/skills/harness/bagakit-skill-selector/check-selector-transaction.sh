set -euo pipefail

ROOT="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      ROOT="$2"
      shift 2
      ;;
    *)
      echo "unexpected argument: $1" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"

python3 - "$ROOT" <<'PY'
import os
import pathlib
import re
import subprocess
import sys
import tempfile

root = pathlib.Path(sys.argv[1])
cli = root / "skills/harness/bagakit-skill-selector/scripts/skill_selector.ts"
base = ["node", "--experimental-strip-types", str(cli)]


def run(args, *, env=None, expected=0):
    result = subprocess.run(
        [*base, *args],
        cwd=root,
        env={**os.environ, **(env or {})},
        text=True,
        capture_output=True,
    )
    if result.returncode != expected:
        raise AssertionError(
            f"command returned {result.returncode}, expected {expected}: {args}\nstdout={result.stdout}\nstderr={result.stderr}"
        )
    return result


def init(file, task):
    run(["init", "--file", str(file), "--task-id", task, "--objective", "transaction proof"])
    run([
        "preflight", "--file", str(file), "--answer", "yes",
        "--decision", "direct_execute", "--status", "in_progress",
    ])


def plan_args(file, skill, operation=None):
    args = [
        "plan", "--file", str(file), "--skill-id", skill, "--kind", "local",
        "--source", f"skills/{skill}", "--why", f"select {skill}",
        "--expected-impact", f"exercise {skill}",
    ]
    if operation:
        args += ["--operation-id", operation]
    return args


def count_table(file, table):
    text = file.read_text(encoding="utf-8")
    return len(re.findall(rf"^\[\[{re.escape(table)}\]\]$", text, re.MULTILINE))


def assert_clean(file):
    residue = list(file.parent.glob(f"{file.name}.lock")) + list(file.parent.glob(f".{file.name}.tmp-*"))
    assert residue == [], residue


with tempfile.TemporaryDirectory() as temp:
    temp_root = pathlib.Path(temp)

    init_replay = temp_root / "init-replay" / "skill-usage.toml"
    init_args = [
        "init", "--file", str(init_replay), "--task-id", "init-replay",
        "--objective", "transaction proof", "--operation-id", "init-operation",
    ]
    run(init_args)
    replayed_init = run(init_args)
    assert "idempotent replay" in replayed_init.stdout
    assert count_table(init_replay, "mutation_log") == 1
    assert_clean(init_replay)

    concurrent = temp_root / "concurrent" / "skill-usage.toml"
    init(concurrent, "concurrent")
    processes = [
        subprocess.Popen(
            [*base, *plan_args(concurrent, f"skill-{index}", f"parallel-{index}")],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        for index in range(8)
    ]
    results = [process.communicate() + (process.returncode,) for process in processes]
    assert all(returncode == 0 for _, _, returncode in results), results
    assert count_table(concurrent, "skill_plan") == 8
    assert count_table(concurrent, "mutation_log") == 8
    assert_clean(concurrent)

    compatible = temp_root / "compatible" / "skill-usage.toml"
    init(compatible, "compatible")
    processes = [
        subprocess.Popen(
            [*base, *plan_args(compatible, f"legacy-{index}")],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        for index in range(8)
    ]
    results = [process.communicate() + (process.returncode,) for process in processes]
    assert all(returncode == 0 for _, _, returncode in results), results
    assert count_table(compatible, "skill_plan") == 8
    assert count_table(compatible, "mutation_log") == 0
    assert_clean(compatible)

    replay = temp_root / "replay" / "skill-usage.toml"
    init(replay, "replay")
    same_args = plan_args(replay, "same-skill", "same-operation")
    processes = [
        subprocess.Popen(
            [*base, *same_args],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        for _ in range(8)
    ]
    results = [process.communicate() + (process.returncode,) for process in processes]
    assert all(returncode == 0 for _, _, returncode in results), results
    assert count_table(replay, "skill_plan") == 1
    assert count_table(replay, "mutation_log") == 1
    conflict = run(plan_args(replay, "different-skill", "same-operation"), expected=1)
    assert "conflict[operation_id_reused]" in conflict.stderr
    assert count_table(replay, "skill_plan") == 1
    assert_clean(replay)

    crash_before = temp_root / "crash-before" / "skill-usage.toml"
    init(crash_before, "crash-before")
    crash_args = plan_args(crash_before, "crash-before", "crash-before-operation")
    run(crash_args, env={"BAGAKIT_SELECTOR_TEST_CRASH_AFTER_TEMP_WRITE": "1"}, expected=86)
    run(["skill-ranking", "--file", str(crash_before), "--json"])
    assert count_table(crash_before, "skill_plan") == 0
    run(crash_args)
    assert count_table(crash_before, "skill_plan") == 1
    assert count_table(crash_before, "mutation_log") == 1
    assert_clean(crash_before)

    crash_after = temp_root / "crash-after" / "skill-usage.toml"
    init(crash_after, "crash-after")
    landed_args = plan_args(crash_after, "crash-after", "crash-after-operation")
    run(landed_args, env={"BAGAKIT_SELECTOR_TEST_CRASH_AFTER_RENAME": "1"}, expected=87)
    assert count_table(crash_after, "skill_plan") == 1
    assert count_table(crash_after, "mutation_log") == 1
    replay_result = run(landed_args)
    assert "idempotent replay" in replay_result.stdout
    assert count_table(crash_after, "skill_plan") == 1
    assert count_table(crash_after, "mutation_log") == 1
    assert_clean(crash_after)

    receipt = temp_root / "receipt" / "skill-usage.toml"
    init(receipt, "receipt")
    run(["close", "--file", str(receipt), "--operation-id", "close-receipt"])
    receipt_text = receipt.read_text(encoding="utf-8")
    assert 'value = "receipt_only"' in receipt_text
    assert count_table(receipt, "mutation_log") == 1
    assert_clean(receipt)

print("ok: selector task mutations serialize concurrent writers and recover idempotently across atomic-replace crashes")
PY
