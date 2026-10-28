// User journey renderer — what one persona does across stages and how it
// feels at each one. The sentiment curve is the load-bearing element; its
// trough and pain markers are the only accents. Layout grammar restated from
// cathrynlavery/diagram-design references/type-journey.md (MIT) on the archify
// class system; see references/upstream-watch.md.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, maxChars, renderDefinitions, textUnits } from '../shared/utils.mjs';
import { animateAttr, loadDiagram, writeDiagram, svgRootAttrs } from '../shared/cli.mjs';
import { asArray, isFinitePoint } from '../shared/geometry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { diagram: journey, template, outPath } = loadDiagram({
  rendererDir: __dirname,
  diagramType: 'journey',
  defaultExample: 'trial-to-paid.journey.json'
});

const LEVELS = ['high', 'med-high', 'neutral', 'med-low', 'low'];
const LEVEL_LABEL = { high: 'HIGH', 'med-high': 'MED-HIGH', neutral: 'NEUTRAL', 'med-low': 'MED-LOW', low: 'LOW' };

const layout = {
  labelX: 88,        // row / level labels, text-anchor end — never rotated
  labelMaxW: 80,     // budget for those labels (7px, letter-spacing 1)
  gridLeft: 96,
  colW: 160,
  gutter: 20,
  eyebrowY: 44,
  nameY: 62,
  bandTop: 88,
  levelStep: 40,     // 5 ordinal levels over a 160px band
  rowGap: 14,        // band bottom → first separator
  actionsH: 40,
  painExtra: 22,     // actions row grows when any stage carries a pain marker
  rowH: 32,
  legendGap: 44,
  maxPain: 2
};

const stages = asArray(journey.stages);
const levelIndex = (level) => LEVELS.indexOf(level);
const levelY = (level) => layout.bandTop + layout.levelStep * levelIndex(level);
const bandBottom = layout.bandTop + layout.levelStep * (LEVELS.length - 1);

const indices = stages.map((stage) => levelIndex(stage.sentiment)).filter((i) => i >= 0);
const troughIndex = indices.length ? Math.max(...indices) : -1;      // deepest level actually used
const troughLevel = troughIndex >= 0 ? LEVELS[troughIndex] : null;
const troughStage = stages.findIndex((stage) => stage.sentiment === troughLevel);
const hasPain = stages.some((stage) => stage.pain);
const hasExtra = typeof journey.extraRow === 'string';

function measureStage(stage, index) {
  const x = layout.gridLeft + index * (layout.colW + layout.gutter);
  return {
    ...stage,
    index,
    x,
    cx: x + layout.colW / 2,
    dotY: levelIndex(stage.sentiment) >= 0 ? levelY(stage.sentiment) : NaN
  };
}

const measured = stages.map(measureStage);
const gridRight = measured.length ? measured[measured.length - 1].x + layout.colW : layout.gridLeft + layout.colW;

// Row bands: separator hairlines at each boundary, labels in the left margin.
const actionsH = layout.actionsH + (hasPain ? layout.painExtra : 0);
const rowsTop = bandBottom + layout.rowGap;
const rowsList = [
  { key: 'action', label: 'ACTIONS', top: rowsTop, height: actionsH, cls: 't-primary', size: 9 },
  { key: 'touchpoint', label: 'TOUCHPOINTS', top: rowsTop + actionsH, height: layout.rowH, cls: 't-muted', size: 8 }
];
if (hasExtra) {
  rowsList.push({ key: 'extra', label: String(journey.extraRow).toUpperCase(), top: rowsTop + actionsH + layout.rowH, height: layout.rowH, cls: 't-muted', size: 8 });
}
const rowsBottom = rowsList[rowsList.length - 1].top + rowsList[rowsList.length - 1].height;
const legendY = rowsBottom + layout.legendGap;
const viewBox = [gridRight + 32, legendY + 20];

