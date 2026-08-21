---
name: design
description: >-
  Router for all interface design work. Picks the one leaf skill that owns the question
  and loads nothing else. Use at the start of any design task: new screen, redesign,
  UX review, visual polish, motion, "make it feel alive", "this looks AI-generated",
  "why does this feel off", flows, information architecture, accessibility. Also the
  entry point for the named modes: /design humanize, /design audit, /design ship.
  Triggers on design, redesign, UX, UI, interface, usability, polish, motion, animation,
  layout, typography, palette, microcopy, а также на русском: дизайн, интерфейс, UX,
  оживи, отполируй, переделай экран, выглядит мёртвым, выглядит как AI.
---

# Design pipeline

This file routes. It never decides. Every rule that governs an actual design
question lives in a leaf skill, and the leaf is the authority — never restate,
summarise, or override a leaf's rules from here.

**The one rule: load the core, then one leaf per question.** An agent holding
seventeen skills at once produces screens with invented components and swapped
variants. An agent holding the core plus one leaf produces one correct decision.
Attention is the budget. Spend it on depth, never on breadth.

## Step 0 — read the core, once per session

Before any leaf runs, establish the project's core. Without it every leaf
invents its own system and the screen drifts.

| Core fact | Where it usually is | Why it gates everything |
| --- | --- | --- |
| Tokens | `global.css`, `tokens/`, `tailwind.config`, `theme.*` | New values fork the system; existing ones extend it |
| Existing components | `components/`, `shared/ui/`, `ui/`, a `COMPONENTS.md` | The seventh copy of a button is the default failure |
| Conventions | `CLAUDE.md`, `AGENTS.md`, `DESIGN-NOTES.md`, `README` | Some geometry is load-bearing and must not be "improved" |
| Stack | `package.json` | Every fix must be written in the project's own idiom |
| Preview | `.claude/launch.json`, `dev` script | A design claim you did not look at is a guess |

State the core in one short paragraph, then route. If a project convention
contradicts a leaf, **the project wins** — say so and move on.

## Step 1 — pick the lane

An interface is *what it does*, *what it looks like*, *how it moves*, and
*whether it holds up*. That decomposition is the whole routing table.

| The question is really about | Lane | Leaf |
| --- | --- | --- |
| Which states exist, what an action affects, whether it is reversible | DECIDE | `product-design` |
| How a user gets from entry to done, and what happens when it goes wrong | DECIDE | `ux-flow-planner` |
| How content, navigation, and taxonomy are organised | DECIDE | `information-architect` |
| Visual direction, aesthetic point of view, escaping templated defaults | BUILD | `frontend-design` |
| Building or retrofitting the screen in code, dark mode, responsive | BUILD | `ui-design` |
| Structure, grouping, spacing, what collapses when narrow | BUILD | `better-layout` |
| Typefaces, scale, wrapping, truncation, tabular numbers | BUILD | `better-typography` |
| Palette, ramps, semantic tones, theming, contrast | BUILD | `better-colors` |
| Labels, errors, empty states, every user-facing string | BUILD | `better-writing` |
| Radius, shadows, optical alignment, icons, press feedback | POLISH | `better-ui` |
| Taste, restraint, the details a user never consciously notices | POLISH | `emil-design-eng` |
| The passage between two states: timing, easing, springs, gestures | MOVE | `ui-animation` |
| Where an interface is missing motion it should have | MOVE | `ui-animation` (Discovery workflow) |
| Focus, keyboard, ARIA, hit areas, reduced motion | GUARD | `better-accessibility` |
| Score a screen, compare two variants, settle a design argument | JUDGE | `design-review` |
| Heuristic audit of a journey from screenshots, with citations | JUDGE | `ux-audit` |
| Holistic review of a whole screen across every domain at once | JUDGE | `better-interface` |

Route to **one**. When two fit, the subject of the sentence decides: motion as
the subject is `ui-animation` even if code exists; capability as the subject is
`product-design` even if the screen is built.

## Step 2 — the named modes

Chains, not new rules. Each stage is still one leaf at a time, and each stage
hands its output to the next.

- **`/design humanize`** — the screen works but feels mechanically generated.
  Do not redesign. Preserve the information architecture, layout, tokens, and
  visual language. Find where the interface is static, overly perfect, or
  unresponsive, and fix *that*: `better-ui` → `ui-animation` (Discovery, then
  build the survivors) → `emil-design-eng` → `better-accessibility`.
  Every animation must communicate something. Decorative motion is a finding,
  not a feature.
- **`/design audit`** — `design-review` for the score, then `better-interface`
  for the cross-discipline sweep, then `ux-audit` only if you have screenshots
  of a multi-screen journey.
- **`/design new <thing>`** — `product-design` → `ux-flow-planner` →
  `frontend-design` → `ui-design` → POLISH → GUARD → `design-review`.
- **`/design ship`** — `better-interface` → `better-accessibility` →
  `design-review`. Stop at the first `Block`.

Run one stage, report, then continue. A mode that runs end to end without
surfacing anything has not been checked.

## Invariants

These hold in every lane and no leaf owns them.

- **Never eyeball geometry that can be calculated.** A rotation centre, a
  bounding box, an arc length, a stroke offset, an intersection: compute it and
  show the arithmetic. Guessed coordinates are the single biggest tell of
  generated SVG and CSS.
- **Verify what you claim.** Look at the change in a browser before calling it
  done. Report anything you could not run as `Not verified` rather than
  implying you checked it.
- **Reuse before you add.** Search the component directory before writing a
  component. Extend a token before inventing a value.
- **Evidence, not taste.** A finding names the rule it violates and the user
  impact. A density or radius you merely disagree with is not a finding.
- **The user's brief wins.** Where the brief pins a direction, follow it
  exactly — including when it asks for something a leaf would call a default.

## Aliases

Some leaves reference siblings that are not installed here. Substitute:

| Upstream name | Use instead |
| --- | --- |
| `typography-audit` | `better-typography` |
| `copywriting` | `better-writing` |
| `accessibility-audit`, `accessibility-auditor` | `better-accessibility` |
| `interface-review`, `design-system-pro`, `ax-audit`, `pr-reviewer` | not installed — skip that hand-off |

`information-architect` carries navigation numbers from Figma's design system
(220px rail, specific blues). Its *method* is the point; its measurements are
not. Take them from the project's core instead.

## The agent

For work spanning several lanes, hand the whole job to the `design-engineer`
subagent. It holds this router plus the core and pulls leaves on demand, which
keeps the main conversation clear of seventeen skills' worth of rules.

Provenance and update instructions for every leaf: [VENDOR.md](VENDOR.md).
