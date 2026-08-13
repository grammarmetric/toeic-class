/* Units 1–7 in one bank, for the checkpoint day's vocabulary sprint.

   This file holds no words of its own — it folds the seven unit banks that were
   loaded before it into a single bank registered as unit 0, so the review page
   can never drift out of step with the unit pages. Load order matters: every
   words-0N.js must come before this file.

   Headwords repeat across units (a courier turns up in Units 3 and 5), so the
   first occurrence wins. A duplicate would otherwise be able to appear as its
   own distractor, which makes a question unanswerable rather than hard. */
(function () {
  var UNITS = [1, 2, 3, 4, 5, 6, 7];
  var seen = {};
  var words = [];

  UNITS.forEach(function (u) {
    var bank = Vocab.bank(u);
    if (!bank) return;
    bank.words.forEach(function (w) {
      var id = w.w.toLowerCase();
      if (seen[id]) return;
      seen[id] = true;
      var copy = {};
      for (var k in w) { if (Object.prototype.hasOwnProperty.call(w, k)) copy[k] = w[k]; }
      copy.fromUnit = u;
      words.push(copy);
    });
  });

  Vocab.register(0, {
    unit: 0,
    part: "Units 1–7",
    kind: "listening",
    words: words
  });
}());
