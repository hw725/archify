---
name: archify
description: "Use when the user asks for an architecture, workflow, sequence, data-flow, lifecycle/state, fishbone (root-cause), kanban board, or user-journey diagram as a standalone HTML/SVG artifact, or pastes Mermaid or DOT to convert. Dependency graphs (including DOT) are drawn here in architecture mode; statistical charts go to the dataviz skill."
license: MIT
metadata:
  version: "2.12.0+local.5"
  category: diagram
  author: tt-a1i
  based_on: Cocoon-AI/architecture-diagram-generator (MIT, v1.0)
  upstream: https://github.com/tt-a1i/archify
---

# Archify Skill

Create professional technical diagrams as self-contained HTML files with inline SVG, a theme toggle, and a built-in image/SVG export menu.

## Routing Boundary

Use this skill as the canonical path for standalone HTML/SVG artifacts, typed renderers, schema and layout validation, and PNG/JPEG/WebP/SVG export across architecture, workflow, sequence, data-flow, lifecycle, fishbone, kanban, and user-journey diagrams. If the deliverable must instead live inline in a Markdown file, write a Mermaid block there (see the mapping table below, read in reverse) rather than an HTML artifact.

Specialist requests take precedence: use the `dataviz` skill for statistical charts. DOT and other dependency graphs stay here — read a pasted DOT file like Mermaid (see below): nodes become architecture components, `subgraph cluster_*` becomes a region boundary, edges become connections; keep only the edges that carry the story. For a dependency graph that must render inline in Markdown, emit a Mermaid `flowchart` instead. Obsidian `.canvas` mind maps go to the claude-obsidian canvas skill. (Local `vega`·`mindmap`·`infocard`·`infographic` skills were removed 2026-10-07.)

The PlantUML stencil skills (`uml`, `bpmn`, `archimate`, `cloud`, `network`, `security`, `data-analytics`, `iot`) were removed on 2026-08-11 in the skill inventory review. Handle requests that name those notations here — the sequence, state, workflow, and data-flow renderers cover the common cases, and Mermaid conversion covers the rest. Do not route to them; they no longer exist.

