// The starter board `/simplecore:board-init` copies. Nine frames covering the three device
// classes this pattern draws, in a domain nobody has to learn: records with a status, a person
// carrying a phone, a terminal in a lobby.
//
// **Replace the words, keep the shapes.** Every frame here is an answer to a question a real
// board will be asked on its first day — where does a create form open, what does an empty list
// look like, what does the phone show when it is offline — so a screen drawn over one of these
// starts from a decision that has already been made rather than from a blank file.
export default {
  pattern: 'simplix-basic',
  contract: 3,

  headline: 'PRODUCT — 관리 콘솔 · 현장 앱 · 공용 단말',
  boardName: 'product',
  tag: 'WIREFRAME v0.1 · LO-FI',
  pdfName: 'wireframe',

  // Which clusters must be drawn before the board counts as covering its scope. Empty while the
  // board is being started: a coverage gate that fires on day one is a gate people switch off.
  requiredSections: [],

  // A frame that is not being built now declares one of these, and the build draws the band, the
  // label chip and the notes chip from it. Delete what this product does not defer.
  phases: {
    2: { tag: '2단계', why: '1단계 범위 밖이다 — 자리만 둔다' },
  },

  // The day every frame is standing on. Frames carry dates, D-n badges and 「N일째」 counters, and
  // each is only readable against a fixed today — a reader who meets 「D-5」 beside a date is doing
  // arithmetic, and so is the gate that checks it. Left undeclared, each frame quietly picks its
  // own. Moving this date is a board-wide edit, not a setting.
  today: '2026-08-14',

  // What has to be BOUGHT before a frame is reachable. A second axis, not a schedule: `phase`
  // says when a screen gets built, `feature` says what opens it.
  features: {},
};
