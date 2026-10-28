# Sequence Renderer

Render `diagram_type: "sequence"` JSON files into the standard Archify HTML
template.

```bash
node archify/renderers/sequence/render-sequence.mjs input.sequence.json output.html
```

The renderer validates input against `archify/schemas/sequence.schema.json`
with the bundled standalone validator. No dependency installation is required.

If `output.html` is omitted, the renderer uses `meta.output` from the JSON file
or falls back to `sequence.html` in the current working directory.

## Input

Sequence JSON files must set:

```json
{
  "schema_version": 1,
  "diagram_type": "sequence",
  "meta": {
    "title": "Cache Miss Request Sequence",
    "subtitle": "Frontend request path with auth and cache fallback",
    "viewBox": [920, 760]
  },
  "participants": [],
  "segments": [],
  "messages": [],
  "activations": [],
  "cards": []
}
```

The timeline scales with the viewBox height: a taller `meta.viewBox` buys more
message room, a shorter one shrinks the readable band instead of clipping. A
complete worked example lives at
`archify/examples/cache-miss-request.sequence.json`.

The schema lives at:

```text
archify/schemas/sequence.schema.json
```

## Layout budget

| Constant | Value |
|----------|-------|
| viewBox | default `[920, 760]`; schema minimum `[480, 480]` |
| Participant boxes | `fixed` (default): 86×54 at y 72, centers at x = 62 + index×108; `spread` (`meta.column_fit`): box width 86–190px and column gap derived from the viewBox width, order and semantics unchanged |
| Participant count | last box must end at or before width − 40 (8 fit at width 920 in `fixed`); layouts that cannot fit fail closed |
| Lifelines | from y 142 down to height − 65; band must be ≥120px tall |
| Message `y` range | `[160, height − 83]` |
| Message spacing | ≥28px vertical between messages that share horizontal space |
| Arrow span | ≥60px horizontal between the two participants |
| Segments | y pixel ranges with `to > from`, inside `[72, lifeline bottom + 20]` |
| Legend row | y = height − 54 |

`segments[].from/to` and `activations[].from/to` are y pixel coordinates, not
participant ids; activations also require `to > from`.

## Design Rules

- Messages require distinct `from` and `to` participants. The schema accepts
  matching IDs, but this renderer draws no self-call loop and rejects them as
  a self-message; more column distance cannot repair it. Keep the internal
  step's wording in a note on an actual interaction or in an ordered card
  rather than inventing another participant.
- A segment title must fit inside its frame (frame right edge is
  `viewBox[0] - 48`); shorten the title or widen `meta.viewBox[0]`.
- Put participants across the top, ordered by the story the reader should
  follow.
- Time moves downward.
- Use `emphasis` for the main request path.
- Use `security` for auth, consent, permission, and policy calls.
- Use `return` for quiet response messages.
- Use `dashed` for async trace, event, logging, and non-blocking work.
- Use segments as light background guides; keep segment labels short.
- Keep labels short enough to fit in narrow previews.

Schema violations exit non-zero with path-prefixed messages annotated with the
element's id or label. The renderer additionally fails when it can detect
layout problems, including missing participants, duplicate participant IDs,
participant labels wider than their box, unknown message endpoints, messages
outside the readable timeline, overly tight vertical spacing between messages
that overlap horizontally, invalid segment or activation ranges, or
participants that exceed the viewBox. Text width is estimated CJK-aware:
fullwidth glyphs count as two units.
