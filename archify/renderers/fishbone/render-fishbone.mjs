// Fishbone (Ishikawa) renderer — one observed effect, causes grouped by
// category, sub-causes hanging off each category. Layout grammar restated
// from cathrynlavery/diagram-design references/type-fishbone.md (MIT) and
// re-expressed on the archify class system; see references/upstream-watch.md.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, maxChars, renderDefinitions, textUnits } from '../shared/utils.mjs';
import { animateAttr, loadDiagram, writeDiagram, svgRootAttrs } from '../shared/cli.mjs';
import { asArray, isFinitePoint } from '../shared/geometry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { diagram: fishbone, template, outPath } = loadDiagram({
  rendererDir: __dirname,
  diagramType: 'fishbone',
  defaultExample: 'checkout-latency.fishbone.json'
});

// Every constant is on the 4px grid. Bones are straight 60° diagonals: a bone
// that attaches to the spine at (ax, CY) ends at (ax - 96, CY ∓ 168). A tick at
// fraction m/6 along the bone therefore sits at (ax - 16m, CY ∓ 28m).
const layout = {
  spineY: 300,
  spineStart: 60,
  firstAttach: 260,   // leftmost bone; leaves room for its sub-cause labels
  headGap: 120,       // spine length between the first bone and the effect box
  boneGap: 160,
  boneDx: -96,
  boneDy: 168,
  tickDx: 16,
  tickDy: 28,
  tickLen: 32,
  tagH: 26,
  tagMinW: 88,
  tagMaxW: 130,
  effectH: 56,
  effectMinW: 180,
  effectMaxW: 320,
  subcauseMaxW: 112,
  legendY: 540,
  height: 572
};

const TICK_FRACTIONS = { 1: [3], 2: [2, 4], 3: [1.5, 3, 4.5] };

const bones = asArray(fishbone.bones);
const head = layout.firstAttach + layout.headGap + layout.boneGap * Math.max(0, bones.length - 1);

function tagWidth(label) {
  return Math.max(layout.tagMinW, Math.round(textUnits(label) * 6.2) + 24);
}

function effectWidth(effect) {
  const longest = Math.max(textUnits(effect?.label) * 6.2, textUnits(effect?.sublabel || '') * 4.3);
  return Math.max(layout.effectMinW, Math.round(longest) + 32);
}

// bone k (1-indexed, first in the array = closest to the head) — odd k above.
function measureBone(bone, index) {
  const k = index + 1;
  const above = k % 2 === 1;
  const sign = above ? -1 : 1;
  const attachX = head - layout.headGap - layout.boneGap * (k - 1);
  const farX = attachX + layout.boneDx;
  const farY = layout.spineY + sign * layout.boneDy;
  const subcauses = asArray(bone.subcauses);
  const fractions = TICK_FRACTIONS[subcauses.length] || [];
  const ticks = subcauses.map((label, i) => {
    const m = fractions[i] ?? 3;
    const x = attachX - layout.tickDx * m;
    const y = layout.spineY + sign * layout.tickDy * m;
    return { label, x, y, endX: x - layout.tickLen, labelX: x - layout.tickLen - 4 };
  });
  const width = tagWidth(bone.label);
  return {
    ...bone,
    k,
    above,
    attachX,
    farX,
    farY,
    ticks,
    subcauses,
    tag: { x: farX - width / 2, y: farY - layout.tagH / 2, width, height: layout.tagH }
  };
}

const measured = bones.map(measureBone);
const effect = {
  ...(fishbone.effect && typeof fishbone.effect === 'object' ? fishbone.effect : {}),
  x: head,
  y: layout.spineY - layout.effectH / 2,
  width: effectWidth(fishbone.effect),
  height: layout.effectH
};
const viewBox = [head + effect.width + 40, layout.height];

