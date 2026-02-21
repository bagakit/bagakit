#!/usr/bin/env python3
"""Build a static GitHub Pages site from markdown files in blogs/."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import re
import shutil
from pathlib import Path

try:
    import markdown  # type: ignore
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: python-markdown. Install with: python3 -m pip install markdown"
    ) from exc


DATE_SLUG_RE = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})-(?P<slug>.+)$")

STYLE_CSS = """
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Mono:wght@400;500&display=swap");

:root {
  color-scheme: light;
  --bg: #f2f4ef;
  --bg-soft: #f8faf5;
  --ink: #171a17;
  --muted: #5d645f;
  --line: #d6dbd3;
  --panel: rgba(255, 255, 255, 0.76);
  --accent: #1b8a72;
  --accent-strong: #126754;
  --signal: #ef8f45;
  --shadow: 0 14px 44px rgba(24, 40, 31, 0.1);
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --bg: #111511;
    --bg-soft: #171c17;
    --ink: #eff6ef;
    --muted: #b6c0b7;
    --line: #2a342c;
    --panel: rgba(25, 31, 25, 0.8);
    --accent: #5fd0b6;
    --accent-strong: #7de1c9;
    --signal: #f6b479;
    --shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
  }
}
* { box-sizing: border-box; }
html, body { min-height: 100%; }
body {
  margin: 0;
  color: var(--ink);
  font-family: "Source Serif 4", "Iowan Old Style", "Palatino Linotype", serif;
  background:
    radial-gradient(1200px 640px at 12% -12%, rgba(27, 138, 114, 0.2), transparent 52%),
    radial-gradient(900px 540px at 104% 8%, rgba(239, 143, 69, 0.18), transparent 48%),
    linear-gradient(180deg, var(--bg-soft) 0%, var(--bg) 100%);
}
a {
  color: var(--accent-strong);
  text-underline-offset: 2px;
  transition: color 160ms ease;
}
a:hover { color: var(--signal); }
.container {
  width: min(1100px, 92vw);
  margin: 0 auto;
  padding: 2.8rem 0 3.6rem;
}
.hero {
  position: relative;
  margin-bottom: 2rem;
  padding: 1.3rem 1.35rem 1.5rem;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: var(--panel);
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
}
.hero::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 22px;
  pointer-events: none;
  border: 1px solid color-mix(in oklab, var(--accent) 24%, transparent);
  mask: linear-gradient(#000, #000) content-box, linear-gradient(#000, #000);
  mask-composite: exclude;
  padding: 1px;
}
.hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  margin-bottom: .65rem;
  padding: .25rem .6rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--muted);
  font-family: "Space Grotesk", ui-sans-serif, sans-serif;
  font-size: .72rem;
  font-weight: 500;
  letter-spacing: .06em;
  text-transform: uppercase;
}
.hero-kicker::before {
  content: "";
  width: .45rem;
  height: .45rem;
  border-radius: 50%;
  background: linear-gradient(120deg, var(--accent), var(--signal));
}
.hero h1 {
  margin: 0 0 .5rem;
  font-family: "Space Grotesk", ui-sans-serif, sans-serif;
  font-size: clamp(1.9rem, 3.5vw, 3rem);
  line-height: 1.08;
  letter-spacing: -.02em;
}
.hero p {
  margin: 0;
  max-width: 64ch;
  color: var(--muted);
  font-size: 1.05rem;
  line-height: 1.6;
}
.hero-meta {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: .7rem;
}
.hero-chip {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: .2rem .62rem;
  color: var(--muted);
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: .76rem;
}
.post-list {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.post-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 188px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background:
    linear-gradient(140deg, color-mix(in oklab, var(--panel) 95%, white) 0%, var(--panel) 100%);
  box-shadow: var(--shadow);
  padding: 1.05rem 1.05rem 1rem;
  text-decoration: none;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}
