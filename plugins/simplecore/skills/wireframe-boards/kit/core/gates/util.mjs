// Reading JavaScript source with regular expressions, carefully enough that the gates which
// do it can be trusted.

/**
 * Split a source fragment on its TOP-LEVEL commas — the ones outside every bracket and string.
 *
 * <p>A regex with a consuming separator silently drops every other key (`label, value = '',
 * hint` yields label and hint), and a gate that reports two-thirds of the keys as unknown is
 * worse than no gate.
 */
export const splitTop = (text) => {
  const out = []; let depth = 0, quote = '', start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote && text[i - 1] !== '\\') quote = ''; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if ('({['.includes(c)) depth++;
    else if (')}]'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out;
};
