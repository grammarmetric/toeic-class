# TOEIC Class

Interactive lesson pages for a small TOEIC class, built from *Tactics for TOEIC
Listening and Reading Test* (Oxford University Press).

**Teaching from these in class? → [TEACHING.md](TEACHING.md)** — the lesson-by-lesson
runsheet with timings, audio lengths, break points and troubleshooting.

Live: <https://grammarmetric.github.io/toeic-class/>

Each unit is one standalone HTML page: cropped book artwork, the unit audio,
answer entry, instant self-check with the answer-key explanations, and the
tapescript behind a reveal.

```
index.html            lesson index
slides-NN.html        5-minute warm-up deck, run before the unit
unit-NN.html          one lesson per unit
vocab-NN.html         the unit's vocabulary game
unit-02-file2.html    Student B role card for the Unit 2 pair work
                      (unlinked on purpose — send the URL only to Student B)
assets/slides.css     deck styling
assets/slides.js      deck runner
assets/lesson.css     lesson styling
assets/lesson.js      shared marking engine
assets/vocab.css      vocabulary game styling, layered on lesson.css
assets/vocab.js       vocabulary game engine
assets/words-NN.js    one word bank per unit
img/uNN/              per-exercise crops rendered from the unit PDF at 220 dpi
audio/uNN/            the unit's class-audio tracks
tools/check-vocab.mjs word-bank and link checks
tools/check-pages.mjs drives real Chrome through every vocabulary page
tools/serve.js        static server for local testing
```

## Warm-up decks

`slides-NN.html` is a standalone deck: `.slide` sections inside `.deck`, one
`.notes` div per slide in the same order. Elements with class `step` inside a
slide reveal one press at a time, so you can ask before showing the answer.
Keys: → ← space, **N** notes, **F** full screen; clicking the left/right of the
slide and swiping also work.
No build step — add a `<section class="slide">` and a matching `<div class="notes">`.

The **deck** is the scroll container, not the slide. A slide is
`min-height:100%` and centres its content, so it grows instead of clipping on a
short window; if the slide scrolled instead, its scrollbar would appear at the
edge of the centred 1000px column rather than the window.

## Vocabulary practice

`vocab-NN.html` is a small game over the unit's words: **meaning** (definition →
word), **in context** (the word's own example sentence with a blank), **speed**
(same as round 1 against an 8-second clock, with a streak multiplier), then
**recall** (type the word from its definition). Anything missed is requeued and
re-asked before the round can end, and word selection is weakest-first, so the
words a student keeps getting wrong come round more often.

Each word carries three mastery dots, filled by answering it right first time
and emptied by one wrong answer, so mastering a unit takes several visits rather
than one lucky run. Score, personal best and mastery live in `localStorage`
only.

Words come from the *Tactics for TOEIC* per-unit word list (Word list and
Quizzes, pp.170–174), topped up from *600 Essential Words for the TOEIC Test*
using the lessons whose context matches the unit — e.g. Unit 3 (Part 3
conversations about faulty equipment and orders) draws on Electronics and
Ordering Supplies. Definitions and example sentences are the books' own.

Adding a unit is one bank file plus one page:

```js
Vocab.register(9, { unit: 9, part: "…", kind: "listening", words: [
  { w: "audit", pos: "n", src: "tactics",
    def: "a financial review of a company",
    ex:  "The audit discovered some financial irregularities.",
    gap: "The ___ discovered some financial irregularities." }
]});
```

`pos` is one of `n v adj adv phr`; `src` is `tactics` or `600` (600-book entries
also need `lesson: "Lesson N, Title"`); `full` overrides the display form when
the book's headword carries extra context, e.g. `full: "(be) considered"`.
`gap` must be the word's own `ex` with the word replaced by `___` — the checker
enforces that, and rejects a gap that leaks its own answer.

Keep **at least four words of each part of speech** in a bank. The engine draws
distractors from the same part of speech, and below four it silently falls back
to a mixed set, which lets a student pick the answer on grammar alone. Several
units needed extra adjectives and adverbs from the 600 book for this reason.

## Checks

```
node tools/check-vocab.mjs    # banks, links, stated word counts
node tools/check-pages.mjs    # real Chrome: plays every unit start to finish
```

The page suite plays a full correct run of all six units, a deliberately wrong
run to exercise the retry queue, four runs to confirm words actually reach
mastered, the reset button, and a 390px overflow pass. It writes screenshots to
`tools/shots/` — look at them. Assertions have passed on visibly broken pages
here before.

Two things that will bite if you touch this: run width checks with
`mobile:false` and assert `innerWidth` is what you asked for, otherwise Chrome
widens the layout viewport to fit overflow and the check passes on a page that
overflows; and clearing `localStorage` from outside the page does not survive
navigation, because the engine flushes its in-memory state on `pagehide` — use
the page's own reset button.

## Adding a unit

A unit page is content markup plus an answer key. Mark each gradable item with
an `id` and a `data-group`, give it a matching `<div class="fb" id="fb-ID">`,
then call `initLesson({store, banks, key})`. Supported item types:

| Type | Markup | Key |
|---|---|---|
| Multiple choice | `<div class="opts" data-mcq="ID" data-letters="A,B,C,D">` | `{a:"B", why:{...}, script:{...}}` |
| Multi-select chips | `<div class="chips" data-bank="NAME" data-item="ID">` | `{set:{NAME:["b","f"]}}` |
| Gap-fill | `<input id="ID-in" data-save>` inside `#ID` | `{accept:["..."], show:"..."}` |
| Open-ended answer | same | `{any:["..."], show:"..."}` — must merely *contain* one |
| Word dropdown | `<select data-pick="ID" data-from="NAME">` | `{a:"word"}` |

`data-letters` also takes words, e.g. `present,past` or
`noun,verb,adjective,adverb`. Timers are `<div class="timer" data-seconds="360"
data-label="...">`. Audio is `<div class="audio" data-src="..." data-title="...">`.

Unit 1 predates the shared engine and keeps its own inline script.

Book pages are **not** four per unit — Unit 6 runs to eight. Check before
assuming. The answer key in the tapescript PDF starts at page 25 and its printed
page numbers match the PDF page numbers.

## Privacy

Answers are kept in the student's own browser (`localStorage`) and are never
transmitted — there is no server, no account and no record. The site ships
`robots.txt` and a `noindex` meta tag, so it is reachable by link but not
through search.