.post-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in oklab, var(--accent) 42%, var(--line));
  box-shadow: 0 20px 44px rgba(20, 42, 30, 0.18);
}
.post-card h2 {
  margin: 0 0 .35rem;
  font-family: "Space Grotesk", ui-sans-serif, sans-serif;
  font-size: clamp(1.08rem, 2vw, 1.28rem);
  line-height: 1.28;
  color: var(--ink);
}
.post-meta {
  color: var(--muted);
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: .77rem;
  margin-bottom: .55rem;
}
.post-excerpt {
  color: color-mix(in oklab, var(--ink) 72%, var(--muted));
  margin: 0;
  line-height: 1.6;
}
.post-read {
  margin-top: .9rem;
  color: var(--accent);
  font-family: "Space Grotesk", ui-sans-serif, sans-serif;
  font-size: .84rem;
  font-weight: 500;
}
.article-shell {
  border: 1px solid var(--line);
  border-radius: 22px;
  background: var(--panel);
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
  overflow: hidden;
}
.topbar {
  padding: .88rem 1.08rem;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  display: flex;
  flex-wrap: wrap;
  gap: .8rem;
  align-items: center;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: .8rem;
}
.topbar a { color: var(--accent-strong); }
.article {
  padding: 1.3rem 1.2rem 1.55rem;
  font-size: 1.02rem;
}
.article h1, .article h2, .article h3, .article h4 {
  font-family: "Space Grotesk", ui-sans-serif, sans-serif;
  line-height: 1.2;
  letter-spacing: -.01em;
}
.article h1 { font-size: clamp(1.7rem, 3vw, 2.4rem); margin-top: 0; }
.article h2 {
  font-size: clamp(1.2rem, 2.3vw, 1.62rem);
  border-top: 1px solid var(--line);
  padding-top: 1rem;
  margin-top: 1.4rem;
}
.article h3 { font-size: 1.1rem; margin-top: 1.2rem; }
.article p, .article li { line-height: 1.76; }
.article blockquote {
  margin: 1.15rem 0;
  padding: .25rem .9rem;
  border-left: 3px solid var(--signal);
  color: color-mix(in oklab, var(--ink) 75%, var(--muted));
}
.article code {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: .9em;
  background: color-mix(in oklab, var(--bg-soft) 85%, var(--line));
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: .08em .36em;
}
.article pre {
  overflow: auto;
  border-radius: 12px;
  padding: .85rem;
  border: 1px solid var(--line);
  background: color-mix(in oklab, var(--bg-soft) 90%, var(--line));
}
.article pre code {
  border: 0;
  padding: 0;
  background: transparent;
}
.article table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: .95rem;
}
.article th, .article td {
  border: 1px solid var(--line);
  padding: .52rem .55rem;
  text-align: left;
}
.article th {
  font-family: "Space Grotesk", ui-sans-serif, sans-serif;
  background: color-mix(in oklab, var(--bg-soft) 88%, var(--line));
}
footer {
  margin-top: 2rem;
  color: var(--muted);
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: .8rem;
}
.fade-rise {
  animation: fadeRise 560ms cubic-bezier(.17,.67,.34,.99) both;
}
.post-card:nth-child(2) { animation-delay: 70ms; }
.post-card:nth-child(3) { animation-delay: 130ms; }
.post-card:nth-child(4) { animation-delay: 180ms; }
@keyframes fadeRise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 900px) {
  .post-list { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .container { width: min(700px, 94vw); padding: 1.3rem 0 2.3rem; }
  .hero { padding: 1rem .95rem 1.1rem; }
  .article { padding: 1.05rem .9rem 1.2rem; }
  .topbar { padding: .75rem .9rem; }
}
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        default="blogs",
        help="Directory with markdown blog files",
    )
    parser.add_argument(
        "--output",
        default="site",
        help="Output directory for generated static files",
    )
    parser.add_argument(
        "--repo-url",
        default="",
        help="GitHub repository URL used for source links (optional)",
    )
    parser.add_argument(
        "--default-branch",
        default="main",
        help="Branch name for source links",
    )
    return parser.parse_args()


def extract_title(markdown_text: str, fallback_slug: str) -> str:
    for line in markdown_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback_slug.replace("-", " ")


def extract_excerpt(markdown_text: str) -> str:
    for line in markdown_text.splitlines():
        stripped = line.strip()
        if (
            not stripped
            or stripped.startswith("#")
            or stripped.startswith(">")
            or stripped.startswith("```")
            or stripped.startswith("- ")
            or re.match(r"^\d+\.\s", stripped)
        ):
            continue
        plain = re.sub(r"[`*_#>]+", "", stripped).strip()
        if plain:
            return plain[:180]
    return ""


