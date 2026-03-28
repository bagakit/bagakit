set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
exec env PYTHONDONTWRITEBYTECODE=1 python3 "./bagakit-brainstorm.py" "$@"
