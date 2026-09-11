# The reading lens — cutting what rules miss down to what a person can read

**A rule and the lens use a regex for opposite purposes.** A rule reports an error, so it must have
no false positives, so it is narrow, so it leaks. The lens **selects candidates for a person to
read**, so it may be broad, and it has to be broad to stop leaking.

| | Rule (`rules`) | Lens (`lens`) |
| --- | --- | --- |
| Who judges | the machine | a person |
| False positives | not allowed | allowed |
| Breadth | enumerated objects and endings | stems and whole families |
| Output | 「fix this」 | 「read this」 |
| What it misses | every form outside the enumeration | almost nothing |

**The skill had rules and nothing else for a long time.** Seventy-two rules returned zero on a
board, and when a person read it in filename order one cluster alone gave fourteen findings, **none
of which any rule had caught** — `결재가 올라갑니다` is caught while `알림이 갑니다` is not.

## How to run it

```bash
T="$HOME/.claude/skills/simplecore/skills/korean-docs/scripts/l10n.mjs"
node "$T" lens                   # the document set, or the declared resources
node "$T" lens docs/manual       # a directory, or a file
node "$T" lens /tmp/draft.md     # a draft outside the project
node "$T" lens --json            # sorted by file — the input for an in-order read
```

`lens` reads segments, not raw lines, so a specimen inside a code span and a key in a resource file
never surface: what surfaces is what a reader would read. **A reply is a valid argument.** A chat
reply passes through no check at all, and the habits the lens exists to catch survive there long
after the repository is clean — write the draft to the scratch directory and point the lens at it
before it goes out. `sweep` prints the count only; the list is this command's.

**How much it narrows**: 27,830 pieces of screen copy → **around two thousand**. That is an amount a
person can read cluster by cluster, and reading those candidates to find the real violations is what
the lens is for.

## The lens — stems by family

**Movement** `간다` · `갑니다` · `가는가` · `온다` · `옵니다` · `나간다` · `나갑니다` · `넘어가` · `넘어와` · `넘어간` · `넘어갑` · `넘어갔` · `넘어갈` · `넘어온` · `넘어옵` · `넘어왔` · `넘기는` · `넘기지` · `넘기고` · `넘기를` · `넘길` · `넘긴` · `넘겨` · `넘겼` · `올라가` ·
`올라간` · `올라갔` · `올라온` · `내려가` · `내려온` · `내리기` · `내리는` · `내립` · `옮겨` · `옮기` · `옮긴` · `옮길` ·
`흐른` · `흐릅` · `흘러` · `던지` · `던진` · `(?<!만)들고`

**Opening · closing · blocking** `연다` · `여는` · `열린` · `열립` · `닫힌` · `닫힙` · `닫는다` · `닫는` · `닫아` · `닫음` · `닫을` · `닫습` · `막는` · `막고` · `막힌` ·
`막힙` · `풀린` · `풀립` · `드러나` · `드러난`

**Hands** `쥐고` · `쥐는` · `(?<!제)품고` · `(?<!제)품는` · `(?<!제)품은` · `(?<!제)품지` · `싣` · `실어` · `잡는` · `잡고` · `잡습` · `잡지` · `잡았` · `잡아` · `갖는다` · `가진다` · `갖습니다` · `가집니다` · `갖는` · `가진` ·
`얹` · `박아` · `박은` · `손대` · `손댄` · `손댈` · `손댑` · `손댔` · `씌우` · `씌운` · `조임` · `조인다` · `넣습` · `넣는다` · `쌓이` · `쌓인` ·
`쌓였` · `앉는다` · `앉은` · `앉습` · `내려앉` · `세운다` · `세웁` · `세우는` · `선다` · `서고` · `서며` · `서므로` · `서는지` · `섰다` · `섰고` · `섰습` · `섭니다` · `서 있` · `(?<!만)들고,` · `(?<!만)들고)` · `(?<!만)들지` · `(?<!만)든다` · `(?<!만)듭니다`

**Absorbing a difference** `차이 수용` · `차이를 수용` · `차이는 수용` · `로 수용` · `에서 수용` ·
`없이 수용` · `설정 수용` · `변경 수용` · `흡수`

