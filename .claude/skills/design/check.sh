#!/usr/bin/env bash
# Asserts the pipeline is intact. Fails loudly; silence is the pass.
#
#   bash .claude/skills/design/check.sh
#
# Catches the one failure that is otherwise silent: the router pointing at a leaf
# that no longer exists, so a route dead-ends mid-task with no error anywhere.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"   # .claude/
SKILLS="$ROOT/skills"; ROUTER="$SKILLS/design/SKILL.md"; FAIL=0
err() { echo "FAIL: $*" >&2; FAIL=1; }

# 1. Every leaf the router routes to (backticked name in a routing-table row) exists.
# Loop in the main shell, not a pipeline: a subshell's FAIL=1 is discarded and
# the check reports "ok" while printing its own failure.
for leaf in $(grep -oE '\| `[a-z-]+`( \(.*\))? \|$' "$ROUTER" | grep -oE '`[a-z-]+`' | tr -d '`' | sort -u); do
  [ -f "$SKILLS/$leaf/SKILL.md" ] || err "router routes to '$leaf', no $SKILLS/$leaf/SKILL.md"
done

# 2. Every skill has a name and a description, and name matches its directory.
for d in "$SKILLS"/*/; do
  n="$(basename "$d")"; f="$d/SKILL.md"
  [ -f "$f" ] || { err "$n has no SKILL.md"; continue; }
  fm="$(awk 'NR>1 && /^---/{exit} {print}' "$f")"
  [ "$(sed -n 's/^name: *//p' <<< "$fm" | head -1)" = "$n" ] || err "$n: frontmatter name != directory"
  grep -q '^description:' <<< "$fm" || err "$n: no description in frontmatter"
done

# 3. Vendored leaves carry their upstream licence.
while IFS='|' read -r _ leaf _; do
  leaf="$(tr -d ' `' <<< "$leaf")"; [ -d "$SKILLS/$leaf" ] || continue
  [ -s "$SKILLS/$leaf/LICENSE" ] || err "$leaf: vendored but no LICENSE"
done < <(grep -E '^\| `[a-z-]+` \| \[' "$SKILLS/design/VENDOR.md" 2>/dev/null)

# 4. opencode can reach the agents.
[ -d "$ROOT/../.opencode/agents" ] || err ".opencode/agents missing - run vendor.sh"

[ "$FAIL" = 0 ] && echo "design pipeline ok: $(ls -d "$SKILLS"/*/ | wc -l) skills, router intact"
exit "$FAIL"
