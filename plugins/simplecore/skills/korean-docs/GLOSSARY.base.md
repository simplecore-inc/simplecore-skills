# The base glossary

The terminology and spelling rules the korean-docs skill applies in every project. The audit script
(`scripts/check-glossary.mjs`) merges them with the project glossary and checks both together.

**Written in English, with Korean only where it is data.** The section headings, the column headers,
the level names (`오류` · `경고` · `경고(N+)`), the terms themselves, and the category descriptions in
the keep-original table are parsed or matched, so they stay exactly as they are. The note column is
guidance and is English.

- A project glossary defining a row with the same `영어` key **replaces this file's row entirely**
  (banned-spelling lists are not merged — carry over the spellings you want to keep). A banned
  expression with the same `금지` pattern is replaced the same way.
- A rule that does not fit a project is disabled through the `## 기본 규칙 예외` table in that
  project's glossary (for example "레버리지" in a financial document).
- Table format: items are separated by `,`. A `/pattern/` item is a regex (lookahead and lookbehind
  allowed); anything else is a literal. Do not write `|` inside a cell (separate items instead of
  using alternation) and do not write `,` inside a regex (it collides with the item separator).
- Only rules agreed on regardless of project and domain live here. Domain concepts are registered in
  each project's glossary.
- **Unlike a domain concept, a product's proper name lives here.** A product's name does not appear
  only in that product's repository — design documents, meeting notes, and another product's
  integration documents all write it, and a transliteration or a wrong capitalization is wrong in
  every project. A lowercase package, directory, or file name is correct, and each row's note draws
  that boundary. The instruction on spelling is section 3 of `references/response-style.md`.

## 용어 대역표

Standard spellings from the loanword orthography and for widely shared technical terms.

