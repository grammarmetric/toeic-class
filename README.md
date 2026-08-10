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
unit-02-file2.html    Student B role card for the Unit 2 pair work
                      (unlinked on purpose — send the URL only to Student B)
assets/slides.css     deck styling
assets/slides.js      deck runner
assets/lesson.css     lesson styling
assets/lesson.js      shared marking engine
img/uNN/              per-exercise crops rendered from the unit PDF at 220 dpi
audio/uNN/            the unit's class-audio tracks
```

## Warm-up decks

`slides-NN.html` is a standalone deck: `.slide` sections inside `.deck`, one
`.notes` div per slide in the same order. Elements with class `step` inside a
slide reveal one press at a time, so you can ask before showing the answer.
Keys: → ← space, **N** notes, **F** full screen; click zones and swipe also work.
No build step — add a `<section class="slide">` and a matching `<div class="notes">`.

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
