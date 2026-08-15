// Gates on what actually got drawn: a declared overlay that never reached the shell, a
// component called with keys it does not know, and markup that came out malformed.
import { idOf } from '../ids.mjs';
import { splitTop } from './util.mjs';

// Overlay gate: `overlay` on the module is what the frame PROMISES — the hollow-dialog check
// above reads it, and the manifest label names it. Drawing it is a separate act: the shell takes
// its own `overlay` argument. Declaring one and forgetting to pass it leaves a frame whose label
// and state both say "dialog" and whose picture has none, and every check upstream passes.
export const overlayGate = {
  id: 'overlayGate',
  title: 'overlay를 셸에 넘기지 않았다 (셸 인자로 overlay를 전달할 것)',
  stage: 'built',
  run: (ctx) => {
    return ctx.loaded
      .filter((s) => s.mod.overlay && !(s.mod.body ?? '').includes(s.mod.overlay))
      .map((s) => s.file);
  },
};

// Dead-import gate. An import a screen no longer uses is invisible: it costs nothing at runtime,
// changes no pixel, and the build stays green — so it accumulates. 360 of them across 225 files
// had built up before anybody counted, and by then the import block of a screen said almost
// nothing about what the screen actually draws, which is the one thing it is good for.
//
// The proof that a removal is safe is cheap: an unused import cannot change the output, so the
// built board must come out byte for byte identical. That is what makes this worth a gate rather
// than a lint anybody can wave through.
//
// Comments are stripped before looking, because a name mentioned only in `// see also foo()` is
// not a use, and a use is a call, a template hole, or a value passed on.
export const deadImportGate = {
  id: 'deadImportGate',
  title: '쓰지 않는 import가 남아 있다 (import 줄이 그 화면이 그리는 것을 말해야 한다)',
  stage: 'built',
  run: (ctx) => {
    const errs = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      for (const m of src.matchAll(/import \{([^}]*)\} from '\.\.\/[a-z]+\.mjs';/g)) {
        const body = src.replace(m[0], '')
          .split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
        const dead = m[1].split(',').map((s) => s.trim()).filter(Boolean)
          .filter((n) => !new RegExp(`\\b${n}\\s*[({\`]|\\b${n}\\b(?=\\s*[,)\\]])`).test(body));
        if (dead.length) errs.push(`${idOf(sc.file)} — ${dead.join(', ')}`);
      }
    }
    return errs;
  },
};

// Option-key gate. A component destructures the options it knows and ignores the rest, so a call
// written with the shape a person expects — `calendar({month, today, marks})` — renders its
// wrapper and NO CONTENT: the markup is balanced, no value leaked, the frame is there, and only
// the emptiness gives it away. It hit `journey` across 13 files, `chartPh` across 4 and `calendar`
// across 5 before each grew its own throw. Three sightings of one defect is where you stop writing
// them one at a time: this reads every component's own destructuring pattern out of
// components.mjs and checks the calls against it, so a component added tomorrow is covered the
// day it is written.
export const optionKeyGate = {
  id: 'optionKeyGate',
  title: '컴포넌트가 모르는 키로 불린다 (그 내용은 그려지지 않는다)',
  stage: 'built',
  run: (ctx) => {
    const optionErrors = [];
    {
      const comps = ctx.componentsSrc;
      const keysOf = new Map();
      for (const m of comps.matchAll(/export const ([a-zA-Z]+) = \(\{([\s\S]*?)\}\)/g)) {
        // Split the destructuring on its own top-level commas — a regex with a consuming separator
        // silently drops every other key (`label, value = '', hint` yields label and hint), and a gate
        // that reports two-thirds of the keys as unknown is worse than no gate.
        const keys = new Set(splitTop(m[2]).map((part) => /^\s*([a-zA-Z_][\w]*)/.exec(part)?.[1]).filter(Boolean));
        if (keys.size) keysOf.set(m[1], keys);
      }
      for (const sc of ctx.screens) {
        const src = ctx.srcOf(sc.file);
        for (const [name, keys] of keysOf) {
          // Only the literal-object call form is checkable; a spread or a variable is the author's business.
          for (const m of src.matchAll(new RegExp(`\\b${name}\\(\\{([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)\\}\\)`, 'g'))) {
            const used = splitTop(m[1]).map((part) => /^\s*([a-zA-Z_][\w]*)\s*:/.exec(part)?.[1]).filter(Boolean);
            const stray = used.filter((k) => !keys.has(k));
            if (stray.length) {
              optionErrors.push(`${idOf(sc.file)} — ${name}({ ${stray.join(', ')} }) — 모르는 키다 (쓸 수 있는 키: ${[...keys].join(', ')})`);
            }
          }
        }
      }
    }
    return optionErrors;
  },
};

