from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: fake_notification_delivery.py <request-file> <receipt-file>")

    request_path = Path(sys.argv[1]).resolve()
    receipt_path = Path(sys.argv[2]).resolve()
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    request = json.loads(request_path.read_text(encoding="utf-8"))
    receipt_path.write_text(
        json.dumps(
            {
                "source": "fake-notify",
                "summary": request.get("summary", ""),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print("sent")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
