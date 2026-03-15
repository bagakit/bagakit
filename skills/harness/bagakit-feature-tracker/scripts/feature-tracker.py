"""Core implementation for bagakit-feature-tracker."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tarfile
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

sys.dont_write_bytecode = True

FEATURE_ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"
FEATURE_ID_BASE = len(FEATURE_ID_ALPHABET)
FEATURE_ID_SCHEME = "feature-tracker-id-v1-c3n2g4"
FEAT_CURSOR_WIDTH = 3
FEAT_NAMESPACE_WIDTH = 2
FEAT_GUARD_WIDTH = 4
LOCAL_GUARD_KEY_WIDTH = 12
LOCAL_ISSUER_VERSION = 1
LOCAL_ISSUER_FILENAME = "issuer.json"
LOCAL_GUARD_KEY_CONFIG = "bagakit.feature-tracker.guard-key"
CURRENT_FEAT_ID_RE = re.compile(r"^f-[23456789abcdefghjkmnpqrstuvwxyz]{9}$")
TRANSITIONAL_FEAT_ID_RE = re.compile(r"^f-[0-9a-z]{7}$")
LEGACY_FEAT_ID_RE = re.compile(r"^f-\d{8}-[a-z0-9][a-z0-9-]*$")
TASK_ID_RE = re.compile(r"^T-\d{3}$")
FEAT_STATUS = {"proposal", "ready", "in_progress", "blocked", "done", "archived", "discarded"}
TASK_STATUS = {"todo", "in_progress", "done", "blocked"}
GATE_STATUS = {"pass", "fail"}
WORKSPACE_MODES = {"worktree", "current_tree", "proposal_only"}
CLOSED_FEAT_STATUS = {"archived", "discarded"}
UNRESOLVED_ENV_RE = re.compile(r"\$\{?[A-Za-z_][A-Za-z0-9_]*")
REFERENCE_SKILLS_ENV = "BAGAKIT_REFERENCE_SKILLS_HOME"
RUNTIME_POLICY_FILENAME = "runtime-policy.json"
LEGACY_CONFIG_FILENAME = "config.json"
FEATURES_DAG_FILENAME = "FEATURES_DAG.json"
FEATURE_PROPOSAL_FILENAME = "proposal.md"
FEATURE_SPEC_DELTA_FILENAME = "spec-delta.md"
FEATURE_VERIFICATION_FILENAME = "verification.md"


def sha256_bytes(data: bytes) -> str:
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    tmp.replace(path)


def read_text(path: Path) -> str:
    with path.open("r", encoding="utf-8") as f:
        return f.read()


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def eprint(msg: str) -> None:
    print(msg, file=sys.stderr)


def is_public_token(raw: str, *, width: int) -> bool:
    return len(raw) == width and all(ch in FEATURE_ID_ALPHABET for ch in raw)


def encode_public_token(value: int, *, width: int) -> str:
    if value < 0:
        raise SystemExit("error: public token encoding requires non-negative integers")
    if value == 0:
        encoded = FEATURE_ID_ALPHABET[0]
    else:
        chars: list[str] = []
        current = value
        while current:
            current, remainder = divmod(current, FEATURE_ID_BASE)
            chars.append(FEATURE_ID_ALPHABET[remainder])
        encoded = "".join(reversed(chars))
    if len(encoded) > width:
        raise SystemExit(f"error: {FEATURE_ID_SCHEME} exhausted for width {width}")
    return encoded.rjust(width, FEATURE_ID_ALPHABET[0])


def public_token_int(raw: str) -> int:
    value = 0
    for ch in raw:
        value = value * FEATURE_ID_BASE + FEATURE_ID_ALPHABET.index(ch)
    return value


def short_hash_token(text: str, *, width: int) -> str:
    digest = hashlib.blake2s(text.encode("utf-8"), digest_size=8).digest()
    return encode_public_token(int.from_bytes(digest, "big") % (FEATURE_ID_BASE ** width), width=width)


def random_token(*, width: int = 8) -> str:
    return short_hash_token(os.urandom(16).hex(), width=width)


def is_valid_feat_id(feat_id: str) -> bool:
    return bool(CURRENT_FEAT_ID_RE.match(feat_id) or TRANSITIONAL_FEAT_ID_RE.match(feat_id) or LEGACY_FEAT_ID_RE.match(feat_id))


def parse_current_feat_cursor(feat_id: str) -> int | None:
    if not CURRENT_FEAT_ID_RE.match(feat_id):
        return None
    payload = feat_id.removeprefix("f-")
    return public_token_int(payload[:FEAT_CURSOR_WIDTH])


def parse_current_feat_namespace(feat_id: str) -> str | None:
    if not CURRENT_FEAT_ID_RE.match(feat_id):
        return None
    payload = feat_id.removeprefix("f-")
    start = FEAT_CURSOR_WIDTH
    end = start + FEAT_NAMESPACE_WIDTH
    return payload[start:end]


def parse_transitional_feat_sequence(feat_id: str) -> int | None:
    if not TRANSITIONAL_FEAT_ID_RE.match(feat_id):
        return None
    payload = feat_id.removeprefix("f-")
    try:
        return int(payload[:4], 36)
    except ValueError:
        return None


def feat_sort_key(feat_id: str) -> tuple[int, int, str]:
    if LEGACY_FEAT_ID_RE.match(feat_id):
        return (0, -1, feat_id)
    seq = parse_transitional_feat_sequence(feat_id)
    if seq is not None:
        return (1, seq, feat_id)
    seq = parse_current_feat_cursor(feat_id)
    if seq is not None:
        return (2, seq, feat_id)
    return (3, -1, feat_id)


def history_event(action: str, detail: str) -> dict[str, str]:
    return {"action": action, "detail": detail}


def next_numbered_path(directory: Path, *, prefix: str, suffix: str) -> Path:
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+){re.escape(suffix)}$")
    next_number = 1
    if directory.exists():
        for entry in directory.iterdir():
            match = pattern.match(entry.name)
            if not match:
                continue
            next_number = max(next_number, int(match.group(1)) + 1)
    return directory / f"{prefix}{next_number:04d}{suffix}"


def run_cmd(cmd: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        text=True,
        capture_output=True,
        check=False,
    )


def run_shell(command: str, *, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=str(cwd),
        text=True,
        capture_output=True,
        shell=True,
        check=False,
    )


def ensure_git_repo(root: Path) -> None:
    cp = run_cmd(["git", "-C", str(root), "rev-parse", "--is-inside-work-tree"])
    if cp.returncode != 0 or cp.stdout.strip() != "true":
        raise SystemExit(f"error: not a git repository: {root}")


def command_exists(name: str) -> bool:
    cp = run_cmd(["bash", "-lc", f"command -v {shlex.quote(name)} >/dev/null 2>&1"])
    return cp.returncode == 0


def current_branch(root: Path) -> str:
    cp = run_cmd(["git", "-C", str(root), "rev-parse", "--abbrev-ref", "HEAD"])
    if cp.returncode != 0:
        return ""
    branch = cp.stdout.strip()
    return "" if branch == "HEAD" else branch


def path_from_porcelain_line(line: str) -> str:
    raw = line[3:] if len(line) > 3 else line
    if " -> " in raw:
        raw = raw.split(" -> ", 1)[1]
    return raw.strip().strip('"')


def is_harness_generated_gitignore(root: Path, rel_path: str) -> bool:
    if rel_path != ".gitignore":
        return False
    target = root / rel_path
    if not target.exists():
        return False
    lines = [line.strip() for line in target.read_text(encoding="utf-8").splitlines() if line.strip()]
    return lines == [".worktrees"]


def non_harness_git_status_lines(root: Path) -> list[str]:
    cp = run_cmd(["git", "-C", str(root), "status", "--porcelain"])
    if cp.returncode != 0:
        raise SystemExit(cp.stderr.strip() or cp.stdout.strip() or "git status failed")

    ignored_prefixes = (".bagakit/", ".worktrees/")
    out: list[str] = []
    for raw in cp.stdout.splitlines():
        line = raw.rstrip()
        if not line:
            continue
        path = path_from_porcelain_line(line)
        if path.startswith(ignored_prefixes):
            continue
        if is_harness_generated_gitignore(root, path):
            continue
        out.append(line)
    return out


def recommend_workspace_mode(root: Path) -> tuple[str, str]:
    changes = non_harness_git_status_lines(root)
    if changes:
        return (
            "worktree",
            "repository has non-harness changes; isolated worktree is safer",
        )
    return (
        "current_tree",
        "repository is clean aside from harness metadata; current_tree is lighter than a dedicated worktree",
    )


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    if not value:
        raise SystemExit("error: slug became empty after normalization")
    return value


@dataclass
class HarnessPaths:
    root: Path

    @property
    def harness_dir(self) -> Path:
        return self.root / ".bagakit" / "feature-tracker"

    @property
    def feats_dir(self) -> Path:
        return self.harness_dir / "features"

    @property
    def feats_archived_dir(self) -> Path:
        return self.harness_dir / "features-archived"

    @property
    def feats_discarded_dir(self) -> Path:
        return self.harness_dir / "features-discarded"

    @property
    def index_dir(self) -> Path:
        return self.harness_dir / "index"

    @property
    def artifacts_dir(self) -> Path:
        return self.harness_dir / "artifacts"

    @property
    def local_dir(self) -> Path:
        return self.harness_dir / "local"

    @property
    def index_file(self) -> Path:
        return self.index_dir / "features.json"

    @property
    def runtime_policy_file(self) -> Path:
        return self.harness_dir / RUNTIME_POLICY_FILENAME

    @property
    def legacy_config_file(self) -> Path:
        return self.harness_dir / LEGACY_CONFIG_FILENAME

    @property
    def dag_file(self) -> Path:
        return self.index_dir / FEATURES_DAG_FILENAME

    @property
    def dag_archive_dir(self) -> Path:
        return self.index_dir / "archive"

    @property
    def ref_report_json(self) -> Path:
        return self.artifacts_dir / "ref-read-report.json"

    @property
    def ref_report_md(self) -> Path:
        return self.artifacts_dir / "ref-read-report.md"

    @property
    def issuer_file(self) -> Path:
        return self.local_dir / LOCAL_ISSUER_FILENAME

    def feat_dir(self, feat_id: str, *, status: str | None = None) -> Path:
        if status == "archived":
            base = self.feats_archived_dir
        elif status == "discarded":
            base = self.feats_discarded_dir
        else:
            base = self.feats_dir
        return base / feat_id

    def feat_state(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / "state.json"

    def feat_tasks(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / "tasks.json"

    def feat_summary(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / "summary.md"

    def feat_proposal(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / FEATURE_PROPOSAL_FILENAME

    def feat_spec_delta(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / FEATURE_SPEC_DELTA_FILENAME

    def feat_verification(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / FEATURE_VERIFICATION_FILENAME

    def feat_artifacts_dir(self, feat_id: str, *, status: str | None = None) -> Path:
        return self.feat_dir(feat_id, status=status) / "artifacts"


def infer_next_feat_sequence(index_data: dict[str, Any]) -> int:
    max_seen = -1
    for item in index_data.get("features", []):
        feat_id = str(item.get("feat_id") or "")
        seq = parse_current_feat_cursor(feat_id)
        if seq is None:
            seq = parse_transitional_feat_sequence(feat_id)
        if seq is not None:
            max_seen = max(max_seen, seq)
    return max_seen + 1


def ensure_feature_id_issuance(index_data: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    changed = False
    legacy_allocator = index_data.pop("id_allocator", None)
    issuance = index_data.get("feature_id_issuance")
    if not isinstance(issuance, dict):
        issuance = {}
        index_data["feature_id_issuance"] = issuance
        changed = True

    scheme = str(issuance.get("scheme") or "")
    if scheme != FEATURE_ID_SCHEME:
        issuance["scheme"] = FEATURE_ID_SCHEME
        changed = True

    inferred_next = infer_next_feat_sequence(index_data)
    raw_next = issuance.get("next_cursor")
    legacy_next = legacy_allocator.get("next") if isinstance(legacy_allocator, dict) else None
    baseline_next = max(
        inferred_next,
        int(legacy_next) if isinstance(legacy_next, int) else 0,
        int(raw_next) if isinstance(raw_next, int) else 0,
    )
    if issuance.get("next_cursor") != baseline_next:
        issuance["next_cursor"] = baseline_next
        changed = True

    return issuance, changed


def normalize_index_data(index_data: dict[str, Any]) -> None:
    if not isinstance(index_data.get("features"), list):
        index_data["features"] = []
    index_data.pop("updated_at", None)
    ensure_feature_id_issuance(index_data)


def normalize_history(items: Any) -> list[dict[str, str]]:
    if not isinstance(items, list):
        return []
    out: list[dict[str, str]] = []
    for raw in items:
        if isinstance(raw, dict):
            action = str(raw.get("action") or "").strip()
            detail = str(raw.get("detail") or "").strip()
            if action:
                out.append(history_event(action, detail))
        elif raw is not None:
            text = str(raw).strip()
            if text:
                out.append(history_event("note", text))
    return out


def normalize_state_payload(state: dict[str, Any]) -> None:
    for key in ("created_at", "updated_at", "archived_at", "discarded_at"):
        state.pop(key, None)
    gate = state.get("gate")
    if isinstance(gate, dict):
        gate.pop("last_checked_at", None)
    history = normalize_history(state.get("history"))
    if history:
        state["history"] = history
    else:
        state.pop("history", None)


def normalize_tasks_payload(tasks: dict[str, Any]) -> None:
    tasks.pop("updated_at", None)
    if not isinstance(tasks.get("tasks"), list):
        return
    for item in tasks["tasks"]:
        if not isinstance(item, dict):
            continue
        for key in ("last_gate_at", "started_at", "finished_at", "updated_at"):
            item.pop(key, None)


def load_local_issuer(paths: HarnessPaths) -> dict[str, Any] | None:
    if not paths.issuer_file.exists():
        return None
    payload = load_json(paths.issuer_file)
    if not isinstance(payload, dict):
        raise SystemExit(f"error: invalid local issuer schema: {paths.issuer_file}")
    return payload


def normalize_local_issuer_payload(payload: dict[str, Any], *, namespace: str) -> dict[str, Any]:
    return {
        "version": LOCAL_ISSUER_VERSION,
        "scheme": FEATURE_ID_SCHEME,
        "namespace": namespace,
        "guard_key_source": f"git-config:{LOCAL_GUARD_KEY_CONFIG}",
    }


def tracked_paths_under(root: Path, rel_path: Path) -> list[str]:
    cp = run_cmd(["git", "-C", str(root), "ls-files", "--", rel_path.as_posix()])
    if cp.returncode != 0:
        return []
    return [line.strip() for line in cp.stdout.splitlines() if line.strip()]


def git_local_config_get(root: Path, key: str) -> str:
    cp = run_cmd(["git", "-C", str(root), "config", "--local", "--get", key])
    if cp.returncode != 0:
        return ""
    return cp.stdout.strip()


def git_local_config_set(root: Path, key: str, value: str) -> None:
    cp = run_cmd(["git", "-C", str(root), "config", "--local", key, value])
    if cp.returncode != 0:
        raise SystemExit(cp.stderr.strip() or cp.stdout.strip() or f"error: failed to set git config {key}")


def used_current_namespaces(paths: HarnessPaths) -> set[str]:
    namespaces: set[str] = set()
    if not paths.index_file.exists():
        return namespaces
    for item in load_index(paths).get("features", []):
        namespace = parse_current_feat_namespace(str(item.get("feat_id") or ""))
        if namespace:
            namespaces.add(namespace)
    return namespaces


def choose_local_namespace(paths: HarnessPaths, *, exclude: set[str] | None = None) -> str:
    blocked = used_current_namespaces(paths) | (exclude or set())
    for _ in range(FEATURE_ID_BASE ** FEAT_NAMESPACE_WIDTH):
        namespace = random_token(width=FEAT_NAMESPACE_WIDTH)
        if namespace not in blocked:
            return namespace
    raise SystemExit("error: no free local issuer namespace available for the current tracker scheme")


def ensure_local_issuer_state(root: Path, paths: HarnessPaths, *, force_rotate: bool = False) -> dict[str, Any]:
    existing = load_local_issuer(paths)
    current_namespace = str(existing.get("namespace") or "").strip() if isinstance(existing, dict) else ""

    namespace = current_namespace
    should_rewrite_issuer = force_rotate or not is_public_token(namespace, width=FEAT_NAMESPACE_WIDTH)
    if should_rewrite_issuer:
        namespace = choose_local_namespace(
            paths,
            exclude={current_namespace} if current_namespace else set(),
        )
    payload = normalize_local_issuer_payload(existing or {}, namespace=namespace)
    if existing != payload:
        save_json(paths.issuer_file, payload)
        print(f"write: {paths.issuer_file}")

    guard_key = git_local_config_get(root, LOCAL_GUARD_KEY_CONFIG)
    if force_rotate or not is_public_token(guard_key, width=LOCAL_GUARD_KEY_WIDTH):
        guard_key = random_token(width=LOCAL_GUARD_KEY_WIDTH)
        git_local_config_set(root, LOCAL_GUARD_KEY_CONFIG, guard_key)
        print(f"write: git-config {LOCAL_GUARD_KEY_CONFIG}")

    payload = load_local_issuer(paths)
    if payload is None:
        raise SystemExit(f"error: missing local issuer after initialization: {paths.issuer_file}")
    return payload


def build_guard_token(root: Path, namespace: str, cursor_token: str) -> str:
    guard_key = git_local_config_get(root, LOCAL_GUARD_KEY_CONFIG)
    if not is_public_token(guard_key, width=LOCAL_GUARD_KEY_WIDTH):
        raise SystemExit(
            "error: missing git-local guard key; run feature-tracker.sh initialize-tracker "
            "or feature-tracker.sh rekey-local-issuer"
        )
    return short_hash_token(
        f"{FEATURE_ID_SCHEME}:{guard_key}:{cursor_token}:{namespace}",
        width=FEAT_GUARD_WIDTH,
    )


def load_index(paths: HarnessPaths) -> dict[str, Any]:
    if not paths.index_file.exists():
        raise SystemExit(f"error: missing harness index: {paths.index_file}")
    data = load_json(paths.index_file)
    if not isinstance(data, dict) or "features" not in data:
        raise SystemExit(f"error: invalid index schema: {paths.index_file}")
    normalize_index_data(data)
    return data


def save_index(paths: HarnessPaths, index_data: dict[str, Any]) -> None:
    normalize_index_data(index_data)
    save_json(paths.index_file, index_data)


def load_runtime_policy(paths: HarnessPaths) -> dict[str, Any]:
    target = paths.runtime_policy_file
    if not target.exists():
        if paths.legacy_config_file.exists():
            raise SystemExit(
                "error: detected legacy policy file "
                f"{paths.legacy_config_file}. "
                "legacy compatibility is disabled; migrate manually by comparing current SKILL.md "
                "and creating runtime-policy.json."
            )
        raise SystemExit(
            f"error: missing runtime policy file: {paths.runtime_policy_file}. "
            "run feature-tracker.sh initialize-tracker to scaffold the latest layout."
        )
    payload = load_json(target)
    if not isinstance(payload, dict):
        raise SystemExit(f"error: invalid runtime policy schema: {target}")
    return payload


def ensure_runtime_policy(paths: HarnessPaths, skill_dir: Path) -> Path:
    if paths.runtime_policy_file.exists():
        return paths.runtime_policy_file
    if paths.legacy_config_file.exists():
        raise SystemExit(
            "error: detected legacy policy file "
            f"{paths.legacy_config_file}. "
            "automatic compatibility migration is disabled; migrate manually to runtime-policy.json."
        )

    copy_template_if_missing(skill_dir, "tpl/runtime-policy-template.json", paths.runtime_policy_file)
    return paths.runtime_policy_file


def resolve_workspace_mode(policy: dict[str, Any], requested: str | None) -> str:
    workspace_cfg = policy.get("workspace", {}) if isinstance(policy, dict) else {}
    raw = str(requested or workspace_cfg.get("default_mode", "proposal_only")).strip().lower()
    if raw not in WORKSPACE_MODES:
        raise SystemExit(
            "error: invalid workspace mode: "
            f"{raw}. expected one of {', '.join(sorted(WORKSPACE_MODES))}"
        )
    return raw


def resolve_branch_prefix(policy: dict[str, Any], requested: str | None) -> str:
    git_cfg = policy.get("git", {}) if isinstance(policy, dict) else {}
    raw = str(requested if requested is not None else git_cfg.get("branch_prefix", "feat/")).strip()
    if not raw:
        raise SystemExit("error: branch prefix must not be empty")
    return raw


def workspace_mode_of(state: dict[str, Any]) -> str:
    raw = str(state.get("workspace_mode") or "").strip().lower()
    if raw not in WORKSPACE_MODES:
        raise SystemExit(
            "error: invalid or missing workspace_mode in feat state: "
            f"{state.get('feat_id', '<unknown>')}"
        )
    return raw


def make_worktree_assignment(
    root: Path,
    *,
    feat_id: str,
    branch_prefix: str,
) -> tuple[str, str, str, Path, str]:
    branch = f"{branch_prefix}{feat_id}"
    wt_name = f"wt-{feat_id}"
    wt_rel = str(Path(".worktrees") / wt_name)
    wt_abs = root / wt_rel
    base_ref = pick_base_branch(root)

    ensure_worktrees_ignored(root)
    (root / ".worktrees").mkdir(parents=True, exist_ok=True)

    cp = run_cmd(
        [
            "git",
            "-C",
            str(root),
            "worktree",
            "add",
            str(wt_abs),
            "-b",
            branch,
            base_ref,
        ]
    )
    if cp.returncode != 0:
        err = cp.stderr.strip() or cp.stdout.strip() or "failed to create worktree"
        raise SystemExit(f"error: {err}")

    return branch, wt_name, wt_rel, wt_abs, base_ref


def get_feat_index_entry(index_data: dict[str, Any], feat_id: str) -> dict[str, Any] | None:
    for item in index_data.get("features", []):
        if item.get("feat_id") == feat_id:
            return item
    return None


def upsert_feat_index(paths: HarnessPaths, state: dict[str, Any]) -> None:
    index_data = load_index(paths)
    entries = index_data.setdefault("features", [])
    payload = {
        "feat_id": state["feat_id"],
        "title": state.get("title", ""),
        "status": state.get("status", "proposal"),
        "workspace_mode": state.get("workspace_mode", ""),
        "branch": state.get("branch", ""),
        "worktree_name": state.get("worktree_name", ""),
    }
    for i, item in enumerate(entries):
        if item.get("feat_id") == payload["feat_id"]:
            entries[i] = payload
            save_index(paths, index_data)
            return
    entries.append(payload)
    entries.sort(key=lambda x: feat_sort_key(str(x.get("feat_id", ""))))
    save_index(paths, index_data)


def feat_index_status(paths: HarnessPaths, feat_id: str) -> str:
    index_data = load_index(paths)
    entry = get_feat_index_entry(index_data, feat_id)
    if entry is None:
        raise SystemExit(f"error: feat not indexed: {feat_id}")
    return str(entry.get("status") or "proposal")


def load_feat(paths: HarnessPaths, feat_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    status = feat_index_status(paths, feat_id)
    state_file = paths.feat_state(feat_id, status=status)
    tasks_file = paths.feat_tasks(feat_id, status=status)
    if not state_file.exists():
        raise SystemExit(f"error: missing feat state file: {state_file}")
    if not tasks_file.exists():
        raise SystemExit(f"error: missing feat tasks file: {tasks_file}")
    state = load_json(state_file)
    tasks = load_json(tasks_file)
    return state, tasks


def materialize_feature_artifact(
    paths: HarnessPaths,
    skill_dir: Path,
    feat_id: str,
    *,
    kind: str,
    overwrite: bool,
) -> Path:
    state, _ = load_feat(paths, feat_id)
    status = str(state.get("status") or "")
    if kind == "proposal":
        target = paths.feat_proposal(feat_id, status=status)
        template = (
            load_template(skill_dir, "tpl/feature-proposal-template.md")
            .replace("<feat-id>", feat_id)
            .replace("<feature-id>", feat_id)
            .replace("<goal>", str(state.get("goal") or ""))
        )
    elif kind == "spec-delta":
        target = paths.feat_spec_delta(feat_id, status=status)
        template = load_template(skill_dir, "tpl/feature-spec-delta-template.md").replace("<capability>", "core")
    elif kind == "verification":
        target = paths.feat_verification(feat_id, status=status)
        template = load_template(skill_dir, "tpl/verification-template.md")
    else:
        raise SystemExit(f"error: unsupported artifact kind: {kind}")

    if target.exists() and not overwrite:
        raise SystemExit(f"error: artifact already exists: {target}")

    write_text(target, template)
    return target


def save_feat(paths: HarnessPaths, feat_id: str, state: dict[str, Any], tasks: dict[str, Any]) -> None:
    normalize_state_payload(state)
    normalize_tasks_payload(tasks)
    status = str(state.get("status") or "")
    save_json(paths.feat_state(feat_id, status=status), state)
    save_json(paths.feat_tasks(feat_id, status=status), tasks)
    upsert_feat_index(paths, state)


def find_task(tasks: dict[str, Any], task_id: str) -> dict[str, Any]:
    for item in tasks.get("tasks", []):
        if item.get("id") == task_id:
            return item
    raise SystemExit(f"error: task not found: {task_id}")


def count_tasks(tasks: dict[str, Any], status: str) -> int:
    return sum(1 for t in tasks.get("tasks", []) if t.get("status") == status)


def ensure_harness_exists(paths: HarnessPaths) -> None:
    if not paths.harness_dir.exists():
        raise SystemExit(
            "error: tracker not initialized. run feature-tracker.sh initialize-tracker first"
        )


def ensure_harness_gitignore(paths: HarnessPaths) -> None:
    target = paths.harness_dir / ".gitignore"
    content = target.read_text(encoding="utf-8") if target.exists() else ""
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    changed = False
    for rule in ("artifacts/*.log", "local/"):
        if rule not in lines:
            lines.append(rule)
            changed = True
    if not changed:
        return
    write_text(target, "\n".join(lines) + "\n")
    print(f"write: {target}")


def ensure_worktrees_ignored(root: Path) -> None:
    gitignore = root / ".gitignore"
    content = gitignore.read_text(encoding="utf-8") if gitignore.exists() else ""
    lines = [line.strip() for line in content.splitlines()]
    if ".worktrees" not in lines:
        with gitignore.open("a", encoding="utf-8") as f:
            if content and not content.endswith("\n"):
                f.write("\n")
            f.write(".worktrees\n")
        print(f"write: {gitignore} (+.worktrees)")


def load_template(skill_dir: Path, rel: str) -> str:
    path = skill_dir / "references" / rel
    if not path.exists():
        raise SystemExit(f"error: missing template: {path}")
    return read_text(path)


def copy_template_if_missing(skill_dir: Path, rel: str, dest: Path) -> None:
    if dest.exists():
        return
    write_text(dest, load_template(skill_dir, rel))
    print(f"write: {dest}")


def manifest_path(skill_dir: Path, path_override: str | None) -> Path:
    if path_override:
        return Path(path_override)
    return skill_dir / "references" / "required-reading-manifest.json"


def resolve_manifest_location(raw: str, *, manifest_dir: Path) -> tuple[Path | None, str | None]:
    expanded = os.path.expanduser(os.path.expandvars(raw))
    if UNRESOLVED_ENV_RE.search(expanded):
        return None, "unresolved environment variable in location"
    path = Path(expanded)
    if not path.is_absolute():
        path = (manifest_dir / path).resolve()
    return path, None


def portable_path_for_report(
    path: Path,
    *,
    root: Path,
    skill_dir: Path,
    manifest_dir: Path,
    reference_skills_home: Path | None,
) -> str:
    resolved = path.resolve()
    bases: list[tuple[str, Path]] = [
        ("<project-root>", root),
        ("<skill-dir>", skill_dir),
        ("<manifest-dir>", manifest_dir),
    ]
    if reference_skills_home is not None:
        bases.append((f"${REFERENCE_SKILLS_ENV}", reference_skills_home))
    bases.append(("$HOME", Path.home()))

    for prefix, base in bases:
        try:
            rel = resolved.relative_to(base.resolve())
        except ValueError:
            continue
        rel_text = rel.as_posix()
        if rel_text in {"", "."}:
            return prefix
        return f"{prefix}/{rel_text}"
    return "<absolute-path-redacted>"


def report_location_label(
    raw: str,
    *,
    root: Path,
    skill_dir: Path,
    manifest_dir: Path,
    reference_skills_home: Path | None,
) -> str:
    expanded = os.path.expanduser(os.path.expandvars(raw))
    if UNRESOLVED_ENV_RE.search(expanded):
        return raw
    path = Path(expanded)
    if path.is_absolute():
        return portable_path_for_report(
            path,
            root=root,
            skill_dir=skill_dir,
            manifest_dir=manifest_dir,
            reference_skills_home=reference_skills_home,
        )
    return path.as_posix()


def default_reference_skills_home() -> Path | None:
    env_raw = os.environ.get(REFERENCE_SKILLS_ENV, "").strip()
    if env_raw:
        return Path(os.path.expanduser(os.path.expandvars(env_raw)))
    return None


def ensure_reference_skills_home() -> Path | None:
    return default_reference_skills_home()


def compute_manifest_hash(path: Path) -> str:
    return sha256_file(path)


def cmd_ref_read_gate(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    skill_dir = Path(args.skill_dir).resolve()
    mpath = manifest_path(skill_dir, args.manifest)
    manifest_dir = mpath.parent.resolve()
    detected_ref_home = ensure_reference_skills_home()
    manifest_path_label = portable_path_for_report(
        mpath,
        root=root,
        skill_dir=skill_dir,
        manifest_dir=manifest_dir,
        reference_skills_home=detected_ref_home,
    )

    if not mpath.exists():
        eprint(f"error: manifest not found: {mpath}")
        return 1

    manifest_data = load_json(mpath)
    entries = manifest_data.get("entries", [])
    if not isinstance(entries, list):
        eprint("error: manifest 'entries' must be list")
        return 1

    result_entries: list[dict[str, Any]] = []
    ok = True
    needs_reference_skills_home = False

    for entry in entries:
        entry_id = str(entry.get("id", ""))
        entry_type = str(entry.get("type", ""))
        location = str(entry.get("location", ""))
        if REFERENCE_SKILLS_ENV in location:
            needs_reference_skills_home = True
        location_label = report_location_label(
            location,
            root=root,
            skill_dir=skill_dir,
            manifest_dir=manifest_dir,
            reference_skills_home=detected_ref_home,
        )
        resolved_location = location_label
        required = bool(entry.get("required", True))
        exists = False
        digest = ""
        error = ""

        if not entry_id or entry_type not in {"file", "url"} or not location:
            ok = False
            error = "invalid manifest entry"
        elif entry_type == "file":
            resolved_path, resolve_error = resolve_manifest_location(location, manifest_dir=manifest_dir)
            if resolve_error:
                exists = False
                error = resolve_error
            else:
                resolved_location = portable_path_for_report(
                    resolved_path,
                    root=root,
                    skill_dir=skill_dir,
                    manifest_dir=manifest_dir,
                    reference_skills_home=detected_ref_home,
                )
                if resolved_path.exists() and resolved_path.is_file():
                    exists = True
                    digest = sha256_file(resolved_path)
                else:
                    exists = False
                    error = "file not found"
        elif entry_type == "url":
            try:
                with urllib.request.urlopen(location, timeout=20) as r:
                    data = r.read()
                exists = True
                digest = sha256_bytes(data)
            except (urllib.error.URLError, TimeoutError) as exc:
                exists = False
                error = f"url fetch failed: {exc}"

        if required and not exists:
            ok = False

        result_entries.append(
            {
                "id": entry_id,
                "type": entry_type,
                "location": location_label,
                "resolved_location": resolved_location,
                "required": required,
                "exists": exists,
                "sha256": digest,
                "error": error,
            }
        )

    status = "VALID" if ok else "INVALID"
    mhash = compute_manifest_hash(mpath)

    payload = {
        "status": status,
        "project_root": "<project-root>",
        "manifest_path": manifest_path_label,
        "manifest_sha256": mhash,
        "entries": result_entries,
    }

    paths.artifacts_dir.mkdir(parents=True, exist_ok=True)
    save_json(paths.ref_report_json, payload)

    lines = [
        "# Reference Read Report",
        "",
        f"Status: {status}",
        "Project Root: <project-root>",
        f"Manifest Path: {manifest_path_label}",
        f"Manifest SHA256: {mhash}",
        "",
        "## Entries",
        "",
        "| ID | Type | Required | Exists | SHA256 | Error |",
        "|---|---|---|---|---|---|",
    ]
    for item in result_entries:
        lines.append(
            "| {id} | {type} | {required} | {exists} | {sha256} | {error} |".format(
                id=item["id"],
                type=item["type"],
                required="yes" if item["required"] else "no",
                exists="yes" if item["exists"] else "no",
                sha256=item["sha256"] or "-",
                error=(item["error"] or "-").replace("|", "/"),
            )
        )

    lines += ["", "## Reading Notes", ""]
    for item in result_entries:
        lines += [
            f"### {item['id']}",
            "- Summary:",
            "- Key takeaways:",
            "",
        ]

    write_text(paths.ref_report_md, "\n".join(lines))

    print(f"write: {paths.ref_report_json}")
    print(f"write: {paths.ref_report_md}")
    if detected_ref_home is not None:
        detected_ref_home_label = portable_path_for_report(
            detected_ref_home,
            root=root,
            skill_dir=skill_dir,
            manifest_dir=manifest_dir,
            reference_skills_home=detected_ref_home,
        )
        print(f"info: {REFERENCE_SKILLS_ENV}={detected_ref_home_label}")
    elif needs_reference_skills_home:
        eprint(
            "warn: BAGAKIT_REFERENCE_SKILLS_HOME is required for manifests that reference external skills; "
            "set it explicitly to the skills root before running this command"
        )
    if not ok:
        eprint("error: reference read gate failed (missing required entries)")
        return 1
    print("ok: reference read report generated")
    return 0


def check_ref_report(paths: HarnessPaths, skill_dir: Path, manifest_override: str | None = None) -> list[str]:
    ensure_reference_skills_home()
    issues: list[str] = []
    mpath = manifest_path(skill_dir, manifest_override)
    if not mpath.exists():
        issues.append(f"manifest missing: {mpath}")
        return issues

    if not paths.ref_report_json.exists():
        issues.append(
            "missing report: "
            f"{paths.ref_report_json} "
            f"(run feature-tracker.sh check-reference-readiness --root {paths.root})"
        )
        return issues

    try:
        report = load_json(paths.ref_report_json)
    except Exception as exc:  # noqa: BLE001
        issues.append(f"failed to read report json: {exc}")
        return issues

    if report.get("status") != "VALID":
        issues.append("ref-read report status is not VALID")

    expected_hash = compute_manifest_hash(mpath)
    if report.get("manifest_sha256") != expected_hash:
        issues.append("manifest hash mismatch; regenerate report")

    entries = report.get("entries", [])
    if not isinstance(entries, list):
        issues.append("report entries malformed")
        return issues

    missing_required = [
        item.get("id")
        for item in entries
        if item.get("required", True) and not item.get("exists", False)
    ]
    if missing_required:
        needs_reference_skills_home = any(
            REFERENCE_SKILLS_ENV in str(item.get("location", ""))
            for item in entries
            if isinstance(item, dict)
        )
        issues.append(f"missing required references: {', '.join(str(i) for i in missing_required)}")
        if needs_reference_skills_home:
            issues.append(
                "hint: ensure required skills are installed and "
                "set BAGAKIT_REFERENCE_SKILLS_HOME to the correct skills directory "
                "(for one-shot shell calls, set it inline with the command)"
            )
        else:
            issues.append("hint: ensure local manifest file entries exist and are readable")

    return issues


def cmd_check_ref_report(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    skill_dir = Path(args.skill_dir).resolve()
    paths = HarnessPaths(root)
    issues = check_ref_report(paths, skill_dir, args.manifest)
    if issues:
        for issue in issues:
            eprint(f"error: {issue}")
        return 1
    print("ok")
    return 0


def cmd_apply(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    skill_dir = Path(args.skill_dir).resolve()
    paths = HarnessPaths(root)
    ensure_git_repo(root)

    if args.strict:
        issues = check_ref_report(paths, skill_dir, args.manifest)
        if issues:
            for issue in issues:
                eprint(f"error: {issue}")
            return 1

    paths.harness_dir.mkdir(parents=True, exist_ok=True)
    paths.feats_dir.mkdir(parents=True, exist_ok=True)
    paths.feats_archived_dir.mkdir(parents=True, exist_ok=True)
    paths.feats_discarded_dir.mkdir(parents=True, exist_ok=True)
    paths.index_dir.mkdir(parents=True, exist_ok=True)
    paths.dag_archive_dir.mkdir(parents=True, exist_ok=True)
    paths.artifacts_dir.mkdir(parents=True, exist_ok=True)

    copy_template_if_missing(skill_dir, "tpl/features-index-template.json", paths.index_file)
    save_index(paths, load_index(paths))
    ensure_runtime_policy(paths, skill_dir)
    copy_template_if_missing(skill_dir, "tpl/features-dag-template.json", paths.dag_file)
    ensure_harness_gitignore(paths)
    ensure_local_issuer_state(root, paths)

    ensure_worktrees_ignored(root)
    print(f"ok: harness initialized at {paths.harness_dir}")
    return 0


def pick_base_branch(root: Path) -> str:
    for candidate in ("main", "master"):
        cp = run_cmd(["git", "-C", str(root), "show-ref", "--verify", f"refs/heads/{candidate}"])
        if cp.returncode == 0:
            return candidate
    cp = run_cmd(["git", "-C", str(root), "rev-parse", "--abbrev-ref", "HEAD"])
    branch = cp.stdout.strip() if cp.returncode == 0 else ""
    return branch or "HEAD"


def cmd_rekey_local_issuer(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)
    payload = ensure_local_issuer_state(root, paths, force_rotate=True)
    print(f"namespace: {payload.get('namespace', '')}")
    return 0


def cmd_materialize_feature_artifact(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    skill_dir = Path(args.skill_dir).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    target = materialize_feature_artifact(
        paths,
        skill_dir,
        args.feat,
        kind=args.kind,
        overwrite=bool(args.overwrite),
    )
    print(f"write: {target}")
    return 0


def allocate_feat_id(root: Path, paths: HarnessPaths) -> str:
    index_data = load_index(paths)
    issuance, _ = ensure_feature_id_issuance(index_data)
    existing_ids = {str(item.get("feat_id", "")) for item in index_data.get("features", [])}
    issuer = ensure_local_issuer_state(root, paths)
    namespace = str(issuer.get("namespace") or "")

    def exists(feat_id: str) -> bool:
        return (
            feat_id in existing_ids
            or paths.feat_dir(feat_id).exists()
            or paths.feat_dir(feat_id, status="archived").exists()
            or paths.feat_dir(feat_id, status="discarded").exists()
        )

    next_sequence = int(issuance.get("next_cursor", 0))
    while True:
        cursor_token = encode_public_token(next_sequence, width=FEAT_CURSOR_WIDTH)
        guard_token = build_guard_token(root, namespace, cursor_token)
        candidate = f"f-{cursor_token}{namespace}{guard_token}"
        next_sequence += 1
        if exists(candidate):
            continue
        issuance["next_cursor"] = next_sequence
        save_index(paths, index_data)
        return candidate


def cmd_feat_new(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    skill_dir = Path(args.skill_dir).resolve()
    ensure_git_repo(root)
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    if args.strict:
        issues = check_ref_report(paths, skill_dir, args.manifest)
        if issues:
            for issue in issues:
                eprint(f"error: {issue}")
            return 1

    title = args.title.strip()
    goal = args.goal.strip()
    slug = slugify(args.slug if args.slug else title)
    feat_id = allocate_feat_id(root, paths)
    if not is_valid_feat_id(feat_id):
        eprint(f"error: generated invalid feat id: {feat_id}")
        return 1

    policy = load_runtime_policy(paths)
    workspace_mode = resolve_workspace_mode(policy, args.workspace_mode)
    branch_prefix = resolve_branch_prefix(policy, args.branch_prefix)
    base_ref = pick_base_branch(root)
    root_branch = current_branch(root)
    branch = ""
    wt_name = ""
    wt_rel = ""
    wt_abs: Path | None = None

    if workspace_mode == "worktree":
        try:
            branch, wt_name, wt_rel, wt_abs, base_ref = make_worktree_assignment(
                root,
                feat_id=feat_id,
                branch_prefix=branch_prefix,
            )
        except SystemExit as exc:
            eprint(str(exc))
            return 1

    feat_dir = paths.feat_dir(feat_id)
    feat_dir.mkdir(parents=True, exist_ok=False)

    state: dict[str, Any] = {
        "version": 1,
        "feat_id": feat_id,
        "title": title,
        "slug": slug,
        "goal": goal,
        "status": "proposal",
        "workspace_mode": workspace_mode,
        "base_ref": base_ref,
        "branch": branch,
        "worktree_name": wt_name,
        "worktree_path": wt_rel,
        "current_task_id": None,
        "counters": {
            "gate_fail_streak": 0,
            "no_progress_rounds": 0,
            "round_count": 0,
        },
        "gate": {
            "last_result": None,
            "last_task_id": None,
            "last_check_commands": [],
            "last_log_path": None,
        },
        "history": [
            history_event(
                "feat_created",
                (
                    f"workspace_mode={workspace_mode}; base_ref={base_ref}; "
                    f"root_branch={root_branch or 'detached'}"
                ),
            )
        ],
    }

    tasks: dict[str, Any] = {
        "version": 1,
        "feat_id": feat_id,
        "tasks": [
            {
                "id": "T-001",
                "title": "Implement first scoped change for this feat",
                "status": "todo",
                "summary": "Replace this placeholder with actual task detail.",
                "gate_result": None,
                "last_gate_commands": [],
                "last_commit_hash": None,
                "notes": [],
            }
        ],
    }

    save_feat(paths, feat_id, state, tasks)

    print(f"write: {feat_dir / 'state.json'}")
    print(f"write: {feat_dir / 'tasks.json'}")
    print(f"workspace_mode: {workspace_mode}")
    print(f"branch: {branch}")
    print(f"worktree: {wt_abs if wt_abs is not None else ''}")
    print(f"feature_id: {feat_id}")
    return 0


def cmd_assign_feat_workspace(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)

    state, tasks = load_feat(paths, args.feat)
    if str(state.get("status") or "") in CLOSED_FEAT_STATUS:
        eprint(f"error: cannot assign workspace for closed feat: {args.feat}")
        return 1

    current_mode = workspace_mode_of(state)
    if current_mode == "worktree" or str(state.get("worktree_path") or "").strip():
        eprint(
            f"error: feat already has worktree assignment: {args.feat}. "
            "manual cleanup is required before reassigning."
        )
        return 1

    policy = load_runtime_policy(paths)
    target_mode = resolve_workspace_mode(policy, args.workspace_mode)
    if target_mode == "proposal_only":
        eprint("error: assign-feature-workspace only supports worktree or current_tree")
        return 1
    if target_mode == current_mode:
        print(f"ok: workspace already assigned {args.feat} => {target_mode}")
        return 0

    branch = ""
    wt_name = ""
    wt_rel = ""
    wt_abs: Path | None = None
    base_ref = str(state.get("base_ref") or pick_base_branch(root))

    if target_mode == "worktree":
        branch_prefix = resolve_branch_prefix(policy, args.branch_prefix)
        try:
            branch, wt_name, wt_rel, wt_abs, base_ref = make_worktree_assignment(
                root,
                feat_id=args.feat,
                branch_prefix=branch_prefix,
            )
        except SystemExit as exc:
            eprint(str(exc))
            return 1

    state["workspace_mode"] = target_mode
    state["base_ref"] = base_ref
    state["branch"] = branch
    state["worktree_name"] = wt_name
    state["worktree_path"] = wt_rel
    state.setdefault("history", []).append(
        history_event(
            "workspace_assigned",
            (
                f"{current_mode} -> {target_mode}; root_branch={current_branch(root) or 'detached'}"
                if current_mode != target_mode
                else f"{target_mode}; root_branch={current_branch(root) or 'detached'}"
            ),
        )
    )
    save_feat(paths, args.feat, state, tasks)

    print(f"ok: workspace assigned {args.feat} => {target_mode}")
    print(f"branch: {branch}")
    print(f"worktree: {wt_abs if wt_abs is not None else ''}")
    return 0


def cmd_feat_status(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    index_data = load_index(paths)
    feats = index_data.get("features", [])

    if args.feat:
        state, tasks = load_feat(paths, args.feat)
        payload = {
            "feature": state,
            "tasks": tasks,
        }
        if args.json:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            return 0
        print(f"feature_id: {state['feat_id']}")
        print(f"title: {state.get('title', '')}")
        print(f"status: {state.get('status', '')}")
        print(f"workspace_mode: {state.get('workspace_mode', '')}")
        print(f"branch: {state.get('branch', '')}")
        print(f"worktree: {state.get('worktree_path', '')}")
        print(f"current_task: {state.get('current_task_id')}")
        print(
            "tasks: "
            f"todo={count_tasks(tasks, 'todo')} "
            f"in_progress={count_tasks(tasks, 'in_progress')} "
            f"done={count_tasks(tasks, 'done')} "
            f"blocked={count_tasks(tasks, 'blocked')}"
        )
        return 0

    if args.json:
        print(json.dumps({"features": feats}, ensure_ascii=False, indent=2))
        return 0

    if not feats:
        print("no features")
        return 0

    print("feature_id	status	workspace	title	branch")
    for item in feats:
        print(
            f"{item.get('feat_id','')}\t{item.get('status','')}\t{item.get('workspace_mode','')}\t"
            f"{item.get('title','')}\t{item.get('branch','')}"
        )
    return 0


def cmd_task_start(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)
    state, tasks = load_feat(paths, args.feat)
    workspace_mode = workspace_mode_of(state)
    if workspace_mode == "proposal_only":
        recommended_mode, reason = recommend_workspace_mode(root)
        next_cmd = (
            "feature-tracker.sh assign-feature-workspace "
            f"--root {shlex.quote(str(root))} --feature {args.feat} --workspace-mode {recommended_mode}"
        )
        alternative = (
            "feature-tracker.sh assign-feature-workspace "
            f"--root {shlex.quote(str(root))} --feature {args.feat} "
            f"--workspace-mode {'worktree' if recommended_mode == 'current_tree' else 'current_tree'}"
        )
        eprint(
            f"error: feat {args.feat} is proposal_only; "
            "assign a workspace first with feature-tracker.sh assign-feature-workspace"
        )
        print(f"recommendation: {recommended_mode} ({reason})")
        print(f"next: {next_cmd}")
        print(f"alternative: {alternative}")
        return 1

    task_id = args.task
    if not TASK_ID_RE.match(task_id):
        eprint(f"error: invalid task id: {task_id}")
        return 1

    for t in tasks.get("tasks", []):
        if t.get("status") == "in_progress" and t.get("id") != task_id:
            eprint(f"error: another task is already in_progress: {t.get('id')}")
            return 1

    target = find_task(tasks, task_id)
    if target.get("status") not in {"todo", "blocked"}:
        eprint(f"error: task {task_id} cannot be started from status={target.get('status')}")
        return 1

    target["status"] = "in_progress"
    state["status"] = "in_progress"
    state["current_task_id"] = task_id
    state.setdefault("history", []).append(
        history_event("task_started", task_id)
    )
    save_feat(paths, args.feat, state, tasks)
    print(f"ok: task started {args.feat}/{task_id}")
    return 0


def detect_project_type(root: Path, config: dict[str, Any]) -> str:
    gate_cfg = config.get("gate", {}) if isinstance(config, dict) else {}
    explicit = str(gate_cfg.get("project_type", "auto"))
    if explicit in {"ui", "non_ui"}:
        return explicit

    rules = gate_cfg.get("project_type_rules", {})
    if isinstance(rules, dict):
        ui_rules = rules.get("ui", {})
        non_ui_rules = rules.get("non_ui", {})
        default_type = str(rules.get("default", "non_ui"))
        if default_type not in {"ui", "non_ui"}:
            default_type = "non_ui"

        def matches(rule_set: Any) -> bool:
            if not isinstance(rule_set, dict):
                return False
            any_paths = rule_set.get("any_path_exists", [])
            if isinstance(any_paths, list) and any_paths:
                for rel in any_paths:
                    if (root / str(rel)).exists():
                        return True
            all_paths = rule_set.get("all_paths_exist", [])
            if isinstance(all_paths, list) and all_paths:
                if all((root / str(rel)).exists() for rel in all_paths):
                    return True
            return False

        if matches(ui_rules):
            return "ui"
        if matches(non_ui_rules):
            return "non_ui"
        return default_type

    # Default behavior when no detection rules are configured.
    return "non_ui"


def collect_non_ui_commands(root: Path, config: dict[str, Any]) -> list[str]:
    gate_cfg = config.get("gate", {}) if isinstance(config, dict) else {}
    custom = gate_cfg.get("non_ui_commands", [])
    if isinstance(custom, list) and custom:
        return [str(c) for c in custom]

    commands: list[str] = []
    if (root / "pyproject.toml").exists() or (root / "requirements.txt").exists() or (root / "pytest.ini").exists():
        if command_exists("pytest"):
            commands.append("pytest -q")
    if (root / "go.mod").exists() and command_exists("go"):
        commands.append("go test ./...")
    if (root / "Cargo.toml").exists() and command_exists("cargo"):
        commands.append("cargo test -q")
    package_json = root / "package.json"
    if package_json.exists() and command_exists("npm"):
        try:
            data = load_json(package_json)
            scripts = data.get("scripts", {}) if isinstance(data, dict) else {}
            if isinstance(scripts, dict) and "test" in scripts:
                commands.append("npm test --silent")
        except Exception:  # noqa: BLE001
            pass
    return commands


def resolve_verification_policy(config: dict[str, Any]) -> str:
    gate_cfg = config.get("gate", {}) if isinstance(config, dict) else {}
    raw = str(gate_cfg.get("verification_policy", "on_demand")).strip().lower()
    allowed = {"never", "on_demand", "auto_ui", "required"}
    if raw not in allowed:
        raise SystemExit(
            "error: invalid gate.verification_policy: "
            f"{raw}. expected one of {', '.join(sorted(allowed))}"
        )
    return raw


def verification_required(policy: str, *, project_type: str, evidence_file: Path) -> bool:
    if policy == "never":
        return False
    if policy == "required":
        return True
    if policy == "auto_ui":
        return project_type == "ui" or evidence_file.exists()
    return evidence_file.exists()


def validate_verification_evidence(evidence_file: Path) -> list[str]:
    errors: list[str] = []
    if not evidence_file.exists():
        return [f"missing verification file: {evidence_file}"]
    text = read_text(evidence_file)
    for heading in ("## Automated Checks", "## Manual Checks", "## Residual Risks"):
        if heading not in text:
            errors.append(f"missing heading in verification evidence: {heading}")
    return errors


def cmd_task_gate(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    state, tasks = load_feat(paths, args.feat)
    task = find_task(tasks, args.task)
    if task.get("status") != "in_progress":
        eprint(f"error: task {args.task} must be in_progress before gate")
        return 1
    if state.get("current_task_id") != args.task:
        eprint("error: current feature current_task_id does not match requested task")
        return 1

    config = load_runtime_policy(paths)
    project_type = detect_project_type(root, config)
    verification_policy = resolve_verification_policy(config)
    verification_file = paths.feat_verification(args.feat, status=str(state.get("status") or ""))

    records: list[dict[str, Any]] = []
    failed = False
    fail_reasons: list[str] = []

    if verification_required(verification_policy, project_type=project_type, evidence_file=verification_file):
        verification_errors = validate_verification_evidence(verification_file)
        if verification_errors:
            failed = True
            fail_reasons.extend(verification_errors)

    if project_type == "ui":
        ui_cmds = config.get("gate", {}).get("ui_commands", []) if isinstance(config, dict) else []
        if isinstance(ui_cmds, list):
            for cmd in ui_cmds:
                cp = run_shell(str(cmd), cwd=root)
                rec = {
                    "command": str(cmd),
                    "exit_code": cp.returncode,
                    "status": "pass" if cp.returncode == 0 else "fail",
                }
                records.append(rec)
                if cp.returncode != 0:
                    failed = True
                    fail_reasons.append(f"ui command failed: {cmd}")
    else:
        commands = collect_non_ui_commands(root, config)
        if not commands:
            failed = True
            fail_reasons.append(
                "no non-ui gate command available; "
                f"set gate.non_ui_commands in {paths.runtime_policy_file.relative_to(root)}"
            )
        else:
            for cmd in commands:
                cp = run_shell(cmd, cwd=root)
                rec = {
                    "command": cmd,
                    "exit_code": cp.returncode,
                    "status": "pass" if cp.returncode == 0 else "fail",
                }
                records.append(rec)
                if cp.returncode != 0:
                    failed = True
                    fail_reasons.append(f"command failed: {cmd}")

    gate_result = "fail" if failed else "pass"

    logs_dir = paths.feat_artifacts_dir(args.feat, status=str(state.get("status") or ""))
    logs_dir.mkdir(parents=True, exist_ok=True)
    next_round = int(state.setdefault("counters", {}).get("round_count", 0)) + 1
    log_file = next_numbered_path(logs_dir, prefix=f"gate-{args.task}-r{next_round}-", suffix=".log")
    lines = [f"project_type={project_type}", f"result={gate_result}"]
    if fail_reasons:
        lines.append("reasons:")
        for r in fail_reasons:
            lines.append(f"- {r}")
    lines.append("commands:")
    for rec in records:
        lines.append(f"- {rec['command']} => {rec['status']} ({rec['exit_code']})")
    write_text(log_file, "\n".join(lines) + "\n")

    counters = state.setdefault("counters", {})
    counters["round_count"] = int(counters.get("round_count", 0)) + 1
    counters["no_progress_rounds"] = int(counters.get("no_progress_rounds", 0)) + 1
    if gate_result == "pass":
        counters["gate_fail_streak"] = 0
    else:
        counters["gate_fail_streak"] = int(counters.get("gate_fail_streak", 0)) + 1

    state["gate"] = {
        "last_result": gate_result,
        "last_task_id": args.task,
        "last_check_commands": records,
        "last_log_path": str(log_file.relative_to(root)),
    }
    state.setdefault("history", []).append(
        history_event("task_gate", f"{args.task} => {gate_result}")
    )

    task["gate_result"] = gate_result
    task["last_gate_commands"] = records

    save_feat(paths, args.feat, state, tasks)

    if gate_result == "fail":
        eprint(f"error: gate failed for {args.feat}/{args.task}")
        for reason in fail_reasons:
            eprint(f"error: {reason}")
        if any(reason.startswith("missing verification file:") for reason in fail_reasons):
            print(
                "next: feature-tracker.sh materialize-feature-artifact "
                f"--root {shlex.quote(str(root))} --feature {args.feat} --kind verification"
            )
        print(f"gate_log: {log_file}")
        return 1

    print(f"ok: gate passed {args.feat}/{args.task}")
    print(f"gate_log: {log_file}")
    return 0


def build_commit_message(
    state: dict[str, Any],
    task: dict[str, Any],
    summary: str,
    task_status: str,
    gate_result: str,
) -> str:
    feat_id = state["feat_id"]
    task_id = task["id"]
    checks = task.get("last_gate_commands", [])
    check_lines = []
    if checks:
        for rec in checks:
            check_lines.append(
                f"- `{rec.get('command','')}` => {rec.get('status','unknown').upper()}"
            )
    else:
        check_lines.append("- No gate command records found")

    body = [
        f"feature({feat_id}): task({task_id}) {summary}",
        "",
        "Plan:",
        f"- Feat Goal: {state.get('goal','')}",
        f"- Task: {task.get('title','')}",
        "",
        "Check:",
        *check_lines,
        "",
        "Learn:",
        "- Add key learnings, risks, or follow-up notes here.",
        "",
        f"Feature-ID: {feat_id}",
        f"Task-ID: {task_id}",
        f"Gate-Result: {gate_result}",
        f"Task-Status: {task_status}",
        "",
    ]
    return "\n".join(body)


def parse_trailers(lines: list[str]) -> dict[str, str]:
    trailers: dict[str, str] = {}
    for line in lines:
        m = re.match(r"^([A-Za-z0-9-]+):\s*(.+)$", line.strip())
        if m:
            trailers[m.group(1)] = m.group(2)
    return trailers


def validate_commit_message(
    text: str,
    expected_feat: str,
    expected_task: str,
    expected_task_status: str,
    expected_gate_result: str,
) -> list[str]:
    errors: list[str] = []
    lines = text.splitlines()
    if not lines:
        return ["empty commit message"]

    subj = lines[0].strip()
    m = re.match(r"^feature\(([^)]+)\): task\((T-\d{3})\) .+$", subj)
    if not m:
        errors.append("invalid subject format")
    else:
        if not is_valid_feat_id(m.group(1)):
            errors.append("invalid subject feature-id")
        elif m.group(1) != expected_feat:
            errors.append("subject feature-id mismatch")
        if m.group(2) != expected_task:
            errors.append("subject task-id mismatch")

    blob = "\n".join(lines)
    for marker in ("\nPlan:\n", "\nCheck:\n", "\nLearn:\n"):
        if marker not in f"\n{blob}\n":
            errors.append(f"missing section: {marker.strip()}")

    trailers = parse_trailers(lines)
    required = {
        "Feature-ID": expected_feat,
        "Task-ID": expected_task,
        "Gate-Result": expected_gate_result,
        "Task-Status": expected_task_status,
    }
    for k, v in required.items():
        if trailers.get(k) != v:
            errors.append(f"missing or invalid trailer {k}")

    if expected_task_status == "done" and expected_gate_result != "pass":
        errors.append("done status requires gate_result=pass")

    return errors


def cmd_task_commit(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)

    state, tasks = load_feat(paths, args.feat)
    feat_dir = paths.feat_dir(args.feat, status=str(state.get("status") or ""))
    task = find_task(tasks, args.task)
    if task.get("status") != "in_progress":
        eprint(f"error: task must be in_progress before commit: {args.task}")
        return 1

    gate_result = str(task.get("gate_result") or "")
    if gate_result not in GATE_STATUS:
        eprint("error: task gate_result is missing; run feature-tracker.sh run-task-gate first")
        return 1

    task_status = args.task_status
    if task_status == "done" and gate_result != "pass":
        eprint("error: Task-Status done requires Gate-Result pass")
        return 1

    msg = build_commit_message(state, task, args.summary.strip(), task_status, gate_result)
    artifacts_dir = paths.feat_artifacts_dir(args.feat, status=str(state.get("status") or ""))
    msg_file = (
        Path(args.message_out).resolve()
        if args.message_out
        else artifacts_dir / next_numbered_path(artifacts_dir, prefix=f"commit-{args.task}-", suffix=".msg").name
    )
    write_text(msg_file, msg)

    errors = validate_commit_message(
        msg,
        expected_feat=args.feat,
        expected_task=args.task,
        expected_task_status=task_status,
        expected_gate_result=gate_result,
    )
    if errors:
        for err in errors:
            eprint(f"error: {err}")
        return 1

    print(f"message_file: {msg_file}")
    print(
        "next: git add -A && "
        f"git commit -F {shlex.quote(str(msg_file))}"
    )

    if args.execute:
        cp = run_cmd(["git", "-C", str(root), "commit", "-F", str(msg_file)])
        if cp.returncode != 0:
            eprint(cp.stderr.strip() or cp.stdout.strip() or "git commit failed")
            return 1
        head = run_cmd(["git", "-C", str(root), "rev-parse", "HEAD"])
        if head.returncode == 0:
            task["last_commit_hash"] = head.stdout.strip()
            save_feat(paths, args.feat, state, tasks)
            print(f"commit_hash: {task['last_commit_hash']}")

    return 0


def cmd_task_finish(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    state, tasks = load_feat(paths, args.feat)
    task = find_task(tasks, args.task)

    if task.get("status") != "in_progress":
        eprint(f"error: task is not in_progress: {args.task}")
        return 1
    if state.get("current_task_id") != args.task:
        eprint("error: state current_task_id mismatch")
        return 1

    result = args.result
    if result == "done" and task.get("gate_result") != "pass":
        eprint("error: cannot finish task as done without gate pass")
        return 1

    task["status"] = result

    state["current_task_id"] = None
    state.setdefault("counters", {})["no_progress_rounds"] = 0
    state.setdefault("history", []).append(
        history_event("task_finished", f"{args.task} => {result}")
    )

    if result == "blocked":
        state["status"] = "blocked"
    else:
        if count_tasks(tasks, "todo") == 0 and count_tasks(tasks, "in_progress") == 0:
            state["status"] = "done"
        else:
            state["status"] = "ready"

    save_feat(paths, args.feat, state, tasks)
    print(f"ok: task finished {args.feat}/{args.task} => {result}")
    print(f"feat_status: {state['status']}")
    if state["status"] == "done":
        root_q = shlex.quote(str(root))
        archive_cmd = f"feature-tracker.sh archive-feature --root {root_q} --feature {args.feat}"
        discard_cmd = (
            "feature-tracker.sh discard-feature "
            f"--root {root_q} --feature {args.feat} --reason superseded"
        )
        if workspace_mode_of(state) == "worktree":
            branch = str(state.get("branch") or "")
            base_ref = str(state.get("base_ref") or pick_base_branch(root))
            branch_merged = bool(branch and git_local_branch_exists(root, branch) and git_branch_merged_into(root, branch, base_ref))
            if branch and not branch_merged:
                print(
                    "next: git -C "
                    f"{root_q} checkout {shlex.quote(base_ref)} "
                    f"&& git -C {root_q} merge --no-ff {shlex.quote(branch)}"
                )
                print(f"after_merge: {archive_cmd}")
            else:
                print(f"next: {archive_cmd}")
        else:
            print(f"next: {archive_cmd}")
        print(f"alternative: {discard_cmd}")
    return 0


def render_summary(state: dict[str, Any], tasks: dict[str, Any]) -> str:
    feat_id = state["feat_id"]
    workspace_mode = state.get("workspace_mode", "")
    todo = count_tasks(tasks, "todo")
    in_prog = count_tasks(tasks, "in_progress")
    done = count_tasks(tasks, "done")
    blocked = count_tasks(tasks, "blocked")
    counters = state.get("counters", {})
    cleanup = {}
    for key in ("archived_cleanup", "discarded_cleanup"):
        val = state.get(key)
        if isinstance(val, dict):
            cleanup = val
            break

    return "\n".join(
        [
            f"# Feature Summary: {feat_id}",
            "",
            f"- Title: {state.get('title', '')}",
            f"- Goal: {state.get('goal', '')}",
            f"- Final Status: {state.get('status', '')}",
            f"- Closed From Status: {state.get('closed_from_status', '')}",
            f"- Workspace Mode: {workspace_mode}",
            f"- Base Ref: {state.get('base_ref', '')}",
            f"- Branch: {state.get('branch', '')}",
            f"- Worktree: {state.get('worktree_path', '')}",
            f"- Discard Reason: {state.get('discard_reason') or ''}",
            f"- Replacement Feat: {state.get('replacement_feat_id') or ''}",
            "",
            "## Closure Cleanup",
            f"- Branch Merged: {cleanup.get('branch_merged', '')}",
            f"- Worktree Removed: {cleanup.get('worktree_removed', '')}",
            f"- Worktree Pruned: {cleanup.get('worktree_pruned', '')}",
            f"- Branch Deleted: {cleanup.get('branch_deleted', '')}",
            f"- Worktree Patch: {cleanup.get('worktree_patch', '')}",
            f"- Worktree Staged Patch: {cleanup.get('worktree_staged_patch', '')}",
            f"- Branch Patch: {cleanup.get('branch_patch', '')}",
            f"- Untracked Archive: {cleanup.get('untracked_archive', '')}",
            f"- Cleanup Note: {cleanup.get('note', '')}",
            "",
            "## Task Stats",
            f"- todo: {todo}",
            f"- in_progress: {in_prog}",
            f"- done: {done}",
            f"- blocked: {blocked}",
            "",
            "## Counters",
            f"- gate_fail_streak: {counters.get('gate_fail_streak', 0)}",
            f"- no_progress_rounds: {counters.get('no_progress_rounds', 0)}",
            f"- round_count: {counters.get('round_count', 0)}",
            "",
            "## Notes",
            "- Promote durable decisions and gotchas to living docs memory when applicable.",
            "",
        ]
    )


def apply_template(template: str, replacements: dict[str, str]) -> str:
    out = template
    for k, v in replacements.items():
        out = out.replace(k, v)
    return out


def resolve_worktree_abs(root: Path, raw: str) -> Path:
    p = Path(raw)
    if p.is_absolute():
        return p
    return (root / p).resolve()


def git_local_branch_exists(root: Path, branch: str) -> bool:
    cp = run_cmd(["git", "-C", str(root), "show-ref", "--verify", f"refs/heads/{branch}"])
    return cp.returncode == 0


def git_branch_merged_into(root: Path, branch: str, base_ref: str) -> bool:
    cp = run_cmd(["git", "-C", str(root), "merge-base", "--is-ancestor", branch, base_ref])
    return cp.returncode == 0


def git_worktree_paths(root: Path) -> set[Path]:
    cp = run_cmd(["git", "-C", str(root), "worktree", "list", "--porcelain"])
    if cp.returncode != 0:
        return set()
    out: set[Path] = set()
    for raw in cp.stdout.splitlines():
        line = raw.strip()
        if not line.startswith("worktree "):
            continue
        path = line[len("worktree ") :].strip()
        if not path:
            continue
        out.add(Path(path).resolve())
    return out


def export_discard_artifacts(
    root: Path,
    feat_dir: Path,
    *,
    base_ref: str,
    branch: str,
    wt_abs: Path | None,
) -> dict[str, str]:
    cleanup: dict[str, str] = {}
    artifacts_dir = feat_dir / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    if wt_abs is not None and wt_abs.exists():
        cp = run_cmd(["git", "-C", str(wt_abs), "diff", "--binary"])
        if cp.returncode != 0:
            raise SystemExit(cp.stderr.strip() or cp.stdout.strip() or "git diff failed in worktree")
        if cp.stdout.strip():
            patch_file = artifacts_dir / "discard-worktree.patch"
            write_text(patch_file, cp.stdout)
            cleanup["worktree_patch"] = patch_file.name

        cp = run_cmd(["git", "-C", str(wt_abs), "diff", "--cached", "--binary"])
        if cp.returncode != 0:
            raise SystemExit(cp.stderr.strip() or cp.stdout.strip() or "git diff --cached failed in worktree")
        if cp.stdout.strip():
            patch_file = artifacts_dir / "discard-worktree-staged.patch"
            write_text(patch_file, cp.stdout)
            cleanup["worktree_staged_patch"] = patch_file.name

        cp = run_cmd(["git", "-C", str(wt_abs), "ls-files", "--others", "--exclude-standard", "-z"])
        if cp.returncode != 0:
            raise SystemExit(cp.stderr.strip() or cp.stdout.strip() or "git ls-files failed in worktree")
        untracked = [item for item in cp.stdout.split("\0") if item]
        if untracked:
            archive_file = artifacts_dir / "discard-untracked.tar.gz"
            with tarfile.open(archive_file, "w:gz") as tf:
                for rel in untracked:
                    target = wt_abs / rel
                    if target.exists():
                        tf.add(target, arcname=rel, recursive=True)
            cleanup["untracked_archive"] = archive_file.name

    if branch and git_local_branch_exists(root, branch):
        cp = run_cmd(["git", "-C", str(root), "diff", "--binary", f"{base_ref}...{branch}"])
        if cp.returncode != 0:
            raise SystemExit(cp.stderr.strip() or cp.stdout.strip() or "git branch diff failed")
        if cp.stdout.strip():
            patch_file = artifacts_dir / "discard-branch.patch"
            write_text(patch_file, cp.stdout)
            cleanup["branch_patch"] = patch_file.name

    return cleanup


def cmd_feat_archive(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    skill_dir = Path(args.skill_dir).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)

    state, tasks = load_feat(paths, args.feat)
    workspace_mode = workspace_mode_of(state)
    current_status = str(state.get("status") or "")
    if current_status not in {"done", "blocked", "archived"}:
        eprint(
            "error: feat must be done/blocked before archive "
            f"(current={current_status})"
        )
        return 1

    branch = str(state.get("branch") or "")
    base_ref = str(state.get("base_ref") or pick_base_branch(root))
    worktree_path = str(state.get("worktree_path") or "")
    wt_abs = resolve_worktree_abs(root, worktree_path) if worktree_path else None

    branch_exists = bool(branch) and git_local_branch_exists(root, branch)
    branch_merged = bool(branch_exists and git_branch_merged_into(root, branch, base_ref))
    if workspace_mode == "worktree" and branch and not branch_merged:
        eprint(f"error: feature branch is not merged into {base_ref}: {branch}")
        eprint(
            "hint: merge the feature branch into base before archiving"
        )
        return 1

    if workspace_mode == "current_tree":
        changes = non_harness_git_status_lines(root)
        if changes:
            eprint("error: current_tree feature has non-harness changes; archive is not fail-closed")
            eprint("hint: clean the root tree or use discard-feature after preserving the work elsewhere")
            return 1

    # Safety: don't remove a dirty worktree.
    if wt_abs is not None and wt_abs.exists():
        cp = run_cmd(["git", "-C", str(wt_abs), "status", "--porcelain"])
        if cp.returncode != 0:
            eprint(cp.stderr.strip() or cp.stdout.strip() or "git status failed")
            return 1
        if cp.stdout.strip():
            eprint(f"error: worktree has uncommitted changes: {wt_abs}")
            eprint("hint: commit/stash/clean the worktree before archiving this feat")
            return 1

    # Remove worktree first (branch deletion is blocked while checked out).
    worktree_removed = False
    worktree_pruned = False
    if wt_abs is not None and wt_abs.exists():
        cp = run_cmd(["git", "-C", str(root), "worktree", "remove", str(wt_abs)])
        if cp.returncode != 0:
            eprint(cp.stderr.strip() or cp.stdout.strip() or "git worktree remove failed")
            return 1
        worktree_removed = True
        print(f"ok: worktree removed {wt_abs}")
        cp = run_cmd(["git", "-C", str(root), "worktree", "prune"])
        if cp.returncode != 0:
            eprint(cp.stderr.strip() or cp.stdout.strip() or "git worktree prune failed")
            return 1
        worktree_pruned = True

    # Verify no stale worktree registration remains.
    if wt_abs is not None and wt_abs in git_worktree_paths(root):
        eprint(f"error: worktree entry still registered after cleanup: {wt_abs}")
        return 1

    branch_deleted = False
    if branch_exists and branch_merged:
        cp = run_cmd(["git", "-C", str(root), "branch", "-D", branch])
        if cp.returncode != 0:
            eprint(cp.stderr.strip() or cp.stdout.strip() or "git branch delete failed")
            return 1
        branch_deleted = True
        print(f"ok: branch deleted {branch}")

    if current_status != "archived":
        state["closed_from_status"] = current_status
    state["status"] = "archived"
    state["archived_cleanup"] = {
        "workspace_mode": workspace_mode,
        "base_ref": base_ref,
        "branch_merged": branch_merged,
        "worktree_removed": worktree_removed,
        "worktree_pruned": worktree_pruned,
        "branch_deleted": branch_deleted,
        "note": (
            "worktree mode removes/prunes worktree and deletes merged branch; "
            "current_tree/proposal_only only archive feat metadata"
        ),
    }
    state.setdefault("history", []).append(
        history_event("feat_archived", "moved + cleaned")
    )

    # Physical archive: move feat dir into features-archived/.
    if current_status != "archived":
        src_dir = paths.feat_dir(args.feat, status=current_status)
        dst_dir = paths.feat_dir(args.feat, status="archived")
        if not src_dir.exists():
            eprint(f"error: missing feature directory: {src_dir}")
            return 1
        if dst_dir.exists():
            eprint(f"error: archived feature directory already exists: {dst_dir}")
            return 1
        dst_dir.parent.mkdir(parents=True, exist_ok=True)
        try:
            src_dir.rename(dst_dir)
        except OSError:
            shutil.move(str(src_dir), str(dst_dir))
        print(f"ok: feat dir moved {src_dir} -> {dst_dir}")

    # Write summary into the archived directory (source of truth after move).
    summary = render_summary(state, tasks)
    summary_file = paths.feat_summary(args.feat, status="archived")
    write_text(summary_file, summary)
    print(f"write: {summary_file}")

    save_feat(paths, args.feat, state, tasks)
    print(f"ok: feat archived {args.feat}")
    return 0


def cmd_feat_discard(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)

    state, tasks = load_feat(paths, args.feat)
    current_status = str(state.get("status") or "")
    if current_status == "discarded":
        print(f"ok: feat already discarded {args.feat}")
        return 0
    if current_status == "archived":
        eprint(f"error: archived feat cannot be discarded: {args.feat}")
        return 1
    if current_status not in {"proposal", "ready", "in_progress", "blocked", "done"}:
        eprint(f"error: feat cannot be discarded from status={current_status}")
        return 1
    if current_status == "in_progress" and not args.force:
        eprint("error: in_progress feat requires --force before discard")
        return 1

    replacement = str(args.replacement or "").strip()
    if replacement:
        if replacement == args.feat:
            eprint("error: replacement feat must differ from discarded feat")
            return 1
        if get_feat_index_entry(load_index(paths), replacement) is None:
            eprint(f"error: replacement feat not indexed: {replacement}")
            return 1

    if current_status == "in_progress":
        for task in tasks.get("tasks", []):
            if task.get("status") == "in_progress":
                task["status"] = "blocked"
                task.setdefault("notes", []).append("force-discarded before task completion")
        state["current_task_id"] = None

    workspace_mode = workspace_mode_of(state)
    branch = str(state.get("branch") or "")
    base_ref = str(state.get("base_ref") or pick_base_branch(root))
    worktree_path = str(state.get("worktree_path") or "")
    wt_abs = resolve_worktree_abs(root, worktree_path) if worktree_path else None
    feat_dir = paths.feat_dir(args.feat, status=current_status)

    cleanup = export_discard_artifacts(root, feat_dir, base_ref=base_ref, branch=branch, wt_abs=wt_abs)

    if workspace_mode == "current_tree":
        changes = non_harness_git_status_lines(root)
        if changes:
            eprint("error: current_tree feature has non-harness changes; discard is not fail-closed")
            eprint("hint: preserve or clean the root tree before discarding this feature")
            return 1

    worktree_removed = False
    worktree_pruned = False
    if wt_abs is not None and wt_abs.exists():
        cp = run_cmd(["git", "-C", str(root), "worktree", "remove", "--force", str(wt_abs)])
        if cp.returncode != 0:
            eprint(cp.stderr.strip() or cp.stdout.strip() or "git worktree remove failed")
            return 1
        worktree_removed = True
        print(f"ok: worktree removed {wt_abs}")
        cp = run_cmd(["git", "-C", str(root), "worktree", "prune"])
        if cp.returncode != 0:
            eprint(cp.stderr.strip() or cp.stdout.strip() or "git worktree prune failed")
            return 1
        worktree_pruned = True

    if wt_abs is not None and wt_abs in git_worktree_paths(root):
        eprint(f"error: worktree entry still registered after discard cleanup: {wt_abs}")
        return 1

    branch_deleted = False
    branch_merged = bool(branch and git_local_branch_exists(root, branch) and git_branch_merged_into(root, branch, base_ref))
    if branch and git_local_branch_exists(root, branch):
        cp = run_cmd(["git", "-C", str(root), "branch", "-D", branch])
        if cp.returncode != 0:
            eprint(cp.stderr.strip() or cp.stdout.strip() or "git branch delete failed")
            return 1
        branch_deleted = True
        print(f"ok: branch deleted {branch}")

    state["closed_from_status"] = current_status
    state["status"] = "discarded"
    state["discard_reason"] = args.reason
    state["replacement_feat_id"] = replacement or None
    state.setdefault("history", []).append(
        history_event("feat_discarded", f"reason={args.reason}; replacement={replacement or 'none'}")
    )

    src_dir = paths.feat_dir(args.feat, status=current_status)
    dst_dir = paths.feat_dir(args.feat, status="discarded")
    if not src_dir.exists():
        eprint(f"error: missing feature directory: {src_dir}")
        return 1
    if dst_dir.exists():
        eprint(f"error: discarded feature directory already exists: {dst_dir}")
        return 1
    dst_dir.parent.mkdir(parents=True, exist_ok=True)
    try:
        src_dir.rename(dst_dir)
    except OSError:
        shutil.move(str(src_dir), str(dst_dir))
    print(f"ok: feat dir moved {src_dir} -> {dst_dir}")

    discarded_artifacts_dir = dst_dir / "artifacts"
    state["discarded_cleanup"] = {
        "workspace_mode": workspace_mode,
        "base_ref": base_ref,
        "branch_merged": branch_merged,
        "worktree_removed": worktree_removed,
        "worktree_pruned": worktree_pruned,
        "branch_deleted": branch_deleted,
        "worktree_patch": (
            str((discarded_artifacts_dir / cleanup["worktree_patch"]).relative_to(root))
            if cleanup.get("worktree_patch")
            else ""
        ),
        "worktree_staged_patch": (
            str((discarded_artifacts_dir / cleanup["worktree_staged_patch"]).relative_to(root))
            if cleanup.get("worktree_staged_patch")
            else ""
        ),
        "branch_patch": (
            str((discarded_artifacts_dir / cleanup["branch_patch"]).relative_to(root))
            if cleanup.get("branch_patch")
            else ""
        ),
        "untracked_archive": (
            str((discarded_artifacts_dir / cleanup["untracked_archive"]).relative_to(root))
            if cleanup.get("untracked_archive")
            else ""
        ),
        "note": (
            "discard closes stale/superseded work while preserving feat artifacts; "
            "worktree mode force-removes worktree and deletes branch after exporting patches when available"
        ),
    }

    summary = render_summary(state, tasks)
    summary_file = paths.feat_summary(args.feat, status="discarded")
    write_text(summary_file, summary)
    print(f"write: {summary_file}")

    save_feat(paths, args.feat, state, tasks)
    print(f"ok: feat discarded {args.feat}")
    return 0


def validate_feat(paths: HarnessPaths, root: Path, feat_id: str) -> list[str]:
    errors: list[str] = []
    state, tasks = load_feat(paths, feat_id)

    if not is_valid_feat_id(feat_id):
        errors.append(f"invalid feat id format: {feat_id}")

    status = state.get("status")
    if status not in FEAT_STATUS:
        errors.append(f"{feat_id}: invalid feature status: {status}")

    if state.get("feat_id") != feat_id:
        errors.append(f"{feat_id}: state feat_id mismatch")

    index_entry = get_feat_index_entry(load_index(paths), feat_id)
    if index_entry is None:
        errors.append(f"{feat_id}: missing feature index entry")
    else:
        if str(index_entry.get("status") or "") != str(state.get("status") or ""):
            errors.append(f"{feat_id}: index status drift from state.json")
        if str(index_entry.get("title") or "") != str(state.get("title") or ""):
            errors.append(f"{feat_id}: index title drift from state.json")
        if str(index_entry.get("workspace_mode") or "") != str(state.get("workspace_mode") or ""):
            errors.append(f"{feat_id}: index workspace_mode drift from state.json")
        if str(index_entry.get("branch") or "") != str(state.get("branch") or ""):
            errors.append(f"{feat_id}: index branch drift from state.json")

    workspace_mode = str(state.get("workspace_mode") or "").strip()
    if workspace_mode not in WORKSPACE_MODES:
        errors.append(f"{feat_id}: invalid workspace_mode: {workspace_mode or '<missing>'}")
    else:
        branch = str(state.get("branch") or "").strip()
        wt_name = str(state.get("worktree_name") or "").strip()
        wt_path = str(state.get("worktree_path") or "").strip()
        if workspace_mode == "worktree":
            if not branch:
                errors.append(f"{feat_id}: worktree mode requires branch")
            if not wt_name:
                errors.append(f"{feat_id}: worktree mode requires worktree_name")
            if not wt_path:
                errors.append(f"{feat_id}: worktree mode requires worktree_path")
        else:
            if branch:
                errors.append(f"{feat_id}: {workspace_mode} mode must not track dedicated branch")
            if wt_name or wt_path:
                errors.append(f"{feat_id}: {workspace_mode} mode must not track worktree fields")

    counters = state.get("counters", {})
    for key in ("gate_fail_streak", "no_progress_rounds", "round_count"):
        try:
            val = int(counters.get(key, 0))
            if val < 0:
                errors.append(f"{feat_id}: counter {key} must be >= 0")
        except Exception:  # noqa: BLE001
            errors.append(f"{feat_id}: counter {key} not integer")

    task_items = tasks.get("tasks")
    if not isinstance(task_items, list) or not task_items:
        errors.append(f"{feat_id}: tasks.json missing tasks array")
        return errors

    seen: set[str] = set()
    in_progress: list[str] = []
    for task in task_items:
        tid = str(task.get("id", ""))
        if not TASK_ID_RE.match(tid):
            errors.append(f"{feat_id}: invalid task id: {tid}")
        if tid in seen:
            errors.append(f"{feat_id}: duplicate task id: {tid}")
        seen.add(tid)

        tstatus = task.get("status")
        if tstatus not in TASK_STATUS:
            errors.append(f"{feat_id}/{tid}: invalid task status: {tstatus}")
        if tstatus == "in_progress":
            in_progress.append(tid)

    if len(in_progress) > 1:
        errors.append(f"{feat_id}: more than one in_progress task: {', '.join(in_progress)}")

    cur = state.get("current_task_id")
    if cur is not None and cur not in in_progress:
        errors.append(f"{feat_id}: current_task_id does not match in_progress task")
    if workspace_mode == "proposal_only" and in_progress:
        errors.append(f"{feat_id}: proposal_only feat must not have in_progress tasks")

    # Validate tracked commit messages for tasks that have commit hash.
    for task in task_items:
        commit_hash = task.get("last_commit_hash")
        if not commit_hash:
            continue
        cp = run_cmd(["git", "-C", str(root), "show", "-s", "--format=%B", str(commit_hash)])
        if cp.returncode != 0:
            errors.append(f"{feat_id}/{task.get('id')}: commit hash not found: {commit_hash}")
            continue
        text = cp.stdout
        gate_result = str(task.get("gate_result") or "pass")
        task_status = str(task.get("status") or "done")
        msg_errors = validate_commit_message(
            text,
            expected_feat=feat_id,
            expected_task=str(task.get("id")),
            expected_task_status=task_status if task_status in {"done", "blocked"} else "done",
            expected_gate_result=gate_result if gate_result in GATE_STATUS else "pass",
        )
        if msg_errors:
            errors.append(
                f"{feat_id}/{task.get('id')}: commit message invalid ({'; '.join(msg_errors)})"
            )

    return errors


def cmd_validate(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    ensure_git_repo(root)

    errors: list[str] = []
    if not paths.index_file.exists():
        errors.append(f"missing index file: {paths.index_file}")
    if not paths.runtime_policy_file.exists():
        if paths.legacy_config_file.exists():
            errors.append(
                "legacy policy file is not supported: "
                f"{paths.legacy_config_file}. "
                "migrate manually to runtime-policy.json."
            )
        else:
            errors.append(f"missing runtime policy file: {paths.runtime_policy_file}")

    if paths.index_file.exists():
        try:
            index_data = load_index(paths)
        except SystemExit as exc:
            errors.append(str(exc))
        else:
            issuance = index_data.get("feature_id_issuance", {})
            if not isinstance(issuance, dict):
                errors.append("feature_id_issuance missing or invalid in features.json")
            else:
                if str(issuance.get("scheme") or "") != FEATURE_ID_SCHEME:
                    errors.append("feature_id_issuance.scheme drift from runtime")
                next_cursor = issuance.get("next_cursor")
                if not isinstance(next_cursor, int) or next_cursor < 0:
                    errors.append("feature_id_issuance.next_cursor must be a non-negative integer")

    legacy_dirs = [
        paths.harness_dir / "feats",
        paths.harness_dir / "feats-archived",
        paths.harness_dir / "feats-discarded",
    ]
    for legacy_dir in legacy_dirs:
        if legacy_dir.exists():
            errors.append(f"legacy feature-tracker runtime path is not supported: {legacy_dir}")

    feats: list[str] = []
    feat_status_by_id: dict[str, str] = {}
    if paths.index_file.exists():
        try:
            index_data = load_index(paths)
            for item in index_data.get("features", []):
                feat_id = str(item.get("feat_id", ""))
                if not feat_id:
                    continue
                feats.append(feat_id)
                feat_status_by_id[feat_id] = str(item.get("status") or "")
        except SystemExit as exc:
            errors.append(str(exc))

    harness_gitignore = paths.harness_dir / ".gitignore"
    if harness_gitignore.exists():
        ignored_lines = {line.strip() for line in harness_gitignore.read_text(encoding="utf-8").splitlines() if line.strip()}
        for rule in ("artifacts/*.log", "local/"):
            if rule not in ignored_lines:
                errors.append(f"tracker .gitignore missing rule: {rule}")
    else:
        errors.append(f"missing tracker .gitignore: {harness_gitignore}")

    tracked_local = tracked_paths_under(root, Path(".bagakit/feature-tracker/local"))
    if tracked_local:
        errors.append(
            "local issuer state must not be tracked: " + ", ".join(sorted(tracked_local))
        )

    if paths.issuer_file.exists():
        try:
            issuer_payload = load_local_issuer(paths)
        except SystemExit as exc:
            errors.append(str(exc))
        else:
            if not isinstance(issuer_payload, dict):
                errors.append(f"invalid local issuer payload: {paths.issuer_file}")
            else:
                if int(issuer_payload.get("version", 0)) != LOCAL_ISSUER_VERSION:
                    errors.append(f"local issuer version drift: {paths.issuer_file}")
                if str(issuer_payload.get("scheme") or "") != FEATURE_ID_SCHEME:
                    errors.append(f"local issuer scheme drift: {paths.issuer_file}")
                namespace = str(issuer_payload.get("namespace") or "")
                if not is_public_token(namespace, width=FEAT_NAMESPACE_WIDTH):
                    errors.append(f"local issuer namespace invalid: {paths.issuer_file}")
                if str(issuer_payload.get("guard_key_source") or "") != f"git-config:{LOCAL_GUARD_KEY_CONFIG}":
                    errors.append(f"local issuer guard source drift: {paths.issuer_file}")

    for feat_id in feats:
        errors.extend(validate_feat(paths, root, feat_id))

    # Validate physical archive layout.
    registered_worktrees = git_worktree_paths(root)
    for feat_id, status in feat_status_by_id.items():
        active_dir = paths.feat_dir(feat_id)
        archived_dir = paths.feat_dir(feat_id, status="archived")
        discarded_dir = paths.feat_dir(feat_id, status="discarded")
        if status in CLOSED_FEAT_STATUS:
            if active_dir.exists():
                errors.append(f"{feat_id}: closed feat dir must not exist in feats/: {active_dir}")
            closed_dir = archived_dir if status == "archived" else discarded_dir
            if not closed_dir.exists():
                errors.append(f"{feat_id}: {status} feat dir missing: {closed_dir}")
            try:
                state, _ = load_feat(paths, feat_id)
            except SystemExit as exc:
                errors.append(str(exc))
                continue
            wt_raw = str(state.get("worktree_path") or "").strip()
            if wt_raw:
                wt_abs = resolve_worktree_abs(root, wt_raw)
                if wt_abs in registered_worktrees:
                    errors.append(
                        f"{feat_id}: closed feat still has registered git worktree entry: {wt_abs}"
                    )
        else:
            if not active_dir.exists():
                errors.append(f"{feat_id}: feat dir missing: {active_dir}")
            if archived_dir.exists():
                errors.append(
                    f"{feat_id}: non-archived feat dir must not exist in features-archived/: {archived_dir}"
                )
            if discarded_dir.exists():
                errors.append(
                    f"{feat_id}: non-discarded feat dir must not exist in features-discarded/: {discarded_dir}"
                )

    # Detect feat directories missing from index (active + archived).
    if paths.feats_dir.exists():
        for child in sorted(paths.feats_dir.iterdir()):
            if child.is_dir() and child.name not in feats:
                errors.append(f"feature directory not indexed: {child.name}")
    if paths.feats_archived_dir.exists():
        for child in sorted(paths.feats_archived_dir.iterdir()):
            if child.is_dir() and child.name not in feats:
                errors.append(f"archived feature directory not indexed: {child.name}")
    if paths.feats_discarded_dir.exists():
        for child in sorted(paths.feats_discarded_dir.iterdir()):
            if child.is_dir() and child.name not in feats:
                errors.append(f"discarded feature directory not indexed: {child.name}")

    if paths.dag_file.exists():
        try:
            dag = load_json(paths.dag_file)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"failed to load dag file: {exc}")
        else:
            if not isinstance(dag, dict):
                errors.append(f"invalid dag schema: {paths.dag_file}")
            else:
                for forbidden in ("execution_mode", "max_parallel", "parallel_recommendation", "first_unfinished_layer"):
                    if forbidden in dag:
                        errors.append(f"dag must not contain execution-planning field: {forbidden}")

                if not isinstance(dag.get("features", []), list):
                    errors.append(f"invalid dag features schema: {paths.dag_file}")
                if not isinstance(dag.get("layers", []), list):
                    errors.append(f"invalid dag layers schema: {paths.dag_file}")
                if not isinstance(dag.get("notes", []), list):
                    errors.append(f"invalid dag notes schema: {paths.dag_file}")

                try:
                    active_states, _ = load_non_archived_feats(paths)
                    expected_dag = build_dag_projection_payload(active_states, all_status_by_feat=feat_status_by_id)
                except SystemExit as exc:
                    errors.append(str(exc))
                else:
                    if dag != expected_dag:
                        errors.append(
                            "dag projection drift from canonical feature state: "
                            "run feature-tracker.sh replan-features to regenerate FEATURES_DAG.json"
                        )

    if errors:
        for err in errors:
            eprint(f"error: {err}")
        eprint(f"failed: {len(errors)} validation error(s)")
        return 1

    print("ok: validation passed")
    return 0


def cmd_doctor(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    val_code = cmd_validate(
        argparse.Namespace(
            root=str(root),
        )
    )
    if val_code != 0:
        eprint("doctor: validation failed first")
        return 1

    config = load_runtime_policy(paths)
    thresholds = config.get("stop_thresholds", {}) if isinstance(config, dict) else {}
    gate_fail_limit = int(thresholds.get("gate_fail_streak", 3))
    no_progress_limit = int(thresholds.get("no_progress_rounds", 2))
    max_round = int(thresholds.get("max_round_count", 8))

    index_data = load_index(paths)
    warnings: list[str] = []

    for item in index_data.get("features", []):
        feat_id = str(item.get("feat_id", ""))
        state, tasks = load_feat(paths, feat_id)
        counters = state.get("counters", {})
        fail_streak = int(counters.get("gate_fail_streak", 0))
        no_progress = int(counters.get("no_progress_rounds", 0))
        rounds = int(counters.get("round_count", 0))
        status = str(state.get("status") or "")

        if fail_streak >= gate_fail_limit:
            warnings.append(
                f"{feat_id}: gate_fail_streak={fail_streak} reached threshold {gate_fail_limit}"
            )
        if no_progress >= no_progress_limit:
            warnings.append(
                f"{feat_id}: no_progress_rounds={no_progress} reached threshold {no_progress_limit}"
            )
        if rounds >= max_round:
            warnings.append(
                f"{feat_id}: round_count={rounds} reached threshold {max_round}"
            )

        if status == "in_progress" and count_tasks(tasks, "in_progress") == 0:
            warnings.append(f"{feat_id}: feature status in_progress but no task in_progress")

        if status in CLOSED_FEAT_STATUS:
            summary_file = paths.feat_summary(feat_id, status=status)
            if not summary_file.exists():
                warnings.append(f"{feat_id}: {status} feat missing summary.md")
            continue

    print("== doctor report ==")
    if warnings:
        for w in warnings:
            print(f"warn: {w}")
    else:
        print("no warnings")

    print("\nrecommended next steps:")
    print("1) Address threshold warnings before starting next task.")
    print("2) Run feature-tracker.sh run-task-gate before every task commit.")
    print("3) Close completed or superseded feats explicitly with archive-feature or discard-feature.")
    return 0


def parse_dependency_spec(raw: str) -> tuple[str, list[str]]:
    if ":" not in raw:
        raise SystemExit(
            "error: invalid dependency spec. expected '<feat-id>:<dep-id>[,<dep-id>...]'"
        )
    feat_id, dep_blob = raw.split(":", 1)
    feat_id = feat_id.strip()
    if not is_valid_feat_id(feat_id):
        raise SystemExit(f"error: invalid feat id in dependency spec: {feat_id}")

    deps: list[str] = []
    seen: set[str] = set()
    dep_blob = dep_blob.strip()
    if dep_blob:
        for raw_dep in dep_blob.split(","):
            dep = raw_dep.strip()
            if not dep:
                continue
            if not is_valid_feat_id(dep):
                raise SystemExit(f"error: invalid dependency feat id: {dep}")
            if dep == feat_id:
                raise SystemExit(f"error: feat cannot depend on itself: {feat_id}")
            if dep in seen:
                continue
            seen.add(dep)
            deps.append(dep)
    return feat_id, deps


def build_layered_dag(
    feat_ids: list[str],
    deps_by_feat: dict[str, set[str]],
) -> list[list[str]]:
    remaining: set[str] = set(feat_ids)
    unresolved: dict[str, set[str]] = {
        feat_id: set(deps_by_feat.get(feat_id, set())) for feat_id in feat_ids
    }
    dependents: dict[str, set[str]] = {feat_id: set() for feat_id in feat_ids}
    for feat_id, deps in unresolved.items():
        for dep in deps:
            dependents.setdefault(dep, set()).add(feat_id)

    layers: list[list[str]] = []
    while remaining:
        ready = sorted(
            (feat_id for feat_id in remaining if not unresolved.get(feat_id, set())),
            key=feat_sort_key,
        )
        if not ready:
            cycle_nodes = sorted(remaining, key=feat_sort_key)
            raise SystemExit(
                "error: dependency cycle detected among feats: " + ", ".join(cycle_nodes)
            )

        layers.append(ready)
        for feat_id in ready:
            remaining.remove(feat_id)
        for feat_id in ready:
            for child in dependents.get(feat_id, set()):
                if child in remaining:
                    unresolved[child].discard(feat_id)

    return layers


def dag_is_complete(payload: dict[str, Any]) -> bool:
    features = payload.get("features", [])
    return isinstance(features, list) and len(features) == 0


def archive_existing_dag(paths: HarnessPaths, payload: dict[str, Any]) -> Path:
    archived = json.loads(json.dumps(payload, ensure_ascii=False))
    archived.pop("generated_at", None)
    archived["is_completed_archive"] = dag_is_complete(payload)
    target = next_numbered_path(paths.dag_archive_dir, prefix="dag-", suffix=".json")
    save_json(target, archived)
    return target


def load_non_archived_feats(paths: HarnessPaths) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    index_data = load_index(paths)
    states: dict[str, dict[str, Any]] = {}
    tasks_by_feat: dict[str, dict[str, Any]] = {}
    for item in index_data.get("features", []):
        feat_id = str(item.get("feat_id", ""))
        if not feat_id:
            continue
        status = str(item.get("status") or "")
        if status in CLOSED_FEAT_STATUS:
            continue
        state, tasks = load_feat(paths, feat_id)
        states[feat_id] = state
        tasks_by_feat[feat_id] = tasks
    return states, tasks_by_feat


def build_dag_projection_payload(
    states: dict[str, dict[str, Any]],
    *,
    all_status_by_feat: dict[str, str],
) -> dict[str, Any]:
    feat_ids = sorted(states.keys(), key=feat_sort_key)
    if not feat_ids:
        return {
            "version": 1,
            "generated_by": "bagakit-feature-tracker",
            "features": [],
            "layers": [],
            "notes": [],
        }

    notes: list[str] = []
    deps_by_feat: dict[str, set[str]] = {}
    for feat_id, state in states.items():
        raw_deps = state.get("depends_on", [])
        if not isinstance(raw_deps, list):
            raw_deps = []
        deps: set[str] = set()
        for raw_dep in raw_deps:
            dep = str(raw_dep).strip()
            if not dep:
                continue
            if dep == feat_id:
                raise SystemExit(f"error: feat cannot depend on itself: {feat_id}")
            dep_status = all_status_by_feat.get(dep, "")
            if dep_status == "archived":
                notes.append(f"{feat_id} depends on archived feat {dep}; treated as already satisfied")
                continue
            if dep_status == "discarded":
                raise SystemExit(f"error: {feat_id} depends on discarded feat {dep}; update dependencies before replanning")
            if dep not in states:
                notes.append(f"{feat_id} dependency missing from active DAG set: {dep}")
                continue
            deps.add(dep)
        deps_by_feat[feat_id] = deps

    layers = build_layered_dag(feat_ids, deps_by_feat)
    layer_by_feat: dict[str, int] = {}
    for i, layer in enumerate(layers):
        for feat_id in layer:
            layer_by_feat[feat_id] = i

    dependents_by_feat: dict[str, list[str]] = {feat_id: [] for feat_id in feat_ids}
    for feat_id, deps in deps_by_feat.items():
        for dep in sorted(deps, key=feat_sort_key):
            dependents_by_feat.setdefault(dep, []).append(feat_id)

    return {
        "version": 1,
        "generated_by": "bagakit-feature-tracker",
        "features": [
            {
                "feat_id": feat_id,
                "depends_on": sorted(deps_by_feat.get(feat_id, set()), key=feat_sort_key),
                "dependents": sorted(dependents_by_feat.get(feat_id, []), key=feat_sort_key),
                "layer": layer_by_feat.get(feat_id),
            }
            for feat_id in feat_ids
        ],
        "layers": [
            {
                "layer": i,
                "feat_ids": layer,
            }
            for i, layer in enumerate(layers)
        ],
        "notes": sorted(set(notes)),
    }


def cmd_replan_feats(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)

    states, tasks_by_feat = load_non_archived_feats(paths)

    clear_ids = {str(item).strip() for item in (args.clear_dependencies or []) if str(item).strip()}
    for feat_id in clear_ids:
        if not is_valid_feat_id(feat_id):
            eprint(f"error: invalid feat id in --clear-dependencies: {feat_id}")
            return 1
        if feat_id not in states:
            eprint(f"error: feat not found (non-archived): {feat_id}")
            return 1

    set_deps: dict[str, list[str]] = {}
    for raw in args.dependency or []:
        feat_id, deps = parse_dependency_spec(str(raw))
        if feat_id not in states:
            eprint(f"error: feat not found (non-archived): {feat_id}")
            return 1
        set_deps[feat_id] = deps

    changed_feats: set[str] = set()
    for feat_id in clear_ids:
        state = states[feat_id]
        if state.get("depends_on") != []:
            state["depends_on"] = []
            state.setdefault("history", []).append(
                history_event("dag_dependencies_updated", "depends_on=none")
            )
            changed_feats.add(feat_id)

    for feat_id, deps in set_deps.items():
        state = states[feat_id]
        if state.get("depends_on") != deps:
            state["depends_on"] = deps
            state.setdefault("history", []).append(
                history_event(
                    "dag_dependencies_updated",
                    "depends_on=" + (",".join(deps) if deps else "none"),
                )
            )
            changed_feats.add(feat_id)

    for feat_id in sorted(changed_feats, key=feat_sort_key):
        save_feat(paths, feat_id, states[feat_id], tasks_by_feat[feat_id])

    all_status_by_feat: dict[str, str] = {}
    for item in load_index(paths).get("features", []):
        fid = str(item.get("feat_id", ""))
        if fid:
            all_status_by_feat[fid] = str(item.get("status") or "")

    try:
        payload = build_dag_projection_payload(states, all_status_by_feat=all_status_by_feat)
    except SystemExit as exc:
        eprint(str(exc))
        return 1

    archived_path: Path | None = None
    if paths.dag_file.exists():
        archived_path = archive_existing_dag(paths, load_json(paths.dag_file))
    save_json(paths.dag_file, payload)

    print(f"write: {paths.dag_file}")
    if archived_path:
        print(f"archive: {archived_path}")
    print(f"feature_count: {len(payload.get('features', []))}")
    print(f"layer_count: {len(payload.get('layers', []))}")
    print(f"next: feature-tracker.sh show-feature-dag --root {root}")

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def cmd_show_feat_dag(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = HarnessPaths(root)
    ensure_harness_exists(paths)
    if not paths.dag_file.exists():
        eprint(f"error: dag file missing: {paths.dag_file}")
        eprint("hint: run feature-tracker.sh replan-features first")
        return 1

    payload = load_json(paths.dag_file)
    if not isinstance(payload, dict):
        eprint(f"error: invalid dag schema: {paths.dag_file}")
        return 1

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    print(f"dag_file: {paths.dag_file}")
    features = payload.get("features", [])
    layers = payload.get("layers", [])
    print(f"feature_count: {len(features) if isinstance(features, list) else 0}")
    print(f"layer_count: {len(layers) if isinstance(layers, list) else 0}")
    if not isinstance(layers, list) or not layers:
        print("layers: none")
    else:
        print("layers:")
        for layer in layers:
            if not isinstance(layer, dict):
                continue
            layer_id = layer.get("layer")
            feat_ids = layer.get("feat_ids", [])
            if not isinstance(feat_ids, list):
                feat_ids = []
            print(f"- L{layer_id}: {' '.join(str(fid) for fid in feat_ids)}")

    if isinstance(features, list) and features:
        print("features:")
        for feature in features:
            if not isinstance(feature, dict):
                continue
            feat_id = str(feature.get("feat_id", ""))
            depends_on = feature.get("depends_on", [])
            dependents = feature.get("dependents", [])
            if not isinstance(depends_on, list):
                depends_on = []
            if not isinstance(dependents, list):
                dependents = []
            layer = feature.get("layer")
            print(
                f"- {feat_id} | layer={layer} | depends_on={','.join(str(item) for item in depends_on) or 'none'} | "
                f"dependents={','.join(str(item) for item in dependents) or 'none'}"
            )

    notes = payload.get("notes", [])
    if isinstance(notes, list) and notes:
        print("notes:")
        for note in notes:
            print(f"- {note}")
    return 0


def query_list(paths: HarnessPaths) -> list[dict[str, Any]]:
    index_data = load_index(paths)
    out: list[dict[str, Any]] = []
    for item in index_data.get("features", []):
        feat_id = str(item.get("feat_id", ""))
        try:
            state, tasks = load_feat(paths, feat_id)
        except SystemExit:
            continue
        out.append(
            {
                "feat_id": feat_id,
                "title": state.get("title", ""),
                "status": state.get("status", ""),
                "workspace_mode": state.get("workspace_mode", ""),
                "branch": state.get("branch", ""),
                "worktree": state.get("worktree_path", ""),
                "task_stats": {
                    "todo": count_tasks(tasks, "todo"),
                    "in_progress": count_tasks(tasks, "in_progress"),
                    "done": count_tasks(tasks, "done"),
                    "blocked": count_tasks(tasks, "blocked"),
                },
            }
        )
    return out


def query_one(paths: HarnessPaths, feat_id: str) -> dict[str, Any]:
    state, tasks = load_feat(paths, feat_id)
    return {"state": state, "tasks": tasks}


def query_filter(
    paths: HarnessPaths,
    *,
    feat_status: str | None,
    task_status: str | None,
    contains: str | None,
) -> list[dict[str, Any]]:
    items = query_list(paths)
    out: list[dict[str, Any]] = []
    needle = contains.lower() if contains else None

    for item in items:
        if feat_status and item.get("status") != feat_status:
            continue
        if task_status and int(item.get("task_stats", {}).get(task_status, 0)) == 0:
            continue
        if needle:
            hay = (
                f"{item.get('feat_id','')} "
                f"{item.get('title','')} "
                f"{item.get('branch','')} "
                f"{item.get('workspace_mode','')}"
            ).lower()
            if needle not in hay:
                continue
        out.append(item)
    return out


def cmd_query_list(args: argparse.Namespace) -> int:
    paths = HarnessPaths(Path(args.root).resolve())
    ensure_harness_exists(paths)
    print(json.dumps({"features": query_list(paths)}, ensure_ascii=False, indent=2))
    return 0


def cmd_query_get(args: argparse.Namespace) -> int:
    paths = HarnessPaths(Path(args.root).resolve())
    ensure_harness_exists(paths)
    print(json.dumps(query_one(paths, args.feat), ensure_ascii=False, indent=2))
    return 0


def cmd_query_filter(args: argparse.Namespace) -> int:
    paths = HarnessPaths(Path(args.root).resolve())
    ensure_harness_exists(paths)
    print(
        json.dumps(
            {
                "features": query_filter(
                    paths,
                    feat_status=args.status,
                    task_status=args.task_status,
                    contains=args.contains,
                )
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="bagakit feature tracker")
    sub = p.add_subparsers(dest="cmd", required=True)

    def add_common(sp: argparse.ArgumentParser) -> None:
        sp.add_argument("--root", default=".")
        sp.add_argument("--skill-dir", default=str(Path(__file__).resolve().parent.parent))

    sp = sub.add_parser("check-reference-readiness", help="generate reference read report")
    add_common(sp)
    sp.add_argument("--manifest", default=None)
    sp.set_defaults(func=cmd_ref_read_gate)

    sp = sub.add_parser("validate-reference-report", help="validate strict ref-read report")
    add_common(sp)
    sp.add_argument("--manifest", default=None)
    sp.set_defaults(func=cmd_check_ref_report)

    sp = sub.add_parser("initialize-tracker", help="apply tracker files into project")
    add_common(sp)
    sp.add_argument("--manifest", default=None)
    sp.add_argument("--strict", dest="strict", action="store_true")
    sp.add_argument("--no-strict", dest="strict", action="store_false")
    sp.set_defaults(strict=True, func=cmd_apply)

    sp = sub.add_parser("rekey-local-issuer", help="rotate the local issuer namespace and git-local guard key")
    add_common(sp)
    sp.set_defaults(func=cmd_rekey_local_issuer)

    sp = sub.add_parser("materialize-feature-artifact", help="write an optional feature helper file from the canonical template")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--kind", choices=["proposal", "spec-delta", "verification"], required=True)
    sp.add_argument("--overwrite", action="store_true")
    sp.set_defaults(func=cmd_materialize_feature_artifact)

    sp = sub.add_parser("create-feature", help="create feature with explicit workspace mode")
    add_common(sp)
    sp.add_argument("--manifest", default=None)
    sp.add_argument("--strict", dest="strict", action="store_true")
    sp.add_argument("--no-strict", dest="strict", action="store_false")
    sp.add_argument("--title", required=True)
    sp.add_argument("--slug", default="")
    sp.add_argument("--goal", required=True)
    sp.add_argument("--workspace-mode", choices=sorted(WORKSPACE_MODES), default=None)
    sp.add_argument("--branch-prefix", default=None)
    sp.set_defaults(strict=True, func=cmd_feat_new)

    sp = sub.add_parser("assign-feature-workspace", help="assign current_tree/worktree to an existing feature")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--workspace-mode", choices=["current_tree", "worktree"], required=True)
    sp.add_argument("--branch-prefix", default=None)
    sp.set_defaults(func=cmd_assign_feat_workspace)

    sp = sub.add_parser("show-feature-status", help="show feature status")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", default=None)
    sp.add_argument("--json", action="store_true")
    sp.set_defaults(func=cmd_feat_status)

    sp = sub.add_parser("start-task", help="start a task")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--task", required=True)
    sp.set_defaults(func=cmd_task_start)

    sp = sub.add_parser("run-task-gate", help="execute gate checks")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--task", required=True)
    sp.set_defaults(func=cmd_task_gate)

    sp = sub.add_parser("prepare-task-commit", help="generate/validate structured commit message")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--task", required=True)
    sp.add_argument("--summary", required=True)
    sp.add_argument("--task-status", choices=["done", "blocked"], default="done")
    sp.add_argument("--message-out", default="")
    sp.add_argument("--execute", action="store_true")
    sp.set_defaults(func=cmd_task_commit)

    sp = sub.add_parser("finish-task", help="finish task with result")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--task", required=True)
    sp.add_argument("--result", choices=["done", "blocked"], required=True)
    sp.set_defaults(func=cmd_task_finish)

    sp = sub.add_parser("archive-feature", help="archive feature (move dir + cleanup worktree)")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.set_defaults(func=cmd_feat_archive)

    sp = sub.add_parser("discard-feature", help="discard feature and preserve reference artifacts")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.add_argument("--reason", choices=["stale", "superseded", "cancelled", "invalid"], required=True)
    sp.add_argument("--replacement", default="")
    sp.add_argument("--force", action="store_true")
    sp.set_defaults(func=cmd_feat_discard)

    sp = sub.add_parser("validate-tracker", help="validate tracker consistency")
    add_common(sp)
    sp.set_defaults(func=cmd_validate)

    sp = sub.add_parser("diagnose-tracker", help="run doctor checks")
    add_common(sp)
    sp.set_defaults(func=cmd_doctor)

    sp = sub.add_parser("replan-features", help="recompute feature dependency projection and archive previous DAG")
    add_common(sp)
    sp.add_argument(
        "--dependency",
        action="append",
        default=[],
        help="dependency override in '<feature-id>:<dep1>,<dep2>' format",
    )
    sp.add_argument("--clear-dependencies", action="append", default=[])
    sp.add_argument("--json", action="store_true")
    sp.set_defaults(func=cmd_replan_feats)

    sp = sub.add_parser("show-feature-dag", help="show current feature DAG")
    add_common(sp)
    sp.add_argument("--json", action="store_true")
    sp.set_defaults(func=cmd_show_feat_dag)

    sp = sub.add_parser("list-features", help="query features list")
    add_common(sp)
    sp.set_defaults(func=cmd_query_list)

    sp = sub.add_parser("get-feature", help="query one feature")
    add_common(sp)
    sp.add_argument("--feature", dest="feat", required=True)
    sp.set_defaults(func=cmd_query_get)

    sp = sub.add_parser("filter-features", help="query features with filters")
    add_common(sp)
    sp.add_argument("--status", default=None)
    sp.add_argument("--task-status", choices=["todo", "in_progress", "done", "blocked"], default=None)
    sp.add_argument("--contains", default=None)
    sp.set_defaults(func=cmd_query_filter)

    return p


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
