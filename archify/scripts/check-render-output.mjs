#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2];

if (!input || input === '-h' || input === '--help') {
  console.error('Usage: node scripts/check-render-output.mjs <diagram.html>');
  process.exit(input ? 0 : 2);
}

const htmlPath = path.resolve(input);
let html;
try {
  html = fs.readFileSync(htmlPath, 'utf8');
} catch (err) {
  console.error(JSON.stringify({
    ok: false,
    file: htmlPath,
    checks: [{ name: 'file_readable', ok: false, details: [err.message] }],
  }, null, 2));
  process.exit(1);
}

const checks = [];

// finite_svg scans only numeric/geometry attributes. Authored prose -- node
// labels, <title> text, aria-labels, data-* attributes -- may legitimately say
// "undefined state" or "Infinity scroll" without any coordinate being
// non-finite. (Ported from upstream tt-a1i/archify PR #373, 2026-10-06
// selective tracking, AUD-20261006-064551-c7ac70de.)
const NON_FINITE_TOKEN = /\b(?:NaN|undefined|Infinity)\b/;
// Consume comments/CDATA as whole tokens, including any tag-like prose.
const SVG_TAG_TOKEN = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<(\/?)([A-Za-z][\w:-]*)(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const HTML_VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const SVG_HTML_INTEGRATION_POINTS = new Set(['foreignobject', 'desc', 'title']);
const HTML_ATTRIBUTE = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
const NUMERIC_ATTRS = new Set([
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'dx', 'dy', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy',
  'fr', 'width', 'height', 'd', 'points', 'pathlength', 'transform', 'viewbox', 'offset',
  'opacity', 'fill-opacity', 'flood-opacity', 'stop-opacity', 'stroke-opacity', 'font-size',
  'font-size-adjust', 'font-weight', 'letter-spacing', 'word-spacing', 'kerning', 'stroke-width',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'textlength', 'startoffset',
  'rotate', 'markerwidth', 'markerheight', 'refx', 'refy', 'orient', 'patterntransform',
  'gradienttransform', 'filterres', 'stddeviation', 'basefrequency', 'numoctaves', 'seed',
  'surfacescale', 'diffuseconstant', 'specularconstant', 'specularexponent',
  'limitingconeangle', 'azimuth', 'elevation', 'pointsatx', 'pointsaty', 'pointsatz',
  'kernelmatrix', 'order', 'divisor', 'bias', 'targetx', 'targety', 'kernelunitlength',
  'scale', 'radius', 'k1', 'k2', 'k3', 'k4', 'tablevalues', 'slope', 'intercept',
  'amplitude', 'exponent',
]);
const ELEMENT_NUMERIC_ATTRS = new Map([
  ['fecolormatrix', new Set(['values'])],
  ['fepointlight', new Set(['z'])],
  ['fespotlight', new Set(['z'])],
]);

function collectNonFiniteAttrs(svg) {
  const details = [];
  const stack = [];
  for (const match of svg.matchAll(SVG_TAG_TOKEN)) {
    if (!match[2]) continue;
    const element = match[2].toLowerCase();
    if (match[1]) {
      const index = stack.map((entry) => entry.element).lastIndexOf(element);
      if (index >= 0) stack.length = index;
      continue;
    }
    const parent = stack[stack.length - 1];
    const inSvg = element === 'svg'
      || Boolean(parent?.inSvg && !SVG_HTML_INTEGRATION_POINTS.has(parent.element));
    if (inSvg) {
      for (const [name, value] of attrEntries(match[0])) {
        if (!isNumericAttr(element, name) || !NON_FINITE_TOKEN.test(decodeNumericReferences(value))) continue;
        details.push(`${match[2]} ${name}="${value}"`);
      }
    }
    // HTML void elements do not open a context; SVG self-closing tags do not
    // either. A nested <svg> inside foreignObject restores SVG checking.
    if (!(inSvg ? /\/\s*>$/.test(match[0]) : HTML_VOID_ELEMENTS.has(element))) {
      stack.push({ element, inSvg });
    }
  }
  return details;
}

function decodeNumericReferences(value) {
  // Numeric references can encode every letter of NaN/Infinity/undefined.
  return value.replace(/&#(?:x([0-9a-f]+)|([0-9]+));?/gi, (_, hex, decimal) => {
    const point = Number.parseInt(hex || decimal, hex ? 16 : 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : '�';
  });
}

function isNumericAttr(elementName, attrName) {
  const normalizedAttr = attrName.toLowerCase();
  return NUMERIC_ATTRS.has(normalizedAttr)
    || ELEMENT_NUMERIC_ATTRS.get(elementName.toLowerCase())?.has(normalizedAttr);
}

function attrEntries(tag) {
  return [...tag.matchAll(HTML_ATTRIBUTE)].map((match) => [
    match[1],
    match[2] ?? match[3] ?? match[4],
  ]);
}

function addCheck(name, ok, details = []) {
  checks.push({ name, ok, details });
}

const svgMatches = [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)];
addCheck('single_svg', svgMatches.length === 1, [`found ${svgMatches.length} <svg> block(s)`]);

