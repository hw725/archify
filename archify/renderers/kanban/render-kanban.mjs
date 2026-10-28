// Kanban board renderer — a state census of work-in-progress. No connectors:
// a board shows state, not flow (flow is workflow's job). Layout grammar
// restated from cathrynlavery/diagram-design references/type-kanban.md (MIT)
// on the archify class system; see references/upstream-watch.md.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, maxChars, renderDefinitions, textUnits } from '../shared/utils.mjs';
import { animateAttr, loadDiagram, writeDiagram, svgRootAttrs } from '../shared/cli.mjs';
import { asArray, isFinitePoint } from '../shared/geometry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { diagram: kanban, template, outPath } = loadDiagram({
  rendererDir: __dirname,
  diagramType: 'kanban',
  defaultExample: 'platform-board.kanban.json'
});

const layout = {
  marginX: 32,
  top: 40,
  colW: 176,
  gutter: 24,
  headerH: 36,
  pad: 12,
  cardH: 48,
  cardGap: 12,
  bottomPad: 16,
  maxPerColumn: 4,
  maxItems: 12,
  maxAccent: 2,
  legendGap: 44
};

// Card state → archify semantic fill. blocked reuses the security treatment
// (rose, dashed, left accent bar), waiting the cloud treatment (dashed), done
// the store treatment — the board borrows existing fills, it invents none.
const stateStyle = {
  default: { fill: 'c-external', dash: '' },
  blocked: { fill: 'c-security', dash: ' stroke-dasharray="4,4"' },
  waiting: { fill: 'c-cloud', dash: ' stroke-dasharray="4,3"' },
  done: { fill: 'c-database', dash: '' }
};

const columns = asArray(kanban.columns);
const items = asArray(kanban.items);
const cardW = layout.colW - layout.pad * 2;

const itemsByColumn = new Map(columns.map((column) => [column.id, []]));
for (const item of items) {
  if (itemsByColumn.has(item.column)) itemsByColumn.get(item.column).push(item);
}

const rows = Math.max(1, ...[...itemsByColumn.values()].map((list) => list.length));
const colH = layout.headerH + layout.pad + rows * (layout.cardH + layout.cardGap) - layout.cardGap + layout.bottomPad;
const colBottom = layout.top + colH;
const legendY = colBottom + layout.legendGap;
// The legend strip is 5 fixed entries wide (ends at marginX + ~490); a 1- or
// 2-column board is narrower than that, so the width never drops below it.
const legendMinWidth = layout.marginX * 2 + 490;
const viewBox = [
  Math.max(
    legendMinWidth,
    layout.marginX * 2 + columns.length * layout.colW + Math.max(0, columns.length - 1) * layout.gutter
  ),
  legendY + 20
];

function chipText(column) {
  const count = itemsByColumn.get(column.id)?.length ?? 0;
  return Number.isInteger(column.limit) ? `${count}/${column.limit}` : `${count}`;
}

function isOverLimit(column) {
  const count = itemsByColumn.get(column.id)?.length ?? 0;
  return Number.isInteger(column.limit) && count > column.limit;
}

function measureColumn(column, index) {
  const x = layout.marginX + index * (layout.colW + layout.gutter);
  const text = chipText(column);
  const chipW = Math.round(textUnits(text) * 4.9) + 12;
  const list = itemsByColumn.get(column.id) || [];
  return {
    ...column,
    x,
    y: layout.top,
    width: layout.colW,
    height: colH,
    chip: { text, x: x + layout.colW - layout.pad - chipW, y: layout.top + 10, width: chipW, height: 16, over: isOverLimit(column) },
    cards: list.map((item, j) => ({
      ...item,
      x: x + layout.pad,
      y: layout.top + layout.headerH + layout.pad + j * (layout.cardH + layout.cardGap),
      width: cardW,
      height: layout.cardH
    }))
  };
}

const measured = columns.map(measureColumn);
let stepCounter = 0;
const cardSteps = new Map();
for (const column of measured) {
  for (const card of column.cards) cardSteps.set(card.id, stepCounter += 1);
}

