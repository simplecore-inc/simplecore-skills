/**
 * Which catalogue placeholders run their value through `Intl.NumberFormat`.
 *
 * <p>i18next writes a format after the value's name (`{{count, number}}`, `{{price, currency(EUR)}}`)
 * and chains several with a comma. Only `number`, `currency` and `relativetime` need a number; every
 * other format, built in (`datetime`, `list`) or registered by the application (a
 * Korean particle picker written `{{plan, josa(을/를)}}`), takes the value it is given, so a string
 * handed to it is not the `NaN` defect.
 */

/** i18next's formats that need a number: `Intl.NumberFormat`, and `Intl.RelativeTimeFormat` for `relativetime`. */
export const NUMBER_FORMATS = new Set(["number", "currency", "relativetime"]);

/**
 * The names of the placeholders in one catalogue entry that ask for a number format.
 *
 * @param {string} text the catalogue entry
 * @returns {Set<string>} the placeholder names, `count` for `{{count, number}}`
 */
export function numberFormattedNames(text) {
  const names = new Set();
  for (const m of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*,([^}]*)\}\}/g)) {
    const formats = m[2].split(",").map((f) => f.split("(")[0].trim().toLowerCase());
    if (formats.some((f) => NUMBER_FORMATS.has(f))) names.add(m[1]);
  }
  return names;
}
