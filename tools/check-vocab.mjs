/* Content checks for the vocabulary banks and pages.
   Run:  node tools/check-vocab.mjs

   These are the checks that catch the mistakes that actually happen when a
   bank is typed up from a scanned book: an example sentence pasted from the
   wrong entry, a gap sentence that no longer matches its example, an answer
   left sitting inside its own question. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const UNITS = [1, 2, 3, 5, 6, 7];
const POS = ["n", "v", "adj", "adv", "phr"];

let pass = 0, fails = [];
function ok(cond, msg) { if (cond) pass++; else fails.push(msg); }

/* ------------------------------------------------------------ load banks */
const BANKS = {};
globalThis.Vocab = { register: (u, d) => { BANKS[u] = d; } };
for (const u of UNITS) {
  const f = path.join(ROOT, "assets", `words-0${u}.js`);
  ok(fs.existsSync(f), `assets/words-0${u}.js is missing`);
  if (fs.existsSync(f)) {
    const src = fs.readFileSync(f, "utf8");
    new Function("Vocab", src)(globalThis.Vocab);
  }
}

/* ----------------------------------------------------------- normalizers */
const norm = (s) => (s || "").toLowerCase()
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[.,!?;:"]/g, "").replace(/\s+/g, " ").trim();
const letters = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");

/* Inflection is not worth a stemmer here; a few candidate prefixes catch a
   genuinely wrong example without rejecting "wave" / "waving".
   Two strengths, and the difference matters: the loose form allows a 4-letter
   prefix so "wave" still matches "waving", but that prefix produces false
   positives when asking whether an answer leaked into its own question
   ("compensate" vs "company"), so the leak check uses the strict form. */
function stems(w, loose) {
  const base = letters(w);
  const out = [base];
  if (base.endsWith("e")) out.push(base.slice(0, -1));
  if (base.endsWith("y")) out.push(base.slice(0, -1));
  if (loose && base.length > 4) out.push(base.slice(0, 4));
  return out.filter((s) => s.length >= 3);
}
const appearsLoose = (w, s) => stems(w, true).some((x) => letters(s).includes(x));
const appearsStrict = (w, s) => stems(w, false).some((x) => letters(s).includes(x));

/* --------------------------------------------------------------- content */
for (const u of UNITS) {
  const b = BANKS[u];
  const tag = `u0${u}`;
  if (!b) { fails.push(`${tag}: bank did not register`); continue; }

  ok(b.unit === u, `${tag}: bank .unit is ${b.unit}, expected ${u}`);
  ok(typeof b.part === "string" && b.part.length > 0, `${tag}: missing .part`);
  ok(["listening", "reading"].includes(b.kind), `${tag}: .kind must be listening or reading`);
  ok(Array.isArray(b.words) && b.words.length >= 12, `${tag}: expected at least 12 words`);

  const seen = new Set();
  const seenDef = new Set();
  const byPos = {};

  for (const w of b.words || []) {
    const id = `${tag}/${w.w}`;

    ok(typeof w.w === "string" && w.w.trim().length > 0, `${id}: empty headword`);
    ok(!seen.has(w.w), `${id}: duplicate headword in this unit`);
    seen.add(w.w);
    ok(POS.includes(w.pos), `${id}: pos "${w.pos}" is not one of ${POS.join(", ")}`);
    /* "help" is the book's whole definition of `assistance` — short is fine,
       empty is not. */
    ok(typeof w.def === "string" && w.def.length >= 4, `${id}: definition missing or too short`);
    /* Two words sharing a definition makes the meaning round unanswerable. */
    ok(!seenDef.has(w.def), `${id}: definition is identical to another word's in this unit`);
    seenDef.add(w.def);
    ok(typeof w.ex === "string" && w.ex.length > 5, `${id}: example missing or too short`);
    ok(["tactics", "600"].includes(w.src), `${id}: src must be "tactics" or "600"`);
    if (w.src === "600") ok(typeof w.lesson === "string" && /^Lesson \d+/.test(w.lesson),
      `${id}: 600-book entries need a "Lesson N, Title" attribution`);
    if (w.full) ok(letters(w.full).includes(letters(w.w)),
      `${id}: .full "${w.full}" does not contain the headword`);

    byPos[w.pos] = (byPos[w.pos] || 0) + 1;

    /* The example has to actually show the word. */
    ok(appearsLoose(w.w, w.ex), `${id}: the example sentence does not contain the word`);

    if (w.gap == null) continue;

    const blanks = (w.gap.match(/___/g) || []).length;
    ok(blanks === 1, `${id}: gap sentence has ${blanks} blanks, expected exactly 1`);
    if (blanks !== 1) continue;

    /* The answer must not be sitting in its own question. */
    ok(!appearsStrict(w.w, w.gap), `${id}: the answer appears in its own gap sentence`);

    /* And the gap has to be this word's example with the word taken out —
       this is the check that catches a sentence edited out of sync. */
    const [before, after] = w.gap.split("___");
    const e = norm(w.ex), pre = norm(before), post = norm(after);
    ok(pre === "" || e.startsWith(pre),
      `${id}: gap opening does not match the example\n      gap: ${pre}\n      ex : ${e}`);
    ok(post === "" || e.endsWith(post),
      `${id}: gap ending does not match the example\n      gap: ...${post}\n      ex : ...${e.slice(-post.length)}`);
  }

  /* The engine prefers same-part-of-speech distractors and needs three of
     them; with fewer it silently falls back to a mixed set, which makes the
     grammar of the options a giveaway. */
  for (const [p, n] of Object.entries(byPos)) {
    ok(n >= 4, `${tag}: only ${n} "${p}" words — need 4+ so same-pos distractors exist`);
  }

  /* Round sizes the engine asks for: 8 gap items, 6 typed items. */
  const gaps = (b.words || []).filter((w) => w.gap).length;
  const typeable = (b.words || []).filter((w) => !w.w.includes(" ")).length;
  ok(gaps >= 8, `${tag}: only ${gaps} words have gap sentences, round 2 needs 8`);
  ok(typeable >= 6, `${tag}: only ${typeable} single-word entries, round 4 needs 6`);
}

/* ----------------------------------------------------------------- pages */
for (const u of UNITS) {
  const p = `vocab-0${u}.html`;
  const f = path.join(ROOT, p);
  ok(fs.existsSync(f), `${p} is missing`);
  if (!fs.existsSync(f)) continue;
  const h = fs.readFileSync(f, "utf8");
  ok(h.includes(`assets/words-0${u}.js`), `${p}: does not load words-0${u}.js`);
  ok(h.includes("assets/vocab.js"), `${p}: does not load vocab.js`);
  ok(h.includes("assets/vocab.css"), `${p}: does not load vocab.css`);
  ok(h.includes("assets/lesson.css"), `${p}: does not load lesson.css`);
  ok(h.includes(`initVocab(${u})`), `${p}: does not call initVocab(${u})`);
  ok(h.includes('id="vgame"'), `${p}: no #vgame mount point`);
  ok(h.includes('id="wordlist"'), `${p}: no #wordlist mount point`);
  ok(h.includes('id="resetBtn"'), `${p}: no reset button`);
  ok(/name="robots"[^>]*noindex/.test(h), `${p}: missing the noindex robots meta`);
  const isReading = [5, 6, 7].includes(u);
  ok(isReading === /<body class="reading">/.test(h),
    `${p}: body class does not match the unit's listening/reading colour`);
}

/* Every link the index promises has to resolve. */
const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
for (const u of UNITS) {
  ok(idx.includes(`vocab-0${u}.html`), `index.html: no link to vocab-0${u}.html`);
}
for (const m of idx.matchAll(/href="([^"#:]+\.html)"/g)) {
  ok(fs.existsSync(path.join(ROOT, m[1])), `index.html links to ${m[1]}, which does not exist`);
}
/* Unit pages that exist should offer their vocabulary page, and vice versa. */
for (const u of [1, 2, 5, 6]) {
  const h = fs.readFileSync(path.join(ROOT, `unit-0${u}.html`), "utf8");
  ok(h.includes(`vocab-0${u}.html`), `unit-0${u}.html: no link to its vocabulary page`);
  const m = h.match(/The (\d+) words behind this unit|full (\d+) words are drilled/);
  ok(m, `unit-0${u}.html: vocabulary section does not state a word count`);
  if (m) {
    const stated = Number(m[1] || m[2]);
    ok(stated === BANKS[u].words.length,
      `unit-0${u}.html says ${stated} words, the bank has ${BANKS[u].words.length}`);
  }
}

/* A count printed on a link is a promise; keep it honest. */
for (const m of idx.matchAll(/vocab-0(\d)\.html"[^<]*<span>· (\d+) words/g)) {
  const u = Number(m[1]), stated = Number(m[2]);
  ok(BANKS[u] && stated === BANKS[u].words.length,
    `index.html says ${stated} words for unit ${u}, the bank has ${BANKS[u]?.words.length}`);
}

/* ---------------------------------------------------------------- report */
const total = pass + fails.length;
if (fails.length) {
  console.log(`\n${fails.length} of ${total} checks FAILED:\n`);
  fails.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
console.log(`\nAll ${total} content checks passed.`);
console.log(UNITS.map((u) => `  Unit ${u}: ${BANKS[u].words.length} words ` +
  `(${BANKS[u].words.filter((w) => w.src === "tactics").length} Tactics, ` +
  `${BANKS[u].words.filter((w) => w.src === "600").length} from 600 Essential Words)`).join("\n"));