function validateFishbone() {
  const problems = [];
  if (fishbone.schema_version !== 1) problems.push('Fishbone files must set "schema_version": 1.');
  if (fishbone.diagram_type !== 'fishbone') problems.push('Fishbone files must set "diagram_type": "fishbone".');
  if (!fishbone.meta?.title) problems.push('Fishbone files must include meta.title.');
  if (!fishbone.effect || typeof fishbone.effect !== 'object' || !fishbone.effect.label) {
    problems.push('Fishbone files must include effect.label — the observed symptom, never the remedy.');
  }
  if (!Array.isArray(fishbone.bones) || fishbone.bones.length < 1 || fishbone.bones.length > 5) {
    problems.push('Fishbone diagrams need 1..5 bones (categories) — a 6th category needs a second diagram or a merged category.');
  }
  if (fishbone.cards !== undefined && !Array.isArray(fishbone.cards)) problems.push('Fishbone "cards" must be an array.');

  const ids = new Set(measured.map((bone) => bone.id));
  if (ids.size !== measured.length) problems.push('Bone ids must be unique.');

  const roots = measured.filter((bone) => bone.rootCause === true);
  if (roots.length !== 1) {
    problems.push(`Exactly one bone must set "rootCause": true — found ${roots.length}. Mark only the confirmed root cause; if two categories are both confirmed, merge them or split into two diagrams.`);
  }

  if (effect.width > layout.effectMaxW) {
    problems.push(`Effect label "${effect.label}" needs a ${effect.width}px box (max ${layout.effectMaxW}px) — shorten it to ≤ ${maxChars(layout.effectMaxW - 32, 6.2)} units or move detail to effect.sublabel.`);
  }

  for (const bone of measured) {
    if (!Array.isArray(bone.subcauses) || bone.subcauses.length < 1 || bone.subcauses.length > 3) {
      problems.push(`Bone "${bone.id}" needs 1..3 sub-causes — an empty category is a placeholder, not a finding; more than 3 becomes a second bone.`);
      continue;
    }
    if (!isFinitePoint(bone.attachX, bone.farX, bone.farY, bone.tag.x, bone.tag.y)) {
      problems.push(`Bone "${bone.id}" produced non-finite coordinates — check that bones is an array of objects.`);
      continue;
    }
    if (bone.tag.width > layout.tagMaxW) {
      problems.push(`Category label "${bone.label}" (~${bone.tag.width}px) is wider than the ${layout.tagMaxW}px tag on bone "${bone.id}" — shorten it to ≤ ${maxChars(layout.tagMaxW - 24, 6.2)} units.`);
    }
    for (const tick of bone.ticks) {
      const estW = Math.round(textUnits(tick.label) * 4.9);
      if (estW > layout.subcauseMaxW) {
        problems.push(`Sub-cause "${tick.label}" on bone "${bone.id}" (~${estW}px) is wider than the ${layout.subcauseMaxW}px sub-cause budget — shorten it to ≤ ${maxChars(layout.subcauseMaxW, 4.9)} units or split it into a second sub-cause.`);
      }
      if (tick.labelX - estW < 24) {
        problems.push(`Sub-cause "${tick.label}" on bone "${bone.id}" runs off the left edge — shorten it to ≤ ${maxChars(tick.labelX - 24, 4.9)} units.`);
      }
    }
  }

  if (problems.length) {
    throw new Error(`Fishbone layout validation failed:\n- ${problems.join('\n- ')}`);
  }
}

function renderSpine() {
  return `        <path d="M ${layout.spineStart} ${layout.spineY} L ${head} ${layout.spineY}" class="a-emphasis"${animateAttr(fishbone.meta, 'edge', 0)} stroke-width="1.6" marker-end="url(#arrowhead-emphasis)"/>`;
}

function renderBoneLine(bone) {
  const cls = bone.rootCause ? 'a-emphasis' : 'a-default';
  const width = bone.rootCause ? 2 : 1.2;
  return `        <path d="M ${bone.attachX} ${layout.spineY} L ${bone.farX} ${bone.farY}" class="${cls}"${animateAttr(fishbone.meta, 'edge', bone.k)} stroke-width="${width}"/>`;
}

