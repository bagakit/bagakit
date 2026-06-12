#!/usr/bin/env python3
"""Manage one semantic Pageville host through the loopback_v0 adapter."""

from __future__ import annotations

import argparse
import fcntl
import html
import json
import mimetypes
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import shutil
import signal
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlsplit
from urllib.request import Request, urlopen


SCHEMA_VERSION = 1
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
VERSION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
RESERVED_SLUGS = {"api", "pages", "__pageville"}


class PagevilleError(RuntimeError):
    """A user-actionable pageville error."""


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def die(message: str) -> "NoReturn":
    raise PagevilleError(message)


def normalize_slug(value: str) -> str:
    raw = re.sub(r"[_\s]+", "-", str(value or "").strip().lower())
    raw = re.sub(r"[^a-z0-9-]+", "-", raw)
    raw = re.sub(r"-+", "-", raw).strip("-")
    if not raw or not SLUG_RE.fullmatch(raw) or raw in RESERVED_SLUGS:
        die("slug must be a non-empty semantic id using lowercase letters, digits, and hyphens")
    return raw


def validate_version(value: str) -> str:
    version = str(value or "").strip()
    if not VERSION_RE.fullmatch(version) or version in {"latest", ".", ".."}:
        die("version must be a semantic token using letters, digits, dots, underscores, or hyphens")
    return version


def safe_text(value: str, field: str, *, required: bool = False, limit: int = 400) -> str:
    text = str(value or "").strip()
    if required and not text:
        die(f"{field} is required")
    if "\n" in text or "\r" in text:
        die(f"{field} must be a single line")
    if len(text) > limit:
        die(f"{field} is too long (max {limit} characters)")
    return text


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    try:
        tmp.write_text(content, encoding="utf-8")
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()


