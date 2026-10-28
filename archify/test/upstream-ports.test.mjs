// Regression tests for upstream fixes ported hunk-by-hunk under the
// selective-tracking contract (.upstream.json). Upstream's own tests for these
// fixes import modules this vendored copy does not carry (diagnostics, i18n,
// quality profiles), so each case is restated against the local renderers.
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-ports-'));

function example(file) {
  return JSON.parse(fs.readFileSync(path.join(skillRoot, 'examples', file), 'utf8'));
}

// Returns { code, stderr, html }. Never throws on non-zero exit.
function render(mode, doc, name) {
  const input = path.join(tmp, `${name}.json`);
  const output = path.join(tmp, `${name}.html`);
  fs.writeFileSync(input, JSON.stringify(doc));
  try {
    execFileSync('node', [path.join(skillRoot, `renderers/${mode}/render-${mode}.mjs`), input, output], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    return { code: 0, stderr: '', html: fs.readFileSync(output, 'utf8') };
  } catch (err) {
    return { code: err.status ?? 1, stderr: String(err.stderr || ''), html: '' };
  }
}

function polylinePoints(d) {
  return [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

test('dataflow: a vertical auto route has no zero-length segment (upstream #169, PR #203)', () => {
  const doc = example('product-analytics.dataflow.json');
  // web (stage 0, row 0) and mobile (stage 0, row 2) share a column, so the
  // auto route is purely vertical and used to repeat both endpoints.
  doc.flows.push({ from: 'web', to: 'mobile', label: 'sync', variant: 'dashed', labelDy: 20 });
  const { code, stderr, html } = render('dataflow', doc, 'dataflow-vertical');
  assert.equal(code, 0, stderr);
  const paths = [...html.matchAll(/<path d="([ML][^"]*)"/g)].map((m) => m[1]).filter((d) => !/[CQAZ]/i.test(d));
  assert.ok(paths.length > 0);
  for (const d of paths) {
    const points = polylinePoints(d);
    for (let i = 1; i < points.length; i += 1) {
      const same = Math.abs(points[i][0] - points[i - 1][0]) <= 0.0001 && Math.abs(points[i][1] - points[i - 1][1]) <= 0.0001;
      assert.equal(same, false, `zero-length segment in d="${d}"`);
    }
  }
});

test('lifecycle: a note-only transition still renders its note (upstream 485f4d2)', () => {
  const doc = example('agent-run.lifecycle.json');
  doc.transitions[0].note = 'needs human sign-off';
  doc.transitions[0].labelDy = 20;
  delete doc.transitions[0].label;
  const { code, stderr, html } = render('lifecycle', doc, 'lifecycle-note-only');
  assert.equal(code, 0, stderr);
  assert.match(html, />needs human sign-off<\/text>/);
});

test('sequence: a segment title wider than its frame is rejected (upstream #297, PR 3c42a59)', () => {
  const doc = example('cache-miss-request.sequence.json');
  doc.segments[0].label = 'A deliberately long segment title that cannot fit '.repeat(4).trim();
  const { code, stderr } = render('sequence', doc, 'sequence-segment-overflow');
  assert.notEqual(code, 0);
  assert.match(stderr, /exceeds the segment frame's available width/);
  assert.match(stderr, /meta\.viewBox\[0\] to at least \d+/);
});

test('sequence: shipped example segment titles still fit (upstream #297, PR 3c42a59)', () => {
  const { code, stderr } = render('sequence', example('cache-miss-request.sequence.json'), 'sequence-segment-ok');
  assert.equal(code, 0, stderr);
});

test('sequence: a self-message is named as unsupported, not as a spacing problem (upstream b18ea2e)', () => {
  const doc = example('cache-miss-request.sequence.json');
  doc.messages[0].to = doc.messages[0].from;
  const { code, stderr } = render('sequence', doc, 'sequence-self-message');
  assert.notEqual(code, 0);
  assert.match(stderr, /is a self-message on participant/);
  assert.doesNotMatch(stderr, /spans 0px/);
});

test('dataflow: an auto route across stages turns in a clear gap, not through a middle node (upstream d484668)', () => {
  const doc = {
    schema_version: 1,
    diagram_type: 'dataflow',
    meta: { title: 'Gap turn', viewBox: [1080, 760] },
    stages: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
    nodes: [
      { id: 'a', type: 'frontend', label: 'Source', stage: 0, row: 0 },
      { id: 'm', type: 'backend', label: 'Middle', stage: 1, row: 1 },
      { id: 'b', type: 'database', label: 'Sink', stage: 2, row: 2 },
    ],
    flows: [{ from: 'a', to: 'b', label: 'rows', variant: 'emphasis', labelDy: -30 }],
  };
  const { code, stderr, html } = render('dataflow', doc, 'dataflow-gap-turn');
  assert.equal(code, 0, stderr);
  const route = [...html.matchAll(/<path d="(M[^"]*)" class="a-emphasis"/g)]
    .map((m) => polylinePoints(m[1]))
    .find((points) => points.length > 2);
  assert.ok(route, 'multi-segment flow path should exist');
  // The middle node box: the third node rect rendered (stage 1, row 1).
  const boxes = [...html.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="6"/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), width: Number(m[3]), height: Number(m[4]) }));
  const middle = boxes.find((box) => box.y === 242);
  assert.ok(middle, 'middle node rect should exist');
  const verticalX = route[1][0];
  assert.ok(verticalX < middle.x || verticalX > middle.x + middle.width,
    `vertical leg x=${verticalX} runs through the middle node [${middle.x}, ${middle.x + middle.width}]`);
});

test('text-fit: an over-long sublabel shrinks toward 6px, and one that cannot fit is rejected (upstream #56, 907ca48)', async () => {
  const { fittedNodeFontSize, minimumNodeTextWidth, availableNodeTextWidth } = await import('../renderers/shared/text-fit.mjs');
  assert.equal(fittedNodeFontSize('short', 120, 8, 6), 8);
  const shrunk = fittedNodeFontSize('a fairly long sublabel here', 120, 8, 6);
  assert.ok(shrunk < 8 && shrunk >= 6, `expected a shrunk size, got ${shrunk}`);
  assert.ok(minimumNodeTextWidth('x'.repeat(60), 6) > availableNodeTextWidth(120));

  const cases = [
    ['workflow', 'agent-tool-call.workflow.json', (doc) => { doc.nodes[0].sublabel = 'x'.repeat(80); }, /Sublabel "x+" needs ~\d+px at the 6px legible minimum/],
    ['dataflow', 'product-analytics.dataflow.json', (doc) => { doc.nodes[0].tag = 'y'.repeat(80); }, /Tag "y+" needs ~\d+px/],
    ['lifecycle', 'agent-run.lifecycle.json', (doc) => { doc.states[0].sublabel = 'z'.repeat(80); }, /Sublabel "z+" needs ~\d+px/],
    ['sequence', 'cache-miss-request.sequence.json', (doc) => { doc.participants[0].sublabel = 'w'.repeat(80); }, /Sublabel "w+" needs ~\d+px/],
    ['architecture', 'web-app.architecture.json', (doc) => { doc.components[0].sublabel = 'v'.repeat(80); }, /Sublabel "v+" needs ~\d+px/],
  ];
  for (const [mode, file, mutate, pattern] of cases) {
    const doc = example(file);
    mutate(doc);
    const { code, stderr } = render(mode, doc, `text-fit-${mode}`);
    assert.notEqual(code, 0, `${mode} should reject`);
    assert.match(stderr, pattern, mode);
  }
});

test('workflow: overlapping phase ranges are rejected (upstream 3f68bd2)', () => {
  const doc = example('agent-tool-call.workflow.json');
  doc.phases[1].fromCol = 1;
  const { code, stderr } = render('workflow', doc, 'workflow-phase-overlap');
  assert.notEqual(code, 0);
  assert.match(stderr, /Phase "reasoning" \(1\.\.3\) overlaps phase "intake" \(0\.\.1\) — start at col 2 or later/);
});

test('dataflow: a diagonal segment through authored via points is rejected (upstream 3f68bd2)', () => {
  const doc = example('product-analytics.dataflow.json');
  doc.flows[0].via = [[184, 157], [200, 271]];
  const { code, stderr } = render('dataflow', doc, 'dataflow-diagonal-via');
  assert.notEqual(code, 0);
  assert.match(stderr, /has a diagonal segment from .* align via\[\d\] with its adjacent point/);
});

test('check-render-output: a diagonal leg inside a multi-point arrow fails orthogonal_arrows (upstream 3f68bd2)', () => {
  const htmlPath = path.join(tmp, 'diagonal-leg.html');
  fs.writeFileSync(htmlPath, '<!doctype html><html><body><svg viewBox="0 0 240 160">'
    + '<path d="M 20 20 L 120 20 L 160 60" class="a-default" stroke-width="1.4" marker-end="url(#arrowhead)"/>'
    + '</svg></body></html>');
  let code = 0;
  let stdout = '';
  try {
    stdout = execFileSync('node', [path.join(skillRoot, 'scripts/check-render-output.mjs'), htmlPath], { encoding: 'utf8' });
  } catch (err) {
    code = err.status ?? 1;
    stdout = String(err.stdout || '');
  }
  assert.equal(code, 1);
  const check = JSON.parse(stdout).checks.find((item) => item.name === 'orthogonal_arrows');
  assert.equal(check.ok, false);
  assert.match(check.details[0], /segment 2/);
});

test('check-render-output: the gap between two subpaths is not a drawn segment (upstream 41a77f6)', () => {
  const htmlPath = path.join(tmp, 'subpaths.html');
  fs.writeFileSync(htmlPath, '<!doctype html><html><body><svg viewBox="0 0 240 160">'
    + '<path d="M 20 20 L 120 20 M 160 80 L 160 120" class="a-default" stroke-width="1.4" marker-end="url(#arrowhead)"/>'
    + '</svg></body></html>');
  const stdout = execFileSync('node', [path.join(skillRoot, 'scripts/check-render-output.mjs'), htmlPath], { encoding: 'utf8' });
  const check = JSON.parse(stdout).checks.find((item) => item.name === 'orthogonal_arrows');
  assert.equal(check.ok, true, JSON.stringify(check.details));
});