function renderTicks(bone) {
  return bone.ticks.map((tick) => `        <path d="M ${tick.x} ${tick.y} L ${tick.endX} ${tick.y}" class="a-default" stroke-width="0.9"/>
        <text x="${tick.labelX}" y="${tick.y + 3}" class="t-muted" font-size="8" text-anchor="end">${esc(tick.label)}</text>`).join('\n');
}

function renderTag(bone) {
  const fill = bone.rootCause ? 'c-backend' : 'c-external';
  const { x, y, width, height } = bone.tag;
  return `        <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" class="c-mask"/>
        <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" class="${fill}"${animateAttr(fishbone.meta, 'node', bone.k)} stroke-width="1.5"/>
        <text x="${bone.farX}" y="${bone.farY + 4}" class="t-primary" font-size="9" font-weight="600" text-anchor="middle">${esc(bone.label)}</text>`;
}

function renderEffect() {
  const cx = effect.x + effect.width / 2;
  const sublabel = effect.sublabel
    ? `\n        <text x="${cx}" y="${effect.y + 40}" class="t-muted" font-size="7" text-anchor="middle">${esc(effect.sublabel)}</text>`
    : '';
  const labelY = effect.sublabel ? effect.y + 24 : effect.y + 32;
  return `        <rect x="${effect.x}" y="${effect.y}" width="${effect.width}" height="${effect.height}" rx="7" class="c-mask"/>
        <rect x="${effect.x}" y="${effect.y}" width="${effect.width}" height="${effect.height}" rx="7" class="c-backend"${animateAttr(fishbone.meta, 'node', 0)} stroke-width="2"/>
        <text x="${cx}" y="${labelY}" class="t-primary" font-size="10" font-weight="600" text-anchor="middle">${esc(effect.label)}</text>${sublabel}`;
}

function renderLegend() {
  const y = layout.legendY;
  return `        <text x="60" y="${y - 20}" class="t-primary" font-size="10" font-weight="600">Legend</text>
        <path d="M 60 ${y - 4} L 84 ${y - 4}" class="a-emphasis" stroke-width="2"/>
        <text x="90" y="${y}" class="t-muted" font-size="7">confirmed root cause</text>
        <path d="M 200 ${y - 4} L 224 ${y - 4}" class="a-default" stroke-width="1.2"/>
        <text x="230" y="${y}" class="t-muted" font-size="7">category bone</text>
        <path d="M 320 ${y - 4} L 344 ${y - 4}" class="a-default" stroke-width="0.9"/>
        <text x="350" y="${y}" class="t-muted" font-size="7">sub-cause tick</text>
        <rect x="440" y="${y - 9}" width="14" height="9" rx="2" class="c-external" stroke-width="1"/>
        <text x="460" y="${y}" class="t-muted" font-size="7">category tag</text>
        <rect x="530" y="${y - 9}" width="14" height="9" rx="2" class="c-backend" stroke-width="1"/>
        <text x="550" y="${y}" class="t-muted" font-size="7">root-cause tag / observed effect</text>`;
}

function renderSvg() {
  return `      <svg viewBox="0 0 ${viewBox[0]} ${viewBox[1]}" ${svgRootAttrs(fishbone.meta, 'fishbone diagram')}>
${renderDefinitions()}

        <!-- Background Grid -->
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Spine -->
${renderSpine()}

        <!-- Category bones -->
${measured.map(renderBoneLine).join('\n')}

        <!-- Sub-cause ticks -->
${measured.map(renderTicks).join('\n')}

        <!-- Category tags -->
${measured.map(renderTag).join('\n\n')}

        <!-- Effect -->
${renderEffect()}

        <!-- Legend -->
${renderLegend()}
      </svg>`;
}

validateFishbone();
writeDiagram({
  outPath,
  template,
  meta: fishbone.meta,
  footerLabel: 'Fishbone diagram',
  svg: renderSvg(),
  cards: fishbone.cards,
});
