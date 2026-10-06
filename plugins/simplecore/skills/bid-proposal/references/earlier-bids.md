# What went wrong in earlier bids

Each of these happened in an earlier bid; the rule after the arrow keeps it from happening again,
and `SKILL.md` states it under the Decisions group of the same name. Read this file at kickoff and
before a whole-document pass, so a rule is recognised when the situation that produced it comes
back.

## Content

- A summary was written where the manuscript was asked for, and a plan where pages were asked for
  → write the full pages.
- 합니다체 was applied to every sentence and a whole session went to undoing it → it belongs to the
  page-head description and the divider lede only.
- Compression lost content, and the gap was then padded with forced filler (「100%, 2-2-1 같은
  내용이 억지스러움」) → compare with the earlier text; never pad.
- An abbreviation line was set under a figure, and a divider kicker said 「요구사항 73건, 네 개 장」
  → neither is ever set.
- A description said how the page was written instead of the claim
  (「작성방식을 쓰는것이 아니라, 제안사의 주장을 쓰는것이다」) → the description and the lede state
  the proposer's claim.
- Features nobody asked for were drawn into the screens (「결재 알림 보내기」), and the user's own
  draft requirement was treated as the client's → only what the tender or the user asked for.
- A table titled 「요구사항 61건」 had 62 rows → counts are computed, never typed.

## Figures

- Figures and the annex were changed without being asked and had to be restored from git → a
  figure the task did not name is never changed.
- A different diagram was placed than the one asked for → cite figures by number and title.
- Figures ended up in two folders → one generator, one output folder.

## Deck

- The deck's `.xml` was edited as if it were PowerPoint → it is the editor's source and is changed
  only through the tool server.
- The wrong pages were merged → name the pages by id and title before merging.
- Stretch was made the default and many pages looked wrong → only where it reads well.
- The running head differed from the contents page, a page carried two titles, and the second band's
  type shrank on some pages → fixed in the kit and master, checked on every page.
- The deck rendered landscape and work went on → a tool defect stops the deck work until fixed.
- Absolute paths and embedded images broke the preview; a PowerPoint repair prompt survived three
  attempts → find the cause in the tool and fix it there.

## Review

- A whole-document pass stopped at chapter 6 and was reported done → the coverage check in
  Review, run before a pass is reported complete.
- Checks passed over defects because each read only part of the deck (one skipped the summary
  folder, one read chapter files only, one read the manuscript only) → every check names the trees
  it reads and is proven on a known defect before it is trusted.
- Persona round files piled up across rounds → delete each round once the next round has read it;
  a round deleted before the next review left that review nothing to check its fixes against.

## Which standard to load

- Codex used Claude Code's Korean audit skill → use the standard that tool has installed.
