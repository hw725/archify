# Kanban Renderer

Render `diagram_type: "kanban"` JSON files into the standard Archify HTML
template.

```bash
node archify/renderers/kanban/render-kanban.mjs input.kanban.json output.html
```

The renderer validates input against `archify/schemas/kanban.schema.json`
with the bundled standalone validator, then applies its own layout checks.
If `output.html` is omitted it uses `meta.output` or falls back to
`kanban.html` in the current working directory.

Layout grammar restated from
[cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design)
`references/type-kanban.md` (MIT), re-expressed on the archify class system.

## Input

```json
{
  "schema_version": 1,
  "diagram_type": "kanban",
  "meta": { "title": "Platform Team Board" },
  "columns": [
    { "id": "backlog", "label": "Backlog" },
    { "id": "progress", "label": "In progress", "limit": 3 },
    { "id": "done", "label": "Done" }
  ],
  "items": [
    { "id": "ava-214", "column": "progress", "title": "Rate limiter rollout", "sublabel": "AVA-214 · nadia", "state": "blocked" },
    { "id": "ava-201", "column": "done", "title": "Cache warmers", "sublabel": "AVA-201 · lin", "state": "done" }
  ],
  "cards": []
}
```

Work cards are `items` (the top-level `cards` key is reserved for the summary
cards under the SVG, as in every other mode). Items render in array order
within their column. `state` is one of `default`, `blocked`, `waiting`,
`done`. A column with `limit` shows an `n/limit` WIP chip; a column without
one (entry queue, terminal column) shows a bare count. Worked example:
`archify/examples/platform-board.kanban.json`.

## Layout budget

| Constant | Value |
|----------|-------|
| viewBox | auto: width = 64 + columns×176 + gutters×24; height from the tallest column + legend |
| Column | 176px wide, 24px gutter, `c-lane` fill with no border, header band 36px |
| WIP chip | rectangular tag rx 2 (never a pill), right-aligned in the header; `c-security`/`t-security` when over limit |
| Card | column width − 24, 48px tall, 12px gap, rx 6 |
| Card states | `default` → `c-external`; `blocked` → `c-security` dashed + 3px left accent bar; `waiting` → `c-cloud` dashed; `done` → `c-database` |
| Budget | ≤ 5 columns, ≤ 4 cards per column, ≤ 12 cards, ≤ 2 accents (blocked cards + over-limit chips) |
| Legend | 44px below the columns |

A board has **no connectors**. It is a state census: what is queued, what is
moving, what is stuck, where the WIP limit is breached. If an arrow is needed
anywhere, the diagram is a `workflow`, not a board.

## Design rules

- Give every in-process column a `limit`; the over-limit chip is half the point
  of the type. Entry and terminal columns carry a bare count.
- Over four cards in a column → aggregate into one count card (`+N more`).
- One or two blocked cards read as signal; more read as noise and blow the
  accent budget.
- One card per person is an org chart, not a board.
- Cap the Done column and note the archive point in a card or sublabel.

Validation fails on: unknown column references, more than 4 cards in a
column, more than 12 cards, more than 2 accent elements, titles or sublabels
wider than the card, column labels colliding with their chip, duplicate ids,
unknown fields, and non-finite coordinates. Text width is estimated
CJK-aware: fullwidth glyphs count as two units.
