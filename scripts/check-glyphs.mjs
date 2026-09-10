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
 * declared, and the unused warning below could never fire. It was dead from the
 * day it was written. Stripping the literal before counting gives it back its
 * job: dropping a phrase from the site now leaves its glyphs visibly orphaned
 * in the font subset instead of silently padding it.
 */
const DECLARATION = /export const CJK_GLYPHS =\s*"[^"]*"/;

const used = new Set();
for (const file of walk("src")) {
  const text = readFileSync(file, "utf8").replace(DECLARATION, "");
  for (const char of text.match(CJK) ?? []) used.add(char);
}

const source = readFileSync("src/data/site.ts", "utf8");
const declared = new Set(
  (source.match(/export const CJK_GLYPHS =\s*"([^"]*)"/)?.[1] ?? "").split(""),
);

const missing = [...used].filter((c) => !declared.has(c));
const unused = [...declared].filter((c) => !used.has(c));

if (unused.length) {
  console.warn(`Subset declares ${unused.length} unused glyph(s): ${unused.join("")}`);
}

if (missing.length) {
  console.error(
    `\n${missing.length} glyph(s) used but missing from CJK_GLYPHS: ${missing.join("")}\n` +
      `Add them, or they will fall back to the visitor's system font.\n`,
  );
  process.exit(1);
}

console.log(`All ${used.size} Chinese glyphs are covered by the font subset.`);