// Duplicate-key gate. `console_({ overlay, tab, current, overlay: issue })` is valid JavaScript:
// the last key wins, silently. That one line made a screen's ORDINARY state draw its dialog, so
// the closed frame and the open frame became the same picture — and every check upstream passed,
// because the markup is balanced, the overlay is declared, the label matches, and the frame is
// there. Only a reader comparing two frames that should differ can see it, which is why it
// survived until a persona review walked the pair.
export const dupKeyGate = {
  id: 'dupKeyGate',
  title: '한 호출에 같은 키가 두 번 있다',
  stage: 'built',
  run: (ctx) => {
    const dupKeyErrors = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      // A regex cannot do this: the option object of a screen shell nests dozens of levels deep, and
      // an expression that stops at one level silently skips exactly the biggest calls — the ones
      // where a duplicated key hides best. So the braces are counted.
      for (const m of src.matchAll(/\b([a-zA-Z_]\w*)\(\{/g)) {
        const open = src.indexOf('{', m.index);
        let depth = 0, end = open, quote = '';
        for (; end < src.length; end++) {
          const c = src[end];
          if (quote) { if (c === quote && src[end - 1] !== '\\') quote = ''; continue; }
          if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
          if (c === '{') depth++;
          else if (c === '}') { depth--; if (!depth) break; }
        }
        const seen = new Map();
        for (const part of splitTop(src.slice(open + 1, end))) {
          // `overlay,` shorthand and `overlay: x` name the same key.
          const key = /^\s*([a-zA-Z_]\w*)\s*(?::|,|$)/.exec(part)?.[1];
          if (!key) continue;
          if (seen.has(key)) dupKeyErrors.push(`${idOf(sc.file)} — ${m[1]}({ … }) 에 「${key}」가 두 번 있다. 뒤엣것이 조용히 이기므로 앞엣것은 그려지지 않는다`);
          seen.set(key, true);
        }
      }
    }
    return dupKeyErrors;
  },
};

// Structure gate: one unclosed tag inside a component silently swallows everything after it —
// a status bar lands inside a pane, a fixed height stops applying, panes nest inside each
// other. The frame still renders, still counts, and still reads as covered, so nothing but a
// person looking at the board catches it. That is precisely the failure a gate exists for.
// Checked per frame so the message names the screen; void elements never close, so they are
// skipped. A board with nested panes is not
// something to iterate on.
// A body writes no raw tags — and a raw tag with no class is the shape that gets past a reading.
// It renders, the markup balances, every other gate passes, and the only sign is that the line
// draws at the BOARD's base size instead of its neighbours', because it inherited what nothing
// gave it. Three cards on one frame did exactly that.
//
// Judged on the rendered board rather than the source, because a screen composes from functions
// and the tag it emitted is the thing to look at. `style` is not a substitute for a class: it
// carries no size and no register marker, and a gate that accepted it would accept the defect.
export const classlessGate = {
  id: 'classlessGate',
  title: '화면 안에 클래스 없는 raw 요소가 있다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    for (const [, aid, frameHtml] of ctx.html.matchAll(/<article class="frame[^"]*" id="([^"]+)">([\s\S]*?)<\/article>/g)) {
      // Only the drawing. The label, the role strip and the notes are the board speaking about
      // the screen, and they are the kit's own markup rather than a screen file's.
      const screen = /<div class="screen">([\s\S]*)$/.exec(frameHtml);
      if (!screen) continue;
      // BLOCK containers only. `b` · `em` · `i` · a bare `span` are inline emphasis inside a
      // line of copy and carry no size of their own; a classless `div` or `p` becomes its own
      // line and takes the board's base size, which is the defect this gate exists for.
      for (const [tag, name] of screen[1].matchAll(/<(div|p)(?![a-zA-Z0-9])([^>]*)>/g)) {
        const attrs = tag.slice(1 + name.length, -1);
        if (/\bclass\s*=\s*["'][^"']+["']/.test(attrs)) continue;
        bad.push(`${aid} — <${name}${attrs.trim() ? ' ' + attrs.trim().slice(0, 30) : ''}> 클래스가 없다`);
      }
    }
    return bad;
  },
};

