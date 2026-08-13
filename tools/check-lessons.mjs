/* Browser checks for the lesson pages:  node tools/check-lessons.mjs

   The vocabulary suite plays the games; this one plays the lessons. For every
   page that calls initLesson it reads the answer key straight out of the page's
   own <script>, fills in every gradable item with the book's answer, presses each
   Check button and asserts the score came back full — then deliberately gets one
   group wrong and asserts the marking notices. It also loads every deck and
   asserts each slide has a matching notes div.

   The point of the wrong-answer pass is that a key with a typo in it still
   scores 100% if you only ever feed it its own answers. */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, launch, sleep } from "./cdp.mjs";

const LESSONS = ["unit-02", "unit-03", "unit-04", "unit-05", "unit-06", "unit-07", "review-01"];
const DECKS = ["slides-01", "slides-02", "slides-03", "slides-04",
               "slides-05", "slides-06", "slides-07", "slides-review"];
const PLAIN = ["index", "unit-01", "unit-02-file2"];

let pass = 0;
const fails = [];
function ok(cond, msg, detail = "") {
  if (cond) pass++;
  else fails.push(msg + (detail ? "  — " + detail : ""));
}

/* ------------------------------------------------- read the key from source */
/* The config is an object literal passed straight to initLesson, so the only
   way to get at it is to lift the literal out of the file and evaluate it. */
function lessonConfig(page) {
  const src = readFileSync(join(ROOT, page + ".html"), "utf8");
  const at = src.indexOf("initLesson(");
  if (at < 0) return null;
  const start = src.indexOf("{", at);
  let depth = 0, end = -1, inStr = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i], prev = src[i - 1];
    if (inStr) { if (ch === inStr && prev !== "\\") inStr = null; continue; }
    if (ch === '"' || ch === "'") { inStr = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  return new Function("return (" + src.slice(start, end + 1) + ")")();
}

/* The expression that fills one item in with its correct (or wrong) answer.
   Mirrors the four item types the engine supports. */
function fillExpr(id, k, banks, right) {
  if (k.set) {
    const bank = Object.keys(k.set)[0];
    const want = JSON.stringify(k.set[bank]);
    const all = JSON.stringify((banks && banks[bank]) || []);
    return `(()=>{
      const box = document.querySelector('[data-bank="${bank}"][data-item="${id}"]');
      if (!box) return 'NOBOX';
      const want = ${want}, all = ${all};
      const pick = ${right} ? want : all.filter(w => want.indexOf(w) < 0).slice(0, 1);
      box.querySelectorAll('.chip').forEach(c => {
        const on = c.getAttribute('aria-pressed') === 'true';
        if (on !== (pick.indexOf(c.dataset.w) >= 0)) c.click();
      });
      return 'OK';
    })()`;
  }
  if (k.accept || k.any) {
    const val = right ? (k.accept ? k.accept[0] : k.any[0]) : "zzzz nonsense zzzz";
    return `(()=>{
      const n = document.getElementById(${JSON.stringify(id)});
      if (!n) return 'NONODE';
      const f = (typeof n.value === 'string') ? n : n.querySelector('input[type=text],textarea');
      if (!f) return 'NOFIELD';
      f.value = ${JSON.stringify(val)};
      f.dispatchEvent(new Event('input', {bubbles:true}));
      return 'OK';
    })()`;
  }
  return `(()=>{
    const sel = document.querySelector('[data-pick="${id}"]');
    if (sel) {
      const want = ${JSON.stringify(k.a)};
      const other = Array.from(sel.options).map(o => o.value).filter(v => v && v !== want)[0] || '';
      sel.value = ${right} ? want : other;
      sel.dispatchEvent(new Event('change', {bubbles:true}));
      return 'OK';
    }
    const box = document.querySelector('[data-mcq="${id}"]');
    if (!box) return 'NOBOX';
    const opts = Array.from(box.querySelectorAll('.opt'));
    const btn = ${right}
      ? opts.find(o => o.dataset.v === ${JSON.stringify(k.a)})
      : opts.find(o => o.dataset.v !== ${JSON.stringify(k.a)});
    if (!btn) return 'NOOPT';
    btn.click();
    return 'OK';
  })()`;
}

const OVERFLOW = `(()=>{
  const bad = [];
  document.querySelectorAll('body *').forEach(function (n) {
    const r = n.getBoundingClientRect();
    if (r.width > 0 && r.right > innerWidth + 1) {
      bad.push(n.tagName.toLowerCase() + '.' + (n.className || '').toString().split(' ')[0] +
               ' right=' + Math.round(r.right));
    }
  });
  return bad.slice(0, 6);
})()`;

/* Every scan has to have actually decoded — a wrong filename that the server
   answers with a 404 page still leaves an <img> in the DOM.
   Most scans below the fold are loading="lazy", so they have to be forced to
   load first; without that this check reports a healthy page as broken. */
