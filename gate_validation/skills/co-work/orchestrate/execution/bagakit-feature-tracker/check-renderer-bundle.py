"""Public HTTP proof: a live server never mixes renderer and asset builds."""
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.request import urlopen

skill = Path(sys.argv[1])
repo = Path(sys.argv[2])

with tempfile.TemporaryDirectory(dir=repo) as directory:
    copied = Path(directory) / "skill"
    shutil.copytree(skill, copied)

    def launch():
        process = subprocess.Popen(
            [sys.executable, str(copied / "scripts/feature-tracker.py"),
             "serve-feature-status", "--root", str(repo), "--port", "0"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        line = process.stdout.readline()
        assert line.startswith("status_server: http://"), line
        return process, line.split("status_server: ", 1)[1].strip()

    def request(url):
        with urlopen(url, timeout=10) as response:
            body = response.read().decode("utf-8")
        return body, re.search(r'data-ui-revision="([^"]+)"', body).group(1)

    first, url = launch()
    try:
        before, revision = request(url)
        target = copied / "scripts/web/topology-view.js"
        target.write_text(target.read_text() + "\n/* bundle-change-proof */\n")
        after, same_revision = request(url)
        assert revision == same_revision
        assert "bundle-change-proof" not in after
        second, url2 = launch()
        try:
            updated, next_revision = request(url2)
            assert next_revision != revision
            assert "bundle-change-proof" in updated
        finally:
            second.terminate()
            second.communicate(timeout=10)
    finally:
        first.terminate()
        first.communicate(timeout=10)
print("ok: live UI bundles stay immutable until restart; next build gets a new UI revision")