Every diagram ships with a **dark/light theme toggle** (persists in `localStorage`, respects `prefers-color-scheme`), an **export menu** (copy PNG to clipboard; download PNG/JPEG/WebP rasterized natively at up to 4× resolution; download a **dual-theme SVG** that follows the embedding host's `prefers-color-scheme` — ideal for GitHub READMEs), and a **CSS-variable color system** that keeps both themes consistent. To skin a diagram in a project's own brand colors and fonts, follow `references/brand-matching.md` (variable mapping + gates; the template itself stays untouched).

## Setup (one-time, renderer modes only)

The eight typed renderers validate JSON against schemas via `ajv`. From this skill's folder:

```bash
npm install
```

Without it the renderers still run — they print a warning and skip schema validation, keeping their own layout checks. The **generated HTML never has dependencies**; only the renderers do.

This copy tracks upstream tt-a1i/archify **selectively** (`.upstream.json` `mode: selective-tracking`, true base `9d54f0e7`): weekly screening keeps running and self-contained renderer-level fixes are ported by hand, but the v2.13+ viewer runtime, brand-marks, delta and migration surfaces are intentionally not adopted — see `references/upstream-watch.md` for the measured reasons and the reopen condition.

If you have no shell access at all (e.g. the skill was added as project knowledge), fall back to architecture mode for every request: hand-place SVG into `assets/template.html` following the Design System below, and run the self-review checklist before delivering.

## Choosing a Diagram Type

| Type | Use for | How |
|------|---------|-----|
| `architecture` | System components, cloud resources, services, security boundaries, infrastructure | `renderers/architecture/render-architecture.mjs` + JSON (or hand-place SVG when renderers can't run) |
| `workflow` | Technical flows, approval gates, tool calls, runbooks, CI/CD, incident response | `renderers/workflow/render-workflow.mjs` + JSON |
| `sequence` | API call chains, request lifecycles, cache fallback, async traces, return paths | `renderers/sequence/render-sequence.mjs` + JSON |
| `dataflow` | Pipelines, ETL/ELT, PII isolation, lineage, warehouse sync, consumers | `renderers/dataflow/render-dataflow.mjs` + JSON |
| `lifecycle` | State machines, status transitions, wait states, retries, terminal states | `renderers/lifecycle/render-lifecycle.mjs` + JSON |
| `fishbone` | Root-cause analysis: one observed effect, causes by category, sub-causes, one confirmed root cause (post-mortems) | `renderers/fishbone/render-fishbone.mjs` + JSON |
| `kanban` | Work-in-progress snapshot by state with WIP limits, blocked/waiting/done cards — no connectors | `renderers/kanban/render-kanban.mjs` + JSON |
| `journey` | One persona across stages with an ordinal sentiment curve, actions, touchpoints, pain markers | `renderers/journey/render-journey.mjs` + JSON |

Trigger phrases: "architecture/system/cloud diagram" → `architecture` (unless clearly process-oriented). "workflow/flow/process/runbook/approval/CI-CD/incident" → `workflow`. "sequence/interaction/call chain/who calls whom" → `sequence`. "data flow/pipeline/ETL/lineage/PII/governance" → `dataflow`. "state/status/lifecycle/state machine/retry/terminal" → `lifecycle`. "fishbone/Ishikawa/root cause/post-mortem causes/원인 분석" → `fishbone`. "kanban/board/WIP/what is blocked/작업 현황판" → `kanban`. "user journey/customer journey/experience map/how it feels at each step/여정 지도" → `journey`. A board that needs an arrow is a `workflow`; a journey with no person in it is a `dataflow`.

Layout types still under upstream watch (not implemented — sankey, wardley, deployment, uml-class, story-map, db-schema) are listed with their spec locations in `references/upstream-watch.md`; dependency graphs are drawn in architecture mode (see the routing boundary above).

## Mermaid as an Input Dialect

When the user pastes Mermaid code, do NOT try to render or parse it mechanically — read it for structure and **lay out from scratch** in the matching archify mode:

| Mermaid | Archify mode | Mapping |
|---------|--------------|---------|
| `flowchart` / `graph` | `workflow` (or `architecture` if it's a component map) | `subgraph` → lane or region boundary; node shape `{}` (diamond) → decision/security node; `-->` labels → edge labels (use sparingly); `classDef`/`style` → nearest semantic type |
| `sequenceDiagram` | `sequence` | `participant` → participants (pick semantic `type` from the name); `->>` → message, `-->>` → `return` variant; `Note` → message `note`; `rect` blocks → segments |
| `stateDiagram` | `lifecycle` | states → states (pick `start`/`active`/`waiting`/`success`/`failure` from names); `[*]` start/end → `start` type / `terminal` lane; transition labels → event-like labels |

Drop Mermaid styling; keep only the topology and meaning. You choose grouping, lane order, and what deserves emphasis — that judgment is the product.

## Layout principles (read before placing)

Archify's readability comes from **spatial narrative**, not from drawing every dependency as an arrow. Before you write coordinates or edge lists, plan one clear story:

1. **One main path** — left → right (architecture) or lane → column (workflow). The reader should trace the happy path without crossing lines.
2. **Few labeled edges** — label only cross-boundary or non-obvious transitions on the main path. Adjacent steps stay unlabeled.
3. **Short side branches** — permissions, storage, bots, CI: connect **up or down** from the nearest node on the main path. Never route a secondary edge diagonally across unrelated components.
4. **Cards for detail** — policies, tech stack notes, and "also connects to X" belong in summary cards, not as extra arrows.
5. **Mode fit** — process / approval / tool-call stories → `workflow` or `sequence`. Component maps with ≤12 nodes → `architecture`. If the diagram needs 20+ edges, remove edges until the main path is obvious.

Worked examples on this pattern: `examples/archify-repo.architecture.json` (this repo) and `examples/maka-architecture.architecture.json` (third-party desktop app).

When validation fails on label overlap, read the **Suggested fix** lines (coordinates / `labelAt` / `labelDy`) and apply them directly — do not guess offsets blindly.

## Renderer Modes (architecture / workflow / sequence / dataflow / lifecycle / fishbone / kanban / journey)

Run `node bin/archify.mjs doctor` to verify an installation. Run `node bin/archify.mjs demo [output-directory]` to generate a ready-to-open example before creating the first custom diagram.

All eight modes follow the same loop:

1. **Where the shapes live**: field shapes = `schemas/<type>.schema.json`, worked examples = `examples/*.{architecture,workflow,sequence,dataflow,lifecycle,fishbone,kanban,journey}.json`. Open the example for the mode you are producing and copy its patterns instead of guessing field shapes.
2. Write `<name>.<type>.json`.
3. Render: `node bin/archify.mjs render <type> <input>.json <output>.html` (paths relative to this skill's folder).
4. Validate the generated artifact: `node bin/archify.mjs validate <type> <input>.json --json`, or check an existing HTML file with `node bin/archify.mjs check <output>.html`. This catches malformed SVG output, non-finite SVG values, two-point diagonal arrows, and arrows crossing the legend.
5. If either step fails, the error names the JSON path or the fix (thresholds, valid ranges, which knob to change). Fix the JSON and re-run; never edit the renderer.

Schema violations exit non-zero with path-prefixed messages like `/nodes/3 (id/label: "router") must NOT have additional properties`. The renderers additionally fail fast on layout problems: node/state overlap (including cross-lane), labels colliding with nodes or other labels, labels wider than their node, out-of-range columns/rows, too-short edges, workflow edges crossing unrelated nodes, and legends outside the viewBox. CJK text is measured at double width automatically.

Set `meta.animation: "trace"` only when the user asks for motion or a presentation/demo view. It adds lightweight SVG/CSS trace animation to renderer-marked arrows and nodes, respects `prefers-reduced-motion`, and leaves the default static output unchanged.

### Mode guidance and inline examples

Per-mode field guidance with inline JSON for workflow, sequence, dataflow, lifecycle, fishbone, kanban and journey = `references/mode-examples.md`. The canonical shapes remain `examples/*.<type>.json`; open the reference only when the example alone does not settle a field.

### Per-mode deep guidance

Each renderer has a README with its full design language (route presets, semantic types, story guidance): `renderers/workflow/README.md`, `renderers/sequence/README.md`, `renderers/dataflow/README.md`, `renderers/lifecycle/README.md`, `renderers/fishbone/README.md`, `renderers/kanban/README.md`, `renderers/journey/README.md`. Open the matching one when a diagram needs route presets or semantic types beyond what the example shows.

## Architecture Mode

Architecture has the same read-schema-then-render loop as the other modes — prefer it. Hand-placed SVG is the fallback for when renderers can't run.

```json
{
  "schema_version": 1,
  "diagram_type": "architecture",
  "meta": { "title": "Sample Web App", "subtitle": "3-tier SaaS on AWS", "output": "web-app.html" },
  "components": [
    { "id": "users", "type": "external", "label": "Users", "sublabel": "Browser", "pos": [40, 300] },
    { "id": "api", "type": "backend", "label": "API Server", "sublabel": "FastAPI :8000", "pos": [460, 300] },
    { "id": "db", "type": "database", "label": "PostgreSQL", "sublabel": ":5432", "pos": [680, 300] }
  ],
  "boundaries": [
    { "kind": "region", "label": "AWS us-west-2", "wraps": ["api", "db"] }
  ],
  "connections": [
    { "from": "users", "to": "api", "label": "HTTPS", "variant": "emphasis" },
    { "from": "api", "to": "db", "label": "SQL" }
  ],
  "cards": []
}
```

Render: `node bin/archify.mjs render architecture <input>.json <output>.html`.

**Free placement** — `pos: [x, y]` is the component's top-left; `size: [w, h]` defaults to `[120, 60]`. Unlike typed modes there is no lane/stage grid — asymmetric placement is yours to choose. `meta.viewBox` is optional (auto-fitted).

**Grid placement (#8)** — when manual coordinates are painful, set semantic cells instead of doing arithmetic:

```json
{
  "layout": { "mode": "grid", "cols": 7, "origin": [40, 100], "gapX": 24, "gapY": 48, "cellW": 120, "cellH": 60 },
  "components": [
    { "id": "agents", "type": "frontend", "label": "Agent Hosts", "row": 1, "col": 1 },
    { "id": "ir", "type": "messagebus", "label": "JSON IR", "row": 1, "col": 2 }
  ]
}
```

`pos` still wins when present (override one cell). This is **not** auto-layout — spacing is fixed cell math. Example: `examples/archify-repo-grid.architecture.json`.

**Inspect layout (#9)** — after editing JSON, dump computed boxes without opening HTML:

```bash
node bin/archify.mjs inspect architecture my.architecture.json
# or: node bin/archify.mjs validate architecture my.architecture.json --layout-json
```

Output includes component rects, boundaries, connection point paths, and label positions.

**The renderer does the mechanical work that used to be hand-tuned**, so you only choose coordinates and meaning:

- **Free coordinates** — `pos: [x, y]` is the component's top-left; `size: [w, h]` defaults to `[120, 60]`. Unlike the typed modes there is no lane/stage grid — asymmetric placement is yours to choose. `meta.viewBox` is optional (auto-fitted to your components + a legend row).
- **Grid placement** — optional `layout.mode: "grid"` with `row`/`col` per component (see above). Not dagre; fixed cell spacing only.
- **Boundaries from `wraps`** — list the component ids a `region` (dashed amber) or `security-group` (dashed rose) encloses; the renderer computes the box with correct 30/50 padding automatically. Never hand-arithmetic a boundary again.
- **Connections** route like edges (`variant`, `fromSide`/`toSide`, `route: straight|orthogonal-h|orthogonal-v|auto`, `via`, `labelDx/labelDy/labelAt`). For a vertical labeled connection, push the label into the gap with `labelDy` (the validator will tell you if it lands on a box).
- The renderer auto-emits the two-rect `c-mask` pattern, draws arrows before boxes (z-order), builds the legend from the component types you used, and **fails fast on component overlap, off-canvas components/boundaries, unknown wraps/connection ids, label-vs-component collisions, and non-finite coordinates** — the same reliability the other four modes already had.

### Hand-placed fallback (no renderer available)

When Node/ajv can't run, copy `assets/template.html` and place SVG by hand. Study the worked diagram inside the template and `examples/web-app.html` for coordinate idioms, follow the Design System below, and run the self-review checklist before delivering.

### The Cardinal Rule: CSS classes, not inline colors

The theme toggle works by switching CSS custom properties. Hardcoded `fill="rgba(...)"` or `stroke="#22d3ee"` will NOT update on theme change. Always use the class system:

```svg
<rect x="X" y="Y" width="W" height="H" rx="6" class="c-mask"/>
<rect x="X" y="Y" width="W" height="H" rx="6" class="c-backend" stroke-width="1.5"/>
<text x="CX" y="CY" class="t-primary" font-size="11" font-weight="600" text-anchor="middle">API Server</text>
<text x="CX" y="CY+16" class="t-muted" font-size="9" text-anchor="middle">FastAPI :8000</text>
```

### Design system

Component fills `c-frontend` (clients/UI), `c-backend` (services/APIs), `c-database` (stores/caches), `c-cloud` (managed infra), `c-security` (auth/secrets), `c-messagebus` (Kafka/queues), `c-external` (3rd parties); text accents `t-<same>` plus neutrals `t-primary` / `t-muted` / `t-dim`. Arrows `a-default`, `a-emphasis` (hot path), `a-security` (dashed), `a-dashed` (async) — always set `stroke-width` and pair `marker-end="url(#arrowhead[-variant])"` with the matching class. Boundaries: `c-security-group` (dashed rose), `c-region` (dashed amber), `c-lane` (swimlane).

Typography inherits JetBrains Mono from the SVG root. Sizes: 11–12px component names, 9px sublabels, 8px annotations, 7px tiny labels.

### Hard layout rules

- **Two-rect pattern everywhere**: opaque `c-mask` rect first, styled `c-<type>` rect on top — semi-transparent fills otherwise let arrows bleed through.
- **Arrows before components** in document order (SVG paints in order; arrows must sit behind boxes).
- **Vertical stacking**: ≥40px gap between components; inline connectors (message buses, 20px tall) live inside the gap, never overlapping boxes.
- **Boundary padding**: boundary `y` = inner `y` − 30, boundary `height` = inner `height` + 50, label baseline 18px below the boundary top.
- **Legend placement**: outside ALL boundary boxes, ≥20px below the lowest one; grow the viewBox if needed.

### Self-review checklist (run before delivering)

1. `grep -E 'fill="(#|rgb)|stroke="(#|rgb)' out.html` inside the SVG returns nothing except the template's own defs (Cardinal Rule).
2. Every `c-<type>` rect has an identical-geometry `c-mask` rect immediately before it.
3. All `<line>`/`<path>` arrows appear before all component rects in document order.
4. Compute max(y + height) over all SVG elements: viewBox height must exceed it by ≥20px; same for x/width.
5. Legend y is below every boundary's y + height.
6. The `.toolbar`, `<script>` blocks, and `:root` / `[data-theme]` CSS are untouched — they ARE the theme toggle and export menu.

## Output

A single self-contained `.html`: embedded CSS (Google Fonts loads async and degrades to system monospace offline), inline SVG, ~19KB embedded JS for theme + export. It renders directly in any modern browser. Raster exports render natively at up to 4× the viewBox (large diagrams step down to 3×/2× to stay under canvas limits); the SVG download is dual-theme self-contained and follows the host's `prefers-color-scheme` (manual override via `svg[data-theme="..."]`).
