# archify renderer modes — guidance and inline examples

> `SKILL.md`에서 이관(2026-09-16). 해당 작업을 실제로 할 때만 연다.

### Workflow

```json
{
  "schema_version": 1,
  "diagram_type": "workflow",
  "meta": { "title": "Release Workflow", "subtitle": "PR to production", "output": "release.html" },
  "lanes": [ { "id": "dev", "label": "Developer" }, { "id": "ci", "label": "CI" }, { "id": "exceptions", "label": "Exception Handling", "variant": "exception" } ],
  "phases": [ { "id": "intake", "label": "Intake", "fromCol": 0, "toCol": 1 } ],
  "groups": [ { "id": "checks", "label": "Parallel checks", "lane": "ci", "fromCol": 1, "toCol": 3, "variant": "emphasis" } ],
  "mainPath": ["pr", "build"],
  "nodes": [
    { "id": "pr", "lane": "dev", "col": 0, "type": "frontend", "label": "Open PR", "sublabel": "feature branch" },
    { "id": "build", "lane": "ci", "col": 1, "type": "backend", "label": "Build", "sublabel": "lint + test", "tag": "blocking" }
  ],
  "edges": [
    { "from": "pr", "to": "build", "label": "webhook", "variant": "emphasis", "fromSide": "bottom", "toSide": "top", "route": "drop" }
  ],
  "cards": []
}
```

**Layout budget**: 6 columns (`col` 0–5) at fixed x positions `[88, 220, 300, 430, 500, 625]` — columns 1↔2 and 3↔4 are only 70–80px apart, so default-width (92px) nodes in those adjacent columns of the same lane overlap; skip a column or shrink `width`. Lane content width is 640px. Omit `meta.viewBox` — the renderer sizes height to the lane count automatically. Use `phases` for top-of-diagram story beats, `groups` to frame parallel work or a branch inside one lane, and `lane.variant: "exception"` for error/retry/fallback lanes. `mainPath` is optional but recommended: list the happy-path node ids in order so the renderer can catch missing edges or accidental backward movement. Edge routes: `straight`, `drop` (bend between lanes; `bias` 0–1 picks where), `outside-right`, `return-left`, `bottom-channel`, `up-channel`, or explicit `via` points. Keep adjacent-step edges unlabeled; reserve labels for cross-lane transitions, approvals, async traces, and returns.

### Sequence

```json
{
  "schema_version": 1,
  "diagram_type": "sequence",
  "meta": { "title": "Cache Miss Request", "subtitle": "auth and cache fallback", "output": "cache-miss.html" },
  "participants": [
    { "id": "web", "type": "frontend", "label": "Web App", "sublabel": "React UI" },
    { "id": "api", "type": "backend", "label": "API", "sublabel": "handler" }
  ],
  "segments": [ { "from": 160, "to": 320, "label": "01 / AUTH" } ],
  "messages": [
    { "from": "web", "to": "api", "y": 200, "label": "GET /data", "variant": "emphasis" },
    { "from": "api", "to": "web", "y": 290, "label": "200 JSON", "variant": "return" }
  ],
  "activations": [ { "participant": "api", "from": 190, "to": 300, "type": "backend" } ],
  "cards": []
}
```

**Layout budget**: participants sit at x = 62 + index×108, so a 920-wide viewBox fits at most 8. Message `y` must stay within `[160, viewBox_height − 83]`; messages that share horizontal space need ≥28px vertical separation; arrows need ≥60px horizontal span. `segments[].from/to` and `activations[].from/to` are **y pixel coordinates**, not participant ids. A taller `meta.viewBox` (default `[920, 760]`) buys more timeline room. Keep labels short: "GET /path", "verify JWT", "cache miss", "200 JSON". Omit `meta.column_fit` for the stable `fixed` layout; set it to `"spread"` when a wide viewBox would otherwise leave unused space on the right or meaningful participant labels do not fit the 86px boxes — spread derives box width (86–190px) and column gap from the viewBox without changing participant order, and fails closed with a viewBox hint when the canvas is too narrow.

### Dataflow

```json
{
  "schema_version": 1,
  "diagram_type": "dataflow",
  "meta": { "title": "Product Analytics", "subtitle": "events to consumers", "output": "analytics.html" },
  "stages": [ { "label": "Sources" }, { "label": "Ingest" }, { "label": "Store" } ],
  "nodes": [
    { "id": "web", "type": "frontend", "label": "Web App", "stage": 0, "row": 0, "sublabel": "clickstream" },
    { "id": "kafka", "type": "messagebus", "label": "Kafka", "stage": 1, "row": 0, "tag": "accepted events" }
  ],
  "flows": [
    { "from": "web", "to": "kafka", "label": "events", "classification": "PII touch", "variant": "emphasis" }
  ],
  "cards": []
}
```

**Layout budget**: 2–5 stages at x = 100 + stage×215; 5 rows (`row` 0–4) at y `[128, 242, 356, 470, 584]`; default node 112×58. Default viewBox `[940, 720]`. Flow labels are mandatory and asset-like ("clickstream", "identity map", "feature vectors"); put sensitivity in `classification` ("PII touch", "approved only", "non-PII"). Variants: `emphasis` = primary path, `security` = PII/policy/consent, `dashed` = async/batch.

### Lifecycle

