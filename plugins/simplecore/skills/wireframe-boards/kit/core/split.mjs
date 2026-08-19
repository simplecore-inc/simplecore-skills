// Splitting one board into several files along an axis the board declares.
//
// **The kit holds the mechanism and never the axis.** It learns that a board may name a module
// answering 「which part does this screen belong to」, how many parts there are, what each part's
// file is called and what a reader is to call it. What the parts ARE — what the axis measures,
// what its values mean, which of them belong in one volume — is every word a board supplies, so
// the second product to split its board changes `board.config.mjs` and nothing here.
//
// **A board that declares nothing builds exactly as before**: one file, the same name, the same
// path. Everything below is off until `split` appears in a board's settings.
//
//   split: {
//     module: '../scripts/<placer>.mjs',   // the kit imports it; no placement is restated here
//     part:  { call: '<export>' },                       // frame id → a part key
//     group: { call: '<export>', key: '…', label: '…' }, // frame id → the group inside one file
//     parts: [{ key: <key>, file: '<name>.html', nav: '<what a reader calls it>' }, …],
//     volumes: [{ parts: [<key>, …], name: '<file-name marker>', title: '<cover>' }, …],
//   }
import { existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The entry page's name when a board does not choose one — the name an unsplit board writes. */
export const DEFAULT_ENTRY = 'board.html';

/**
 * Every HTML file a board builds, entry page first.
 *
 * <p>Pure, and deliberately so: `check`, `shots` and `pdf` all need the list and none of them
 * should have to import the board's placing module to get it. A board with no `split` answers
 * with the one file it has always written.
 *
 * @param config a board's settings
 * @returns file names relative to the board folder
 */
export function outputFiles(config) {
  const split = config?.split;
  if (!split) return [DEFAULT_ENTRY];
  return [split.entry?.file ?? DEFAULT_ENTRY, ...split.parts.map((p) => p.file)];
}

/** Keys are compared as text, so a part declared `1` matches a placer that answers `'1'`. */
const keyOf = (v) => (v === null || v === undefined ? null : String(v));

/**
 * Read one exported function off the placing module and refuse anything else by name.
 *
 * <p>A missing export is the failure worth spelling out: `layerOf` renamed in the placing module
 * leaves `split.part.call` pointing at `undefined`, every frame answers `null`, and the board
 * builds with four empty files. Named here, it is one sentence at the top of the build.
 */
function callable(mod, spec, what, modulePath) {
  if (!spec?.call) throw new Error(`board.config.mjs의 split.${what}에 call이 없습니다`);
  const fn = mod[spec.call];
  if (typeof fn !== 'function') {
    throw new Error(`${modulePath}에 '${spec.call}' 함수가 없습니다 — split.${what}.call이 가리키는 것입니다`);
  }
  return fn;
}

/**
 * Bind a board's `split` declaration to the module that answers it.
 *
 * @param boardDir the board folder — `split.module` is resolved from it
 * @param decl the board's `split` settings
 * @returns the axis, ready to place a frame: `{ parts, entry, files, partOf, groupOf, volumes }`,
 *   or null where the board declares no split
 */
export async function loadSplit(boardDir, decl) {
  if (!decl) return null;
  if (!decl.module) throw new Error('board.config.mjs의 split에 module이 없습니다');
  if (!Array.isArray(decl.parts) || !decl.parts.length) {
    throw new Error('board.config.mjs의 split에 parts가 없습니다 — 파일 하나로 빌드하려면 split을 지웁니다');
  }

  const modulePath = isAbsolute(decl.module) ? decl.module : resolve(boardDir, decl.module);
  if (!existsSync(modulePath)) {
    throw new Error(`split.module이 가리키는 파일이 없습니다: ${modulePath}`);
  }
  const mod = await import(pathToFileURL(modulePath).href);

  const partFn = callable(mod, decl.part, 'part', decl.module);
  const groupFn = decl.group ? callable(mod, decl.group, 'group', decl.module) : null;

  const entry = { file: decl.entry?.file ?? DEFAULT_ENTRY, nav: decl.entry?.nav ?? null };
  const parts = decl.parts.map((p) => {
    if (p.key === undefined || p.key === null) throw new Error('split.parts의 항목에 key가 없습니다');
    if (!p.file) throw new Error(`split.parts의 ${p.key}에 file이 없습니다`);
    return { ...p, key: keyOf(p.key) };
  });

  const files = [entry.file, ...parts.map((p) => p.file)];
  const dupFile = files.find((f, i) => files.indexOf(f) !== i);
  if (dupFile) throw new Error(`split이 파일 이름 '${dupFile}'을 두 번 씁니다 — 뒤엣것이 앞엣것을 덮습니다`);
  const keys = parts.map((p) => p.key);
  const dupKey = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dupKey) throw new Error(`split.parts가 key '${dupKey}'를 두 번 선언합니다`);

  const volumes = (decl.volumes ?? []).map((v, i) => {
    const vKeys = (v.parts ?? []).map(keyOf);
    const unknown = vKeys.filter((k) => !keys.includes(k));
    if (unknown.length) {
      throw new Error(`split.volumes[${i}]가 선언되지 않은 part를 부릅니다 — ${unknown.join(' · ')}`);
    }
    if (!v.name) throw new Error(`split.volumes[${i}]에 name이 없습니다 — 파일 이름에 들어갈 마디입니다`);
    return { ...v, parts: vKeys };
  });
  const placed = volumes.flatMap((v) => v.parts);
  const orphan = keys.filter((k) => !placed.includes(k));
  if (volumes.length && orphan.length) {
    throw new Error(`어느 volume에도 들지 않은 part가 있습니다 — ${orphan.join(' · ')}`);
  }

  return {
    parts,
    entry,
    files,
    volumes,
    /** The part a frame belongs to, as a key, or null when the placer claims none. */
    partOf: (frameId) => keyOf(partFn(frameId)),
    /**
     * The group a frame belongs to inside its file — the second axis.
     *
     * <p>`key` names the group, `label` is what a reader sees and `mark` is what stands where a
     * section letter stands. All three are field names the board supplies, because the placer's
     * answer is the board's own shape: it may be a bare string, or a record with a name and a
     * title and an order marker.
     */
    groupOf: groupFn
      ? (frameId) => {
        const got = groupFn(frameId);
        if (got === null || got === undefined) return null;
        if (typeof got !== 'object') return { key: String(got), label: String(got), mark: '' };
        const key = keyOf(decl.group.key ? got[decl.group.key] : got);
        if (key === null) return null;
        return {
          key,
          label: String(decl.group.label ? got[decl.group.label] ?? key : key),
          mark: decl.group.mark ? String(got[decl.group.mark] ?? '') : '',
          // What the groups are sorted by inside one file. Absent, they stand in the order their
          // first frame is drawn — which is right when nothing outside the board decides an order
          // and wrong the moment something does: a mark that says 「third of five」 beside a group
          // sitting first reads as a mistake in the board rather than as an ordering it never
          // claimed.
          order: decl.group.order ? String(got[decl.group.order] ?? '') : null,
        };
      }
      : null,
    /** The part a key names, for a caller holding an answer from `partOf`. */
    partFor: (key) => parts.find((p) => p.key === keyOf(key)) ?? null,
  };
}