def normalize_slug(raw_slug: str, stable_key: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", raw_slug).strip("-").lower()
    if slug:
        return slug
    short = hashlib.sha1(stable_key.encode("utf-8")).hexdigest()[:8]
    return f"post-{short}"


def parse_post_date(stem: str, fallback_ts: float) -> tuple[str, str]:
    match = DATE_SLUG_RE.match(stem)
    if match:
        return match.group("date"), match.group("slug")
    return dt.date.fromtimestamp(fallback_ts).isoformat(), stem


def load_posts(input_dir: Path, repo_url: str, default_branch: str) -> list[dict[str, str]]:
    posts: list[dict[str, str]] = []
    for md_path in sorted(input_dir.glob("*.md")):
        text = md_path.read_text(encoding="utf-8")
        date_text, raw_slug = parse_post_date(md_path.stem, md_path.stat().st_mtime)
        slug = normalize_slug(raw_slug, md_path.name)
        title = extract_title(text, raw_slug)
        excerpt = extract_excerpt(text)
        article_html = markdown.markdown(
            text,
            extensions=[
                "fenced_code",
                "tables",
                "toc",
                "sane_lists",
                "nl2br",
            ],
        )
        source_link = ""
        if repo_url:
            source_rel = md_path.relative_to(input_dir).as_posix()
            source_path = f"{input_dir.name}/{source_rel}"
            source_link = f"{repo_url}/blob/{default_branch}/{source_path}"
        posts.append(
            {
                "slug": slug,
                "title": title,
                "date": date_text,
                "excerpt": excerpt,
                "article_html": article_html,
                "source_link": source_link,
            }
        )
    posts.sort(key=lambda item: (item["date"], item["slug"]), reverse=True)
    return posts


def page_shell(title: str, body: str, style_href: str) -> str:
    safe_title = html.escape(title)
    safe_style_href = html.escape(style_href)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{safe_title}</title>
  <link rel="stylesheet" href="{safe_style_href}">
</head>
<body>
  <main class="container">
{body}
  </main>
</body>
</html>
"""


def build_index(output_dir: Path, posts: list[dict[str, str]]) -> None:
    cards: list[str] = []
    for post in posts:
        title = html.escape(post["title"])
        date_text = html.escape(post["date"])
        excerpt = html.escape(post["excerpt"])
        cards.append(
            f"""      <a class="post-card fade-rise" href="posts/{post['slug']}/">
        <h2>{title}</h2>
        <div class="post-meta">{date_text}</div>
        <p class="post-excerpt">{excerpt}</p>
        <div class="post-read">Read article →</div>
      </a>"""
        )
    post_count = len(posts)
    latest = html.escape(posts[0]["date"]) if posts else "n/a"
    body = f"""    <section class="hero">
      <div class="hero-kicker">Community Journal</div>
      <h1>Bagakit Engineering Blog</h1>
      <p>Notes on skill evolution, delivery systems, and agent engineering.</p>
      <div class="hero-meta">
        <span class="hero-chip">Posts: {post_count}</span>
        <span class="hero-chip">Latest: {latest}</span>
      </div>
    </section>
    <section class="post-list">
{chr(10).join(cards) if cards else "      <p>No posts yet.</p>"}
    </section>
    <footer>
      Source markdown is maintained in <code>blogs/</code>.
    </footer>"""
    (output_dir / "index.html").write_text(
        page_shell("Bagakit Blog", body, "assets/style.css"),
        encoding="utf-8",
    )
    (output_dir / "404.html").write_text(
        page_shell("Not Found", body, "assets/style.css"),
        encoding="utf-8",
    )


def build_posts(output_dir: Path, posts: list[dict[str, str]]) -> None:
    posts_root = output_dir / "posts"
    for post in posts:
        post_dir = posts_root / post["slug"]
        post_dir.mkdir(parents=True, exist_ok=True)
        title = html.escape(post["title"])
        date_text = html.escape(post["date"])
        source_html = ""
        if post["source_link"]:
            source_link = html.escape(post["source_link"])
            source_html = f'<a href="{source_link}">Markdown source</a>'
        body = f"""    <div class="article-shell fade-rise">
    <div class="topbar">
      <a href="../../">← Back to blog</a>
      <span>{date_text}</span>
      {source_html}
    </div>
    <article class="article">
      {post["article_html"]}
    </article>
    </div>"""
        (post_dir / "index.html").write_text(
            page_shell(title, body, "../../assets/style.css"),
            encoding="utf-8",
        )


def build_site(input_dir: Path, output_dir: Path, repo_url: str, default_branch: str) -> None:
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    assets_dir = output_dir / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    (assets_dir / "style.css").write_text(STYLE_CSS.strip() + "\n", encoding="utf-8")
    (output_dir / ".nojekyll").write_text("", encoding="utf-8")

    posts = load_posts(input_dir, repo_url, default_branch)
    build_index(output_dir, posts)
    build_posts(output_dir, posts)


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    if not input_dir.exists():
        raise SystemExit(f"Input directory does not exist: {input_dir}")
    build_site(input_dir, output_dir, args.repo_url.strip(), args.default_branch.strip())
    print(f"Generated {output_dir} from {input_dir}")


if __name__ == "__main__":
    main()