```json
{
  "schema_version": 1,
  "diagram_type": "lifecycle",
  "meta": { "title": "Agent Run Lifecycle", "subtitle": "states and terminal outcomes", "output": "agent-run.html" },
  "lanes": [
    { "id": "main", "label": "Lifecycle phases" },
    { "id": "waiting", "label": "Interruptions" },
    { "id": "terminal", "label": "Terminal exits" }
  ],
  "states": [
    { "id": "queued", "type": "start", "label": "Queued", "lane": "main", "col": 0, "step": "01" },
    { "id": "running", "type": "active", "label": "Executing", "lane": "main", "col": 2, "step": "02" },
    { "id": "approval", "type": "waiting", "label": "Needs Approval", "lane": "waiting", "col": 0 },
    { "id": "done", "type": "success", "label": "Completed", "lane": "terminal", "col": 2 }
  ],
  "transitions": [
    { "from": "queued", "to": "running", "variant": "emphasis" },
    { "from": "running", "to": "approval", "label": "needs approval", "variant": "security", "fromSide": "bottom", "toSide": "right" },
    { "from": "running", "to": "done", "label": "success", "variant": "emphasis", "fromSide": "bottom", "toSide": "top" }
  ],
  "cards": []
}
```

**Layout budget — lane ids are semantic and reserved**: `main` is required and maps to the top phase band (cols 0–4); `terminal` maps to the bottom outcome band (cols 0–2); **every other lane id shares the single middle event band** (cols 0–2) — separate same-band states with different `col` or `yOffset`. Band headers render from your lane labels. Default viewBox `[980, 660]`. Keep transition labels event-like and sparse ("retry", "timeout", "cancel"); prefer state `tag`s, `step` numbers, and summary cards over label-heavy arrows. Put terminal states in the `terminal` lane so endings are unambiguous.

### Fishbone

```json
{
  "schema_version": 1,
  "diagram_type": "fishbone",
  "meta": { "title": "Checkout Latency Post-mortem", "output": "checkout-latency.html" },
  "effect": { "label": "Checkout p99 > 2s", "sublabel": "observed 14:02–15:40 UTC" },
  "bones": [
    { "id": "data", "label": "Data", "rootCause": true, "subcauses": ["stale orders index", "row-lock contention"] },
    { "id": "deploy", "label": "Deploy", "subcauses": ["canary skipped"] },
    { "id": "traffic", "label": "Traffic", "subcauses": ["flash sale spike", "bot retries"] }
  ],
  "cards": []
}
```

**Layout budget**: 1–5 bones in head-to-tail order (first = nearest the effect box), alternating above/below the spine at fixed 60°; 1–3 sub-causes per bone; exactly one `rootCause: true`. viewBox is auto-sized (height 572). Sub-cause labels must stay ≤ ~22 ASCII units (legibility budget); category labels ≤ ~17 units. `effect.label` states the symptom, never the fix. Put ruled-out hypotheses and contributing factors in `cards`.

### Kanban

```json
{
  "schema_version": 1,
  "diagram_type": "kanban",
  "meta": { "title": "Platform Team Board", "output": "platform-board.html" },
  "columns": [
    { "id": "backlog", "label": "Backlog" },
    { "id": "progress", "label": "In progress", "limit": 3 },
    { "id": "done", "label": "Done" }
  ],
  "items": [
    { "id": "ava-214", "column": "progress", "title": "Rate limiter rollout", "sublabel": "AVA-214 · nadia", "state": "blocked" },
    { "id": "ava-219", "column": "progress", "title": "Queue backpressure", "sublabel": "AVA-219 · omar" },
    { "id": "ava-201", "column": "done", "title": "Cache warmers", "sublabel": "AVA-201 · lin", "state": "done" }
  ],
  "cards": []
}
```

**Layout budget**: ≤5 columns (176px each), ≤4 items per column, ≤12 items; work cards are `items` (`cards` stays the summary blocks). `limit` on every in-process column drives the `n/limit` chip and the over-limit accent; entry/terminal columns take no limit. `state` ∈ default·blocked·waiting·done; blocked cards + over-limit chips together ≤ 2. No connectors exist in this mode — if you need an arrow, it is a `workflow`.

### Journey

```json
{
  "schema_version": 1,
  "diagram_type": "journey",
  "meta": { "title": "Trial to Paid", "persona": "Solo founder", "output": "trial-to-paid.html" },
  "extraRow": "Owner",
  "stages": [
    { "id": "signup", "label": "Sign up", "sentiment": "high", "action": "Creates a workspace", "touchpoint": "landing page", "extra": "growth" },
    { "id": "limit", "label": "Hit the limit", "sentiment": "low", "action": "Blocked at 500 rows", "touchpoint": "in-app banner", "extra": "billing", "pain": "no warning before the wall" },
    { "id": "upgrade", "label": "Upgrade", "sentiment": "neutral", "action": "Enters card", "touchpoint": "checkout", "extra": "billing" }
  ],
  "cards": []
}
```

**Layout budget**: 2–6 stages (160px columns), one persona. `sentiment` is ordinal (`high`·`med-high`·`neutral`·`med-low`·`low`) — the first stage at the deepest level used is the trough and gets the only curve accent. `pain` markers: ≤2, trough-level stages only. `extraRow` names an optional third content row filled from each stage's `extra`; omit both together. A flat curve is rejected — if nothing changes how the user feels, draw a `workflow`.
