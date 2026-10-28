# archify upstream watch

> `SKILL.md`에서 이관(2026-09-16). 해당 작업을 실제로 할 때만 연다.

### Selective tracking: tt-a1i/archify (본체 upstream)

**참 기준(true base)은 upstream `9d54f0e7`(2026-07-11 main)이다.** 로컬 벤더링 파일 해시가
이 커밋과 일치함을 AUD-20260920-151402-7dac9db8에서 확인했다. 이전 계약과 commit 177c323이
적은 `324c0c06`(v2.12.0 태그) pin은 추정 오기였다 — 태그는 이 커밋 뒤에 찍혔다. 그래서
`.upstream.json` `pinned_commit`을 9d54f0e7로 정정했고, upstream v2.16.0(`c826e6c3`,
2026-08-30)까지의 격차는 147커밋이다.

**전면 동기화를 기각한 이유(실측, 2026-09-20).** 같은 예시 JSON에서 나오는 HTML이
52KB→715KB(템플릿 53KB→678KB)로 13배 커진다 — viewer runtime·guided views·brand-marks가
템플릿에 내장되고, CLI SVG export나 경량(정적) 템플릿 옵션이 없다. `writeDiagram`의
START_TYPES가 5종으로 고정되고 시그니처가 바뀌며 `esc` export가 사라져 로컬 렌더러
3종(fishbone·kanban·journey)의 재적응이 릴리스마다 반복된다. 신규 표면 가운데 brand-marks는
design-dna 계열이, viewer·guided views는 eli5가 이미 맡는 영역이라 로컬이 남는 쪽이다.

**추적하는 것.** 주간 스크리닝(`py scripts/sync_upstream.py vendor/archify --dry-run`)은 계속
돌리고, auto 후보로 보고되는 렌더러 층(`renderers/*/render-*.mjs`, `shared/{geometry,cli,validator,
layout-report,text-fit}.mjs`, `schemas/`, `scripts/check-render-output.mjs`, 그 테스트·fixtures)에서
**자족적인 수정만 hunk 단위로 이식**한다. upstream 렌더러가 전부 brand-marks·i18n·legend·
diagnostics를 import하므로 auto 후보를 그대로 sync해서는 안 된다(계약 테스트가 utils·geometry의
로컬 표식을 요구한다). 2026-09-20 이식분: PR #80(`geometry.rectsOverlap` — 비유한 rect는 겹침이
아님), PR #91(`utils.textUnits` — BMP 이모지 표현 기호 2단위·variation selector 규칙),
PR #64(sequence `meta.column_fit: "spread"` — viewBox 폭에 맞춰 참가자 상자·열 간격을 넓힘, 기본
`fixed`는 좌표 불변; 스키마 enum 추가, 테스트 5건). 세 건 모두 로컬 렌더러 3종과 무관한 자족 hunk다.
2026-10-06 이식분(AUD-20261006-064551-c7ac70de, upstream HEAD `73aaa069`·v3.0.1 시점): PR #411·#446
(`utils.textUnits` — VS15 뒤 넓은 기반 문자를 1단위로 줄이던 분기 제거), PR #591
(`geometry.rectsOverlap` — 소수 좌표의 가짜 겹침을 막는 `NUMERIC_CLEARANCE_PX`), PR #373
(`check-render-output` `finite_svg` — 라벨 산문의 「undefined」·「Infinity」를 오탐하지 않게 수치 속성만 검사).
v3.0.0(2026-09-28)도 전면 동기화 재개 조건을 채우지 못했다 — viewer 글꼴 내장으로 산출물이 더 커졌고
CLI 출력은 여전히 template 기반 HTML뿐이다. 보류: PR #509(인자 전개 RangeError — 수만 컴포넌트에서만),
PR #299(Sequence 세그먼트 라벨 넘침 — 로컬에 없는 `segmentLabelBox` 전제).

