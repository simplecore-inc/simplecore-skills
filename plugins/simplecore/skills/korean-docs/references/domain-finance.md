# Finance · quant · trading terms

Applied on top of [response-style.md](response-style.md) when working on documents, code, or
comments in finance, quant, or trading. Do not read it for other work. Do not build an awkward
expression by transliterating or literally translating an English term: use what Korean financial
practice and academia have settled on, and where nothing is settled, write it out.

### No gratuitous transliteration

| Banned | Replacement |
| ---- | ---- |
| `브레드스` (breadth) | 시장 폭 |
| `험프` (hump) | (유동성 깊이) 정점 |
| `프린트` (print, a trade record) | 체결값, 체결 기록 |
| `틸트` (tilt) | 비중 기울임, 비중 확대 |
| `리더` (leading stocks) | 주도주 |
| `헤드라인` (a headline figure) | 대표 수치, 전체 |
| `오버레이` (analysis overlay) | 보조분석 |
| `레짐` (regime) | 국면 (시장 국면, 급락 국면, 국면 단절, 국면 게이트) |
| `드로다운` (drawdown) | 낙폭, 급락 |

**Only four are registered as words** — `브레드스` · `험프` · `레짐` · `드로다운`. The other five
have a legitimate meaning outside finance (printing, a camera's pan and tilt, a team leader and a
card reader, a news headline, a screen overlay), so the word alone cannot decide, and they are
registered together with the word that does decide: `체결 프린트` · `비중 틸트` · `가치 틸트` ·
`팩터 틸트` · `모멘텀 틸트` · `리더 종목` · `헤드라인 수치` · `헤드라인 지표` · `분석 오버레이`.
**Where that preceding word is absent, a person judges it** — meeting one of these five in a
financial document, confirm what it refers to and fix it to the replacement above.

### Literal translations that are banned or need care

- **`모사(模寫)` is banned** — `simulation` is 「시뮬레이션」, or the settled 「모의」 (모의투자,
  모의 체결). `체결 모사` → 「체결 시뮬레이션」.
- **`함의` (implied) is banned** — use 「내재」: `implied volatility` → 「내재 변동성」, 내재 수익률,
  내재 바스켓.
- **`effective` needs care** — microstructure's `effective spread` (2×|체결가−mid|) is settled as
  「유효 스프레드」, but using 「유효 스프레드」 for the executable bid/ask difference confuses the
  two. Write the latter as **「체결 가능 스프레드」**. `effective leverage` is 「실효 레버리지」.
- **`regime break`** → 「국면 단절」 (in an econometrics context, 「구조적 단절」).
- **Do not translate `book` (the order book) literally** — `책` is banned. Use 「호가창」
  (「호가창이 얇아진다」).
- **`dominated` needs care** — `한국 지배` (Korea-dominated) ✖ is 「한국 주도」. In a market context
  `dominate` is 주도, not 지배.
- **`hard` needs care** — `하드 손절` → 「강제 손절」, `하드 상한` → 「절대 상한」,
  `하드 레짐 단절` → 「명백한 국면 단절」. 「하드코딩」 is settled and stays.
- **Do not translate an English metaphor literally** — plumbing → `배관` ✖ is 「통제 체계」·
  「기반 규칙」, let winners run → `승자 주행` ✖ is 「수익 포지션을 끝까지 끌고 감」, hazard sim →
  `해저드 모사` ✖ is 「장애 시뮬레이션」, aggressiveness dial → `공격성 다이얼` ✖ is
  「공격성 자동 조절」.
- **Do not compress an English noun phrase into a literal one** — `단절 넘는 생존을 보고` ✖ is
  written out as 「단절 전후에도 살아남는지 확인한다」. `가산 선형` (additive linear) →
  「선형 합산」, `비중복분` (incremental / non-overlapping part) →
  「중복되지 않는 부분, 추가 기여분」.

### Settled terms stay (no over-correction)

엣지, 슬리피지, 레이턴시, 커버리지, 바스켓, 포지션, 프록시, 리밸런스, 잔차, 직교, 괴리, 편입/편출,
내재 변동성, 음의 자기상관, 실효 레버리지, 페어/스탯아브, 페이드 (in a trading context), 게이트 and
the like are written as they are.

A specialist English abbreviation or proper noun on first use (NBBO, OU, HAC, ATS) stays in English
rather than being transliterated; write it out once on first use where that helps.

※ The base glossary's `레버리지 → 활용` rule conflicts with this domain. A finance project disables
it by listing `레버리지` under `## 기본 규칙 예외` in its glossary. **The repository that writes this
standard down needs the same exception** — naming a domain term means writing the word, so the
glossary of the repository holding this file carries that exception too. A standard that violates
itself by being written down would make the skill unable to pass its own audit.
