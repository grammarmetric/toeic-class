/* Shared lesson engine for the TOEIC class pages.
   A unit page supplies content markup plus a LESSON config, then calls
   initLesson(LESSON). Everything below is generic across units. */
"use strict";

function initLesson(LESSON) {

  var KEY = LESSON.key || {};
  var STORE = LESSON.store;

  /* ------------------------------------------------------------ storage */
  var state = {};
  try { state = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) { state = {}; }
  var t = null;
  function save() {
    clearTimeout(t);
    t = setTimeout(function () {
      try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
    }, 200);
  }
  function setVal(k, v) { state[k] = v; save(); }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function norm(s) {
    return (s || "").toLowerCase().replace(/[‘’]/g, "'")
      .replace(/[.,!?;:]/g, "").replace(/\s+/g, " ").trim();
  }
  function clearMark(id) {
    var node = document.getElementById(id);
    if (node) {
      node.classList.remove("marked-ok", "marked-no");
      node.querySelectorAll(".chip,.opt").forEach(function (c) { c.classList.remove("ok", "no", "miss", "key"); });
      node.querySelectorAll("input,select").forEach(function (f) { f.classList.remove("ok", "no"); });
    }
    var fb = document.getElementById("fb-" + id);
    if (fb) fb.classList.remove("show");
  }

  /* -------------------------------------------------------- build: MCQ */
  document.querySelectorAll("[data-mcq]").forEach(function (box) {
    var id = box.dataset.mcq;
    var letters = box.dataset.letters.split(",");
    var wide = box.dataset.letters.length > 9;
    letters.forEach(function (L) {
      var b = el("button", "opt" + (wide ? " wide" : ""), L);
      b.type = "button";
      b.dataset.v = L;
      if (state[id] === L) b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", function () {
        box.querySelectorAll(".opt").forEach(function (o) {
          o.setAttribute("aria-pressed", "false");
          o.classList.remove("ok", "no", "key");
        });
        b.setAttribute("aria-pressed", "true");
        setVal(id, L);
        clearMark(id);
      });
      box.appendChild(b);
    });
  });

  /* -------------------------------------------- build: multi-select set */
  document.querySelectorAll("[data-bank]").forEach(function (box) {
    var id = box.dataset.item, bank = box.dataset.bank;
    var words = (LESSON.banks && LESSON.banks[bank]) || [];
    var k = id + ":" + bank;
    words.forEach(function (w) {
      var b = el("button", "chip", w);
      b.type = "button";
      b.dataset.w = w;
      if ((state[k] || []).indexOf(w) >= 0) b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", function () {
        var cur = state[k] ? state[k].slice() : [];
        var i = cur.indexOf(w);
        if (i >= 0) { cur.splice(i, 1); b.setAttribute("aria-pressed", "false"); }
        else { cur.push(w); b.setAttribute("aria-pressed", "true"); }
        b.classList.remove("ok", "no", "miss");
        setVal(k, cur);
      });
      box.appendChild(b);
    });
  });

  /* --------------------------------------------------- build: dropdowns */
  document.querySelectorAll("[data-pick]").forEach(function (sel) {
    var id = sel.dataset.pick;
    var list = (LESSON.banks && LESSON.banks[sel.dataset.from]) || [];
    sel.appendChild(new Option("— choose —", ""));
    list.forEach(function (w) { sel.appendChild(new Option(w, w)); });
    if (state[id] != null) sel.value = state[id];
    sel.addEventListener("change", function () { setVal(id, sel.value); clearMark(id); });
  });

  /* ------------------------------------------------- build: free fields */
  document.querySelectorAll("[data-save]").forEach(function (f) {
    if (state[f.id] != null) f.value = state[f.id];
    f.addEventListener("input", function () {
      setVal(f.id, f.value);
      f.classList.remove("ok", "no");
    });
  });

  /* --------------------------------------------------------- build: audio */
  var blobCache = {};
  document.querySelectorAll(".audio").forEach(function (box) {
    var src = box.dataset.src;
    var audio = new Audio();
    audio.preload = "none";
    var play = el("button", "play", "▶"); play.type = "button";
    play.setAttribute("aria-label", "Play " + box.dataset.title);
    var meta = el("div", "meta");
    meta.appendChild(el("div", "t", box.dataset.title));
    var stat = el("div", "s", "Tap play to load");
    meta.appendChild(stat);
    var again = el("button", "again", "↺ Restart"); again.type = "button";
    var bar = el("div", "bar"); var fill = el("i"); bar.appendChild(fill);
    box.appendChild(play); box.appendChild(meta); box.appendChild(again); box.appendChild(bar);

    function fmt(s) {
      if (!isFinite(s)) return "–:––";
      var m = Math.floor(s / 60), r = Math.floor(s % 60);
      return m + ":" + (r < 10 ? "0" : "") + r;
    }
    function paint() {
      var d = audio.duration;
      fill.style.right = (isFinite(d) && d > 0) ? (100 - (audio.currentTime / d) * 100) + "%" : "100%";
      stat.textContent = fmt(audio.currentTime) + " / " + fmt(d);
    }
    var loading = false;
    /* Fetch the whole file to a Blob before playing: a mid-track stall on
       classroom wifi must never interrupt a listening. */
    function ensure() {
      if (audio.src) return Promise.resolve();
      if (blobCache[src]) { audio.src = blobCache[src]; return Promise.resolve(); }
      loading = true; play.disabled = true; stat.textContent = "Loading…";
      return fetch(src).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.blob();
      }).then(function (b) {
        blobCache[src] = URL.createObjectURL(b);
        audio.src = blobCache[src];
        loading = false; play.disabled = false; stat.textContent = "Ready";
      }).catch(function (err) {
        loading = false; play.disabled = false;
        stat.textContent = "Could not load audio — tap to retry";
        throw err;
      });
    }
    play.addEventListener("click", function () {
      if (loading) return;
      if (!audio.paused) { audio.pause(); return; }
      ensure().then(function () { return audio.play(); }).catch(function () {});
    });
    again.addEventListener("click", function () {
      if (loading) return;
      ensure().then(function () { audio.currentTime = 0; return audio.play(); }).catch(function () {});
    });
    bar.addEventListener("click", function (e) {
      if (!isFinite(audio.duration)) return;
      var r = bar.getBoundingClientRect();
      audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audio.duration;
      paint();
    });
    audio.addEventListener("play", function () { play.textContent = "❚❚"; });
    audio.addEventListener("pause", function () { play.textContent = "▶"; });
    audio.addEventListener("ended", function () { play.textContent = "▶"; paint(); });
    audio.addEventListener("timeupdate", paint);
    audio.addEventListener("loadedmetadata", paint);
  });

  /* --------------------------------------------------------- build: timer */
  document.querySelectorAll(".timer").forEach(function (box) {
    var secs = parseInt(box.dataset.seconds, 10);
    var left = secs, iv = null;
    var clock = el("div", "clock");
    var lab = el("div", "lab", box.dataset.label || "");
    var go = el("button", "btn sm", "Start"); go.type = "button";
    var rs = el("button", "btn ghost sm", "Reset"); rs.type = "button";
    function paint() {
      var m = Math.floor(left / 60), s = left % 60;
      clock.textContent = m + ":" + (s < 10 ? "0" : "") + s;
    }
    paint();
    box.appendChild(clock); box.appendChild(lab); box.appendChild(go); box.appendChild(rs);
    go.addEventListener("click", function () {
      if (iv) { clearInterval(iv); iv = null; go.textContent = "Start"; box.classList.remove("run"); return; }
      box.classList.remove("done"); box.classList.add("run");
      go.textContent = "Pause";
      iv = setInterval(function () {
        left--; paint();
        if (left <= 0) {
          clearInterval(iv); iv = null; left = 0; paint();
          box.classList.remove("run"); box.classList.add("done");
          go.textContent = "Start";
        }
      }, 1000);
    });
    rs.addEventListener("click", function () {
      if (iv) { clearInterval(iv); iv = null; }
      left = secs; paint(); go.textContent = "Start";
      box.classList.remove("run", "done");
    });
  });

  /* ------------------------------------------------------------ marking */
  function fbShow(id, ok, html) {
    var fb = document.getElementById("fb-" + id);
    if (!fb) return;
    fb.className = "fb show " + (ok ? "ok" : "no");
    fb.innerHTML = html;
  }
  function mark(id, ok) {
    var node = document.getElementById(id);
    if (!node) return;
    node.classList.remove("marked-ok", "marked-no");
    node.classList.add(ok ? "marked-ok" : "marked-no");
  }

  function checkMcq(id) {
    var k = KEY[id]; if (!k) return true;
    var chosen = state[id];
    var box = document.querySelector('[data-mcq="' + id + '"]');
    box.querySelectorAll(".opt").forEach(function (o) {
      o.classList.remove("ok", "no", "key");
      if (o.dataset.v === k.a) o.classList.add(chosen === k.a ? "ok" : "key");
      else if (o.dataset.v === chosen) o.classList.add("no");
    });
    var ok = chosen === k.a;
    mark(id, ok);
    var head = ok
      ? "Correct — <span class='c'>" + k.a + "</span>."
      : "Answer: <span class='c'>" + k.a + "</span>" + (chosen ? ", you chose " + chosen + "." : ".");
    var body = "";
    if (k.why && typeof k.why === "object") {
      body = "<ul>" + Object.keys(k.why).map(function (L) {
        var line = k.script && k.script[L] ? k.script[L] + " — " : "";
        return "<li><span class='c'>(" + L + ")</span> " + line + k.why[L] + "</li>";
      }).join("") + "</ul>";
    } else if (k.why) {
      body = "<ul><li>" + k.why + "</li></ul>";
    }
    if (k.note) body += "<ul><li>" + k.note + "</li></ul>";
    fbShow(id, ok, head + body);
    return ok;
  }

  function checkSet(id) {
    var k = KEY[id]; if (!k) return true;
    var right = true, msg = [];
    Object.keys(k.set).forEach(function (bank) {
      var want = k.set[bank];
      var have = state[id + ":" + bank] || [];
      var box = document.querySelector('[data-bank="' + bank + '"][data-item="' + id + '"]');
      if (!box) return;
      box.querySelectorAll(".chip").forEach(function (c) {
        c.classList.remove("ok", "no", "miss");
        var w = c.dataset.w, picked = c.getAttribute("aria-pressed") === "true", isKey = want.indexOf(w) >= 0;
        if (picked && isKey) c.classList.add("ok");
        else if (picked && !isKey) { c.classList.add("no"); right = false; }
        else if (!picked && isKey) { c.classList.add("miss"); right = false; }
      });
      var missing = want.filter(function (w) { return have.indexOf(w) < 0; });
      if (missing.length) msg.push("<li>Missing " + bank + ": <span class='c'>" + missing.join(", ") + "</span></li>");
    });
    mark(id, right);
    fbShow(id, right, right ? "All correct." : "Dashed outlines show words you missed.<ul>" + msg.join("") + "</ul>");
    return right;
  }

  function checkText(id) {
    var k = KEY[id]; if (!k) return true;
    /* the item id may be the field itself, or a wrapper holding one */
    var node = document.getElementById(id);
    var f = (node && typeof node.value === "string")
      ? node : node.querySelector("input[type=text],textarea");
    if (!f) return true;
    var v = norm(f.value);
    /* `accept` = the whole answer must match one of these;
       `any`    = the answer must contain one of these, for open-ended replies */
    var ok = k.accept
      ? k.accept.some(function (a) { return norm(a) === v; })
      : (v.length > 0 && k.any.some(function (a) { return v.indexOf(norm(a)) >= 0; }));
    f.classList.remove("ok", "no");
    f.classList.add(ok ? "ok" : "no");
    mark(id, ok);
    fbShow(id, ok, ok ? "Correct." : "Answer: <span class='c'>" + k.show + "</span>"
      + (k.note ? "<ul><li>" + k.note + "</li></ul>" : ""));
    return ok;
  }

  function checkPick(id) {
    var k = KEY[id]; if (!k) return true;
    var sel = document.querySelector('[data-pick="' + id + '"]');
    var ok = sel.value === k.a;
    sel.classList.remove("ok", "no");
    sel.classList.add(ok ? "ok" : "no");
    mark(id, ok);
    fbShow(id, ok, ok ? "Correct." : "Answer: <span class='c'>" + k.a + "</span>"
      + (k.note ? "<ul><li>" + k.note + "</li></ul>" : ""));
    return ok;
  }

  function checkOne(id) {
    var k = KEY[id];
    if (!k) return true;
    if (k.set) return checkSet(id);
    if (k.accept || k.any) return checkText(id);
    if (document.querySelector('[data-pick="' + id + '"]')) return checkPick(id);
    return checkMcq(id);
  }

  function idsInGroup(g) {
    var out = [];
    document.querySelectorAll('[data-group="' + g + '"]').forEach(function (n) {
      if (n.id && out.indexOf(n.id) < 0) out.push(n.id);
    });
    return out;
  }

  document.querySelectorAll("[data-check]").forEach(function (b) {
    b.addEventListener("click", function () {
      var g = b.dataset.check;
      var ids = idsInGroup(g);
      var got = 0;
      ids.forEach(function (id) { if (checkOne(id)) got++; });
      var s = document.getElementById("score-" + g);
      if (s) {
        s.textContent = got + " / " + ids.length + " correct";
        s.className = "score " + (got === ids.length ? "good" : "bad");
      }
      /* jump to the first wrong item so long sections stay usable on a phone */
      var firstBad = ids.filter(function (id) {
        var n = document.getElementById(id);
        return n && n.classList.contains("marked-no");
      })[0];
      if (firstBad && b.dataset.jump !== "off") {
        document.getElementById(firstBad).scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
  });

  document.querySelectorAll("[data-clearmark]").forEach(function (b) {
    b.addEventListener("click", function () {
      var g = b.dataset.clearmark;
      idsInGroup(g).forEach(clearMark);
      var s = document.getElementById("score-" + g);
      if (s) { s.textContent = ""; s.className = "score"; }
    });
  });

  /* ------------------------------------------------------------- reset */
  var rb = document.getElementById("resetBtn");
  if (rb) rb.addEventListener("click", function () {
    if (!confirm("Clear all your answers on this page?")) return;
    try { localStorage.removeItem(STORE); } catch (e) {}
    location.reload();
  });
}
