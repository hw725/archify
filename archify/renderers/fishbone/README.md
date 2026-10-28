# Fishbone Renderer

Render `diagram_type: "fishbone"` (Ishikawa / root-cause) JSON files into the
standard Archify HTML template.

```bash
node archify/renderers/fishbone/render-fishbone.mjs input.fishbone.json output.html
```

The renderer validates input against `archify/schemas/fishbone.schema.json`
with the bundled standalone validator, then applies its own layout checks.
If `output.html` is omitted it uses `meta.output` or falls back to
`fishbone.html` in the current working directory.

Layout grammar restated from
[cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design)
`references/type-fishbone.md` (MIT), re-expressed on the archify class system.

## Input

```json
{
  "schema_version": 1,
  "diagram_type": "fishbone",
  "meta": { "title": "Checkout Latency Post-mortem" },
  "effect": { "label": "Checkout p99 > 2s", "sublabel": "observed 14:02–15:40 UTC" },
  "bones": [
    { "id": "data", "label": "Data", "rootCause": true, "subcauses": ["stale orders index", "row-lock contention"] },
    { "id": "deploy", "label": "Deploy", "subcauses": ["canary skipped"] }
  ],
  "cards": []
}
```

`effect` is the observed symptom, never the remedy. `bones` are categories in
head-to-tail order — the first bone attaches closest to the effect box. Bones
alternate above (odd) and below (even) the spine. Exactly one bone sets
`rootCause: true`. Worked example: `archify/examples/checkout-latency.fishbone.json`.

## Layout budget

| Constant | Value |
|----------|-------|
| viewBox | auto: width = 260 + 120 + 160×(bones−1) + effect width + 40; height 572 |
| Spine | y = 300, from x 60 to the effect box; `a-emphasis` with arrowhead |
| Bone attach x | first bone at head − 120, then every 160px leftward |
| Bone geometry | straight 60° diagonal: far end at (attach − 96, 300 ∓ 168) |
| Category tag | 26px tall, width 88–130 (auto from label); `c-external`, root cause `c-backend` |
| Sub-causes | 1–3 per bone at fractions 3/6 · 2/6, 4/6 · 1.5/6, 3/6, 4.5/6 along the bone; 32px tick, label anchored to its open end |
| Sub-cause label | ≤ 112px (≈22 ASCII units) — a legibility budget; the same-side neighbour bone is 320px away, so this is not a collision bound |
| Effect box | 56px tall, width 180–320 (auto), `c-backend`, rx 7 |
| Legend | y 540 |

Bones are the only diagonal lines in an archify diagram (ticks are
horizontal): they carry no `marker-end`, so `check-render-output.mjs` treats
them as decoration, not arrows. Every other connector in a fishbone stays
orthogonal.

## Design rules

- One effect, one confirmed root cause. Two confirmed categories are two
  diagrams or one merged category — never two accent bones.
- Every bone needs at least one sub-cause; an empty category is a placeholder,
  not a finding. More than three sub-causes is a second bone.
- Sub-causes must add information beyond the category name.
- A chronology of failures is a `lifecycle` or `sequence` diagram; fishbone
  is for the causes of *one* effect.
- Put the investigation narrative (what was ruled out, contributing factors)
  in `cards`, not in extra bones.

Validation fails on: zero or multiple root causes, bones without sub-causes,
category labels wider than the tag, sub-cause labels wider than the gap to the
next bone or running off the left edge, an effect label wider than 320px,
unknown fields, and non-finite coordinates. Text width is estimated
CJK-aware: fullwidth glyphs count as two units.
