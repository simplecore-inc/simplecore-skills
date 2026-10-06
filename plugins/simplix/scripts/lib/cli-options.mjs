/**
 * The option guard the frontend scripts in this plugin share.
 *
 * Every script here stops on an option it does not know rather than falling through to a normal
 * run. A misspelt `--selftest` that fell through scanned nothing and printed the summary a clean
 * tree prints, and a misspelt `--root` audited the working directory instead of the project: in
 * both cases the one output the run must never produce for a reason other than cleanliness. So
 * each script declares every option it takes, and anything else is refused with exit 2.
 *
 * A valued option is written `--name=value` or `--name value`. A name listed in `inlineOnly`
 * takes only the first form, for an option whose spelling something outside the script reads
 * (a hook that tells a narrowed run from a full one by the `--name=` text). A valued option at
 * the end of the line with nothing after it is refused as well: it names a value the run would
 * otherwise go on without.
 *
 * @example
 * const spec = { flags: ["--json"], valued: ["root"] };
 * const { flags, values, unknown } = parseOptions(process.argv.slice(2), spec);
 * if (reportUnknown(unknown, spec)) process.exit(2);
 * const root = path.resolve(values.root ?? process.cwd());
 */

/**
 * @typedef {object} OptionSpec
 * @property {readonly string[]} [flags] boolean options, spelt in full (`--json`)
 * @property {readonly string[]} [valued] valued option names, without the dashes (`root`)
 * @property {readonly string[]} [inlineOnly] valued names accepted only as `--name=value`
 */

/**
 * Read an argument list against the options a script declares.
 *
 * @param {readonly string[]} argv the arguments after the script path
 * @param {OptionSpec} spec the options the script takes
 * @returns {{ flags: Set<string>, values: Record<string, string>, unknown: string[] }} the
 *          flags present, the value of each valued option given, and every argument the spec
 *          does not account for
 */
export function parseOptions(argv, spec) {
  const flags = new Set();
  const values = {};
  const unknown = [];
  const declaredFlags = spec.flags ?? [];
  const valued = spec.valued ?? [];
  const inlineOnly = spec.inlineOnly ?? [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (declaredFlags.includes(a)) {
      flags.add(a);
      continue;
    }
    const name = valued.find((n) => a === `--${n}` || a.startsWith(`--${n}=`));
    if (!name) {
      unknown.push(a);
    } else if (a !== `--${name}`) {
      values[name] = a.slice(name.length + 3);
    } else if (inlineOnly.includes(name)) {
      unknown.push(`${a} (write it --${name}=<value>)`);
    } else if (i + 1 < argv.length) {
      values[name] = argv[++i];
    } else {
      unknown.push(`${a} (no value)`);
    }
  }
  return { flags, values, unknown };
}

/**
 * The options a spec declares, as the refusal prints them.
 *
 * @param {OptionSpec} spec the options the script takes
 * @returns {string} one line naming every option
 */
export function knownOptions(spec) {
  const inlineOnly = spec.inlineOnly ?? [];
  const valued = (spec.valued ?? []).map((n) =>
    inlineOnly.includes(n) ? `--${n}=<value>` : `--${n} <value>`,
  );
  return [...(spec.flags ?? []), ...valued].join("  ");
}

/**
 * Print the refusal for unrecognised arguments.
 *
 * @param {readonly string[]} unknown the arguments {@link parseOptions} could not place
 * @param {OptionSpec} spec the options the script takes
 * @returns {boolean} true when something was refused, so the caller exits or returns 2
 */
export function reportUnknown(unknown, spec) {
  if (unknown.length === 0) return false;
  console.error(`✖ unrecognised option: ${unknown.join(" ")}`);
  console.error(`  known options: ${knownOptions(spec)}`);
  return true;
}