function validateJourney() {
  const problems = [];
  if (journey.schema_version !== 1) problems.push('Journey files must set "schema_version": 1.');
  if (journey.diagram_type !== 'journey') problems.push('Journey files must set "diagram_type": "journey".');
  if (!journey.meta?.title) problems.push('Journey files must include meta.title.');
  if (!Array.isArray(journey.stages) || journey.stages.length < 2 || journey.stages.length > 6) {
    problems.push('Journey maps need 2..6 stages — split a wider funnel into two journeys (e.g. acquisition and retention).');
  }
  if (journey.cards !== undefined && !Array.isArray(journey.cards)) problems.push('Journey "cards" must be an array.');
  if (journey.extraRow !== undefined && (typeof journey.extraRow !== 'string' || !journey.extraRow)) {
    problems.push('extraRow must be a non-empty row label such as "OWNER" or "METRIC".');
  } else if (hasExtra) {
    const label = String(journey.extraRow);
    const estW = Math.round(textUnits(label) * 4.3 + Math.max(0, label.length - 1));
    if (estW > layout.labelMaxW) {
      problems.push(`extraRow "${label}" (~${estW}px) is wider than the ${layout.labelMaxW}px label margin — shorten it to ≤ ${maxChars(layout.labelMaxW, 5.3)} units (e.g. "OWNER", "METRIC").`);
    }
  }

  const ids = new Set(measured.map((stage) => stage.id));
  if (ids.size !== measured.length) problems.push('Stage ids must be unique.');

  const used = new Set(measured.map((stage) => stage.sentiment));
  if (measured.length >= 2 && used.size === 1) {
    problems.push('The sentiment curve is flat — every stage has the same sentiment. If nothing changes how the user feels, this is a workflow or lifecycle, not a journey; otherwise name the dip.');
  }

  const pains = measured.filter((stage) => stage.pain);
  if (pains.length > layout.maxPain) {
    problems.push(`${pains.length} stages carry pain markers — max ${layout.maxPain}. If nothing is un-marked, nothing is focal; keep markers on the trough only.`);
  }
  const extras = measured.filter((stage) => stage.extra);
  if (extras.length && !hasExtra) {
    problems.push(`Stage "${extras[0].id}" sets extra but the diagram has no extraRow label — set extraRow (e.g. "OWNER") or drop the field.`);
  }
  if (hasExtra && !extras.length) {
    problems.push(`extraRow "${journey.extraRow}" is set but no stage provides an extra value — fill at least one or remove extraRow.`);
  }

  const textMax = layout.colW - 16;
  for (const stage of measured) {
    if (levelIndex(stage.sentiment) < 0) {
      problems.push(`Stage "${stage.id}" uses unknown sentiment "${stage.sentiment}" — use one of ${LEVELS.join(', ')} (ordinal, never numeric).`);
      continue;
    }
    if (!isFinitePoint(stage.x, stage.cx, stage.dotY)) {
      problems.push(`Stage "${stage.id}" produced non-finite coordinates — check that stages is an array of objects.`);
      continue;
    }
    if (stage.pain && stage.sentiment !== troughLevel) {
      problems.push(`Stage "${stage.id}" carries a pain marker but its sentiment (${stage.sentiment}) is not the trough (${troughLevel}) — pain markers belong on the lowest-sentiment stage(s) only.`);
    }
    const checks = [
      ['label', stage.label, 6.2, textMax],
      ['action', stage.action, 5.6, textMax],
      ['touchpoint', stage.touchpoint, 4.9, textMax],
      ['extra', stage.extra, 4.9, textMax],
      ['pain', stage.pain, 4.3, layout.colW - 32]
    ];
    for (const [field, value, perUnit, max] of checks) {
      if (!value) continue;
      const estW = Math.round(textUnits(value) * perUnit);
      if (estW > max) {
        problems.push(`${field} "${value}" on stage "${stage.id}" (~${estW}px) is wider than the ${max}px column — shorten it to ≤ ${maxChars(max, perUnit)} units.`);
      }
    }
  }

  if (problems.length) {
    throw new Error(`Journey layout validation failed:\n- ${problems.join('\n- ')}`);
  }
}

function renderHeaders() {
  const persona = journey.meta?.persona
    ? `        <text x="${layout.gridLeft}" y="26" class="t-muted" font-size="8">Persona: ${esc(journey.meta.persona)}</text>\n`
    : '';
  return persona + measured.map((stage) => `        <text x="${stage.cx}" y="${layout.eyebrowY}" class="t-dim" font-size="7" font-weight="600" letter-spacing="1" text-anchor="middle">STAGE ${stage.index + 1}</text>
        <text x="${stage.cx}" y="${layout.nameY}" class="t-primary" font-size="10" font-weight="600" text-anchor="middle">${esc(stage.label)}</text>`).join('\n');
}

function renderLevels() {
  const used = new Set(['high', 'neutral', 'low', ...measured.map((stage) => stage.sentiment)]);
  return LEVELS.filter((level) => used.has(level)).map((level) => {
    const y = levelY(level);
    return `        <path d="M ${layout.gridLeft} ${y} L ${gridRight} ${y}" class="a-default" stroke-width="0.5" stroke-dasharray="2,6"/>
        <text x="${layout.labelX}" y="${y + 3}" class="t-dim" font-size="7" text-anchor="end">${LEVEL_LABEL[level]}</text>`;
  }).join('\n');
}

