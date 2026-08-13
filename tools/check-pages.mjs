/* Browser checks for the vocabulary pages:  node tools/check-pages.mjs
   Drives real Chrome over CDP — no puppeteer — through a complete run of
   every unit and asserts what ended up on screen.

   The Chrome plumbing and the two CDP gotchas it guards live in cdp.mjs.
   The one that belongs here: localStorage is cleared before each run,
   otherwise mastery saved by an earlier run changes which words get asked. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, launch, sleep } from "./cdp.mjs";

const UNITS = [1, 2, 3, 4, 5, 6, 7];

let pass = 0;
const fails = [];
function ok(cond, msg, detail = "") {
  if (cond) pass++;
  else fails.push(msg + (detail ? "  — " + detail : ""));
}

/* Word counts come from the banks themselves so the two suites cannot drift. */
const BANKS = {};
globalThis.Vocab = { register: (u, d) => { BANKS[u] = d; } };
for (const u of UNITS) new Function("Vocab", readFileSync(join(ROOT, "assets", `words-0${u}.js`), "utf8"))(globalThis.Vocab);

/* Reads whatever question is on screen and works out the right answer from
   the bank, so the suite can play a genuinely correct run rather than
   clicking blindly. */
const RESOLVE = (unit, mode) => `(()=>{
  const bank = Vocab.bank(${unit}).words;
  const sentEl = document.querySelector('.vsent');
  const defEl = document.querySelector('.vdef');
  let want = null;
  if (sentEl) {
    const txt = sentEl.textContent.trim();
    const m = bank.filter(w => w.gap && w.gap.replace('___','?').trim() === txt);
    if (m.length === 1) want = m[0].w;
  } else if (defEl) {
    const d = defEl.textContent.trim();
    const m = bank.filter(w => w.def === d);
    if (m.length === 1) want = m[0].w;
  }
  if (!want) return 'NOMATCH';
  const inp = document.getElementById('vin');
  if (inp) {
    inp.value = ${mode === "right"} ? want : 'zzzzz';
    document.getElementById('vgo').click();
    return want;
  }
  const opts = Array.from(document.querySelectorAll('.vopt'));
  const btn = ${mode === "right"}
    ? opts.find(b => b.dataset.w === want)
    : opts.find(b => b.dataset.w !== want);
  if (!btn) return 'NOBTN';
  btn.click();
  return want;
})()`;

const STATE = `(()=>{
  if (document.getElementById('vstart')) return 'start';
  if (document.getElementById('vagain')) return 'done';
  if (document.querySelector('.vfb.show')) return 'feedback';
  if (document.querySelector('.vopts') || document.getElementById('vin')) return 'question';
  if (document.getElementById('vnext')) return 'roundcard';
  return 'unknown';
})()`;

/* Clearing storage from outside does not survive navigation — the page
   flushes its in-memory state on `pagehide`. Use the page's own reset
   button, which is what a student would use anyway. */
async function resetPage(c, url) {
  await c.go(url);
  await c.eval("window.confirm = function () { return true; }; document.getElementById('resetBtn').click()");
  await sleep(800);
}

const { c, base, stop } = await launch({ port: 8124, debugPort: 9334, profile: ".chrome-profile" });

