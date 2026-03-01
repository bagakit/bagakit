set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"
exec "${PYTHON3:-python3}" "./bagakit-researcher.py" "$@"