| 영어 | 한국어 | 금지 표기 | 비고 |
| ---- | ------ | --------- | ---- |
| directory | 디렉터리 | 디렉토리 | loanword spelling |
| license | 라이선스 | 라이센스 | loanword spelling |
| release | 릴리스 | 릴리즈 | loanword spelling |
| message | 메시지 | 메세지 | loanword spelling |
| application | 애플리케이션 | 어플리케이션 | loanword spelling |
| architecture | 아키텍처 | 아키텍쳐 | loanword spelling |
| transaction | 트랜잭션 | 트랜젝션 | loanword spelling |
| cache | 캐시 | 캐쉬 | loanword spelling |
| data | 데이터 | 데이타 | loanword spelling |
| content | 콘텐츠 | 컨텐츠 | loanword spelling |
| business | 비즈니스 | 비지니스 | loanword spelling |
| controller | 컨트롤러 | 콘트롤러 | loanword spelling |
| method | 메서드 | 메소드 | the National Institute of Korean Language's standard spelling |
| algorithm | 알고리즘 | 알고리듬 | loanword spelling |
| template | 템플릿 | 템플레이트, 탬플릿 | loanword spelling |
| interface | 인터페이스 | 인터훼이스 | loanword spelling |
| snapshot | 스냅샷 | 스넵샷, 스냅숏 | loanword spelling |
| timestamp | 타임스탬프 | 타임스템프 | loanword spelling |
| thread | 스레드 | 쓰레드 | loanword spelling |
| navigation | 내비게이션 | 네비게이션 | loanword spelling |
| collection | 컬렉션 | 콜렉션 | loanword spelling |
| metric | 메트릭 | /매트릭(?!스)/ | a misspelling. 「매트릭스」 (matrix) is a different word, so a lookahead keeps it out. A project may translate it as 「지표」 |
| repository | 저장소 | 리포지토리, 레포지토리 | shared by the git repository and the Repository design pattern |
| operating system | 운영 체제 | 운영체제 | standard spacing |
| among them | 그중 | /그 중(?!복)(?!요)(?!간)(?!계)(?!단)(?!력)(?!심)(?!립)(?!재)(?!지)(?!점)/ | 「그중」 is one word, written closed up. Places where another word follows — 「그 중복」·「그 중요한」 — are filtered out by the following syllable |
| annotation | 애노테이션 | 어노테이션, 애너테이션 | a code annotation in Java and the like. A name in code (`@Table`) keeps its own spelling |
| capture | 캡처 | 캡쳐 | loanword spelling |
| webhook | 웹훅 | 웹후크, 웹 훅 | loanword spelling |
| vendor | 벤더 | 밴더 | loanword spelling |
| enum | 열거형 | 이넘 | |
| endpoint | 엔드포인트 | 종단점, 엔드 포인트 | |
| credential | 자격 증명 | 크리덴셜 | |
| parameter | 매개변수 | /(?<!하이퍼)파라미터/ | 「하이퍼파라미터」 (settled in ML) is the exception. A project where 「파라미터」 is the convention disables this with a base-rule exception |
| best practices | 모범 사례 | 베스트 프랙티스 | |
| default | 기본값, 기본 | | the transliteration "디폴트" is caught by the banned-expression table |
| frontend (UI 계층 지칭) | 프론트엔드 | 프런트엔드, 프런트 | The National Institute of Korean Language's standard is 「프런트」 (as in a hotel front desk), but 「프론트엔드」 is the overwhelmingly settled usage in software. Do not shorten it to 「프런트」 on its own |
| delivery (메시징·동기화 전달 단위) | 전송 | 배송 | delivery as a per-target unit in a messaging or synchronization pipeline is 「전송」. A delivery that really is a parcel is 「배송」 and this rule does not apply to it (that domain disables the rule through the project glossary). A `delivery` in a code identifier is not translated |
| stuck | 정체 | 고착 | a state transition that has stopped making progress (정체된 작업, 정체 복구). Before a concrete noun write 「정체된 X」; before a general noun such as 복구 or 판정 write 「정체 X」 |
| drop | 드롭 | 드랍 | loanword spelling |
| gateway | 게이트웨이 | 게이트웨어 | loanword spelling |
| backpressure | 백프레셔 | 역압 | the transliteration is the settled spelling for flow control in streaming and asynchronous systems. In mechanical and fluid domains back pressure is 「배압」, so those projects disable this with a base-rule exception |
| timezone | 시간대 | 타임존 | per the IANA identifiers. Code identifiers (`timezone`·`timeZone` field names) and configuration keys keep their own spelling |
| secure context | 보안 컨텍스트 | 시큐어 컨텍스트 | the W3C term for the condition (https or localhost) under which a browser exposes powerful APIs such as WebAuthn and the clipboard |
| passkey | 패스키 | 패스 키 | the user-facing name of a WebAuthn/FIDO credential; the transliteration is the settled spelling. Code identifiers keep their own |
| presigned URL | 사전 서명 URL | 프리사인드 URL, 프리사인 URL | an object-storage URL issued with an expiring signature parameter. A project that narrows it with a purpose prefix replaces this row by defining its own with the same `presigned URL` key |
| AccessCORE | AccessCORE | AccessCore, Accesscore, ACCESSCORE, 액세스코어 | a product name; only the last four letters are capitalized. **A lowercase identifier is correct and is not caught** — the package `dev.accesscore`, the directory `accesscore-license-admin`, the file `accesscore-logo.tsx`. The rule is case-sensitive, so lowercase `accesscore` matches none of the four patterns. Write an all-caps code name (a constant, an environment variable) inside a code span, which is excluded from checking and so never matches `ACCESSCORE`. **Screen copy cannot use backticks, so mark that place with `<code>` or a `mono` class** — its inside, holding no Hangul, is excluded like inline code (SKILL.md), which is why no project-level exception is needed here |
| SimpliX | SimpliX | 심플릭스 | a product name; do not transliterate. **Lowercase `simplix` is correct and is not caught** — the package `simplix-react`, the config file `simplix.config.ts`, the skill name `simplix:frontend`. This row looks only for the Hangul transliteration |
| PACS Studio | PACS Studio | 팩스 스튜디오 | a product name. **「팩스」 on its own is not caught** — the fax that sends documents is a different word, so only the two-word `팩스 스튜디오` is matched |
| NICEPAY | 나이스페이 | 나이스페이먼츠, NICE페이 | the name of a payment gateway. **`NICE`·`nice`·「나이스」 alone are not this company and are not caught** — the English word nice, the credit-rating agency 나이스, and the grade NICE are all different things, so only `나이스페이먼츠`·`NICE페이` are matched |