export const structureGate = {
  id: 'structureGate',
  title: 'unbalanced markup',
  stage: 'built',
  run: (ctx) => {
    const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
    const unbalanced = [];
    for (const [, aid, frameHtml] of ctx.html.matchAll(/<article class="frame[^"]*" id="([^"]+)">([\s\S]*?)<\/article>/g)) {
      const stack = [];
      // The tail is captured so a self-closing tag can be recognised by its slash. SVG is drawn with
      // them (`<polyline …/>`, `<rect …/>`) and they close nothing, so counting them as opened tags
      // would refuse a perfectly balanced frame.
      for (const [, close, name, tail] of frameHtml.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)>/g)) {
        if (VOID.test(name)) continue;
        if (tail.trimEnd().endsWith('/')) continue;
        if (!close) { stack.push(name); continue; }
        if (stack[stack.length - 1] === name) stack.pop();
        else {
          unbalanced.push(`${aid}: </${name}> closes <${stack[stack.length - 1] ?? 'nothing'}>`);
          break;
        }
      }
      if (stack.length) unbalanced.push(`${aid}: ${stack.length} tag(s) left open — <${stack.join('>, <')}>`);
    }
    return unbalanced;
  },
};

// Empty-value gate: a missing argument does not throw in a template literal — it is coerced
// and printed. `undefined` lands in the frame as visible text, reads as a screen label, and
// survives every other gate here because the markup around it is perfectly well formed.
export const leakedValueGate = {
  id: 'leakedValueGate',
  title: 'a value leaked into the board',
  stage: 'built',
  run: (ctx) => {
    const LEAKED = /\bundefined\b|\[object Object\]|\bNaN\b/;
    const leaked = [];
    for (const [, aid, frameHtml] of ctx.html.matchAll(/<article class="frame[^"]*" id="([^"]+)">([\s\S]*?)<\/article>/g)) {
      const text = frameHtml.replace(/<[^>]*>/g, ' ');
      const hit = text.match(LEAKED);
      if (hit) leaked.push(`${aid}: "${hit[0]}" printed as screen text`);
    }
    return leaked;
  },
};

// Slot gate: an argument that lands in the wrong parameter of a shared drawing.
//
// A state frame calls its base's `screenBody(...)`, and the parameters differ by base — some take
// `(overlay)`, some `(detail, overlay)`, some `(detail)`. Pass a help dialog where the DETAIL slot
// is and three things happen at once: the dialog renders inside the panel, the panel disappears,
// and the overlay is empty. None of it throws, and `overlayGate` passes because it only asks
// whether the body contains the overlay string — which it does, in the wrong place.
//
// Found by hand twice; the sweep that followed found four. That gap is why this is a gate: the
// shape is invisible in a screenshot of the frame alone, because a dialog in a panel still looks
// like a dialog.
export const slotGate = {
  id: 'slotGate',
  title: '다이얼로그가 상세 패널 자리로 들어간다',
  stage: 'preflight',
  run: (ctx) => {
    const bad = [];
    for (const e of ctx.loaded) {
      const s = ctx.srcOf(e.file);
      const imp = /import\s+base\s*,\s*\{[^}]*\}\s+from\s+'\.\/([a-z0-9-]+)\.mjs'/.exec(s);
      if (!imp) continue;
      const call = /body:\s*screenBody\(([^)]*)\)/.exec(s);
      if (!call || !call[1].trim()) continue;
      // Both arguments, not just the first. The gate used to check the first only, and a base
      // whose signature is `(overlay, detail)` swallowed `screenBody(undefined, help)` in silence —
      // the dialog rendered into the panel's slot, so the explanation never opened AND the record's
      // panel disappeared. Three frames shipped that way. What matters is which SLOT the dialog
      // lands in, so each argument is matched to the parameter at its position.
      const baseSrc = ctx.srcOf(imp[1]);
      const sig = /export const screenBody = \(([^)]*)\)/.exec(baseSrc);
      if (!sig) continue;
      const params = sig[1].split(',').map((x) => x.split('=')[0].trim());
      const args = call[1].split(',').map((x) => x.trim());
      args.forEach((arg, i) => {
        if (!arg || arg === 'undefined' || arg === "''") return;
        const slot = params[i];
        if (!slot) return;
        const isDialog = new RegExp(`export const ${arg}\\s*=\\s*(dialog|viewerDialog)\\(`).test(baseSrc);
        if (!isDialog || slot === 'overlay') return;
        const fixed = params.map((pp, j) => (pp === 'overlay' ? arg : j === i ? 'undefined' : 'undefined'));
        while (fixed.length && fixed[fixed.length - 1] === 'undefined') fixed.pop();
        bad.push(`${e.num}: screenBody(${call[1].trim()}) — ${arg}는 다이얼로그인데 ${i + 1}번째 인자라 「${slot}」 자리로 들어간다. screenBody(${fixed.join(', ')})`);
      });
    }
    return bad;
  },
};
