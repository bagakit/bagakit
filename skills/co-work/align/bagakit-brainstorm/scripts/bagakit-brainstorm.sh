set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec env PYTHONDONTWRITEBYTECODE=1 python3 "$SCRIPT_DIR/bagakit-brainstorm.py" "$@"
