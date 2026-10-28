// meta.column_fit: "spread" (ported from upstream tt-a1i/archify PR #64 under
// selective tracking). Fixed layout must keep historical coordinates byte-for-
// byte; spread must widen boxes/gaps with the viewBox, keep participant order,
// and still fail closed when the canvas cannot hold the participants.
//
//   node --test test/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-column-fit-'));
const example = path.join(skillRoot, 'examples/cache-miss-request.sequence.json');

function render(doc, name) {
  const input = path.join(tmp, `${name}.json`);
  const output = path.join(tmp, `${name}.html`);
  fs.writeFileSync(input, JSON.stringify(doc));
  try {
    execFileSync('node', [path.join(skillRoot, 'renderers/sequence/render-sequence.mjs'), input, output],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    return { code: 0, stderr: '', html: fs.readFileSync(output, 'utf8') };
  } catch (err) {
    return { code: err.status ?? 1, stderr: String(err.stderr || ''), html: '' };
  }
}

function participantRects(html) {
  const svg = html.match(/<svg\b[\s\S]*?<\/svg>/)?.[0] || '';
  return [...svg.matchAll(/<rect x="([\d.]+)" y="72" width="([\d.]+)" height="54" rx="6" class="c-mask"\/>/g)]
    .map((m) => ({ x: Number(m[1]), width: Number(m[2]) }));
}

function load() {
  return JSON.parse(fs.readFileSync(example, 'utf8'));
}

test('column_fit: omitted and "fixed" render identically to the golden coordinates', () => {
  const base = render(load(), 'base');
  const fixed = load();
  fixed.meta.column_fit = 'fixed';
  const rendered = render(fixed, 'fixed');
  assert.equal(base.code, 0);
  assert.equal(rendered.code, 0);
  assert.equal(rendered.html, base.html);
  const rects = participantRects(base.html);
  assert.ok(rects.length >= 2);
  assert.equal(rects[0].width, 86);
  assert.equal(rects[1].x - rects[0].x, 108);
});

test('column_fit: "spread" widens boxes and gaps on a wide viewBox and keeps order', () => {
  const doc = load();
  doc.meta.column_fit = 'spread';
  doc.meta.viewBox = [1400, 760];
  const { code, stderr, html } = render(doc, 'spread');
  assert.equal(code, 0, stderr);
  const rects = participantRects(html);
  assert.ok(rects.length >= 2);
  assert.ok(rects[0].width > 86 && rects[0].width <= 190, `box width ${rects[0].width}`);
  assert.ok(rects[1].x - rects[0].x > 108, 'column gap must grow with the viewBox');
  for (let i = 1; i < rects.length; i += 1) assert.ok(rects[i].x > rects[i - 1].x, 'participant order preserved');
  const last = rects[rects.length - 1];
  assert.ok(last.x + last.width <= 1400 - 40, 'last box stays inside the right margin');
  assert.doesNotMatch(html, /NaN|undefined>/);
});

test('column_fit: "spread" at the 920px default width never shrinks below the fixed layout', () => {
  const doc = load();
  doc.meta.column_fit = 'spread';
  doc.meta.viewBox = [920, 760];
  const { code, stderr, html } = render(doc, 'spread-default');
  assert.equal(code, 0, stderr);
  const rects = participantRects(html);
  assert.ok(rects[0].width >= 86);
  assert.ok(rects[1].x - rects[0].x >= 108);
});

test('column_fit: "spread" fails closed with the viewBox hint when the canvas is too narrow', () => {
  const doc = load();
  doc.meta.column_fit = 'spread';
  doc.meta.viewBox = [480, 760];
  const { code, stderr } = render(doc, 'spread-narrow');
  assert.notEqual(code, 0);
  assert.match(stderr, /exceed viewBox width|set meta\.viewBox\[0\]/);
  assert.doesNotMatch(stderr, /TypeError|is not a function/);
});

test('column_fit: unknown value is rejected by the schema', () => {
  const doc = load();
  doc.meta.column_fit = 'wide';
  const { code, stderr } = render(doc, 'bad');
  assert.notEqual(code, 0);
  assert.match(stderr, /column_fit/);
});

process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