**주간 스크리닝 규칙(선택 추적).** `triage_sweep.py`는 `mode: selective-tracking` 계약을 upstream
커밋 수만으로는 격차로 보지 않는다 — 미지 경로·에스컬레이션이 생겼을 때만 판정 job을 연다.
LICENSE류 에스컬레이션은 감사가 검토한 blob sha를 `escalate_to_audit_if.reviewed_blobs`에 적어
같은 변경으로 매주 다시 열리지 않게 한다(2026-09-20 HEAD 실측: 자동 72·수동 14·미지 0·에스컬레이션 0).

**제외하는 것(`never_adopt`).** 템플릿, viewer bin(`preview`·`open-artifact`·`visual-check`),
`brand-marks/`, `delta/`, `migrations/`, `recipes/`, `skill-release.json`, viewer·delivery·brand·
authoring 계약 문서, `shared/{brand-marks,generated-brand-marks,i18n,diagnostics,legend,
output-path,repository-evidence,engineering-profiles,desktop-readability}.mjs`, release/update
스크립트, 그리고 그 표면을 검사하는 테스트 전부.

**재심사 조건.** upstream이 정적·경량 템플릿(viewer runtime 없는 출력) 또는 CLI SVG export를
내면 `/audit-config`로 전면 동기화를 다시 심사한다. 기존 예시 JSON 재배치(v2.16 규칙
clean-flow/edge-through-node에 걸리는 2/8건)는 그 규칙을 받지 않는 한 불필요하다.

### Upstream watch: cathrynlavery/diagram-design layout types

[cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) (MIT, Copyright (c) 2025 Cathryn Lavery) ships 10 layout types the original five renderers did not cover. It carries **no renderer code** — each type is a Markdown layout spec (`skills/diagram-design/references/type-<name>.md`) plus hand-placed example HTML — so «porting» means restating the spec on the archify class system and writing a typed renderer, not copying files. First registered as cherry-pick candidates in AUD-20260822-211429-288ba6c6 (2026-08-26); scope confirmed and three ported in AUD-20260918-113315-ffe57ed9 (2026-09-20, upstream commit `dc1ace4`).

**Ported (typed renderers, v2.15.0):** `fishbone` (from `type-fishbone.md`), `kanban` (`type-kanban.md`), `journey` (`type-journey.md`). Each has a schema, renderer, README, worked example, golden render and layout-rule tests. Brand matching (`onboarding.md`·`profiles.md`) is restated as `references/brand-matching.md` — a procedure over the CSS variables of the template, no skin file.

**Still on watch (not implemented):** requests for these fall back to hand-placed architecture mode; spec locations are given so a later port starts from the same place.

| Type | Spec in upstream | Fallback now |
|---|---|---|
| Sankey / flow-quantity | `references/type-sankey.md` — exactly 3 stage columns, ribbon thickness carries data, no arrowheads | `dataviz` skill when magnitudes matter; otherwise `dataflow` |
| Wardley map | `references/type-wardley.md` — value chain vs evolution axis, ≤9 components, ≤12 links | hand-placed architecture mode |
| Deployment | `references/type-deployment.md` — hosts/pods inside ≤3 zones, replica counts, versions | `architecture` with `region` boundaries |
| UML class | `references/type-uml-class.md` — ≤7 classes, operations compartment, typed relationship vocabulary | `architecture` + Mermaid conversion guidance |
| Story map | `references/type-story-map.md` — activities left→right, priority top→bottom, one release cut | hand-placed architecture mode |
| Database schema | `references/type-db-schema.md` — ≤5 tables, real types/constraints, column-to-column FK edges | `architecture` with `database` components |
| Dependency graph | `references/type-dependency.md` | `architecture` mode (pasted DOT is read like Mermaid; inline Markdown → Mermaid `flowchart`) |

The diagram-design repo itself is NOT installed as a competing skill — archify stays the diagram-profile front door.