function validateKanban() {
  const problems = [];
  if (kanban.schema_version !== 1) problems.push('Kanban files must set "schema_version": 1.');
  if (kanban.diagram_type !== 'kanban') problems.push('Kanban files must set "diagram_type": "kanban".');
  if (!kanban.meta?.title) problems.push('Kanban files must include meta.title.');
  if (!Array.isArray(kanban.columns) || kanban.columns.length < 1 || kanban.columns.length > 5) {
    problems.push('Kanban boards need 1..5 columns.');
  }
  if (!Array.isArray(kanban.items)) problems.push('Kanban files must include an items array (the work cards; summary "cards" are separate).');
  if (kanban.cards !== undefined && !Array.isArray(kanban.cards)) problems.push('Kanban "cards" must be an array.');

  const columnIds = new Set(columns.map((column) => column.id));
  if (columnIds.size !== columns.length) problems.push('Column ids must be unique.');
  const itemIds = new Set(items.map((item) => item.id));
  if (itemIds.size !== items.length) problems.push('Item ids must be unique.');
  if (items.length > layout.maxItems) {
    problems.push(`Board holds ${items.length} items — max ${layout.maxItems}. Aggregate the backlog into one count card (e.g. "+14 more") instead of listing every item.`);
  }

  for (const item of items) {
    if (!columnIds.has(item.column)) problems.push(`Item "${item.id}" references unknown column "${item.column}".`);
    if (item.state !== undefined && !stateStyle[item.state]) problems.push(`Item "${item.id}" uses unknown state "${item.state}" — use default, blocked, waiting, or done.`);
  }

  let accents = 0;
  for (const column of measured) {
    if (!isFinitePoint(column.x, column.y, column.chip.x)) {
      problems.push(`Column "${column.id}" produced non-finite coordinates — check that columns is an array of objects.`);
      continue;
    }
    if (column.cards.length > layout.maxPerColumn) {
      problems.push(`Column "${column.id}" holds ${column.cards.length} cards — max ${layout.maxPerColumn}. Aggregate the overflow into one count card (e.g. "+${column.cards.length - layout.maxPerColumn + 1} more").`);
    }
    const labelMax = layout.colW - layout.pad * 2 - column.chip.width - 8;
    const labelW = Math.round(textUnits(column.label) * 6.2);
    if (labelW > labelMax) {
      problems.push(`Column label "${column.label}" (~${labelW}px) collides with its WIP chip — shorten it to ≤ ${maxChars(labelMax, 6.2)} units.`);
    }
    if (column.chip.over) accents += 1;
    for (const card of column.cards) {
      if (card.state === 'blocked') accents += 1;
      const titleW = Math.round(textUnits(card.title) * 5.6);
      if (titleW > cardW - 20) {
        problems.push(`Title "${card.title}" (~${titleW}px) is wider than card "${card.id}" (${cardW - 20}px) — shorten it to ≤ ${maxChars(cardW - 20, 5.6)} units or move detail to sublabel.`);
      }
      const subW = Math.round(textUnits(card.sublabel || '') * 4.3);
      if (subW > cardW - 20) {
        problems.push(`Sublabel "${card.sublabel}" (~${subW}px) is wider than card "${card.id}" (${cardW - 20}px) — shorten it to ≤ ${maxChars(cardW - 20, 4.3)} units.`);
      }
    }
  }
  if (accents > layout.maxAccent) {
    problems.push(`Board spends ${accents} accent elements (blocked cards + over-limit chips) — max ${layout.maxAccent}. One or two blocked cards read as signal; more reads as noise. Demote extra blocked cards to waiting or default.`);
  }

  if (problems.length) {
    throw new Error(`Kanban layout validation failed:\n- ${problems.join('\n- ')}`);
  }
}

