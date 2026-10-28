# Journey Renderer

Render `diagram_type: "journey"` (user journey map) JSON files into the
standard Archify HTML template.

```bash
node archify/renderers/journey/render-journey.mjs input.journey.json output.html
```

The renderer validates input against `archify/schemas/journey.schema.json`
with the bundled standalone validator, then applies its own layout checks.
If `output.html` is omitted it uses `meta.output` or falls back to
`journey.html` in the current working directory.

Layout grammar restated from
[cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design)
`references/type-journey.md` (MIT), re-expressed on the archify class system.

## Input

```json
{
  "schema_version": 1,
  "diagram_type": "journey",
  "meta": { "title": "Trial to Paid", "persona": "Solo founder" },
  "extraRow": "Owner",
  "stages": [
    { "id": "signup", "label": "Sign up", "sentiment": "high", "action": "Creates a workspace", "touchpoint": "landing page", "extra": "growth" },
    { "id": "limit", "label": "Hit the limit", "sentiment": "low", "action": "Blocked at 500 rows", "touchpoint": "in-app banner", "extra": "billing", "pain": "no warning before the wall" }
  ],
  "cards": []
}
```

One persona per map. `sentiment` is ordinal — `high`, `med-high`, `neutral`,
`med-low`, `low` — never a number. The first stage at the deepest level used is
the **trough**: its dot and incoming curve segment are the accent. `pain`
markers are allowed only on trough-level stages, at most two. `extraRow`
names an optional third content row (owner, metric) filled from each stage's
`extra`. Worked example: `archify/examples/trial-to-paid.journey.json`.

## Layout budget

| Constant | Value |
|----------|-------|
| viewBox | auto: width = 96 + stages×160 + gutters×20 + 32; height from the rows + legend |
| Stage columns | 160px wide, 20px gutter, left margin 96 for row and level labels (horizontal, never rotated; `extraRow` label ≤ 80px) |
| Stage header | `STAGE n` eyebrow (7px) over the stage name (10px) |
| Sentiment band | 160px tall, five levels 40px apart; hairlines for HIGH, NEUTRAL, LOW plus any other level in use |
| Curve | straight segments between `r=4.5` dots; `a-default` 1.5px, the trough's incoming segment `a-emphasis` 2px |
| Rows | ACTIONS (40px, 62px when any pain marker) → TOUCHPOINTS (32px) → optional extra row (32px), hairline separated |
| Pain marker | dashed `c-security` tag under the stage's action, rx 2 |
| Budget | 2–6 stages, ≤ 2 pain markers; accents = the first trough-level stage (dot + incoming segment) plus the pain markers. A second stage at the trough level may carry a pain marker but is not accented — the curve names one trough |

The curve is **data, not a connector**: it carries no arrowhead, so its
diagonals pass `check-render-output.mjs`. A journey map has no other
connectors.

## Design rules

- If every stage feels the same you are drawing a `workflow`; the renderer
  rejects a flat curve.
- Sentiment stays ordinal and named — no 0–100 scores, no emoji.
- Split a wide funnel into two journeys rather than exceeding six stages.
- Pain markers only on the trough; marking every stage erases the signal.
- No person, no sentiment, no journey map — an internal system flow belongs
  in `dataflow` or `architecture`.

Validation fails on: fewer than 2 or more than 6 stages, a flat sentiment
curve, more than 2 pain markers, a pain marker off the trough, `extra` without
`extraRow` (or the reverse), text wider than its column, duplicate ids,
unknown fields, and non-finite coordinates. Text width is estimated
CJK-aware: fullwidth glyphs count as two units.