const BROKEN_IMAGES = `(async () => {
  const imgs = Array.from(document.querySelectorAll('img'));
  imgs.forEach(i => { i.loading = 'eager'; });
  await Promise.all(imgs.map(i => i.complete ? null : new Promise(res => {
    i.addEventListener('load', res, { once: true });
    i.addEventListener('error', res, { once: true });
    setTimeout(res, 5000);
  })));
  return imgs.filter(i => i.naturalWidth === 0).map(i => i.getAttribute('src')).slice(0, 8);
})()`;

const MISSING_ALT = `(()=>{
  const bad = [];
  document.querySelectorAll('img').forEach(function (i) {
    if (!i.getAttribute('alt') || i.getAttribute('alt').trim().length < 4) bad.push(i.getAttribute('src'));
  });
  return bad.slice(0, 8);
})()`;

const { c, base, stop } = await launch({ port: 8125, debugPort: 9335, profile: ".chrome-lessons" });

try {
  /* --------------------------------------------------- pages load cleanly */
  for (const page of [...PLAIN, ...LESSONS, ...DECKS]) {
    ok(existsSync(join(ROOT, page + ".html")), `${page}.html exists`);
    await c.go(`${base}/${page}.html`);
    ok(c.logs.length === 0, `${page}: no console errors`, c.logs.join(" | "));
    ok(c.failed.length === 0, `${page}: no failed requests`, c.failed.slice(0, 4).join(" | "));
    const broken = await c.eval(BROKEN_IMAGES);
    ok(broken.length === 0, `${page}: every image loaded`, broken.join(", "));
    const noalt = await c.eval(MISSING_ALT);
    ok(noalt.length === 0, `${page}: every image has alt text`, noalt.join(", "));
  }

  /* ------------------------------------------------------- decks are sane */
  for (const page of DECKS) {
    await c.go(`${base}/${page}.html`);
    const slides = await c.eval("document.querySelectorAll('.deck .slide').length");
    const notes = await c.eval("document.querySelectorAll('.notes').length");
    ok(slides >= 6, `${page}: has ${slides} slides`);
    ok(slides === notes, `${page}: one notes block per slide`, `${slides} slides, ${notes} notes`);
    ok(await c.eval("!!document.querySelector('.slide.on')"), `${page}: first slide is showing`);
    /* Walk to the end; a deck that throws mid-run would show up as a console error. */
    await c.eval(`(()=>{ for (let i=0;i<80;i++) document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'})); })()`);
    await sleep(200);
    ok(c.logs.length === 0, `${page}: no errors walking to the last slide`, c.logs.join(" | "));
  }

  /* ------------------------------------------ audio files really are there */
  for (const page of LESSONS) {
    await c.go(`${base}/${page}.html`);
    const srcs = await c.eval("Array.from(document.querySelectorAll('.audio')).map(a => a.dataset.src)");
    for (const s of srcs) {
      const status = await c.eval(`fetch(${JSON.stringify(s)}, {method:'HEAD'}).then(r => r.status).catch(() => 0)`);
      ok(status === 200, `${page}: ${s} is served`, "status " + status);
    }
  }

  /* ------------------------------------ a full correct run of every lesson */
  for (const page of LESSONS) {
    const cfg = lessonConfig(page);
    ok(!!cfg && !!cfg.key, `${page}: answer key found in the page`);
    if (!cfg || !cfg.key) continue;

    const url = `${base}/${page}.html`;
    await c.go(url);
    await c.eval(`localStorage.removeItem(${JSON.stringify(cfg.store)})`);
    await c.go(url);

    /* Every keyed id must exist on the page, and every gradable item on the
       page must be keyed — a stray id in either direction is a silent hole. */
    const ids = Object.keys(cfg.key);
    const missing = await c.eval(
      `${JSON.stringify(ids)}.filter(id => !document.getElementById(id))`);
    ok(missing.length === 0, `${page}: every key id is on the page`, missing.join(", "));
    const unkeyed = await c.eval(`(()=>{
      const keyed = new Set(${JSON.stringify(ids)});
      const out = [];
      document.querySelectorAll('[data-group]').forEach(n => { if (n.id && !keyed.has(n.id)) out.push(n.id); });
      return out;
    })()`);
    ok(unkeyed.length === 0, `${page}: every gradable item is keyed`, unkeyed.join(", "));
    const fbMissing = await c.eval(
      `${JSON.stringify(ids)}.filter(id => !document.getElementById('fb-' + id))`);
    ok(fbMissing.length === 0, `${page}: every item has a feedback slot`, fbMissing.join(", "));

    for (const id of ids) {
      const r = await c.eval(fillExpr(id, cfg.key[id], cfg.banks, true));
      ok(r === "OK", `${page}/${id}: could be answered`, String(r));
    }

    const groups = await c.eval(
      "Array.from(document.querySelectorAll('[data-check]')).map(b => b.dataset.check)");
    ok(groups.length > 0, `${page}: has Check buttons`);
    for (const g of groups) {
      await c.eval(`document.querySelector('[data-check="${g}"]').click()`);
      const s = await c.eval(`(document.getElementById('score-${g}') || {}).textContent || ''`);
      const m = s.match(/^(\d+) \/ (\d+) correct$/);
      ok(!!m, `${page}/${g}: score rendered`, s);
      if (m) ok(m[1] === m[2], `${page}/${g}: all correct with the book's answers`, s);
      const good = await c.eval(`document.getElementById('score-${g}').className.includes('good')`);
      ok(good, `${page}/${g}: score shows as good`);
    }
    ok(c.logs.length === 0, `${page}: no console errors during marking`, c.logs.join(" | "));

    /* ------------------------------- and a deliberately wrong pass, once */
    const g = groups[0];
    const wrongIds = await c.eval(
      `Array.from(document.querySelectorAll('[data-group="${g}"]')).map(n => n.id).filter(Boolean)`);
    const target = wrongIds.find((id) => cfg.key[id]);
    if (target) {
      await c.eval(`document.querySelector('[data-clearmark="${g}"]').click()`);
      await c.eval(fillExpr(target, cfg.key[target], cfg.banks, false));
      await c.eval(`document.querySelector('[data-check="${g}"]').click()`);
      const s2 = await c.eval(`document.getElementById('score-${g}').textContent`);
      const m2 = s2.match(/^(\d+) \/ (\d+) correct$/);
      ok(m2 && m2[1] !== m2[2], `${page}/${g}: a wrong answer lowers the score`, s2);
      ok(await c.eval(`document.getElementById(${JSON.stringify(target)}).classList.contains('marked-no')`),
         `${page}/${target}: wrong item is marked wrong`);
      ok(await c.eval(`document.getElementById('fb-' + ${JSON.stringify(target)}).classList.contains('show')`),
         `${page}/${target}: the explanation is shown`);
    }
  }

  /* ------------------------------- narrow width, mobile emulation OFF */
  for (const page of [...PLAIN, ...LESSONS]) {
    await c.go(`${base}/${page}.html`, { width: 390, height: 900 });
    const iw = await c.eval("innerWidth");
    ok(iw === 390, `${page}: layout viewport really is 390px`, "got " + iw);
    const over = await c.eval(OVERFLOW);
    ok(over.length === 0, `${page}: nothing overflows 390px`, over.join(", "));
    ok(await c.eval("document.documentElement.scrollWidth <= innerWidth + 1"),
       `${page}: no horizontal scroll`);
  }

  /* Marked-up state is wider than resting state: feedback boxes and option rows. */
  for (const page of ["unit-03", "unit-04", "unit-07", "review-01"]) {
    const cfg = lessonConfig(page);
    await c.go(`${base}/${page}.html`, { width: 390, height: 900 });
    for (const id of Object.keys(cfg.key)) await c.eval(fillExpr(id, cfg.key[id], cfg.banks, true));
    await c.eval("document.querySelectorAll('[data-check]').forEach(b => b.click())");
    await sleep(200);
    const over = await c.eval(OVERFLOW);
    ok(over.length === 0, `${page}: nothing overflows 390px once marked`, over.join(", "));
  }

  /* ------------------------------------------------------ screenshots */
  /* Clear first, or the shots show the correct-run answers this suite just
     filled in rather than what a student opens the page to. */
  await c.go(`${base}/index.html`, { width: 390, height: 1400 });
  await c.shot("index-week2-phone");
  for (const page of ["unit-03", "unit-04", "unit-07", "review-01"]) {
    const cfg = lessonConfig(page);
    await c.go(`${base}/${page}.html`);
    await c.eval(`localStorage.removeItem(${JSON.stringify(cfg.store)})`);
    await c.go(`${base}/${page}.html`, { width: 390, height: 1200 });
    await c.shot(page + "-phone");
    await c.go(`${base}/${page}.html`, { width: 1100, height: 1000 });
    await c.shot(page + "-wide");
  }
  await c.go(`${base}/slides-review.html`, { width: 1280, height: 800 });
  await c.shot("slides-review");
} catch (e) {
  ok(false, "lesson suite crashed", e.message);
} finally {
  stop();
}

const total = pass + fails.length;
if (fails.length) {
  console.log(`\n${fails.length} of ${total} lesson checks FAILED:\n`);
  fails.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
console.log(`\nAll ${total} lesson checks passed. Screenshots in tools/shots/.`);