if (svgMatches.length === 1) {
  const svg = svgMatches[0][0];
  const nonFiniteAttrs = collectNonFiniteAttrs(svg);
  addCheck('finite_svg', nonFiniteAttrs.length === 0, nonFiniteAttrs);
  const legendStart = svg.indexOf('<!-- Legend -->');
  const beforeLegend = legendStart >= 0 ? svg.slice(0, legendStart) : svg;
  const arrows = collectArrows(beforeLegend);
  // Every straight segment counts, not only two-point arrows (upstream 3f68bd2).
  const diagonal = arrows.flatMap((arrow) => diagonalStraightSegments(arrow).map((segment) => ({ arrow, ...segment })));
  addCheck(
    'orthogonal_arrows',
    diagonal.length === 0,
    diagonal.map(({ arrow, segmentIndex }) => `${arrow.kind} ${arrow.index} segment ${segmentIndex + 1}: ${arrow.raw}`),
  );

  if (legendStart >= 0) {
    const legendFragment = svg.slice(legendStart);
    const legendBoxes = collectLegendBoxes(legendFragment);
    const collisions = collectLegendCollisions(arrows, legendBoxes);
    addCheck(
      'legend_clearance',
      collisions.length === 0,
      collisions.map((hit) => `${hit.arrow.kind} ${hit.arrow.index} crosses legend ${hit.box.label}`),
    );
  } else {
    addCheck('legend_clearance', true, ['no legend marker found']);
  }
}

const ok = checks.every((check) => check.ok);
console.log(JSON.stringify({ ok, file: htmlPath, checks }, null, 2));
// Let pending stdout writes drain: large receipts are asynchronous when piped (upstream #311).
process.exitCode = ok ? 0 : 1;

function collectArrows(fragment) {
  const arrows = [];
  let index = 0;

  for (const tag of fragment.matchAll(/<(path|line)\b[^>]*>/gi)) {
    const raw = tag[0];
    if (!/\bclass="[^"]*\ba-(?:default|emphasis|security|dashed)\b/.test(raw)) continue;
    if (!/\bmarker-end=/.test(raw)) continue;
    const attrs = parseAttrs(raw);
    const segments = tag[1].toLowerCase() === 'line'
      ? lineSegments(attrs)
      : pathSegments(attrs.d || '');
    arrows.push({ kind: tag[1].toLowerCase(), index: index += 1, raw, segments });
  }

  return arrows;
}

function lineSegments(attrs) {
  const start = [numberAttr(attrs, 'x1'), numberAttr(attrs, 'y1')];
  const end = [numberAttr(attrs, 'x2'), numberAttr(attrs, 'y2')];
  if (!isPoint(start) || !isPoint(end)) return [];
  return [{ start, end }];
}

function pathSegments(d) {
  // A moveto starts a new subpath: the gap before it is not a drawn segment,
  // so it must not read as a diagonal or a crossing (upstream 41a77f6, minimal
  // local form — upstream moved path parsing into svg-path-analysis.mjs).
  const subpathStarts = new Set();
  const points = pointsFromPath(d, subpathStarts);
  const segments = [];
  for (let i = 1; i < points.length; i += 1) {
    if (subpathStarts.has(i)) continue;
    segments.push({ start: points[i - 1], end: points[i] });
  }
  return segments;
}

function diagonalStraightSegments(arrow) {
  return arrow.segments.flatMap(({ start, end }, segmentIndex) => (
    Math.abs(start[0] - end[0]) > 0.01 && Math.abs(start[1] - end[1]) > 0.01
      ? [{ segmentIndex, start, end }]
      : []
  ));
}

function collectLegendBoxes(fragment) {
  const boxes = [];

  for (const match of fragment.matchAll(/<rect\b[^>]*>/gi)) {
    const attrs = parseAttrs(match[0]);
    const x = numberAttr(attrs, 'x');
    const y = numberAttr(attrs, 'y');
    const width = numberAttr(attrs, 'width');
    const height = numberAttr(attrs, 'height');
    if ([x, y, width, height].every(Number.isFinite)) {
      boxes.push({ x1: x, y1: y, x2: x + width, y2: y + height, label: `rect@${x},${y}` });
    }
  }

  for (const match of fragment.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi)) {
    const attrs = parseAttrs(match[1]);
    const box = textBox(attrs, stripTags(match[2]).trim());
    if (box) boxes.push(box);
  }

  return boxes;
}

