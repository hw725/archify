const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

export function renderDefinitions() {
  return `        <!-- Definitions -->
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" class="m-default" />
          </marker>
          <marker id="arrowhead-emphasis" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" class="m-emphasis" />
          </marker>
          <marker id="arrowhead-security" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" class="m-security" />
          </marker>
          <marker id="arrowhead-dashed" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" class="m-dashed" />
          </marker>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" class="c-grid" stroke-width="0.5"/>
          </pattern>
        </defs>`;
}

export function renderCards(cards) {
  const list = Array.isArray(cards) ? cards : [];
  return `    <!-- Info Cards -->
    <div class="cards">
${list.map((card) => `      <div class="card">
        <div class="card-header">
          <div class="card-dot ${esc(card.dot)}"></div>
          <h3>${esc(card.title)}</h3>
        </div>
        <ul>
${card.items.map((item) => `          <li>&bull; ${esc(item)}</li>`).join('\n')}
        </ul>
      </div>`).join('\n\n')}
    </div>`;
}

const SVG_SLOT_RE = /      <!-- ARCHIFY:SVG_SLOT_START -->[\s\S]*?      <!-- ARCHIFY:SVG_SLOT_END -->/;
const CARDS_SLOT_RE = /    <!-- ARCHIFY:CARDS_SLOT_START -->[\s\S]*?    <!-- ARCHIFY:CARDS_SLOT_END -->/;

const TEMPLATE_PLACEHOLDERS = [
  '<title>[PROJECT NAME] Architecture Diagram</title>',
  '<h1>[PROJECT NAME] Architecture</h1>',
  '<p class="subtitle">[Subtitle description]</p>',
  '[Project Name] &bull; [Additional metadata]',
];

// `footer` is injected as raw HTML so callers can embed <kbd> hints;
// pass only trusted strings here, never user input.
export function applyTemplate(template, { title, subtitle, footer, svg, cards }) {
  if (!SVG_SLOT_RE.test(template)) {
    throw new Error('applyTemplate: template missing ARCHIFY:SVG_SLOT sentinel');
  }
  if (!CARDS_SLOT_RE.test(template)) {
    throw new Error('applyTemplate: template missing ARCHIFY:CARDS_SLOT sentinel');
  }
  for (const ph of TEMPLATE_PLACEHOLDERS) {
    if (!template.includes(ph)) {
      throw new Error(`applyTemplate: template missing placeholder ${JSON.stringify(ph)}`);
    }
  }
  // Function replacers: a literal `$&`, `$'`, `$\`` or `$$` in titles, labels,
  // or rendered SVG must not be interpreted as a replacement pattern.
  return template
    .replace(TEMPLATE_PLACEHOLDERS[0], () => `<title>${esc(title)} Diagram</title>`)
    .replace(TEMPLATE_PLACEHOLDERS[1], () => `<h1>${esc(title)}</h1>`)
    .replace(TEMPLATE_PLACEHOLDERS[2], () => `<p class="subtitle">${esc(subtitle ?? '')}</p>`)
    .replace(SVG_SLOT_RE, () => svg)
    .replace(CARDS_SLOT_RE, () => cards)
    .replace(TEMPLATE_PLACEHOLDERS[3], () => footer);
}

// CJK and other fullwidth glyphs render at roughly twice the advance width of
// ASCII in the monospace stacks the template uses. Includes the supplementary
// CJK extensions and emoji, which also render double-width.
//
// Code points that take two columns of advance width: East Asian Wide and
// Fullwidth per UAX #11, tracking Unicode 17.0. That takes in the BMP symbols
// carrying emoji presentation (U+2705, U+2B50, U+26A1, U+231B, ...), which
// render at the same square advance as the supplementary-plane emoji already
// listed here, and Hangul Jamo Extended-A. Two boundary calls worth naming:
// Unicode 16.0 reclassified the trigrams (U+2630-U+2637) and the monogram /
// digram symbols (U+268A-U+268F) from Neutral to Wide, so both are in; and
// Hangul Jamo Extended-A stops at U+A97C, its last assigned jamo, because
// U+A97D-U+A97F are unassigned, and unassigned code points outside the CJK
// ranges UAX #11 names default to Neutral rather than Wide. Spelled out as
// ranges because V8 has no \p{East_Asian_Width=W} property escape.
// (ported from upstream tt-a1i/archify PR #91, 2026-09-20 selective tracking;
// Hangul syllables, Han and CJK Ext-B were already two units before the port.)
const FULLWIDTH_RE = /[\u1100-\u115F\u231A-\u231B\u2329-\u232A\u23E9-\u23EC\u23F0\u23F3\u25FD-\u25FE\u2614-\u2615\u2630-\u2637\u2648-\u2653\u267F\u268A-\u268F\u2693\u26A1\u26AA-\u26AB\u26BD-\u26BE\u26C4-\u26C5\u26CE\u26D4\u26EA\u26F2-\u26F3\u26F5\u26FA\u26FD\u2705\u270A-\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B-\u2B1C\u2B50\u2B55\u2E80-\uA4CF\uA960-\uA97C\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6\u{16FE0}-\u{18DFF}\u{1AFF0}-\u{1AFFF}\u{1B000}-\u{1B2FF}\u{1F000}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u;

// A variation selector (U+FE00-U+FE0F) carries no advance of its own: it
// re-presents the character before it. VS16 (U+FE0F) asks for emoji
// presentation, which renders at the square emoji advance, so a base plus
// VS16 is measured as two units -- otherwise widening the emoji-presentation
// bases above turns U+2B50 U+FE0F from two units into three while the glyph on
// screen stays one square, and leaves U+2708 U+FE0F at two only because its
// base happens to be narrow.
//
// VS15 (U+FE0E) asks for text presentation, but fonts do not reliably render
// a wide base (CJK, U+2B50) narrow, so the base keeps its own width. Under-
// measuring spills the label out of its box; over-measuring only pads it.
// (Ported from upstream tt-a1i/archify PR #411/#446, 2026-10-06,
// AUD-20261006-064551-c7ac70de.)
const VARIATION_SELECTOR_FIRST = 0xfe00;
const VARIATION_SELECTOR_LAST = 0xfe0f;
const VARIATION_SELECTOR_EMOJI = 0xfe0f;

export function textUnits(text) {
  const chars = Array.from(String(text ?? ''));
  let units = 0;
  for (let i = 0; i < chars.length; i += 1) {
    const codePoint = chars[i].codePointAt(0);
    if (codePoint >= VARIATION_SELECTOR_FIRST && codePoint <= VARIATION_SELECTOR_LAST) continue;
    const next = i + 1 < chars.length ? chars[i + 1].codePointAt(0) : -1;
    if (next === VARIATION_SELECTOR_EMOJI) units += 2;
    else units += FULLWIDTH_RE.test(chars[i]) ? 2 : 1;
  }
  return units;
}

// How many text units (see textUnits) fit in `px` at `perUnit` px per unit —
// used by validators to phrase "shorten to <= N units" hints.
export function maxChars(px, perUnit) {
  return Math.floor(px / perUnit);
}
