# korean-docs — 한국어 산출물 기준 스킬

Claude Code가 만드는 모든 한국어 산출물(답변·문서·번역·교정·검수)에 일관된 용어와 자연스러운 문체를 적용하는 범용 스킬. 어떤 프로젝트에서나 동작하며, 프로젝트별 용어사전과 함께 쓰면 용어 표준이 작업을 거듭할수록 쌓인다.

## 무엇을 해 주나

- **자연스러운 한국어 보장** — 번역투(`~하는 것을 허용합니다`), 이중 피동(`되어진다`), 어색한 음차(`디폴트`, `레짐`), 외래어 표기 오류(`디렉토리` → 디렉터리) 등을 기준 문서와 감사 스크립트로 걸러낸다.
- **용어 일관성** — 프로젝트 용어사전(GLOSSARY.md)에 표준 번역과 금지 표기를 등재하고, 감사 스크립트가 문서 전체를 기계 검사한다.
- **용어사전 진화** — 작업 중 내린 용어 결정과 사용자의 교정을 즉시 용어사전에 등재해, 같은 지적을 두 번 받지 않게 한다. 번역 선택지가 갈리는 용어는 임의로 확정하지 않고 후보·추천안과 함께 사용자 확인을 받아 등재한다.
- **도메인 용어 기준** — 금융·퀀트·트레이딩 도메인의 정착 용어 기준을 내장한다.

## 구성

```
korean-docs/
├── SKILL.md                     # 스킬 본문 — 모드 구분, 워크플로, 감사 도구 사용법
├── README.md                    # 이 파일 (사람용 안내)
├── GLOSSARY.base.md             # 기본 용어사전 — 프로젝트 무관 표기·번역투 규칙 (감사 시 항상 적용)
├── RULES.base.json              # 기본 문장 규칙 팩 — hit/miss 예문을 실은 정규식 규칙 (rules 훑기 전용)
├── scripts/
│   ├── l10n.mjs                 # 통합 CLI — check(문서) · audit(다국어 자원) · rules · suspects · apply
│   ├── check-glossary.mjs       # 문서 감사의 훅 진입점 — check와 같은 엔진, 같은 판정
│   └── lib/                     # 공용 엔진 — 용어사전 파싱·병합(glossary.mjs), 문서 감사(doc-audit.mjs)
├── templates/
│   └── GLOSSARY.md              # 프로젝트 용어사전 템플릿 (check --init으로 생성)
└── references/
    ├── response-style.md        # 상시 적용 기준 — 문체 표 · 여덟 물음 · 단어 고르는 기준 (답변마다 읽는다)
    ├── global-korean-card.md    # 전역 CLAUDE.md에 그대로 붙이는 블록 (요약 뒤에도 남는 습관 목록)
    ├── audit-tooling.md         # 감사 도구 참조 — 훅 · 선언 파일 · 규칙 작성 · 검출 확인 (감사할 때 읽는다)
    ├── korean-style.md          # 교정·검수용 심각도(S1/S2) 패턴 카탈로그 + 번역 문체·원문 충실도 기준
    ├── ui-copy.md               # 화면 문구 판정 기준 (관점 A~Z)
    ├── ui-copy-sweep.md         # 전수 검토 절차
    ├── reading-lens.md · lens.txt  # 규칙이 놓치는 것을 사람이 읽을 후보로 뽑는 렌즈
    └── domain-finance.md        # 금융·퀀트·트레이딩 도메인 용어 (그 분야 작업에서만)
```

## 동작 방식 — 두 가지 모드

- **답변 모드**: 모든 한국어 답변·설명에 `references/response-style.md`의 기준(합니다체, 여덟 물음, 단어 고르는 기준)을 적용한다. 프로젝트에 용어사전이 있으면 답변에도 그 표준을 따른다. 감사 스크립트는 실행하지 않는다.
- **문서 작업 모드**: 문서 작성·번역·교정·검수·용어사전 관리 시 전체 워크플로를 따른다 — 용어사전 읽기 → 작업 → 새 용어 등재(갈리는 용어는 사용자 확인) → 요청받은 감사는 오류 0건까지 → 완료 보고에 용어 결정 절 포함.

발동 경로는 이중화되어 있다. 스킬 description이 한국어 산출물이 있는 거의 모든 작업에서 스킬을 발동시키고, 스킬이 건너뛰어지는 사소한 질문에서도 전역 지침의 필수 읽기 지시(아래)가 문체 기준 적용을 보장한다.

## 전역 지침 연결 (필수)

이 스킬을 모든 세션에서 활용하려면 전역 지침(`~/.claude/CLAUDE.md`)에 두 가지가 있어야 한다.

1. **읽기 지시 한 문단** — 세션에서 한국어를 처음 쓰기 전에 `references/response-style.md`를 읽고
   세션 내내 적용하라는 문장. 스킬이 발동되지 않는 사소한 질문에서도 문체 기준을 적용하게 한다.
2. **습관 카드** — `references/global-korean-card.md`를 표식 주석까지 통째로 붙인 블록. 긴 세션에서
   요약이 일어나면 읽은 파일은 맥락에서 사라지고 전역 지침만 다시 실리므로, 답변 문체와 여덟 물음은
   그 파일에 직접 있어야 한다.