function renderColumn(column) {
  const chipFill = column.chip.over ? 'c-security' : 'c-external';
  const chipText = column.chip.over ? 't-security' : 't-muted';
  const ruleY = column.y + layout.headerH;
  return `        <rect x="${column.x}" y="${column.y}" width="${column.width}" height="${column.height}" rx="6" class="c-lane" stroke-width="0"/>
        <text x="${column.x + layout.pad}" y="${column.y + 23}" class="t-primary" font-size="10" font-weight="600">${esc(column.label)}</text>
        <rect x="${column.chip.x}" y="${column.chip.y}" width="${column.chip.width}" height="${column.chip.height}" rx="2" class="c-mask"/>
        <rect x="${column.chip.x}" y="${column.chip.y}" width="${column.chip.width}" height="${column.chip.height}" rx="2" class="${chipFill}" stroke-width="1"/>
        <text x="${column.chip.x + column.chip.width / 2}" y="${column.chip.y + 11}" class="${chipText}" font-size="7" font-weight="600" text-anchor="middle">${esc(column.chip.text)}</text>
        <path d="M ${column.x} ${ruleY} L ${column.x + column.width} ${ruleY}" class="a-default" stroke-width="0.6"/>`;
}

function renderCard(card) {
  const style = stateStyle[card.state || 'default'] || stateStyle.default;
  const bar = card.state === 'blocked'
    ? `\n        <rect x="${card.x + 1}" y="${card.y + 4}" width="3" height="${card.height - 8}" rx="1.5" class="t-security"/>`
    : '';
  const sublabel = card.sublabel
    ? `\n        <text x="${card.x + 10}" y="${card.y + 35}" class="t-muted" font-size="7">${esc(card.sublabel)}</text>`
    : '';
  return `        <rect x="${card.x}" y="${card.y}" width="${card.width}" height="${card.height}" rx="6" class="c-mask"/>
        <rect x="${card.x}" y="${card.y}" width="${card.width}" height="${card.height}" rx="6" class="${style.fill}"${animateAttr(kanban.meta, 'node', cardSteps.get(card.id))} stroke-width="1.5"${style.dash}/>${bar}
        <text x="${card.x + 10}" y="${card.y + 19}" class="t-primary" font-size="9" font-weight="600">${esc(card.title)}</text>${sublabel}`;
}

function renderLegend() {
  const y = legendY;
  return `        <text x="${layout.marginX}" y="${y - 20}" class="t-primary" font-size="10" font-weight="600">Legend</text>
        <rect x="${layout.marginX}" y="${y - 9}" width="14" height="9" rx="2" class="c-external" stroke-width="1"/>
        <text x="${layout.marginX + 20}" y="${y}" class="t-muted" font-size="7">in progress</text>
        <rect x="${layout.marginX + 100}" y="${y - 9}" width="14" height="9" rx="2" class="c-security" stroke-width="1" stroke-dasharray="4,4"/>
        <text x="${layout.marginX + 120}" y="${y}" class="t-muted" font-size="7">blocked</text>
        <rect x="${layout.marginX + 180}" y="${y - 9}" width="14" height="9" rx="2" class="c-cloud" stroke-width="1" stroke-dasharray="4,3"/>
        <text x="${layout.marginX + 200}" y="${y}" class="t-muted" font-size="7">waiting / external</text>
        <rect x="${layout.marginX + 300}" y="${y - 9}" width="14" height="9" rx="2" class="c-database" stroke-width="1"/>
        <text x="${layout.marginX + 320}" y="${y}" class="t-muted" font-size="7">done</text>
        <rect x="${layout.marginX + 370}" y="${y - 9}" width="20" height="9" rx="2" class="c-security" stroke-width="1"/>
        <text x="${layout.marginX + 396}" y="${y}" class="t-muted" font-size="7">over WIP limit</text>`;
}

function renderSvg() {
  const cards = measured.flatMap((column) => column.cards);
  return `      <svg viewBox="0 0 ${viewBox[0]} ${viewBox[1]}" ${svgRootAttrs(kanban.meta, 'kanban board')}>
${renderDefinitions()}

        <!-- Background Grid -->
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Columns -->
${measured.map(renderColumn).join('\n\n')}

        <!-- Cards -->
${cards.map(renderCard).join('\n\n')}

        <!-- Legend -->
${renderLegend()}
      </svg>`;
}

validateKanban();
writeDiagram({
  outPath,
  template,
  meta: kanban.meta,
  footerLabel: 'Kanban board',
  svg: renderSvg(),
  cards: kanban.cards,
});