try {

  /* ---------------------------------------------------------- index */
  await c.go(base + "/index.html");
  await c.eval("localStorage.clear()");
  await c.go(base + "/index.html");
  ok(c.logs.length === 0, "index: no console errors", c.logs.join(" | "));
  ok(c.failed.length === 0, "index: no failed requests", c.failed.join(" | "));
  ok(await c.eval("document.querySelectorAll('a.warm.vocab[href^=\"vocab-0\"]').length") === UNITS.length,
     `index: one vocabulary link per unit (${UNITS.length})`);
  ok(await c.eval("!!document.querySelector('a[href=\"vocab-review.html\"]')"),
     "index: links the Units 1–7 sprint");

  /* --------------------------------------------- a full correct run */
  for (const u of UNITS) {
    const url = `${base}/vocab-0${u}.html`;
    const n = BANKS[u].words.length;
    await c.go(url);
    await c.eval("localStorage.clear()");
    await c.go(url);

    ok(c.logs.length === 0, `u0${u}: no console errors`, c.logs.join(" | "));
    ok(c.failed.length === 0, `u0${u}: no failed requests`, c.failed.join(" | "));
    ok(await c.eval("!!document.getElementById('vstart')"), `u0${u}: start card renders`);
    ok(await c.eval("document.querySelectorAll('#wordlist .wrow').length") === n,
       `u0${u}: word list shows all ${n} words`);
    ok(await c.eval("document.querySelectorAll('#wordlist .md').length") === n * 3,
       `u0${u}: three mastery dots per word`);
    ok((await c.eval("document.querySelector('.vmeter-h').textContent")).includes("0 / " + n),
       `u0${u}: mastery meter starts at 0 / ${n}`);

    await c.eval("document.getElementById('vstart').click()");

    let rounds = 0, questions = 0, unresolved = 0, guard = 0;
    let sawMcq = false, sawType = false, sawTimer = false;
    while (guard++ < 400) {
      const st = await c.eval(STATE);
      if (st === "done") break;
      if (st === "roundcard") { rounds++; await c.eval("document.getElementById('vnext').click()"); continue; }
      if (st === "question") {
        if (await c.eval("!!document.getElementById('vin')")) sawType = true; else sawMcq = true;
        if (await c.eval("!!document.getElementById('vtbar')")) sawTimer = true;
        const got = await c.eval(RESOLVE(u, "right"));
        if (got === "NOMATCH" || got === "NOBTN") unresolved++;
        questions++;
        continue;
      }
      if (st === "feedback") { await c.eval("document.getElementById('vnext').click()"); continue; }
      ok(false, `u0${u}: unexpected screen state`, st);
      break;
    }

    ok(unresolved === 0, `u0${u}: every question resolved against the bank`, `${unresolved} unresolved`);
    ok(rounds === 3, `u0${u}: three between-round cards shown`, `saw ${rounds}`);
    ok(sawMcq && sawType, `u0${u}: both multiple-choice and typed rounds appeared`);
    ok(sawTimer, `u0${u}: the speed round ran a timer`);
    ok(questions === 30, `u0${u}: 8+8+8+6 questions asked with no retries`, `asked ${questions}`);
    ok(await c.eval("!!document.getElementById('vagain')"), `u0${u}: run summary reached`);

    const acc = await c.eval("document.querySelectorAll('.vfinal .v')[0].textContent");
    ok(acc === "100%", `u0${u}: a perfect run reports 100% accuracy`, acc);
    const score = await c.eval("Number(document.getElementById('vscore').textContent)");
    ok(score > 0, `u0${u}: score accumulated`, String(score));

    /* The engine debounces its writes by 200ms, so let the last one land. */
    await sleep(400);
    const saved = await c.eval(`JSON.parse(localStorage['gm.toeic.vocab.u0${u}'] || 'null')`);
    ok(saved && saved.best === score, `u0${u}: personal best persisted`, JSON.stringify(saved?.best));
    ok(saved && saved.runs === 1, `u0${u}: run counted`);
    /* One perfect run is 30 correct answers, so mastery should have advanced
       exactly 30 times. Weakest-first selection spreads those over distinct
       words, so nothing reaches the 3 needed for "mastered" in a single run —
       that takes repeat visits, which is the point. */
    const vals = Object.values(saved.mastery || {});
    const sum = vals.reduce((a, b) => a + b, 0);
    ok(sum === 30, `u0${u}: 30 correct answers advanced mastery 30 times`, `sum ${sum}`);
    ok(vals.every((v) => v >= 1 && v <= 3), `u0${u}: mastery stays inside 1–3 for words asked`);
    const mastered = vals.filter((v) => v >= 3).length;
    ok(mastered === 0, `u0${u}: one run does not master anything`, `${mastered} mastered`);

    /* Progress survives a reload — students use this between lessons. */
    await c.go(url);
    ok((await c.eval("document.querySelector('.vmeter-h').textContent")).includes(mastered + " / " + n),
       `u0${u}: mastery meter reloads from storage`);
    ok((await c.eval("document.querySelector('.vprev').textContent")).includes("best " + score),
       `u0${u}: start card shows the saved best`);
  }

  /* ------------------------------------------- the reset button works */
  {
    const url = `${base}/vocab-01.html`;
    await resetPage(c, url);
    ok(await c.eval("localStorage['gm.toeic.vocab.u01'] == null"),
       "reset: clears saved progress and it stays cleared after the reload");
    ok((await c.eval("document.querySelector('.vmeter-h').textContent")).includes("0 / 23"),
       "reset: mastery meter back to zero");
    ok(await c.eval("!document.querySelector('.vprev')"),
       "reset: start card no longer shows a previous best");
  }

  /* ------------------------- repeat runs are what actually master words */
  {
    const u = 1, url = `${base}/vocab-0${u}.html`;
    for (let r = 0; r < 4; r++) {
      await c.go(url);
      await c.eval("document.getElementById('vstart').click()");
      let guard = 0;
      while (guard++ < 400) {
        const st = await c.eval(STATE);
        if (st === "done") break;
        if (st === "question") { await c.eval(RESOLVE(u, "right")); continue; }
        await c.eval("document.getElementById('vnext').click()");
      }
      await sleep(400);   /* let the run's last debounced write land */
    }
    const saved = await c.eval(`JSON.parse(localStorage['gm.toeic.vocab.u01'] || 'null')`);
    const vals = Object.values(saved.mastery || {});
    const mastered = vals.filter((v) => v >= 3).length;
    ok(saved.runs === 4, "repeat: four runs counted", String(saved.runs));
    ok(mastered > 0, "repeat: words reach mastered after repeat runs", `${mastered} mastered`);
    ok(vals.every((v) => v <= 3), "repeat: mastery never exceeds 3");
    await c.go(url);
    ok((await c.eval("document.querySelector('.vmeter-h').textContent")).includes(mastered + " / 23"),
       "repeat: meter reflects mastered count");
  }

  /* ------------------------------- a wrong run: retries and reset */
  {
    const u = 1, url = `${base}/vocab-0${u}.html`;
    await resetPage(c, url);
    await c.eval("document.getElementById('vstart').click()");

    let asked = 0, retries = 0, guard = 0;
    while (guard++ < 200) {
      const st = await c.eval(STATE);
      if (st === "done" || st === "roundcard") break;
      if (st === "question") {
        if (await c.eval("!!document.querySelector('.vretry')")) retries++;
        await c.eval(RESOLVE(u, "wrong"));
        asked++;
        continue;
      }
      if (st === "feedback") { await c.eval("document.getElementById('vnext').click()"); continue; }
      break;
    }
    ok(asked > 8, "retry: missed words came back before the round ended", `asked ${asked}`);
    ok(retries > 0, "retry: second-chance banner shown", `${retries} retries`);
    ok(await c.eval("Number(document.getElementById('vscore').textContent)") === 0,
       "retry: a run of wrong answers scores nothing");
    ok(await c.eval("Number(document.getElementById('vstreak').textContent)") === 0,
       "retry: streak stays at zero");
    await sleep(400);
    const m = await c.eval(`JSON.parse(localStorage['gm.toeic.vocab.u01'] || '{}').mastery || {}`);
    ok(Object.values(m).every((v) => v === 0), "retry: wrong answers reset mastery to zero");
  }

  /* ---------------------------- narrow width, mobile emulation OFF */
  for (const u of UNITS) {
    const url = `${base}/vocab-0${u}.html`;
    await c.go(url, { width: 390, height: 800 });
    const iw = await c.eval("innerWidth");
    ok(iw === 390, `u0${u}: layout viewport really is 390px`, "got " + iw);
    const over = await c.eval(`(()=>{
      const bad = [];
      document.querySelectorAll('body *').forEach(function (n) {
        const r = n.getBoundingClientRect();
        if (r.width > 0 && r.right > innerWidth + 1) {
          bad.push(n.tagName.toLowerCase() + '.' + (n.className || '').toString().split(' ')[0] +
                   ' right=' + Math.round(r.right));
        }
      });
      return bad.slice(0, 6);
    })()`);
    ok(over.length === 0, `u0${u}: nothing overflows 390px at rest`, over.join(", "));
    ok(await c.eval("document.documentElement.scrollWidth <= innerWidth + 1"),
       `u0${u}: no horizontal scroll at rest`);

    /* Mid-question is the wider layout: options, feedback, timer. */
    await c.eval("document.getElementById('vstart').click()");
    await c.eval(RESOLVE(u, "right"));
    const over2 = await c.eval(`(()=>{
      const bad = [];
      document.querySelectorAll('body *').forEach(function (n) {
        const r = n.getBoundingClientRect();
        if (r.width > 0 && r.right > innerWidth + 1) bad.push(n.tagName.toLowerCase() + '.' + (n.className || '').toString().split(' ')[0]);
      });
      return bad.slice(0, 6);
    })()`);
    ok(over2.length === 0, `u0${u}: nothing overflows 390px mid-question`, over2.join(", "));
  }

  /* ------------------------------------------------------ screenshots */
  await c.go(`${base}/vocab-01.html`, { width: 900, height: 1000 });
  await c.eval("localStorage.clear()");
  await c.go(`${base}/vocab-01.html`, { width: 900, height: 1000 });
  await c.shot("vocab-start");
  await c.eval("document.getElementById('vstart').click()");
  await c.shot("vocab-question");
  await c.eval(RESOLVE(1, "right"));
  await sleep(150);
  await c.shot("vocab-feedback");
  await c.go(`${base}/vocab-05.html`, { width: 390, height: 900 });
  await c.eval("document.getElementById('vstart').click()");
  await c.eval(RESOLVE(5, "wrong"));
  await sleep(150);
  await c.shot("vocab-phone-wrong");
  await c.go(`${base}/index.html`, { width: 390, height: 1100 });
  await c.shot("index-phone");
} catch (e) {
  ok(false, "page suite crashed", e.message);
} finally {
  stop();
}

const total = pass + fails.length;
if (fails.length) {
  console.log(`\n${fails.length} of ${total} browser checks FAILED:\n`);
  fails.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
console.log(`\nAll ${total} browser checks passed. Screenshots in tools/shots/.`);