def atomic_json(path: Path, value: object) -> None:
    atomic_write(path, json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


class State:
    def __init__(self, root: str) -> None:
        self.project_root = Path(root).expanduser().resolve()
        self.surface = self.project_root / ".bagakit" / "pageville"
        self.registry_path = self.surface / "registry.json"
        self.server_path = self.surface / "server.json"
        self.lock_path = self.surface / "state.lock"
        self.pages_path = self.surface / "pages"
        self.log_path = self.surface / "server.log"

    def require_initialized(self) -> None:
        if not self.registry_path.is_file():
            die("page host is not initialized; run init --root <project>")

    def ensure_initialized(self) -> None:
        self.surface.mkdir(parents=True, exist_ok=True)
        self.pages_path.mkdir(parents=True, exist_ok=True)
        if not self.registry_path.exists():
            atomic_json(self.registry_path, {"schema_version": SCHEMA_VERSION, "pages": {}})
        marker = self.surface / "surface.toml"
        if not marker.exists():
            atomic_write(
                marker,
                "\n".join(
                    [
                        "schema_version = 1",
                        'surface_id = "pageville-runtime"',
                        'surface_root = ".bagakit/pageville"',
                        'owner_kind = "tool"',
                        'owner_id = "bagakit-pageville"',
                        'lifecycle_class = "runtime"',
                        'edit_policy = "mixed"',
                        "cleanup_safe = true",
                        'source_of_truth = ["skills/co-work/deliver/bagakit-pageville/SKILL.md", "skills/co-work/deliver/bagakit-pageville/references/pageville-contract.toml"]',
                        'reviewable_outputs = ["pages/<slug>/versions/<version>/manifest.json", "pages/<slug>/versions/<version>/annotations.jsonl"]',
                        "",
                    ]
                ),
            )

    def read_registry(self) -> dict:
        self.require_initialized()
        try:
            data = json.loads(self.registry_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            die(f"cannot read page registry: {exc}")
        if not isinstance(data, dict) or data.get("schema_version") != SCHEMA_VERSION:
            die("page registry has an unsupported schema version")
        pages = data.get("pages")
        if not isinstance(pages, dict):
            die("page registry pages must be an object")
        return data

    def read_server(self) -> dict | None:
        try:
            data = json.loads(self.server_path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return None
        except (OSError, json.JSONDecodeError) as exc:
            die(f"cannot read server metadata: {exc}")
        if not isinstance(data, dict):
            die("server metadata is invalid")
        return data


@contextmanager
def state_lock(state: State):
    state.surface.mkdir(parents=True, exist_ok=True)
    with state.lock_path.open("a+", encoding="utf-8") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def print_result(value: object, as_json: bool = False) -> None:
    if as_json:
        print(json.dumps(value, ensure_ascii=False, indent=2))
        return
    if isinstance(value, str):
        print(value)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(item, (dict, list)):
                print(f"{key}: {json.dumps(item, ensure_ascii=False)}")
            else:
                print(f"{key}: {item}")
        return
    print(value)


def page_dir(state: State, slug: str, version: str) -> Path:
    path = state.pages_path / slug / "versions" / version
    resolved = path.resolve()
    if not is_relative_to(resolved, state.pages_path.resolve()):
        die("page path escapes the page host store")
    return path


def load_page_record(state: State, slug: str) -> dict:
    data = state.read_registry()
    record = data["pages"].get(slug)
    if not isinstance(record, dict):
        die(f"unknown page slug: {slug}")
    return record


def resolve_version(record: dict, requested: str | None) -> str:
    versions = record.get("versions")
    if not isinstance(versions, list):
        die("page registry version list is invalid")
    requested_value = str(requested or "latest").strip()
    if requested_value == "latest":
        latest = record.get("latest_version")
        if not isinstance(latest, str) or not latest:
            die("page has no latest version")
        return latest
    version = validate_version(requested_value)
    if not any(isinstance(item, dict) and item.get("version") == version for item in versions):
        die(f"unknown version {version} for page {record.get('slug', '')}")
    return version


def read_manifest(state: State, slug: str, requested: str | None) -> tuple[dict, Path, str]:
    record = load_page_record(state, slug)
    version = resolve_version(record, requested)
    directory = page_dir(state, slug, version)
    manifest_path = directory / "manifest.json"
    if not manifest_path.is_file():
        die(f"manifest missing for page {slug} version {version}")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        die(f"cannot read page manifest: {exc}")
    if not isinstance(manifest, dict):
        die("page manifest must be an object")
    return manifest, directory, version


def page_url(server: dict, slug: str, version: str = "latest") -> str:
    return f"http://127.0.0.1:{int(server['port'])}/pages/{slug}/{version}/"


def server_health(state: State, server: dict | None = None) -> bool:
    info = server or state.read_server()
    if not info:
        return False
    try:
        port = int(info["port"])
        token = str(info["token"])
        request = Request(
            f"http://127.0.0.1:{port}/__pageville/health",
            headers={"X-Pageville-Token": token},
        )
        with urlopen(request, timeout=0.8) as response:
            body = json.loads(response.read().decode("utf-8"))
        return (
            isinstance(body, dict)
            and body.get("service") == "bagakit-pageville"
            and body.get("authorized") is True
        )
    except (KeyError, ValueError, OSError, HTTPError, URLError, json.JSONDecodeError):
        return False


def process_alive(pid_value: object) -> bool:
    try:
        pid = int(pid_value)
        if pid <= 0:
            return False
        os.kill(pid, 0)
        return True
    except (TypeError, ValueError, OSError):
        return False


def server_snapshot(state: State) -> dict:
    info = state.read_server()
    if not info:
        return {"state": "stopped", "port": None, "pid": None}
    healthy = server_health(state, info)
    return {
        "state": "running" if healthy else "stale",
        "port": info.get("port"),
        "pid": info.get("pid"),
        "started_at": info.get("started_at"),
    }


def cmd_init(args: argparse.Namespace) -> int:
    state = State(args.root)
    with state_lock(state):
        state.ensure_initialized()
    print_result({"surface": ".bagakit/pageville", "registry": "registry.json"}, args.json)
    return 0


def cmd_start(args: argparse.Namespace) -> int:
    state = State(args.root)
    state.ensure_initialized()
    with state_lock(state):
        existing = state.read_server()
        if existing and server_health(state, existing):
            print_result(
                {"state": "running", "port": existing["port"], "pid": existing["pid"], "url": f"http://127.0.0.1:{existing['port']}/"},
                args.json,
            )
            return 0
        if existing and process_alive(existing.get("pid")):
            die("page host metadata is stale but its process is still alive; inspect status or stop it after recovery")
        if existing:
            state.server_path.unlink(missing_ok=True)
        token = secrets.token_urlsafe(24)
        command = [
            sys.executable,
            str(Path(__file__).resolve()),
            "serve-loop",
            "--root",
            str(state.project_root),
            "--port",
            str(max(0, int(args.port))),
            "--token",
            token,
        ]
        state.log_path.parent.mkdir(parents=True, exist_ok=True)
        log_handle = state.log_path.open("ab")
        try:
            process = subprocess.Popen(
                command,
                stdin=subprocess.DEVNULL,
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        finally:
            log_handle.close()
        for _ in range(40):
            info = state.read_server()
            if info and info.get("pid") == process.pid and server_health(state, info):
                print_result(
                    {"state": "running", "port": info["port"], "pid": info["pid"], "url": f"http://127.0.0.1:{info['port']}/"},
                    args.json,
                )
                return 0
            if process.poll() is not None:
                break
            time.sleep(0.075)
        die("page host failed to start; inspect .bagakit/pageville/server.log")
    return 0


def cmd_stop(args: argparse.Namespace) -> int:
    state = State(args.root)
    state.require_initialized()
    with state_lock(state):
        info = state.read_server()
        if not info:
            print_result({"state": "stopped"}, args.json)
            return 0
        if server_health(state, info):
            try:
                request = Request(
                    f"http://127.0.0.1:{int(info['port'])}/__pageville/shutdown",
                    method="POST",
                    headers={"X-Pageville-Token": str(info["token"])},
                )
                with urlopen(request, timeout=1.5):
                    pass
            except (OSError, HTTPError, URLError):
                pass
            for _ in range(30):
                if not state.server_path.exists():
                    break
                time.sleep(0.1)
        if state.server_path.exists() and process_alive(info.get("pid")):
            die("page host is not healthy but its process is still alive; do not start another host on the same root")
        if state.server_path.exists():
            state.server_path.unlink(missing_ok=True)
        print_result({"state": "stopped", "pid": info.get("pid")}, args.json)
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    state = State(args.root)
    state.require_initialized()
    registry = state.read_registry()
    pages = list(registry["pages"].values())
    active = [item for item in pages if item.get("status") == "active"]
    result = {
        **server_snapshot(state),
        "pages": len(pages),
        "active_pages": len(active),
        "surface": ".bagakit/pageville",
    }
    print_result(result, args.json)
    return 0


def next_version(record: dict) -> str:
    values: list[int] = []
    for item in record.get("versions", []):
        if isinstance(item, dict):
            match = re.fullmatch(r"v(\d+)", str(item.get("version", "")))
            if match:
                values.append(int(match.group(1)))
    return f"v{max(values, default=0) + 1}"


def copy_source(source: Path, destination: Path) -> str:
    if not source.exists():
        die(f"source does not exist: {source}")
    destination.mkdir(parents=True, exist_ok=False)
    if source.is_file():
        shutil.copy2(source, destination / "index.html")
        return source.name
    if not source.is_dir():
        die("source must be an HTML file or directory")
    source_root = source.resolve()
    for child in source.iterdir():
        if not is_relative_to(child.resolve(), source_root):
            die("source directory contains a symlink outside the selected source")
        target = destination / child.name
        if child.is_dir():
            shutil.copytree(child, target, symlinks=False)
        elif child.is_file():
            shutil.copy2(child, target)
    if not (destination / "index.html").is_file():
        die("source directory must contain index.html")
    return source.name


def cmd_publish(args: argparse.Namespace) -> int:
    state = State(args.root)
    state.require_initialized()
    slug = normalize_slug(args.slug)
    title = safe_text(args.title or slug, "title", required=True)
    kind = safe_text(args.kind or "other", "kind", required=True, limit=80)
    owner = safe_text(args.owner or "unknown", "owner", required=True, limit=120)
    source_ref = safe_text(args.source_ref or Path(args.source).name, "source_ref", required=True, limit=240)
    if Path(source_ref).is_absolute():
        die("source_ref must be logical or repo-relative, not an absolute path")
    source = Path(args.source).expanduser().resolve()
    tags = []
    for item in args.tags or []:
        tag = safe_text(item, "tag", limit=40)
        if tag:
            tags.append(tag)
    with state_lock(state):
        registry = state.read_registry()
        record = registry["pages"].get(slug)
        if not isinstance(record, dict):
            record = {
                "page_id": slug,
                "slug": slug,
                "title": title,
                "kind": kind,
                "owner": owner,
                "status": "active",
                "created_at": now_utc(),
                "updated_at": now_utc(),
                "latest_version": None,
                "versions": [],
            }
            registry["pages"][slug] = record
        version = validate_version(args.version) if args.version else next_version(record)
        if any(isinstance(item, dict) and item.get("version") == version for item in record["versions"]):
            die(f"version already exists: {slug}/{version}; publish a new version")
        final_dir = page_dir(state, slug, version)
        final_dir.parent.mkdir(parents=True, exist_ok=True)
        staging = final_dir.with_name(f".{version}.publishing-{os.getpid()}")
        if staging.exists():
            shutil.rmtree(staging)
        try:
            source_name = copy_source(source, staging)
        except PagevilleError:
            shutil.rmtree(staging, ignore_errors=True)
            raise
        payload_ref = None
        if args.payload:
            payload_path = Path(args.payload).expanduser().resolve()
            try:
                payload = json.loads(payload_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                shutil.rmtree(staging, ignore_errors=True)
                die(f"payload must be valid JSON: {exc}")
            atomic_json(staging / "payload.json", payload)
            payload_ref = "payload.json"
        manifest = {
            "schema_version": SCHEMA_VERSION,
            "page_id": slug,
            "slug": slug,
            "title": title,
            "kind": kind,
            "owner": owner,
            "version": version,
            "entrypoint": "index.html",
            "source_name": source_name,
            "source_ref": source_ref,
            "tags": tags,
            "published_at": now_utc(),
            "payload_ref": payload_ref,
        }
        atomic_json(staging / "manifest.json", manifest)
        (staging / "annotations.jsonl").touch()
        os.replace(staging, final_dir)
        record.update({"title": title, "kind": kind, "owner": owner, "status": "active", "updated_at": now_utc(), "latest_version": version})
        record["versions"].append({"version": version, "published_at": manifest["published_at"], "entrypoint": "index.html", "source_name": source_name, "payload_ref": payload_ref})
        atomic_json(state.registry_path, registry)
    server = state.read_server()
    result = {"page_id": slug, "version": version, "status": "active", "source_name": source_name, "managed_link": page_url(server, slug, version) if server and server_health(state, server) else None, "latest_link": page_url(server, slug, "latest") if server and server_health(state, server) else None}
    print_result(result, args.json)
    return 0


def cmd_link(args: argparse.Namespace) -> int:
    state = State(args.root)
    state.require_initialized()
    slug = normalize_slug(args.slug)
    record = load_page_record(state, slug)
    version = resolve_version(record, args.version)
    server = state.read_server()
    if not server or not server_health(state, server):
        die("page host is not running; run start --root <project>")
    result = {"page_id": slug, "version": version, "url": page_url(server, slug, version)}
    print_result(result, args.json)
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    state = State(args.root)
    state.require_initialized()
    registry = state.read_registry()
    rows = []
    server = state.read_server()
    healthy = bool(server and server_health(state, server))
    for slug, record in sorted(registry["pages"].items()):
        rows.append({"page_id": slug, "title": record.get("title"), "kind": record.get("kind"), "owner": record.get("owner"), "status": record.get("status"), "latest_version": record.get("latest_version"), "url": page_url(server, slug, "latest") if healthy else None})
    print_result(rows, args.json)
    return 0


def annotations_for(directory: Path) -> list[dict]:
    path = directory / "annotations.jsonl"
    if not path.exists():
        return []
    records = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            records.append(value)
    return records


def cmd_get(args: argparse.Namespace) -> int:
    state = State(args.root)
    state.require_initialized()
    slug = normalize_slug(args.slug)
    manifest, directory, version = read_manifest(state, slug, args.version)
    result = {"manifest": manifest, "annotations": annotations_for(directory)}
    print_result(result, args.json)
    return 0


def cmd_versions(args: argparse.Namespace) -> int:
    state = State(args.root)
    state.require_initialized()
    slug = normalize_slug(args.slug)
    record = load_page_record(state, slug)
    rows = []
    for item in record.get("versions", []):
        if isinstance(item, dict):
            rows.append({**item, "url": (page_url(state.read_server(), slug, str(item["version"])) if state.read_server() and server_health(state, state.read_server()) else None)})
    print_result(rows, args.json)
    return 0


def cmd_fetch(args: argparse.Namespace) -> int:
    state = State(args.root)
    state.require_initialized()
    slug = normalize_slug(args.slug)
    manifest, directory, version = read_manifest(state, slug, args.version)
    payload = None
    payload_ref = manifest.get("payload_ref")
    if payload_ref:
        payload_path = directory / str(payload_ref)
        try:
            payload = json.loads(payload_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            die(f"cannot read page payload: {exc}")
    result = {"page_id": slug, "version": version, "manifest": manifest, "payload": payload, "annotations": annotations_for(directory)}
    print_result(result, args.json)
    return 0


def cmd_annotate(args: argparse.Namespace) -> int:
    state = State(args.root)
    state.require_initialized()
    slug = normalize_slug(args.slug)
    label = safe_text(args.label, "label", limit=120)
    note = safe_text(args.note, "note", limit=2000)
    if not label and not note:
        die("annotation requires --label or --note")
    author = safe_text(args.author or "human", "author", limit=120)
    anchor = safe_text(args.anchor, "anchor", limit=240)
    with state_lock(state):
        _manifest, directory, version = read_manifest(state, slug, args.version)
        existing = annotations_for(directory)
        annotation_id = f"a{len(existing) + 1}"
        record = {"annotation_id": annotation_id, "page_id": slug, "version": version, "author": author, "created_at": now_utc()}
        if anchor:
            record["anchor"] = anchor
        if label:
            record["label"] = label
        if note:
            record["note"] = note
        with (directory / "annotations.jsonl").open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    print_result(record, args.json)
    return 0


def cmd_archive(args: argparse.Namespace) -> int:
    state = State(args.root)
    state.require_initialized()
    slug = normalize_slug(args.slug)
    with state_lock(state):
        registry = state.read_registry()
        record = registry["pages"].get(slug)
        if not isinstance(record, dict):
            die(f"unknown page slug: {slug}")
        record["status"] = "archived"
        record["updated_at"] = now_utc()
        atomic_json(state.registry_path, registry)
    print_result({"page_id": slug, "status": "archived", "versions_retained": len(record.get("versions", []))}, args.json)
    return 0


class PagevilleHandler(BaseHTTPRequestHandler):
    server_version = "BagakitPageville/1"

    @property
    def state(self) -> State:
        return self.server.page_state  # type: ignore[attr-defined]

    @property
    def token(self) -> str:
        return self.server.page_token  # type: ignore[attr-defined]

    def authorized(self) -> bool:
        return self.headers.get("X-Pageville-Token", "") == self.token

    def json_response(self, value: object, status: int = 200) -> None:
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def text_response(self, body: str, status: int = 200, content_type: str = "text/plain; charset=utf-8") -> None:
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlsplit(self.path)
        path = unquote(parsed.path)
        if path == "/__pageville/health":
            self.json_response({"service": "bagakit-pageville", "protocol": 1, "authorized": self.authorized()})
            return
        if path == "/api/pages":
            self.json_response(self.state.read_registry())
            return
        if path.startswith("/api/pages/"):
            self.serve_api_page(path)
            return
        if path == "/" or path == "/index.html":
            self.serve_index()
            return
        if path.startswith("/pages/"):
            self.serve_page(path)
            return
        self.send_error(404)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlsplit(self.path)
        if parsed.path == "/__pageville/shutdown":
            if not self.authorized():
                self.json_response({"error": "forbidden"}, 403)
                return
            self.json_response({"state": "stopping"})
            threading.Thread(target=self.server.shutdown, daemon=True).start()  # type: ignore[attr-defined]
            return
        self.send_error(404)

    def serve_index(self) -> None:
        registry = self.state.read_registry()
        rows = []
        for slug, record in sorted(registry["pages"].items()):
            if not isinstance(record, dict):
                continue
            status = str(record.get("status", "active"))
            if status == "archived":
                continue
            rows.append(
                f'<li><a href="/pages/{html.escape(slug)}/latest/">{html.escape(str(record.get("title") or slug))}</a>'
                f' <small>{html.escape(str(record.get("kind") or "other"))} · {html.escape(str(record.get("latest_version") or "-"))}</small></li>'
            )
        body = "<!doctype html><meta charset='utf-8'><title>Bagakit Pageville</title><h1>Managed pages</h1><ul>" + "".join(rows) + "</ul>"
        self.text_response(body, content_type="text/html; charset=utf-8")

    def serve_api_page(self, path: str) -> None:
        parts = [item for item in PurePosixPath(path).parts if item not in {"/", "api", "pages"}]
        if not parts or len(parts) > 2:
            self.send_error(404)
            return
        try:
            slug = normalize_slug(parts[0])
            version = parts[1] if len(parts) == 2 else "latest"
            manifest, directory, resolved = read_manifest(self.state, slug, version)
            self.json_response({"manifest": manifest, "version": resolved, "payload": self.payload(directory, manifest), "annotations": annotations_for(directory)})
        except PagevilleError as exc:
            self.json_response({"error": str(exc)}, 404)

    def payload(self, directory: Path, manifest: dict) -> object:
        payload_ref = manifest.get("payload_ref")
        if not payload_ref:
            return None
        try:
            return json.loads((directory / str(payload_ref)).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None

    def serve_page(self, path: str) -> None:
        parts = [item for item in PurePosixPath(path).parts if item not in {"/", "pages"}]
        if len(parts) < 2:
            self.send_error(404)
            return
        try:
            slug = normalize_slug(parts[0])
            requested = parts[1]
            record = load_page_record(self.state, slug)
            version = resolve_version(record, requested)
            directory = page_dir(self.state, slug, version).resolve()
            relative = PurePosixPath(*parts[2:]) if len(parts) > 2 else PurePosixPath("index.html")
            target = (directory / Path(str(relative))).resolve()
            if not is_relative_to(target, directory) or not target.is_file():
                self.send_error(404)
                return
            content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            data = target.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except PagevilleError:
            self.send_error(404)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def cmd_serve_loop(args: argparse.Namespace) -> int:
    state = State(args.root)
    state.ensure_initialized()
    token = safe_text(args.token, "token", required=True, limit=200)
    server = ThreadingHTTPServer(("127.0.0.1", max(0, int(args.port))), PagevilleHandler)
    server.page_state = state  # type: ignore[attr-defined]
    server.page_token = token  # type: ignore[attr-defined]
    info = {"schema_version": SCHEMA_VERSION, "protocol": 1, "pid": os.getpid(), "port": server.server_port, "token": token, "started_at": now_utc()}
    atomic_json(state.server_path, info)

    def stop_handler(_signum: int, _frame: object) -> None:
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, stop_handler)
    try:
        server.serve_forever(poll_interval=0.2)
    finally:
        server.server_close()
        try:
            current = state.read_server()
            if current and current.get("pid") == os.getpid():
                state.server_path.unlink(missing_ok=True)
        except PagevilleError:
            pass
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage one semantic loopback host for local pages")
    sub = parser.add_subparsers(dest="command", required=True)

    def common(command: str, help_text: str) -> argparse.ArgumentParser:
        child = sub.add_parser(command, help=help_text)
        child.add_argument("--root", default=".", help="project root")
        child.add_argument("--json", action="store_true", help="emit JSON")
        return child

    common("init", "initialize the pageville runtime surface")
    start = common("start", "start or reuse one loopback host")
    start.add_argument("--port", type=int, default=0, help="preferred port, 0 chooses an available port")
    common("stop", "stop the verified page host")
    common("status", "show host health and page counts")
    publish = common("publish", "publish a new immutable page version")
    publish.add_argument("--slug", required=True)
    publish.add_argument("--source", required=True)
    publish.add_argument("--title")
    publish.add_argument("--kind", default="other")
    publish.add_argument("--owner", default="unknown")
    publish.add_argument("--version")
    publish.add_argument("--source-ref")
    publish.add_argument("--payload")
    publish.add_argument("--tags", action="append")
    link = common("link", "resolve a semantic page link")
    link.add_argument("--slug", required=True)
    link.add_argument("--version", default="latest")
    common("list", "list registered pages")
    get = common("get", "read one page manifest and annotations")
    get.add_argument("--slug", required=True)
    get.add_argument("--version", default="latest")
    versions = common("versions", "list retained page versions")
    versions.add_argument("--slug", required=True)
    fetch = common("fetch", "return page data and annotations")
    fetch.add_argument("--slug", required=True)
    fetch.add_argument("--version", default="latest")
    annotate = common("annotate", "append a human annotation")
    annotate.add_argument("--slug", required=True)
    annotate.add_argument("--version", default="latest")
    annotate.add_argument("--anchor")
    annotate.add_argument("--label")
    annotate.add_argument("--note")
    annotate.add_argument("--author", default="human")
    archive = common("archive", "archive a page while retaining versions")
    archive.add_argument("--slug", required=True)

    loop = sub.add_parser("serve-loop", help=argparse.SUPPRESS)
    loop.add_argument("--root", required=True)
    loop.add_argument("--port", type=int, default=0)
    loop.add_argument("--token", required=True)
    return parser


COMMANDS = {
    "init": cmd_init,
    "start": cmd_start,
    "stop": cmd_stop,
    "status": cmd_status,
    "publish": cmd_publish,
    "link": cmd_link,
    "list": cmd_list,
    "get": cmd_get,
    "versions": cmd_versions,
    "fetch": cmd_fetch,
    "annotate": cmd_annotate,
    "archive": cmd_archive,
    "serve-loop": cmd_serve_loop,
}


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return COMMANDS[args.command](args)
    except PagevilleError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