**Contact · connection** `닿` · `기대는` · `기대고` · `기대지` · `기대면` · `기대며` · `기대야` · `기댄` · `기댑` · `기댈` · `기댔` ·
`딸리` · `딸린` · `딸립` · `딸려` · `딸릴` · `딸렸` · `걸린` · `걸리` ·
`걸려` · `걸어` · `걸고` · `걸지` ·
`붙는` · `붙들` · `붙이` · `붙은` · `붙지` · `붙어` · `붙음` · `붙인` · `붙일` · `붙습` · `잇기` · `잇는` · `잇고` · `물고 있`

**Personification** `말한다` · `말합` · `말을 한` · `말을 합` · `밝힌` · `밝힙` · `답한다` · `답합` · `물어봅` · `물어본` ·
`보여 준` · `보여 줍` · `기억한` · `기억합` · `기다린` · `기다립` · `스스로` · `대신하` · `대신합` · `불려` · `불러 낸` · `따라온` ·
`따라와` · `이끌` · `이끈다` · `이끄는` · `이끕`

**Household metaphors** `세간(?!의)` · `가재도구` · `살림` — code, files, and modules called somebody's household goods. 「세간의 관심」 is 世間 and a different word.

**Structure standing in for evidence** `구조로 보장` · `구조로 지키` · `구조로 지킨` · `구조로 지켜` · `구조로 막` · `구조로 충족` · `구조로 방지` · `구조로 배제` · `구조적 충족` · `구조적으로` — one word, 「구조」, covering what does the thing and how. The reader is left with nothing to verify, so write the test item and its pass criterion, or the number. Uses that name a real arrangement — 「계층 구조」·「저장 구조」·「구조 변경」 — are legitimate, so what separates them is not the word but whether the sentence is making a claim that needs evidence.

**Queues** `큐` — a product's own waiting list called 「큐」. 「이벤트 큐」·「로컬 큐」 are data structures and 「렌더 큐」·「처리 큐」 are screen names, and the preceding word does not separate them. So the machine side catches it by enumerating screen names in the glossary, and whatever escapes the enumeration is what this lens shows a person.

**Shape · state** `펼치` · `펼쳐` · `무너지` · `살아나` · `살아났` · `되살` · `살아 있` · `생사` · `죽는` · `죽은` · `죽었` · `죽어` ·
`죽이` · `죽으` · `죽음` · `산다` · `삽니다` · `살고 있` · `(?<!안)사는(?! *사람)` · `(?<!주)사는(?! *사람)` · `(?<!조)사는(?! *사람)` · `(?<!회)사는(?! *사람)` · `(?<!검)사는(?! *사람)` · `흔들리` ·
`흔들립` · `벌어집` · `벌어진` · `얼어붙` · `돕니다` · `돈다` · `도는` · `새어` · `가른다` · `가르는` · `가르지` · `가르세` ·
`가르면` · `가릅` · `갈린` · `물린` · `물리` · `맞물` · `부딪` · `늙는` · `늙은` · `깨진`

**Metaphors settled as names** `몫` · `자리` · `(?<!구)축(?![소적약])` · `(?<!단)축(?![소적약])` · `(?<!압)축(?![소적약])` · `(?<!감)축(?![소적약])` · `시계(?!열)` · `주인` · `걸음` · `연료` · `얽힘` · `사다리` · `뼈대` · `골격` · `는 길` · `관문` ·
`함정` · `유령` · `천장` · `바닥` · `출발점` · `구실` · `거울` · `판박이` · `데칼코마니` · `동전의` · `쌍둥이` · `판본` · `싼 쪽` · `싼 편` · `이 싸다` · `싸다\.` · `비싸` · `가벼운` · `무거운` ·
`표면` · `발밑` · `걷는` · `걷는다` · `걷고` · `걷기` · `걸어서` · `걸었` · `걷지` · `어깨너머` · `등 뒤` · `눈앞` · `손아귀` · `(?<!유)(?<!급)가족(?!관계)(?!돌봄)` · `형제(?! *노드)` · `자매` · `혈통` · `족보`

**Compression · flat assertion** `통째로` · `조용히` · `일 뿐` · `이 아니라` · `가 아니라` · `핵심` · `곧` · `유일한` · `최악` · `하나의` · `그 이상`