function collectLegendCollisions(arrows, boxes) {
  const collisions = [];
  for (const arrow of arrows) {
    for (const segment of arrow.segments) {
      for (const box of boxes) {
        if (segmentIntersectsBox(segment, padBox(box, 2))) {
          collisions.push({ arrow, box });
        }
      }
    }
  }
  return collisions;
}

function textBox(attrs, text) {
  const x = numberAttr(attrs, 'x');
  const y = numberAttr(attrs, 'y');
  const fontSize = Number.parseFloat(attrs['font-size'] || '10');
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(fontSize)) return null;
  const width = estimatedTextWidth(text, fontSize);
  const anchor = attrs['text-anchor'] || 'start';
  let x1 = x;
  if (anchor === 'middle') x1 = x - width / 2;
  if (anchor === 'end') x1 = x - width;
  return {
    x1,
    y1: y - fontSize,
    x2: x1 + width,
    y2: y + fontSize * 0.25,
    label: text || `text@${x},${y}`,
  };
}

function estimatedTextWidth(text, fontSize) {
  let units = 0;
  for (const char of text) units += char.charCodeAt(0) > 255 ? 1.8 : 0.62;
  return Math.max(fontSize, units * fontSize);
}

function pointsFromPath(d, subpathStarts = null) {
  const tokens = d.match(/[MLHVZmlhvz]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g) || [];
  const points = [];
  let i = 0;
  let command = '';
  let current = [0, 0];
  let start = null;

  while (i < tokens.length) {
    if (isCommand(tokens[i])) command = tokens[i++];
    if (!command) break;

    const absolute = command === command.toUpperCase();
    switch (command.toUpperCase()) {
      case 'M':
      case 'L': {
        // Only the first pair after M/m is a moveto; later pairs are implicit lineto.
        let moveto = command.toUpperCase() === 'M';
        while (i + 1 < tokens.length && !isCommand(tokens[i])) {
          const x = Number.parseFloat(tokens[i++]);
          const y = Number.parseFloat(tokens[i++]);
          if (!Number.isFinite(x) || !Number.isFinite(y)) break;
          current = absolute ? [x, y] : [current[0] + x, current[1] + y];
          if (moveto) {
            subpathStarts?.add(points.length);
            start = current;
            moveto = false;
          }
          points.push(current);
          if (!start) start = current;
        }
        break;
      }
      case 'H': {
        while (i < tokens.length && !isCommand(tokens[i])) {
          const x = Number.parseFloat(tokens[i++]);
          if (!Number.isFinite(x)) break;
          current = absolute ? [x, current[1]] : [current[0] + x, current[1]];
          points.push(current);
        }
        break;
      }
      case 'V': {
        while (i < tokens.length && !isCommand(tokens[i])) {
          const y = Number.parseFloat(tokens[i++]);
          if (!Number.isFinite(y)) break;
          current = absolute ? [current[0], y] : [current[0], current[1] + y];
          points.push(current);
        }
        break;
      }
      case 'Z': {
        if (start) points.push(start);
        break;
      }
      default:
        return [];
    }
  }

  return points.filter(isPoint);
}

function segmentIntersectsBox(segment, box) {
  const { start, end } = segment;
  if (pointInsideBox(start, box) || pointInsideBox(end, box)) return true;
  const edges = [
    [[box.x1, box.y1], [box.x2, box.y1]],
    [[box.x2, box.y1], [box.x2, box.y2]],
    [[box.x2, box.y2], [box.x1, box.y2]],
    [[box.x1, box.y2], [box.x1, box.y1]],
  ];
  return edges.some(([a, b]) => segmentsIntersect(start, end, a, b));
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;
  return false;
}

function orientation(a, b, c) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b[0] <= Math.max(a[0], c[0]) + 1e-9
    && b[0] + 1e-9 >= Math.min(a[0], c[0])
    && b[1] <= Math.max(a[1], c[1]) + 1e-9
    && b[1] + 1e-9 >= Math.min(a[1], c[1]);
}

function pointInsideBox(point, box) {
  return point[0] >= box.x1 && point[0] <= box.x2 && point[1] >= box.y1 && point[1] <= box.y2;
}

function padBox(box, padding) {
  return {
    ...box,
    x1: box.x1 - padding,
    y1: box.y1 - padding,
    x2: box.x2 + padding,
    y2: box.y2 + padding,
  };
}

function parseAttrs(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}

function numberAttr(attrs, name) {
  return Number.parseFloat(attrs[name]);
}

function isCommand(token) {
  return /^[A-Za-z]$/.test(token);
}

function isPoint(point) {
  return Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, '');
}
