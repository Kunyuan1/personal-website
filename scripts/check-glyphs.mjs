/**
 * Verifies that every Chinese character used in the site is present in
 * CJK_GLYPHS, which is what the Noto Serif SC subset is built from.
 *
 * This fails silently in the browser — a missing glyph just renders in
 * whatever CJK font the visitor happens to have, or not at all — so it is
 * worth checking mechanically. Run with `npm run check:glyphs`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CJK = /[\u4e00-\u9fff]/gu;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(tsx?|css)$/.test(entry)) out.push(path);
  }
  return out;
}

/**
 * The declaration itself is not a use.
 *
 * `CJK_GLYPHS` lives in `src/data/site.ts`, which this walk reads like any
 * other file — so every declared glyph was landing in `used` by virtue of being
 * declared, and the unused check below could never fire. It was dead from the
 * day it was written. Stripping the literal before counting gives it back its
 * job: dropping a phrase from the site now leaves its glyphs visibly orphaned
 * in the font subset instead of silently padding it.
 */
const DECLARATION = /export const CJK_GLYPHS =\s*"([^"]*)"/;

// Parsed once, and the same match is what gets stripped below. Two copies of
// this pattern kept in sync by hand is the shape of the bug this file just
// grew a fix for: if they ever drifted, the strip would miss the declaration
// and every declared glyph would count as used again.
const source = readFileSync("src/data/site.ts", "utf8");
const declaration = source.match(DECLARATION);
const declared = new Set((declaration?.[1] ?? "").split(""));

const used = new Set();
for (const file of walk("src")) {
  let text = readFileSync(file, "utf8");
  if (declaration) text = text.replace(declaration[0], "");
  for (const char of text.match(CJK) ?? []) used.add(char);
}

const missing = [...used].filter((c) => !declared.has(c));
const unused = [...declared].filter((c) => !used.has(c));

// Both directions exit non-zero. A warning is what the unused half used to be,
// and it is how twenty dead glyphs accumulated in the subset over several
// months: the line printed into a passing log and nobody reads a passing log.
// Dropping a phrase from the site is now a two-line change — the copy, and the
// glyphs it was the only user of.
if (unused.length) {
  console.error(
    `\n${unused.length} glyph(s) declared in CJK_GLYPHS but used nowhere: ${unused.join("")}\n` +
      `Remove them, or the font subset carries weight no page asks for.\n`,
  );
}

if (missing.length) {
  console.error(
    `\n${missing.length} glyph(s) used but missing from CJK_GLYPHS: ${missing.join("")}\n` +
      `Add them, or they will fall back to the visitor's system font.\n`,
  );
}

if (unused.length || missing.length) process.exit(1);

console.log(`All ${used.size} Chinese glyphs are covered by the font subset.`);
