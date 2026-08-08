# TOEIC Class

Interactive lesson pages for a small TOEIC class, built from *Tactics for TOEIC
Listening and Reading Test* (Oxford University Press).

Each unit is one standalone HTML page: cropped book artwork, the unit audio,
answer entry, instant self-check with the answer-key explanations, and the
tapescript behind a reveal.

- `index.html` — lesson index
- `unit-NN.html` — one lesson per unit
- `img/uNN/` — per-exercise crops rendered from the unit PDF at 220 dpi
- `audio/uNN/` — the unit's class-audio tracks

Answers are kept in the student's own browser (`localStorage`) and are never
transmitted. The site ships `robots.txt` and a `noindex` meta tag, so it is
reachable by link but not through search.
