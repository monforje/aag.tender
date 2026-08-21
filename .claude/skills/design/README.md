# Design pipeline

A design team as skills: one thin router, sixteen vendored leaf skills, one agent.

Built on the principle that attention is the budget. A router that *contains* the
rules is a router that spends the whole context window before the first decision.
This one only points, so an agent reasoning about typography holds the typography
rules and nothing else.

```
        /design  (router — 130 lines, points at exactly one leaf)
             │
   ┌─────────┼──────────┬──────────┬─────────┬──────────┐
 DECIDE    BUILD     POLISH      MOVE      GUARD      JUDGE
   │         │          │          │         │          │
 product-  frontend-  better-ui  ui-       better-   design-
  design    design    emil-      animation  a11y      review
 ux-flow-  ui-design  design-eng                     ux-audit
  planner  better-*                                  better-
 info-arch  (layout,                                 interface
            type,
            colors,
            writing)
             │
    design-engineer  (agent — holds the router + the project core, pulls one leaf per question)
```

## Use it

| Want | Say |
| --- | --- |
| Route one question | `/design` |
| Make a working screen stop feeling generated | `/design humanize` |
| Score and sweep an existing screen | `/design audit` |
| Build something new, end to end | `/design new <thing>` |
| Pre-merge gate | `/design ship` |
| Hand over a job spanning several lanes | the `design-engineer` subagent |

Leaves also fire on their own triggers — ask about easing and `ui-animation`
answers without going through the router.

## Port it to another repo

Two files carry the whole thing. Everything else is downloaded.

```bash
mkdir -p .claude/skills/design .claude/agents
cp /path/to/source/.claude/skills/design/{SKILL.md,vendor.sh,README.md} .claude/skills/design/
cp /path/to/source/.claude/agents/design-engineer.md .claude/agents/
bash .claude/skills/design/vendor.sh
```

Then assert it came up intact — the one failure that is otherwise silent is the
router pointing at a leaf that no longer exists, which dead-ends a route mid-task
with no error anywhere:

```bash
bash .claude/skills/design/check.sh
```

`vendor.sh` clones the sixteen upstream repos, copies each leaf in with its
licence, writes provenance to `VENDOR.md`, and links `.opencode/agents` for
opencode. Re-run it any time to update — it is idempotent and wipes each
vendored folder before recopying, so never hand-edit one.

## Both agents, one directory

Claude Code and opencode both read `.claude/skills/<name>/SKILL.md`, so the
leaves are shared as-is. Agents differ: Claude Code reads `.claude/agents/`,
opencode reads `.opencode/agents/`, hence the symlink. `design-engineer.md`
carries `name:` (Claude Code) and `mode:` (opencode) and deliberately omits
`model:` and `tools:`, whose formats are incompatible between the two — both
fall back to their defaults.

Verify discovery:

```bash
opencode agent list | grep design-engineer
```

## What is not here

- **SVG geometry** has no leaf worth vendoring — the candidates were thin,
  unlicensed, or JSON-spec generators rather than geometry reasoning. It is
  covered by an invariant in the router instead: never eyeball a coordinate that
  can be calculated.
- **`ux-review`** (cherifskr) is good but mandates French prose in its output.
- **`design-pipeline`** (richhemsley3) was the shape this router borrows, but it
  hardcodes Figma's design system; the router replaces it.
- **Visual direction libraries** — [MengTo/skills](https://github.com/MengTo/skills)
  has ~130 style-technique skills (shaders, scroll systems, named looks). A
  reference library, not a pipeline. Add individual ones to `vendor.sh` if a
  project wants that vocabulary.

Upstreams, commits, and licences: [VENDOR.md](VENDOR.md). All MIT.