// The curve is data, not a connector: no markers, diagonals allowed. Each
// segment is its own path so trace animation can step through it; the
// segment arriving at the trough is the accent.
function renderCurve() {
  const segments = [];
  for (let i = 1; i < measured.length; i += 1) {
    const a = measured[i - 1];
    const b = measured[i];
    const accent = i === troughStage;
    segments.push(`        <path d="M ${a.cx} ${a.dotY} L ${b.cx} ${b.dotY}" class="${accent ? 'a-emphasis' : 'a-default'}"${animateAttr(journey.meta, 'edge', i - 1)} stroke-width="${accent ? 2 : 1.5}"/>`);
  }
  return segments.join('\n');
}

function renderDots() {
  return measured.map((stage) => {
    const accent = stage.index === troughStage;
    return `        <circle cx="${stage.cx}" cy="${stage.dotY}" r="4.5" class="c-mask"/>
        <circle cx="${stage.cx}" cy="${stage.dotY}" r="4.5" class="${accent ? 'c-backend' : 'c-external'}"${animateAttr(journey.meta, 'node', stage.index)} stroke-width="${accent ? 2 : 1.5}"/>`;
  }).join('\n');
}

function renderRows() {
  const out = [];
  for (const row of rowsList) {
    out.push(`        <path d="M ${layout.gridLeft} ${row.top} L ${gridRight} ${row.top}" class="a-default" stroke-width="0.6"/>
        <text x="${layout.labelX}" y="${row.top + 22}" class="t-dim" font-size="7" font-weight="600" letter-spacing="1" text-anchor="end">${esc(row.label)}</text>`);
    for (const stage of measured) {
      const value = stage[row.key];
      if (!value) continue;
      out.push(`        <text x="${stage.cx}" y="${row.top + 22}" class="${row.cls}" font-size="${row.size}" text-anchor="middle">${esc(value)}</text>`);
      if (row.key === 'action' && stage.pain) {
        const px = stage.x + 12;
        const py = row.top + 32;
        out.push(`        <rect x="${px}" y="${py}" width="${layout.colW - 24}" height="16" rx="2" class="c-mask"/>
        <rect x="${px}" y="${py}" width="${layout.colW - 24}" height="16" rx="2" class="c-security" stroke-width="1" stroke-dasharray="3,3"/>
        <text x="${stage.cx}" y="${py + 11}" class="t-security" font-size="7" text-anchor="middle">${esc(stage.pain)}</text>`);
      }
    }
  }
  out.push(`        <path d="M ${layout.gridLeft} ${rowsBottom} L ${gridRight} ${rowsBottom}" class="a-default" stroke-width="0.6"/>`);
  return out.join('\n');
}

function renderLegend() {
  const y = legendY;
  const x = layout.gridLeft;
  return `        <text x="${x}" y="${y - 20}" class="t-primary" font-size="10" font-weight="600">Legend</text>
        <path d="M ${x} ${y - 4} L ${x + 24} ${y - 4}" class="a-default" stroke-width="1.5"/>
        <text x="${x + 30}" y="${y}" class="t-muted" font-size="7">sentiment</text>
        <circle cx="${x + 107}" cy="${y - 4}" r="4.5" class="c-backend" stroke-width="2"/>
        <text x="${x + 118}" y="${y}" class="t-muted" font-size="7">trough stage</text>
        <rect x="${x + 200}" y="${y - 9}" width="20" height="10" rx="2" class="c-security" stroke-width="1" stroke-dasharray="3,3"/>
        <text x="${x + 226}" y="${y}" class="t-muted" font-size="7">pain point</text>`;
}

function renderSvg() {
  return `      <svg viewBox="0 0 ${viewBox[0]} ${viewBox[1]}" ${svgRootAttrs(journey.meta, 'user journey map')}>
${renderDefinitions()}

        <!-- Background Grid -->
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Stage headers -->
${renderHeaders()}

        <!-- Sentiment levels -->
${renderLevels()}

        <!-- Sentiment curve -->
${renderCurve()}

        <!-- Sentiment dots -->
${renderDots()}

        <!-- Content rows -->
${renderRows()}

        <!-- Legend -->
${renderLegend()}
      </svg>`;
}

validateJourney();
writeDiagram({
  outPath,
  template,
  meta: journey.meta,
  footerLabel: 'User journey map',
  svg: renderSvg(),
  cards: journey.cards,
});
