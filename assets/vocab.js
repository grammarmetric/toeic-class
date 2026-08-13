/* Vocabulary game engine for the TOEIC class pages.
   A vocab page loads this file, then one words-NN.js bank, then calls
   initVocab(N). Everything below is generic across units.

   Nothing is collected: the score, the streak and the per-word mastery
   counters all live in this browser's localStorage and go nowhere else. */
"use strict";

var Vocab = (function () {
  var BANKS = {};
  return {
    register: function (unit, data) { BANKS[unit] = data; },
    bank: function (unit) { return BANKS[unit]; },
    units: function () { return Object.keys(BANKS); }
  };
})();

function initVocab(unitNo) {

  var BANK = Vocab.bank(unitNo);
  if (!BANK) return;
  var WORDS = BANK.words;
  var STORE = "gm.toeic.vocab.u" + (unitNo < 10 ? "0" : "") + unitNo;

  /* A word counts as mastered once it has been answered correctly, first
     try, on three separate questions. One wrong answer resets it to zero —
     the point is to keep shaky words in circulation, not to award badges. */
  var MASTER_AT = 3;

  /* ------------------------------------------------------------ storage */
  var save = {};
  try { save = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) { save = {}; }
  if (!save.mastery) save.mastery = {};
  if (!save.best) save.best = 0;
  if (!save.runs) save.runs = 0;

  var writeT = null;
  var discarded = false;
  function writeNow() {
    clearTimeout(writeT);
    writeT = null;
    if (discarded) return;
    try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) {}
  }
  function persist() {
    clearTimeout(writeT);
    writeT = setTimeout(writeNow, 200);
  }
  /* Answering quickly keeps pushing the debounced write back, so a student
     who closes the tab straight after an answer would lose it. Flush on the
     way out — on phones `pagehide` is the event that actually fires. */
  window.addEventListener("pagehide", writeNow);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") writeNow();
  });

  /* ------------------------------------------------------------ helpers */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function shuffle(a) {
    var out = a.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }
  function norm(s) {
    return (s || "").toLowerCase().replace(/[‘’]/g, "'")
      .replace(/[.,!?;:]/g, "").replace(/\s+/g, " ").trim();
  }
  /* Levenshtein, capped — only used to tell a near-miss spelling apart from
     a genuinely wrong word so the feedback can say which it was. */
  function editDist(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      for (j = 0; j <= b.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
  }
  function masteryOf(w) { return save.mastery[w.w] || 0; }
  function masteredCount() {
    var n = 0;
    WORDS.forEach(function (w) { if (masteryOf(w) >= MASTER_AT) n++; });
    return n;
  }

  /* --------------------------------------------------------- round setup */
  /* Four passes at the same set of words, each demanding a bit more:
     recognise it, place it in a sentence, produce it at speed, spell it. */
  var ROUNDS = [
    { id: "meaning", name: "Meaning",    blurb: "Read the meaning, choose the word.",                 type: "def",  n: 8 },
    { id: "context", name: "In context", blurb: "One word is missing. Which one fits?",               type: "gap",  n: 8 },
    { id: "speed",   name: "Speed",      blurb: "Same again, but the clock is running.",              type: "def",  n: 8, secs: 8 },
    { id: "recall",  name: "Recall",     blurb: "No choices this time — type the word yourself.",     type: "type", n: 6 }
  ];

  /* Weakest words first, so a struggling student meets them more often.
     Ties are shuffled, otherwise every run asks the same questions.
     The gap round needs a sentence to blank; the recall round is skipped for
     multi-word entries — typing "work-life balance" tests patience, not
     vocabulary. */
  function pickWords(n, round) {
    var pool = WORDS.filter(function (w) {
      if (round.type === "gap") return !!w.gap;
      if (round.type === "type") return w.w.indexOf(" ") < 0;
      return true;
    });
    var tiers = {};
    pool.forEach(function (w) {
      var m = Math.min(masteryOf(w), MASTER_AT);
      (tiers[m] = tiers[m] || []).push(w);
    });
    var ordered = [];
    for (var m = 0; m <= MASTER_AT; m++) {
      if (tiers[m]) ordered = ordered.concat(shuffle(tiers[m]));
    }
    return ordered.slice(0, Math.min(n, ordered.length));
  }

  /* Distractors come from the same unit, same part of speech where possible,
     so the choice is about meaning rather than about grammar. */
  function distractors(word, n) {
    var same = WORDS.filter(function (w) { return w.w !== word.w && w.pos === word.pos; });
    var rest = WORDS.filter(function (w) { return w.w !== word.w && w.pos !== word.pos; });
    var out = shuffle(same).slice(0, n);
    if (out.length < n) out = out.concat(shuffle(rest).slice(0, n - out.length));
    return out;
  }

  function buildQuestion(word, round) {
    if (round.type === "type") {
      return { word: word, round: round, kind: "type" };
    }
    var opts = shuffle(distractors(word, 3).concat([word]));
    return { word: word, round: round, kind: "mcq", opts: opts };
  }

  function buildRound(round) {
    return pickWords(round.n, round).map(function (w) {
      return buildQuestion(w, round);
    });
  }

  /* ------------------------------------------------------------ run state */
  var run = null;
  var root = document.getElementById("vgame");
  var timerH = null;

  function stopTimer() {
    if (timerH) { clearInterval(timerH); timerH = null; }
  }

  function newRun() {
    stopTimer();
    run = {
      ri: 0, items: [], idx: 0, queue: [], retries: 0,
      score: 0, streak: 0, bestStreak: 0,
      asked: 0, right: 0, answered: false, startedMastered: masteredCount()
    };
    startRound();
  }

  function startRound() {
    run.items = buildRound(ROUNDS[run.ri]);
    run.idx = 0; run.queue = []; run.retries = 0;
    if (!run.items.length) { nextRound(); return; }
    drawQuestion();
  }

  function nextRound() {
    stopTimer();
    run.ri++;
    if (run.ri >= ROUNDS.length) drawRunSummary();
    else drawRoundSummary();
  }

  /* --------------------------------------------------------------- chrome */
  /* Also drawn by the start card, before any run exists. */
  function hud() {
    var total = WORDS.length, done = masteredCount();
    var pct = total ? Math.round((done / total) * 100) : 0;
    var score = run ? run.score : 0, streak = run ? run.streak : 0;
    return '<div class="vhud">' +
      '<div class="vstat"><span class="k">Score</span><span class="v" id="vscore">' + score + '</span></div>' +
      '<div class="vstat"><span class="k">Streak</span><span class="v' + (streak >= 3 ? " hot" : "") +
        '" id="vstreak">' + streak + '</span></div>' +
      '<div class="vmeter"><div class="vmeter-h"><span>Words mastered</span><span>' + done + ' / ' + total + '</span></div>' +
      '<div class="vbar"><i style="width:' + pct + '%"></i></div></div>' +
      '</div>';
  }

  function roundBar() {
    var r = ROUNDS[run.ri];
    var dots = run.items.map(function (it, i) {
      var c = i < run.idx ? (it.gotIt ? "d ok" : "d no") : (i === run.idx ? "d now" : "d");
      return '<i class="' + c + '"></i>';
    }).join("");
    return '<div class="vround">' +
      '<div class="vround-h"><span class="vr-n">Round ' + (run.ri + 1) + ' of ' + ROUNDS.length + '</span>' +
      '<span class="vr-t">' + esc(r.name) + '</span></div>' +
      '<div class="vdots">' + dots + '</div></div>';
  }

  /* ------------------------------------------------------------- question */
  function drawQuestion() {
    stopTimer();
    var q = run.items[run.idx];
    if (!q) { nextRound(); return; }
    run.answered = false;
    var r = q.round;
    var w = q.word;

    var stem, help = "";
    if (r.type === "def") {
      stem = '<p class="vdef">' + esc(w.def) + '</p><p class="vpos">' + esc(posLabel(w.pos)) + '</p>';
    } else if (r.type === "gap") {
      stem = '<p class="vsent">' + w.gap.replace(/___/g, '<span class="vblank">?</span>') + '</p>';
    } else {
      var letters = w.w.replace(/[^a-z]/gi, "").length;
      stem = '<p class="vdef">' + esc(w.def) + '</p><p class="vpos">' + esc(posLabel(w.pos)) + '</p>';
      help = '<p class="vhint">Starts with <b>' + esc(w.w.charAt(0)) + '</b> &middot; ' +
             letters + ' letter' + (letters === 1 ? "" : "s") + '</p>';
    }

    var body = '';
    if (q.kind === "mcq") {
      body = '<div class="vopts" id="vopts">' + q.opts.map(function (o, i) {
        return '<button type="button" class="vopt" data-w="' + esc(o.w) + '">' +
               '<span class="vkey">' + (i + 1) + '</span><span class="vw">' + esc(o.w) + '</span></button>';
      }).join("") + '</div>';
    } else {
      body = '<div class="vtype"><input type="text" id="vin" autocomplete="off" autocapitalize="off" ' +
             'autocorrect="off" spellcheck="false" placeholder="type the word"> ' +
             '<button type="button" class="btn" id="vgo">Check</button></div>';
    }

    root.innerHTML = hud() + '<div class="sec vcard">' + roundBar() +
      (q.retry ? '<p class="vretry">Second chance &mdash; you missed this one earlier.</p>' : "") +
      '<p class="vask">' + esc(askLabel(r)) + '</p>' + stem + help + body +
      '<div class="vfb" id="vfb"></div>' +
      (r.secs ? '<div class="vtimer"><i id="vtbar"></i></div>' : "") +
      '</div>';

    if (q.kind === "mcq") {
      root.querySelectorAll(".vopt").forEach(function (b) {
        b.addEventListener("click", function () { answer(b.dataset.w); });
      });
    } else {
      var input = document.getElementById("vin");
      input.focus();
      document.getElementById("vgo").addEventListener("click", function () { answer(input.value); });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); answer(input.value); }
      });
    }

    if (r.secs) startTimer(r.secs);
  }

  function askLabel(r) {
    return r.type === "def" ? "Which word means this?"
         : r.type === "gap" ? "Which word completes the sentence?"
         : "Type the word that means this.";
  }
  function posLabel(p) {
    return { n: "noun", v: "verb", adj: "adjective", adv: "adverb", phr: "phrase" }[p] || p;
  }

  function startTimer(secs) {
    var left = secs * 1000, step = 100;
    var bar = document.getElementById("vtbar");
    timerH = setInterval(function () {
      left -= step;
      if (bar) bar.style.width = Math.max(0, (left / (secs * 1000)) * 100) + "%";
      if (left <= 0) { stopTimer(); if (!run.answered) answer(null, true); }
    }, step);
  }

  /* --------------------------------------------------------------- answer */
  function answer(given, timedOut) {
    if (run.answered) return;
    run.answered = true;
    stopTimer();

    var q = run.items[run.idx];
    var w = q.word;
    var r = q.round;
    var ok, near = false;

    if (timedOut) {
      ok = false;
    } else if (q.kind === "mcq") {
      ok = given === w.w;
    } else {
      var v = norm(given);
      ok = v === norm(w.w);
      if (!ok && v) near = editDist(v, norm(w.w)) <= 1;
    }

    q.gotIt = ok;

    /* Retry items keep the word in circulation but never pay out, so the
       score still means "got it first time". */
    if (!q.retry) {
      run.asked++;
      if (ok) {
        run.right++;
        run.streak++;
        if (run.streak > run.bestStreak) run.bestStreak = run.streak;
        var pts = 100 + Math.min(run.streak - 1, 5) * 20;
        if (r.secs) {
          var bar = document.getElementById("vtbar");
          var frac = bar ? (parseFloat(bar.style.width) || 0) / 100 : 0;
          pts += Math.round(frac * 50);
        }
        run.score += pts;
        q.pts = pts;
      } else {
        run.streak = 0;
      }
    }

    if (ok) {
      if (!q.retry) save.mastery[w.w] = Math.min((save.mastery[w.w] || 0) + 1, MASTER_AT);
    } else {
      save.mastery[w.w] = 0;
      if (run.retries < 2) run.queue.push(q);
    }
    persist();

    paintAnswer(q, ok, given, timedOut, near);
  }

  function paintAnswer(q, ok, given, timedOut, near) {
    var w = q.word;
    document.getElementById("vscore").textContent = run.score;
    var st = document.getElementById("vstreak");
    st.textContent = run.streak;
    st.className = "v" + (run.streak >= 3 ? " hot" : "");

    if (q.kind === "mcq") {
      root.querySelectorAll(".vopt").forEach(function (b) {
        b.disabled = true;
        if (b.dataset.w === w.w) b.classList.add("ok");
        else if (b.dataset.w === given) b.classList.add("no");
      });
    } else {
      var input = document.getElementById("vin");
      input.disabled = true;
      input.classList.add(ok ? "ok" : "no");
      var go = document.getElementById("vgo");
      if (go) go.disabled = true;
    }

    var head = ok
      ? '<b class="vy">✓ Correct</b>' + (q.pts ? ' <span class="vpts">+' + q.pts + '</span>' : "")
      : timedOut ? '<b class="vn">✗ Out of time</b>'
      : near ? '<b class="vn">✗ So close</b> &mdash; check the spelling.'
      : '<b class="vn">✗ Not that one</b>';

    var sent = q.round.type === "gap" && w.gapShow ? w.gapShow : w.ex;
    var fb = document.getElementById("vfb");
    fb.className = "vfb show " + (ok ? "ok" : "no");
    fb.innerHTML = head +
      '<p class="vword"><b>' + esc(w.full || w.w) + '</b> <i>(' + esc(posLabel(w.pos)) + ')</i> ' + esc(w.def) + '</p>' +
      (sent ? '<p class="vex">' + hi(sent, w) + '</p>' : "") +
      '<p class="vsrc">' + esc(w.src === "tactics" ? "Tactics for TOEIC — Unit " + unitNo + " word list"
                                                    : "600 Essential Words — " + (w.lesson || "")) + '</p>' +
      '<div class="vnextrow"><button type="button" class="btn" id="vnext">' +
      (run.idx + 1 >= run.items.length && !run.queue.length ? "Finish round" : "Next") + ' →</button>' +
      '<span class="vhintk">or press Enter</span></div>';

    document.getElementById("vnext").addEventListener("click", advance);
    document.getElementById("vnext").focus();
  }

  /* Bold the target inside its example sentence — seeing the word sitting in
     real text is most of what makes an example worth showing. */
  function hi(sentence, w) {
    var stem = w.w.replace(/[^a-z]/gi, "");
    if (stem.length < 4) return esc(sentence);
    var re = new RegExp("(" + stem.slice(0, Math.max(4, stem.length - 2)) + "[a-z]*)", "ig");
    return esc(sentence).replace(re, "<b>$1</b>");
  }

  function advance() {
    run.idx++;
    if (run.idx >= run.items.length && run.queue.length) {
      /* Everything missed comes back before the round can be finished. */
      run.queue.forEach(function (q) { q.retry = true; q.gotIt = false; });
      run.items = run.items.concat(run.queue);
      run.queue = [];
      run.retries++;
    }
    if (run.idx >= run.items.length) nextRound();
    else drawQuestion();
  }

  /* -------------------------------------------------------------- summary */
  function drawRoundSummary() {
    var r = ROUNDS[run.ri];
    root.innerHTML = hud() + '<div class="sec vcard vmid">' +
      '<p class="vstep">Round ' + (run.ri + 1) + ' of ' + ROUNDS.length + '</p>' +
      '<h2 class="vbig">' + esc(r.name) + '</h2>' +
      '<p class="vblurb">' + esc(r.blurb) + '</p>' +
      '<div class="vnextrow"><button type="button" class="btn" id="vnext">Start round →</button></div>' +
      '</div>';
    document.getElementById("vnext").addEventListener("click", startRound);
    document.getElementById("vnext").focus();
  }

  function drawRunSummary() {
    save.runs++;
    var beat = run.score > save.best;
    if (beat) save.best = run.score;
    persist();

    var acc = run.asked ? Math.round((run.right / run.asked) * 100) : 0;
    var gained = masteredCount() - run.startedMastered;
    var shaky = WORDS.filter(function (w) { return masteryOf(w) === 0; });

    root.innerHTML = hud() + '<div class="sec vcard">' +
      '<p class="vstep">Run complete</p>' +
      '<h2 class="vbig">' + run.score + ' points</h2>' +
      '<div class="vfinal">' +
        '<div><span class="k">Accuracy</span><span class="v">' + acc + '%</span></div>' +
        '<div><span class="k">Best streak</span><span class="v">' + run.bestStreak + '</span></div>' +
        '<div><span class="k">Newly mastered</span><span class="v">' + (gained > 0 ? "+" + gained : gained) + '</span></div>' +
        '<div><span class="k">Personal best</span><span class="v">' + save.best + (beat ? ' ★' : "") + '</span></div>' +
      '</div>' +
      (shaky.length
        ? '<p class="vshaky-h">Still shaky &mdash; these come back first next run</p>' +
          '<div class="vshaky">' + shaky.map(function (w) {
            return '<span class="vtag">' + esc(w.full || w.w) + '</span>';
          }).join("") + '</div>'
        : '<p class="vshaky-h">Nothing shaky left in this unit. Play again to keep it that way.</p>') +
      '<div class="vnextrow"><button type="button" class="btn" id="vagain">Play again →</button>' +
      '<a class="btn ghost" href="#wordlist">See the word list</a></div>' +
      '</div>';
    document.getElementById("vagain").addEventListener("click", newRun);
    document.getElementById("vagain").focus();
  }

  /* ---------------------------------------------------------- start card */
  function drawStart() {
    var total = WORDS.length, done = masteredCount();
    root.innerHTML = hud() + '<div class="sec vcard vmid">' +
      '<p class="vstep">Unit ' + unitNo + ' vocabulary</p>' +
      '<h2 class="vbig">' + total + ' words, four rounds</h2>' +
      '<p class="vblurb">Recognise it, place it in a sentence, produce it at speed, then spell it. ' +
      'Anything you miss comes straight back before the round ends.</p>' +
      (save.runs
        ? '<p class="vblurb vprev">You have played ' + save.runs + ' time' + (save.runs === 1 ? "" : "s") +
          ' &middot; best ' + save.best + ' points &middot; ' + done + ' of ' + total + ' words mastered.</p>'
        : "") +
      '<div class="vnextrow"><button type="button" class="btn" id="vstart">Start →</button>' +
      '<a class="btn ghost" href="#wordlist">See the word list first</a></div>' +
      '</div>';
    document.getElementById("vstart").addEventListener("click", newRun);
  }

  /* ------------------------------------------------------------ word list */
  function drawWordList() {
    var host = document.getElementById("wordlist");
    if (!host) return;
    var rows = WORDS.map(function (w) {
      var m = masteryOf(w);
      var dots = "";
      for (var i = 0; i < MASTER_AT; i++) dots += '<i class="md' + (i < m ? " on" : "") + '"></i>';
      return '<div class="wrow"><div class="wl"><b>' + esc(w.full || w.w) + '</b> ' +
        '<i>(' + esc(posLabel(w.pos)) + ')</i> ' + esc(w.def) +
        (w.ex ? '<span class="wex">' + hi(w.ex, w) + '</span>' : "") + '</div>' +
        '<div class="wm" title="' + m + ' of ' + MASTER_AT + ' toward mastered">' + dots + '</div></div>';
    }).join("");
    host.innerHTML = '<div class="sec-h"><div class="badge">≡</div><h2>Word list</h2></div>' +
      '<p class="note">Every word this unit drills. The dots fill in as you get a word right ' +
      'first time; one wrong answer empties them again.</p><div class="wlist">' + rows + '</div>';
  }

  /* ----------------------------------------------------------- keyboard */
  document.addEventListener("keydown", function (e) {
    var n = document.getElementById("vnext");
    if (e.key === "Enter" && n && document.activeElement !== document.getElementById("vin")) {
      e.preventDefault(); n.click(); return;
    }
    if (run && !run.answered && /^[1-4]$/.test(e.key)) {
      var b = root.querySelectorAll(".vopt")[parseInt(e.key, 10) - 1];
      if (b) { e.preventDefault(); b.click(); }
    }
  });

  /* -------------------------------------------------------------- reset */
  var rb = document.getElementById("resetBtn");
  if (rb) rb.addEventListener("click", function () {
    if (!confirm("Clear your score and word mastery for this unit?")) return;
    /* Mark the state dead first: reloading fires `pagehide`, and without this
       the flush would write everything straight back and the reset would
       silently do nothing. */
    discarded = true;
    try { localStorage.removeItem(STORE); } catch (e) {}
    location.reload();
  });

  drawStart();
  drawWordList();
}
