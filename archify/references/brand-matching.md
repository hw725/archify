# archify brand matching — 브랜드 토큰을 템플릿 CSS 변수에 매핑

> 사용자가 “우리 브랜드 색으로”·“사이트 색 맞춰”·“회사 폰트로”라고 할 때만 연다.
> **색·폰트 추출은 이 문서의 일이 아니다** — 웹사이트·디자인 시스템·토큰 JSON에서 팔레트와
> 타이포그래피를 뽑고 근거를 남기는 절차는 `vendor/design-dna`(design-dna 계열)가 정본으로
> 소유한다. archify는 그 결과 토큰을 아래 표로 템플릿 변수에 **배정만** 한다.
> (2026-09-20 AUD-20260920-151402-7dac9db8 — 종전에 여기 있던 출처 확보·추출·미리보기 절차는
> design-dna와 중복이라 제거했다. 원 출처는 cathrynlavery/diagram-design `onboarding.md`·`profiles.md`, MIT.)

## 왜 archify에는 별도 스킨 파일이 없는가

archify는 생성된 HTML 자체가 정본이다 — `assets/template.html`의 `:root`·`[data-theme]`
블록이 CSS 변수를 정의하고, SVG는 클래스(`c-*`·`t-*`·`a-*`)로만 색을 참조한다
(SKILL.md “The Cardinal Rule”). 그래서 브랜드 적용은 **변수 값만 바꾸는 일**이고,
렌더러·스키마·예시는 손대지 않는다. `assets/template.html` 원본도 고치지 않는다
(골든 테스트가 바이트 일치를 요구한다) — 생성물 HTML의 변수 블록만 치환하고, 같은
프로젝트에서 반복할 것이면 그 블록을 프로젝트 폴더(예: `docs/archify-brand.css`)에 두고
다음 렌더 뒤 붙여 넣는다.

## 변수 매핑표 (`assets/template.html` `:root` 기준)

design-dna가 낸 토큰(주 강조색·보조색·배경·텍스트·폰트 3계열, 라이트/다크 두 벌)을 이렇게 배정한다.
브랜드 강조색이 하나면 `--arrow-emphasis`·`--backend-stroke`에, 위험/경고색이 있으면
`--security-stroke`에 준다. 나머지 컴포넌트 계열은 강조색의 명도·채도 변주로 채우되
**대비 3:1 이상**(선/텍스트 대 배경)을 지킨다. 못 채우는 역할은 기본값을 남기고 그 사실을 보고한다.

| 역할 | archify 변수 | 브랜드 토큰에서 받는 것 |
|---|---|---|
| 페이지·패널 배경 | `--bg`, `--panel`, `--panel-border` | body 배경, 카드 배경·테두리 |
| 본문·보조·희미한 텍스트 | `--text`, `--text-muted`, `--text-dim` | 본문색, 캡션색, placeholder색 |
| 기본 연결선·강조 연결선 | `--arrow`, `--arrow-emphasis` | 구분선색, 주 강조색(primary) |
| 컴포넌트 7계열 (fill/stroke 쌍) | `--frontend-*`, `--backend-*`, `--database-*`, `--cloud-*`, `--security-*`, `--messagebus-*`, `--external-*` | 브랜드 팔레트의 보조색들. `fill`은 stroke의 8～12% 알파, `stroke`는 원색 |
| 레인·격자·마스크 | `--lane-fill`, `--lane-stroke`, `--grid`, `--mask` | 표 배경, 격자선, 카드 배경(불투명) |
| 툴바 | `--toolbar-*` | 그대로 두어도 무방(화면 전용, 인쇄·export 미포함) |
| 폰트 | `<style>`의 `font-family` 스택 + export 스크립트의 `svg { font-family … }` 문자열 | 본문·코드 폰트. 웹폰트는 `<link>`를 추가하고 오프라인 fallback을 남긴다 |

## 게이트

- **정확한 폰트만 “브랜드 일치”라 부른다.** 공개 폰트명·굵기를 확인하지 못했으면 fallback을
  썼다고 보고한다.
- **접근성 게이트.** 텍스트 대 배경 4.5:1, 선 대 배경 3:1 미만이면 적용하지 않고 대안 값을 제안한다.
- **다크 테마 동시 적용.** 라이트만 받았으면 다크는 명도 반전이 아니라 “같은 색상·낮은 채도·
  높은 명도 텍스트”로 파생하고, 그 사실을 보고한다.
- **골든·검사기 불변.** 이 절차는 생성물만 바꾼다. `npm test`가 실패하면 template을 건드린 것이다.

## 의도적으로 받지 않는 것: upstream brand-marks

upstream tt-a1i/archify v2.13+의 `brand-marks/`(제품 로고 카탈로그·`renderers/shared/brand-marks.mjs`·
`references/brand-marks.md`)는 컴포넌트에 서비스 로고를 찍는 기능이다. 로컬 archify는 이를
채택하지 않는다(`.upstream.json` `never_adopt`, 선택 추적 계약) — 브랜드 정체성(색·폰트)은
design-dna가, 로고 자산은 사용자가 직접 관리한다.