둘 다 있는지는 `node scripts/detect-simplecore.mjs --json`의 `globalKorean.present` · `card`로
확인하고, `/simplecore:init`이 빠진 쪽을 써 넣는다.

## 새 프로젝트에서 시작하기

```bash
# 1. 프로젝트 용어사전 생성 (권장 위치: .claude/GLOSSARY.md)
node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" check --init

# 2. 생성된 파일에서 프로젝트명을 채우고, front matter의 audit.paths에 감사 대상 지정
#    (예: paths: [docs])

# 3. 작업하면서 용어를 등재하고, 감사 실행
node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" check            # audit.paths 대상
node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" check <경로...>  # 특정 파일·폴더

# 4. (선택) 다국어 자원(i18n·메시지 번들·메일)이 있는 프로젝트는 .claude/l10n.json에
#    kinds를 선언하면 audit · rules · suspects · apply가 자원 전체를 같은 규칙으로 다룬다
```

용어사전이 없어도 스킬은 동작한다 — 기본 용어사전(GLOSSARY.base.md)의 규칙만으로 검사하고, 만들라고 먼저 제안하지 않는다. 사용자가 요청하면 `check --init`으로 만든다.

## 용어사전 시스템

- **탐색**: 현재 디렉터리에서 위로 올라가며 `.claude/GLOSSARY.md`(기본 위치) → `GLOSSARY.md` 순서로 찾는다. `.git`이 있는 디렉터리(프로젝트 경계)나 홈 디렉터리에서 멈춘다.
- **병합**: 기본 용어사전 + 프로젝트 용어사전을 병합해 검사한다. 같은 영어 키의 행을 프로젝트에서 정의하면 기본 행 전체가 교체되고, `## 기본 규칙 예외` 표로 기본 규칙을 개별 비활성화할 수 있다(예: 금융 프로젝트의 `레버리지`). 같은 표에 경고 수준의 내장 검사 이름(`heading-form` · `repeat` · `untranslated`)을 적어 그 검사를 끌 수도 있다.
- **수준**: 금지 표기는 `오류`(감사 실패), 금지 표현은 `오류`/`경고`/`경고(N+)`(파일 내 N회 이상일 때만 보고)로 관리한다.
- **세는 대상**: `경고(N+)`와 규칙 팩의 `minPerFile`은 글쓴이가 되풀이한 횟수만 센다. `금지 → 대체` 대조 행의 **대체 쪽은 세지 않는다** — 카탈로그가 쓰라고 적어 둔 문구이지 글쓴이의 문장이 아니다. 대조 행의 판정 조건은 `scripts/lib/doc-audit.mjs`의 `contrastRecommendedRanges`에 적혀 있다. 조건에 맞지 않는 행은 그대로 세므로, 카탈로그는 목록 항목·인용 줄·표 칸 가운데 하나에 화살표 하나짜리 짝으로 적는다.
- **형식**: 표 항목은 `,`로 구분, `/pattern/`은 정규식. 셀 안 `|` 금지, 정규식 안 `,` 금지. 자세한 형식은 `templates/GLOSSARY.md` 참조.

## 감사 도구 요약

```
l10n.mjs check [경로...]   # 문서 감사. 지정 없으면 audit.paths, 그것도 없으면 프로젝트 전체
  --all            # audit.paths 무시하고 프로젝트 전체
  --strict         # 경고도 실패 처리
  --untranslated   # 영문 문장 잔존 경고 (번역 프로젝트)
  --glossary <p>   # 용어사전 경로 직접 지정
  --no-base        # 기본 용어사전 제외
  --list-rules     # 병합된 규칙 목록 출력
  --init           # .claude/GLOSSARY.md 템플릿 생성
l10n.mjs audit             # 다국어 자원 감사 (.claude/l10n.json의 kinds 선언 필요)
l10n.mjs rules --test      # 규칙 팩(RULES.base.json + 프로젝트 팩) 예문 검증
l10n.mjs rules · suspects  # 문장 규칙·문체 의심 훑기 (찾기만 한다)
l10n.mjs apply --patch f   # 문맥을 읽고 다시 쓴 문장을 반영 (--write 전까지 미리보기)
```

`check-glossary.mjs [경로...]`는 문서 감사의 훅 진입점으로 `check`와 같은 엔진·같은 플래그를
쓴다 — 쓰기 시점 훅이 이 경로를 실행하고, 직접 불러도 판정이 같다.

- 명시적으로 지정한 파일은 `audit.exclude`와 무관하게 항상 검사한다. 코드 블록·인라인 코드·링크 경로·URL은 검사에서 제외된다.
- `.md`·`.mdx`와 함께 `.svg` 파일도 검사한다 — SVG는 `<text>`/`<tspan>` 라벨만 보고 태그·속성·스타일·경로는 무시한다. 문서에 삽입된 SVG도, 저장소에 독립으로 있는 외부 `.svg` 파일도 대상이다.
- 종료 코드: `0` 통과, `1` 위반, `2` 사용법·파싱 오류.
