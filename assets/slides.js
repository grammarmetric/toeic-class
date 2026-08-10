/* Minimal deck runner for the warm-up presentations.
   Advance: → / space / click the right of the screen / swipe left.
   Elements with class "step" inside a slide reveal one at a time before
   the deck moves on, so you can ask the question before showing the answer. */
"use strict";

(function () {
  var slides = [].slice.call(document.querySelectorAll(".slide"));
  if (!slides.length) return;

  var i = 0, step = 0;
  var prog = document.querySelector(".prog");
  var count = document.querySelector(".count");

  function steps(n) { return [].slice.call(slides[n].querySelectorAll(".step")); }

  function paint() {
    slides.forEach(function (s, n) { s.classList.toggle("on", n === i); });
    var st = steps(i);
    st.forEach(function (e, n) { e.classList.toggle("shown", n < step); });

    /* the notes strip belongs to the slide we are on */
    document.querySelectorAll(".notes").forEach(function (nt, n) {
      nt.classList.toggle("here", n === i);
    });

    var total = slides.length;
    if (prog) prog.style.width = ((i + 1) / total * 100) + "%";
    if (count) count.textContent = (i + 1) + " / " + total;
    try { location.hash = "s" + (i + 1); } catch (e) {}
  }

  function go(n, atEnd) {
    if (n < 0 || n >= slides.length) return;
    i = n;
    step = atEnd ? steps(i).length : 0;
    paint();
    slides[i].scrollTop = 0;
  }

  function next() {
    if (step < steps(i).length) { step++; paint(); return; }
    go(i + 1, false);
  }
  function prev() {
    if (step > 0) { step--; paint(); return; }
    go(i - 1, true);
  }

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === "ArrowRight" || k === "PageDown" || k === " " || k === "Enter") { e.preventDefault(); next(); }
    else if (k === "ArrowLeft" || k === "PageUp" || k === "Backspace") { e.preventDefault(); prev(); }
    else if (k === "Home") { e.preventDefault(); go(0, false); }
    else if (k === "End") { e.preventDefault(); go(slides.length - 1, true); }
    else if (k === "n" || k === "N") { toggleNotes(); }
    else if (k === "f" || k === "F") { toggleFull(); }
  });

  var zp = document.querySelector(".zone.prev"), zn = document.querySelector(".zone.next");
  if (zp) zp.addEventListener("click", prev);
  if (zn) zn.addEventListener("click", next);

  /* swipe on a phone */
  var x0 = null, y0 = null;
  document.addEventListener("touchstart", function (e) {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) { dx < 0 ? next() : prev(); }
    x0 = y0 = null;
  }, { passive: true });

  /* teacher notes */
  var nb = document.getElementById("notesBtn");
  function toggleNotes() {
    var on = document.body.classList.toggle("notes-on");
    if (nb) nb.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (nb) nb.addEventListener("click", toggleNotes);

  /* fullscreen */
  var fb = document.getElementById("fullBtn");
  function toggleFull() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
  if (fb) fb.addEventListener("click", toggleFull);

  /* resume at #sN if the page is reopened mid-lesson */
  var m = /^#s(\d+)$/.exec(location.hash || "");
  if (m) { var n = parseInt(m[1], 10) - 1; if (n >= 0 && n < slides.length) i = n; }
  paint();
})();
