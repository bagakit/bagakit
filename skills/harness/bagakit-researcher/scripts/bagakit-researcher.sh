set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "${PYTHON3:-python3}" "$script_dir/bagakit-researcher.py" "$@"