## 원문 유지 용어

Categories kept in the original rather than translated or transliterated. A reference table, not an
audit target (the common transliteration errors are caught by the banned-expression table below).
**The first column stays Korean on purpose**: an item carrying Hangul or parentheses is read as a
category description, and only a plain-ASCII item is taken as a proper noun for the untranslated
check.

| 용어 | 비고 |
| ---- | ---- |
| 제품명·서비스명 (Docker, Kubernetes, GitHub 등) | do not transliterate ("도커") |
| 언어·프레임워크명 (Java, Python, Spring 등) | do not transliterate ("자바") |
| 약어 (API, SQL, HTTP, CLI, JVM, GC 등) | keep the original |
| 코드 식별자·설정 키·CLI 명령·SQL 키워드 | everything written as code |

## 금지 표현

Translation-ese, transliteration, and AI style patterns. The reasoning behind the sentence patterns
is in `references/korean-style.md` and `references/ai-tells.md`; the vocabulary and spelling
standard is in `references/response-style.md`.

| 금지 | 대체 | 수준 | 비고 |
| ---- | ---- | ---- | ---- |
| /것을 허용/ | ~할 수 있습니다 | 오류 | a literal "allows you to" |
| /(?<![가-힣])꼴(?![찌불사])/ | 형태 · 경우 · 표현 · 방식 · 문장 | 오류 | a colloquial noun meaning 「모양」, which reads as low register in technical writing. **The replacement is decided by context, not fixed** — 「등재된 꼴만 본다」 is **형태**, 「~가 앞에 오는 꼴만 본다」 is **경우**, 「그 꼴을 허락한다」 is **표현**, 「새는 꼴 하나」 is **예문**. **A compound with Hangul in front of it is legitimate and is not caught** — 글꼴·사다리꼴·세모꼴·네모꼴·마름모꼴, and one repository held thirty-nine occurrences of 「글꼴」 alone. 「꼴찌·꼴불견·꼴사납다」 are different words too |
| /(?<![가-힣])산문/ | 글 · 본문 · 설명문 · 서술 | 오류 | a literal `prose`. Korean 「산문」 is a literary term, the opposite of verse, so it misses when it is meant as 「writing that is not code」. **The replacement is decided by context** — 「커밋 인접 산문」 is **커밋 메시지 주변의 글**, 「합니다체 산문」 is **설명문**, 「설명 산문」 is **설명하는 문장**, 「문서의 산문」 is **본문**. **A compound with Hangul in front is not caught** — the 「산문」 of 「등산문화」 is a different word. A project that discusses literature and pairs it with verse turns this off through `## 기본 규칙 예외` |
| /것을 가능하게/ | ~할 수 있게 합니다 | 오류 | a literal "enables" |
| 할 수 있게 해줍니다 | ~할 수 있습니다 | 오류 | a literal "lets you" |
| 에 대한 지원을 제공 | ~를 지원합니다 | 오류 | a literal "provides support for" |
| /되어[지집진질]/ | ~됩니다, ~될 | 오류 | a double passive ("되어진다", "되어집니다"). The conjugation changes the syllable block, so the final consonants are opened up to catch 「되어진·되어질」 — matching only 「되어지」 lets 「되어진다」 through |
| /보여[지집]/ | 표시됩니다, 나타납니다 | 오류 | a double passive. Fixing it to 「보입니다」 alone removes the double passive but leaves it unclear whether the system displays or the user looks — screen copy says 「표시됩니다」 |
| 당신 | (생략 또는 문장 재구성) | 오류 | a literal "you" |
| /빚지/, /빚는다/, /빚습니다/, /빚어야/ | 요구한다, 필요하다, 함께 내야 한다 | 오류 | a literal "owe". Every conjugation is caught — 빚진다·빚지고·빚질·빚지지 |
| /[의는] 빚[을이가도는]/, /빚을 [진지]/ | 남은 항목, 요구하는 것 | 오류 | the nominal form of a literal "owe" (「프레임의 빚」). A financial document dealing with real debt disables this with a base-rule exception |
| 여러분 | (생략) | 오류 | a literal "you" |
| 우리는, 우리가, 저희 | (생략 또는 문장 재구성) | 오류 | a literal "we" |
| 디폴트 | 기본값, 기본 | 오류 | a transliterated "default" |
| 레버리지 | 활용 | 오류 | a transliterated "leverage". In finance it is the settled term, so those documents disable it with a base-rule exception |
| 하니스, 하네스 | 실행 환경 | 오류 | a transliterated "harness". Depending on context: 런타임, 제어 계층, 테스트 실행 환경, 평가 파이프라인. A document about physical equipment (a safety harness) disables it with a base-rule exception |
| /소비(?!자)/ | 사용, 사용량 | 오류 | a literal "consume". **Excluding 「소비자」 here does not mean it is allowed** — the word splits into two meanings that a word-level rule cannot judge, and the rule pack's `software-consumer` catches calling an API or event consumer a 「소비자」 (the economics 소비자 of 소비자물가 · 소비자 보호 is legitimate and stays). A messaging domain where it is settled disables this with an exception |
| /이벤트[를을] ?방출/, /이벤트 방출/, /값[을를] ?방출/, /신호[를을] ?방출/, /스트림[을를] ?방출/, /방출하는 이벤트/ | 내보내기, 발생 | 오류 | a literal "emit". **The word alone does not separate them, so it is registered with the preceding word** — 「압력 방출」·「폭연방출구」·「방출량」·「방출밸브」·「방사선 방출」·「대기 방출」·「열 방출」 are formal terms in industrial safety, chemical engineering, environment, and physics, and banning the bare word turns every document in those fields into errors. A place with no preceding word is judged by a person |
| /커밋[을를] 세[운우워웠]/, /빌드[을를] 세[운우워웠]/, /서버[을를] 세[운우워웠]/, /컨테이너[을를] 세[운우워웠]/, /이미지[을를] 세[운우워웠]/ | 커밋한다, 빌드한다, 띄운다, 만든다 | 오류 | a literal "build"·"stand up". 「계획을 세운다」·「규칙을 세운다」 are legitimate, so the pattern is not widened: only objects with no legitimate use are named. **Conjugation changes the syllable block, so the stem 「세우」 alone catches neither `세운다` nor `세워`** — open the final consonant for a verb that takes one or contracts. A vertical bar splits the table column even when escaped, so the items are separated by commas instead of regex alternation |
| /[이가로] 선다/, /[이가로] 섰/, /[이가] 서 있/, /[이가로] 서는 (?!곳)/, /[이가로] 설 것/ | 있다, 표시된다, 배치된다, 만들어졌다 | 경고 | a literal "stand". A screen, a rule, or a value that 「선다」 is translation-ese. A person, a car, or a building really does stand, so this is a warning rather than an error. **Conjugation changes the syllable block** — matching only `선다` lets `섰다`·`섰습니다`·`서 있다`·`서는` through, and the particle arrives as `로` (「영어로 선다」) as well as `이`·`가` |
| /구워 ?넣/, /구워져/, /구워 있/, /구워진/, /구워집/, /구워 ?내보내/, /구워 ?낸/, /구운 파일/ | 이미지에 넣기, 빌드에 들어 있음, 새겨 넣기, 적용해 저장하기, 포함 | 경고 | a literal "baked into"·"burned in". Neither writing a value into an image or a build nor burning a mask or subtitles into a file is 「굽는다」. **Conjugation changes the syllable block** — matching only `구워져` lets `구워진 파일`·`구워집니다`·`구워 내보낸다` through. 「CD를 굽는다」 is settled and cooking is legitimate, so the stem is not widened to 「굽」. A document about cooking disables this with a base-rule exception |
| 본질적으로 | (삭제 또는 구체 서술) | 오류 | a literal "essentially" |
| 표면 | 문맥에 맞게: 엔드포인트, 조회 주소, 맡은 범위, 영역, 구성 | 오류 | a literal "surface". The replacement depends on what is meant — the set of addresses an API opens is "엔드포인트", one address answering a list or a detail is "조회 주소", the share an agent or a team takes on ("서버 표면"·"화면 표면"·"작업 표면") is "맡은 범위"·"서버 쪽"·"건드리는 곳", and the kinds and placement of documents is "문서 구성". **A window a screen is drawn in** (a popover, a separate window, full screen) is "창", easily confused with "화면 표면" above — the question that separates them is whether it has pixel dimensions. With dimensions it is a window; without, it is about who takes on what, and therefore "맡은 범위". A document about physical surfaces (pipe surface temperature, coating, surface treatment) disables this through `## 기본 규칙 예외` — **that exception switches off the whole repository, quieting the software sense too.** Where both senses live in one repository, the rule pack's `software-surface` keeps catching the software one |
| 배선 | 조립(부트 구성)·등록·연결(경로에 꽂기) | 경고 | a literal "wiring" (including 「재배선」). "연동" (runtime linkage) and "통합" (integration) are separate concepts and are not replacements. Physical electrical wiring is the correct term, so keep such uses and disable the rule in a document centred on it |
| 와이어링 | 조립, 등록, 연결 | 오류 | a transliterated "wiring" |
| /전선에서 [빼걷]/, /전선에 [싣실]/, /전선이 [나실]/, /전선을 [타탄]/ | 응답에서 뺀다, 응답에 포함한다, 응답이 전달한다 | 오류 | a literal "on the wire". A Korean 전선 is an electrical cable. A document about actual cables and power distribution disables this with a base-rule exception |
| /커밋[을를] ?밀/, /브랜치[을를] ?밀/, /메인[을를] ?밀/, /원격[에으]?로 ?밀/, /저장소[에로] ?밀/ | 푸시한다 | 오류 | "push" rendered into Korean. **It is the pair of 커밋** — this tool's operation names (커밋·머지·리베이스) are used as they are, and translating only 푸시 is the inconsistency. **The word 「밀다」 itself is not blocked** — a forklift pushing its forks and a bulldozer pushing earth are real actions in that field and appear in industrial-safety documents. What separates them is the object: a commit, a branch, and a remote cannot be physically pushed. **The cause is the urge to render a settled loanword into Korean, and over-correction is not the safe side but the twin failure** |
| /인구 ?조사/ | 전수 조사, 전수 확인, 전부 세기 | 오류 | a literal "census". **인구 is a count of people** — counting files, call sites, checkers, or frames is not a population, and 「전수 조사」 says the same thing without the human metaphor. **It is worst in a product about people**: it collides in one document with places that really do count people (상시 근로자 수 · 재적 인원), and the reader has to think twice about which is meant (the same reason 「죽은」·「살아 있는」 were separated). Counting people really has its own names (「상시 근로자 수」·「재적 인원」·「출역 인원」), so no exception is needed |
| /생활권/ | 도보 N분 거리, 인접, 같은 지역, 같은 단지 | 오류 | a formal term of urban planning and regional development (「생활권 계획」·「중생활권」·「생활권 공원」) borrowed to mean 「nearby」. **What separates them is whether there is a value that can be checked** — 「같은 생활권에 있다」 makes the reader guess the range, while 「도보 10분 거리에 있다」 is a fact that can be compared. Caught: 「발주자 본사와 같은 생활권에 있다」 → 「발주자 본사에서 도보 10분 거리에 있다」. Not to be caught: 「1생활권 상업용지」·「생활권 계획 수립」 in urban-planning, regional-development, and real-estate documents are formal terms, so those projects disable it through `## 기본 규칙 예외` |
| /에 산다/, /에 삽니다/, /에 사는[지 ]/, /에 살고/, /에 살아 있/, 사는 곳 | ~에 있다, ~에 둔다, ~에 남는다, 위치 | 경고 | a literal "lives". Do not write where a file, some code, or a setting 「산다」. **Conjugation changes the syllable block** — matching only `산다` lets `사는지`·`살고`·`삽니다` through. A person really living somewhere (「서울에 산다」) is legitimate and letters alone do not separate them, so this is a warning rather than an error. A document full of people disables it with a base-rule exception |
| /같은 나무/, /한 나무에/, /그 나무에/, /나무에서 [일작커]/, /나무를 [나공쓰]/, /마이그레이션 나무/, /디렉터리 나무/, /폴더 나무/ | 작업 트리, 저장소, 계보, 디렉터리 구조 | 경고 | a literal "working tree"·"tree". A folder tree on a screen is 「트리」. A document about actual trees disables this with a base-rule exception |
| /에 있어(?![야도\s])서?/ | ~에서, ~할 때 | 경고 | a literal "in terms of". **Conjugations that state existence are excluded by the following syllable** — the 「있어야」 of 「목록에 있어야 합니다」, the 「있어도」 of 「범위 밖에 있어도」, and **the connective form followed by a clause** (「낱말이 한 자리에 있어 고치면」) are not this translation-ese. All three have to be enumerated because the ending changes the syllable, so the stem 「있어」 cannot separate them. The translation-ese side appears as 「~에 있어서」 and as 「~에 있어,」 with a comma, so 「서」 and the punctuation are caught as they are |
| /가지고 있/ | ~가 있습니다, ~를 제공합니다 | 경고 | a literal "have" |
| /그것(?!도)/ | (생략 또는 명사 반복) | 경고 | a literal "it". 「그것도」 (= besides, even that) is a legitimate idiom and is excluded |
| 에서의, 으로의, 에의 | 절·구로 풀어쓰기 | 경고 | double particles |
| /(?<!야 )할 것입니다/ | ~합니다 | 경고 | a literal "will". A statement of fact is present tense. Obligation — 「~해야 할 것입니다」 — is not a future assertion and is excluded by a lookbehind: catching 「곧 처리해야 할 것입니다」 would be a false positive |
| 결론적으로 | (내용으로 마무리) | 경고 | the summarizing-pivot habit |
| /도커(?!파일)/ | Docker | 오류 | a product name; do not transliterate ("도커파일" is also written Dockerfile) |
| 쿠버네티스 | Kubernetes | 오류 | a product name; do not transliterate |
| 깃허브 | GitHub | 오류 | a product name; do not transliterate |
| /자바(?!스크립트)/ | Java | 오류 | a language name; do not transliterate |
| 자바스크립트 | JavaScript | 오류 | a language name; do not transliterate |
| 파이썬 | Python | 오류 | a language name; do not transliterate |
| 리눅스 | Linux | 오류 | a product name; keep the original |
| 윈도우즈 | Windows | 오류 | a product name; keep the original |
| /리액트(?! 네이티브)/ | React | 오류 | a library name; do not transliterate |
| 리액트 네이티브 | React Native | 오류 | a framework name; do not transliterate |
| 웹뷰 | WebView | 오류 | a platform API name; do not transliterate |
| 엑스포 | Expo | 오류 | a product name; do not transliterate |
| 아이폰 | iPhone | 오류 | a product name; do not transliterate |
| 아이패드 | iPad | 오류 | a product name; do not transliterate |
| 파일들, 사용자들, 개발자들, 서버들, 클라이언트들, 함수들, 객체들, 변수들, 노드들, 테이블들, 컬럼들, 엔티티들, 클러스터들 | 단수형으로(맥락이 복수를 표현) | 경고 | the plural suffix "-들" everywhere |
| /[를을] 통해/ | ~로, ~해서 | 경고(4+) | a literal "via/through" everywhere |
| /에 대[해한]/ | 목적격 조사로 직결 | 경고(6+) | a literal "about/for" everywhere |
| 에 의해 | 행위자를 주어로 | 경고(3+) | literal passives everywhere |
| 또한 | (삭제 또는 문장 재구성) | 경고(4+) | a literal "also/additionally" everywhere |
| 강력한 | 구체적 특성 서술 | 경고(3+) | a literal "powerful" everywhere |
| 수 있습니다 | 단언 가능하면 "~합니다" | 경고(10+) | "can" everywhere. Describing a capability is fine |
| 역위상 | 의존성 역순 | 오류 | the reverse of a topological sort. "역위상" is misread as signal anti-phase and reads oddly. Child → parent direction |
| 위상 순서 | 의존성 순서 | 오류 | topological order — the execution order of a sorted dependency graph. Parent → child direction |
| 위상 정렬 | 의존성 정렬 | 오류 | topological sort — the algorithm that orders a dependency graph |
| 위상 그래프 | 그래프 구조 | 오류 | a literal "topology". **The bare word 「위상」 is not registered** — a signal's phase, mathematical topology, and 「국제적 위상」 are all legitimate, and letters alone do not separate them. Only the compounds diverge in software, so the machine catches these four rows and a person judges the remaining 「위상」 in context |
| /(?<!표현의 )(?<!표현 )충실성/ | 원문 충실도 | 오류 | a literal "fidelity". Accounting's 「표현의 충실성」 (faithful representation) is a formal term and is excluded by the preceding words. An accounting document that repeats it disables the rule with a base-rule exception |
| 거버너 | 감시기, 품질 감시기 | 오류 | a transliterated "governor". A mechanical speed governor is not transliterated either — it is 「조속기」. 「거버넌스」 differs by a syllable (넌 ≠ 너) and is not caught |
| /(?<!논리적 )(?<![가-힣])함의(?![하한할함해])/ | 뒷받침, 담고 있음 | 오류 | a literal "implication". **Logic's 함의 is used as a predicate, so it is excluded by the following syllable** — 「p가 q를 함의한다」·「함의하는」·「함의할」·「함의함」 are legitimate and 「논리적 함의」 is excluded by a lookbehind. **When the preceding character is Hangul it is not the word but 「…함」 plus the particle 「의」** — 결함의·포함의·정함의 are all that shape, and without excluding them every document about defects is caught. What is left is the noun use, 「정책적 함의」·「함의를 담다」. Finance's implied is 「내재」 (내재 변동성) |
| /동치(?![관류])/ | 일치 | 오류 | a literal "equivalent". Mathematics and logic have the formal 「동치관계」·「동치류」, excluded by the following syllable. A mathematics document about equivalent propositions disables it with a base-rule exception |
| /휴리스틱(?! 평가)/ | 경험 규칙 | 오류 | a transliterated "heuristic". HCI's 「휴리스틱 평가」 (Nielsen) is settled and is excluded by a lookahead |
| 정련 | 정제 | 오류 | a literal "refine". Metallurgical and textile 정련 are formal process terms, so those documents disable it with a base-rule exception |
| /다치 술어/, /다중값 술어/ | 다중값 조건 | 오류 | a literal "multi-valued predicate". **A predicate that narrows a query is 「조건」** — 「술어」·「서술어」 are grammar terms, and nobody calls a list filter that. This row once fixed 「다치」 while leaving 「술어」, which endorsed the mistranslation. **The 「서술어」 of grammar stays** — subject-predicate agreement is a subject this skill returns to constantly. **The bare 「다치」 is not caught** — it overlaps with 「다치다」 |
| /가역(?!\s?[반과])/ | 되돌릴 수 있는, 되돌릴 수 없는 | 오류 | a literal "reversible". Chemistry and thermodynamics have the formal 「가역 반응」·「가역과정」, excluded by the following syllable. What is left is software use such as 「가역 작업」·「비가역적 변경」. A thermodynamics document that also writes 「가역 기관」·「가역 단열」 disables it with a base-rule exception |
| 독립확증 | 독립 출처 확인 | 오류 | a coinage: 「독립」 and 「확증」 stuck together, absent from the dictionary |
| /(?<![이꾸])미지(?![수급불지원정근명])(?!\s*[않말못])/ | 낯선, 처음 보는 | 오류 | a literal "unknown". **Words that merely share the syllables are excluded on both sides** — after it 미지수·미지급·미지불·미지지(未支持)·미지원·미지정·미지근·**미지명** (not yet named), and before it **이미지**. Without excluding the front, a document about photographs or builds is caught at every 「이미지」, and that noise buries the real findings. **A verb's conjugation is caught separately** — 「꾸미지 않게」 is the stem 「꾸미」 plus the connective 「지」, not the word 미지. 「꾸미다」 is practically the only stem ending in 「미」, so the front is excluded, and a following negative auxiliary (않·말·못) is excluded with it to cover other stems. The spaced 「이 미지의 값」 has whitespace in front and is still caught. What is left is 「미지의 값」·「미지 영역」 |
| /자기 지지(?![대체])/ | 자기 근거 | 오류 | a literal "self-supporting". A structure's 「자기 지지대」·「자기 지지체」 are excluded by the following syllable |
| /전치(?![사증태])/ | 행·열 뒤바뀜 | 오류 | a literal "transpose". 전치사·전치증폭기·전치태반 are different words, excluded by the following syllable. A linear-algebra document where 「전치행렬」 is the formal term disables it with a base-rule exception |
| 비싼 작업, 비싼 신호, /(?<!비)싼 신호/ | 비용이 큰 …, 비용이 적은 … | 오류 | a literal "expensive"·"cheap". The cost is high, not the price. **「싼 신호」 is the tail of 「비싼 신호」, so a lookbehind keeps one place from being reported twice.** 「싼 요금제」 about a real price is legitimate, so the following noun is written in to narrow it |
| 나쁜 정보 | 잘못된 정보 | 오류 | a literal "bad information". Information is not morally good or bad |
| /답변에 ?안? ?떠오르/ | 답변에 나오지 않게 | 오류 | a literal "surface in the answer". Write plainly what does and does not appear in the answer |
| 전제 위에 | 전제를 바탕으로 | 오류 | a literal "build on the premise". A premise is a ground, not the base of a structure |
| 붙는 위치, 붙이는 위치 | 적용 위치, 연결 지점 | 오류 | a literal "where it hooks". Write what applies where, and what is connected to what |
| 정밀도와 회수율, 회수율과 정밀도 | 재현율 | 오류 | a literal "recall". **The bare 「회수율」 is not registered** — 채권 회수율 · 설문 회수율 · 자원 회수율 are formal terms and letters alone do not separate them. Only its pairing with precision is caught |
| 프로레이션 | 일할 계산 | 오류 | a transliterated "proration" |
| 캐리오버 | 이월 | 오류 | a transliterated "carryover" |
| /더닝(?!.?크루거)/ | 재청구 | 오류 | a transliterated "dunning". 「더닝 크루거」·「더닝-크루거」·「더닝크루거」 are a personal name and are excluded |
| 리펀드 | 환불 | 오류 | a transliterated "refund" |
| 서브스크립션 | 구독 | 오류 | a transliterated "subscription" |
| /오더(?![라니군냐])/ | 주문 | 오류 | a transliterated "order". 「워크오더」·「오더링」 are the same family. **The connective forms of 「오다」 are excluded by the following syllable** — 오더라도·오더라·오더니·오더군·오더냐 are the verb, not a transliteration |
| 브레드스 | 시장 폭 | 오류 | a transliterated "breadth" |
| 험프 | 정점 | 오류 | a transliterated "hump" — the peak of liquidity depth. A document about road humps (「험프형 과속방지턱」) disables it with a base-rule exception |
| 레짐 | 국면 | 오류 | a transliterated "regime" — 시장 국면 · 급락 국면 · 국면 단절 · 국면 게이트 |
| 드로다운 | 낙폭, 급락 | 오류 | a transliterated "drawdown" |
| 체결 프린트 | 체결값, 체결 기록 | 오류 | a literal "print" (a trade record). **The bare 「프린트」 is not registered** — printing is a legitimate sense and letters alone do not separate them. Only its pairing with 체결 is caught |
| 비중 틸트, 가치 틸트, 팩터 틸트, 모멘텀 틸트 | 비중 기울임, 비중 확대 | 오류 | a transliterated "tilt". **The bare 「틸트」 is not registered** — a camera's 「팬·틸트」 is settled |
| 리더 종목 | 주도주 | 오류 | a literal "leading stocks". **The bare 「리더」 is not registered** — a team leader and a card reader are legitimate |
| 헤드라인 수치, 헤드라인 지표 | 대표 수치, 전체 | 오류 | a literal "headline number". **The bare 「헤드라인」 is not registered** — a news headline is legitimate |
| 분석 오버레이 | 보조분석 | 오류 | a literal "analysis overlay". **The bare 「오버레이」 is not registered** — a screen or graphics overlay is settled |
