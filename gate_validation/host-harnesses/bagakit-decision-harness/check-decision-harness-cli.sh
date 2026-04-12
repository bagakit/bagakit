set -eu

root="."
while [ "$#" -gt 0 ]; do
  case "$1" in
    --root)
      root="${2:-}"
      shift 2
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

host_root="$tmp_dir/host"
dist_root="$tmp_dir/dist"
decision_cli="$root/host-harnesses/bagakit-decision-harness/scripts/decision-harness.sh"

bash "$root/scripts/skill.sh" host-harness-list --selector bagakit-decision-harness --json > "$tmp_dir/list.json"
grep -q '"harnessId": "bagakit-decision-harness"' "$tmp_dir/list.json"

bash "$root/scripts/skill.sh" host-harness-init \
  --selector bagakit-decision-harness \
  --repo "$host_root" \
  --json > "$tmp_dir/init.json"

for dir in inbox signals decisions reviews patterns drills ai-updates metrics principles projects exports; do
  [ -d "$host_root/$dir" ] || {
    echo "missing initialized host dir: $dir" >&2
    exit 1
  }
done
[ -f "$host_root/harness.toml" ]
[ -f "$host_root/.bagakit/decision-harness/surface.toml" ]

signal_path=$(sh "$decision_cli" add-signal \
  --root "$host_root" \
  --input-type typed_note \
  --text "User wants every decision to improve the next decision." \
  --privacy-class private)
signal_id=$(basename "$signal_path" .toml)

decision_path=$(sh "$decision_cli" create-decision \
  --root "$host_root" \
  --question "Should L4 stay separate from L1-L3 skills?" \
  --decision-type choice \
  --source-signal "$signal_id" \
  --option "Keep L4 as a host harness" \
  --option "Fold L4 back into skills" \
  --confidence medium \
  --expected-outcome "The host owns project-level runtime state." \
  --risk-tier medium)
decision_id=$(basename "$decision_path" .toml)
grep -q '"Keep L4 as a host harness"' "$decision_path"

review_path=$(sh "$decision_cli" review-decision \
  --root "$host_root" \
  --decision "$decision_id" \
  --actual-outcome "The source and host-root boundary stayed explicit." \
  --result-gap "The CLI needed an installable host initializer.")
review_id=$(basename "$review_path" .toml)

pattern_path=$(sh "$decision_cli" propose-pattern \
  --root "$host_root" \
  --condition "A reusable unit owns a full project host." \
  --default-action "Model it as an L4 host harness." \
  --source-decision "$decision_id" \
  --example "A decision-improvement workspace" \
  --counter-example "A small reusable writing primitive" \
  --confidence medium)
pattern_id=$(basename "$pattern_path" .toml)
sh "$decision_cli" set-pattern-status \
  --root "$host_root" \
  --pattern "$pattern_id" \
  --status accepted \
  --note "Accepted after CLI smoke validation" > "$tmp_dir/pattern-status.txt"

sh "$decision_cli" add-ai-update \
  --root "$host_root" \
  --update-type workflow \
  --candidate-change "Ask for source-signal ids when creating decision receipts." \
  --why-change "Decision receipts should stay traceable." \
  --expected-improvement "Reviews can find the originating signals." \
  --scope "create-decision" \
  --evidence-ref "$review_id" \
  --evidence-ref "$pattern_id" > "$tmp_dir/ai-update.txt"

sh "$decision_cli" metric-action \
  --root "$host_root" \
  --metric decision_review_coverage \
  --value "1 reviewed decision" \
  --action "Keep review receipts mandatory for pattern promotion." \
  --reason "Patterns should only promote after review." > "$tmp_dir/metric-action.txt"

bash "$root/scripts/skill.sh" host-harness-distribute-package \
  --selector bagakit-decision-harness \
  --dist "$dist_root" \
  --no-clean \
  --json > "$tmp_dir/package.json"
[ -f "$dist_root/bagakit-decision-harness.host-harness" ]

echo "ok: decision harness CLI smoke passed"