**Dropped endings · headline style** `며\.` · `하고\.` · `되고\.` · `이고\.` · `지고\.` · `같고\.` · `지만\.` · `는데\.` · `인데\.` · `해서\.` ·
`어서\.` · `아서\.` · `나서\.` · `함\.` · `됨\.` · `임\.(?!md)` · `음\.` · `예정\.` · `필요\.` · `불가\.` · `가능\.` · `무관\.` ·
`여부\.` · `으로\.` · `의 \S+의` — a sentence ended on a noun phrase, an adverbial phrase, or a connective ending with no predicate, or 「의」 used twice in a row. A full stop claims the thing is a sentence, so a final ending has to stand there. **Most of the candidates are nouns that merely share those syllables.** Leave 사물함 · 책임 · 믿음 · 처음 · 최종 보고 alone and fix only what reads as a sentence with no predicate. A table cell, a bold lead-in, and a list item are name slots rather than sentences, so delete the full stop there.

**Planting · seeds** 씨앗 · 심는 · 심은 · 심어 · 심을 · 심기 — `seed` rendered as 「씨앗」 and loading sample data rendered as 「심는다」. A random-number seed is 「시드」 too. 「중심은」 · 「핵심은」 coming along for the ride is reading material

**Counting with native numerals** `(?<!모)(?<!구)두(?= )` · `(?<!미)(?<!상)(?<!자)(?<!정)(?<!실)(?<!추)(?<!시)(?<!형)세(?= )` · `(?<!하)네(?= )` · `다섯(?= )` · `여섯(?= )` · `일곱(?= )` · `여덟(?= )` · `아홉(?= )` — a place where the name is already written beside it and a number covers it (「탐지 네 판정」 · 「사본 두 벌」). With a name present, delete the number; where it is a value to check, write it in digits. 「둘」 · 「셋」 · 「넷」 are left out because of 「둘 다」 and the verb 「두다」


**Empty relations · avoiding the plain verb** `관련되어 있` · `연관되어 있` · `연계되어 있` · `역할을 한` · `역할을 합` · `역할을 하는` · `기능한다` · `기능합니다` · `기능하는` · `갖추고 있` · `보유하고 있` — how two things connect is covered by 「관련」 instead of named, or a slot for 「이다 · 있다」 is filled with a longer phrase (ai-tells.md §14 · §18). A place where a role really is defined (「관리자 역할을 한 명 지정한다」) is legitimate, which is why this is a lens family and not a rule.

### Write the conjugations, not just the stem

**The lens held `붙는` without `붙이` · `붙은` · `붙지` · `붙어`, and 126 sites never reached the
candidate list.** When you add a stem, add that family's conjugations with it — the final forms
(-는다 · -습니다), the adnominal forms (-은 · -는 · -을), the connective forms (-어 · -지 · -며), and
the nominal forms (-음 · -기). Writing one stem and concluding 「the family is covered」 is the most
common hole in the lens.

## The lens grows

**When a reading turns up a metaphor that is in neither the rules nor the lens, add its stem here.**
Put it in the rules too if a rule can hold it, but **what a narrow rule cannot hold is the lens's
job** — 「자리」 drags in digits and seats and 「연다」 drags in files and windows, and in the lens
those false positives are not a cost but reading material.

### `rules --test` catches a family the lens only half knows

**Half-knowing a family is worse than not knowing it** — with only `붙는` in the lens, it reports
having found the family while walking past `붙이` · `붙은` · `붙지` · `붙어`. So when **only some of
a rule's hit examples** match the lens, verification fails and names the form that escaped.

- **Matching none is not judged.** It means the lens has no interest in that family, which is the
  ordinary case for rules about spelling, transliteration, particles, and connectives — things that
  do not conjugate.
- **Domain-scoped rules are never asked.** The lens is universal and owes a domain nothing —
  「천장」 is a metaphor in a billing product and a real ceiling on a construction site.
- **Opt out with `"lens": false`** when the missing form is an everyday word that would only add
  reading (「것」·「켜는」), or when the target is a closed list the rule enumerates rather than a
  family. Write why in `lensReason`.

**Do not chase words one at a time.** A lens that copies a rule's enumeration becomes a duplicate of
that rule, and the lens's only value — catching a family broadly — is gone. What to chase is not a
word but **a stem's conjugations**.

**Do not stop at zero findings from the rules after fixing what the lens showed.** The lens is a
stem list too, so a family it does not know is a family it cannot catch — the last net is reading in
order, and the lens exists to cut that reading down to a manageable size.
