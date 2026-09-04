# CLEANUP_REPORT

CaughtIn4K codebase audit performed after the final UI polish and Vercel
fallback work. The project has been through six iterations; this pass
removes dead Vite-template scaffolding, an obsolete default favicon, a
debug script, and three superseded deployment-research documents.

## Phase 1 — Inventory

Source files (excluding `node_modules/`, `venv/`, `__pycache__/`, `dist/`,
`.kilo/`):

```
D:/aipoweredphishingwebsitedetection/
├── api/
│   └── index.py                          (Vercel Python entry)
├── backend/
│   ├── analyzers/
│   │   ├── __init__.py                   (package marker)
│   │   ├── nlp_analyzer.py
│   │   ├── url_analyzer.py
│   │   ├── visual_analyzer.py
│   │   └── webpage_analyzer.py
│   ├── _tmp_envelope_test.py             (DEBUG SCRIPT — created in an earlier turn, not part of the test suite)
│   ├── main.py                           (FastAPI app)
│   ├── requirements.txt                  (local venv deps)
│   ├── test_nlp.py
│   ├── test_pipeline.py
│   ├── test_vercel_fallback.py
│   └── test_visual.py
├── frontend/
│   ├── public/
│   │   ├── favicon.svg                   (Vite default — purple Bolt-style icon, doesn't match brand)
│   │   └── icons.svg                     (Bluesky icon set, Vite template leftover, not referenced)
│   ├── src/
│   │   ├── assets/
│   │   │   ├── hero.png                  (Vite default hero image, not referenced)
│   │   │   ├── react.svg                 (Vite template logo, not referenced)
│   │   │   └── vite.svg                  (Vite template logo, not referenced)
│   │   ├── components/
│   │   │   ├── Header.jsx                (used by App)
│   │   │   ├── Hero.jsx                  (used by App)
│   │   │   ├── InvestigationScene.jsx    (used by Scanner)
│   │   │   ├── Mark.jsx                  (used by Header)
│   │   │   ├── ResultsView.jsx           (used by Scanner)
│   │   │   ├── Scanner.jsx               (used by App)
│   │   │   └── VerdictMoment.jsx         (used by Scanner)
│   │   ├── App.css                       (Vite scaffolding — #center, #next-steps, .hero, .ticks, .counter — NEVER IMPORTED)
│   │   ├── App.jsx                       (root)
│   │   ├── index.css                     (global styles — real design tokens)
│   │   └── main.jsx                      (Vite entry)
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── README.md                         (Vite default "React + Vite" boilerplate — superseded by root README.md)
│   ├── tailwind.config.js
│   └── vite.config.js
├── .kilo/                                (agent runtime state — out of project scope)
├── api/index.py                          (already listed above)
├── cd backend.txt                        (scratch note: "cd backend / venv\Scripts\activate / uvicorn …")
├── DEPLOYMENT_READINESS.md               (pre-refactor research; superseded)
├── PROJECT_SPEC.md                       (original project specification)
├── README.md                             (real project readme)
├── requirements.txt                      (Vercel Python deps)
├── VERCEL_CHROMIUM_RESEARCH.md           (research; superseded)
├── VERCEL_FALLBACK_COMPLETE.md           (FINAL hand-off — keep)
└── VERCEL_PREP_COMPLETE.md               (intermediate hand-off; superseded)
```

## Phase 2 — Red Error Audit

| Symptom | Cause | Resolution |
|---|---|---|
| `Check` from `lucide-react` shows a red squiggle in `Scanner.jsx` | Imported but unused; only the local `HandCheck` SVG is used | **FIX** — remove the import |
| Vite default favicon is purple, not the CaughtIn4K hand-drawn mark | Vite scaffold leftover | **FIX** — replace with a hand-drawn mark that matches the existing `Mark.jsx` (color-corrected SVG) |
| Otherwise no actual compile / runtime / import errors detected | — | — |

`App.css` is a stylistic Vite scaffold and is dead. Its removal fixes any
lingering lint warnings in the editor.

`PROJECT_SPEC.md` contains UI direction language ("modern, premium,
technical, trustworthy") that conflicts with the final "cute forensic
notebook" direction. **Reviewed** — kept as historical spec; the README
and the final UI are the source of truth for the current design.

## Phase 3 — Stale Reference Audit

| Pattern | Where | Action |
|---|---|---|
| `screenshot_url` | nowhere in source (only in `DEPLOYMENT_READINESS.md` and `VERCEL_PREP_COMPLETE.md`, both historical) | n/a |
| `SCREENSHOTS_DIR` | nowhere in source | n/a |
| `StaticFiles` | nowhere in source (only in deleted `DEPLOYMENT_READINESS.md` references) | n/a |
| `/screenshots/` route | nowhere in source | n/a |
| `os.makedirs` | nowhere in source | n/a |
| `@sparticuz/chromium` | nowhere in source (only in `VERCEL_CHROMIUM_RESEARCH.md` and `VERCEL_PREP_COMPLETE.md`, both historical) | n/a |
| `localhost:8000` | `vite.config.js` (Vite dev proxy target, correct), `test_pipeline.py` / `test_vercel_fallback.py` (test scripts, correct), `README.md` (local dev instructions, correct), `Scanner.jsx` (comment, correct) | none — all legitimate |
| `localhost:5173` | `vite.config.js` (port), `README.md` (local dev), `package.json` (implicit) | none — legitimate |
| `chromium-headless-shell` | `visual_analyzer.py` (Playwright launch channel, correct — this is the local path) | keep |
| `print(` / `console.log` | only in test scripts (intentional test output) | keep |
| `TODO` / `FIXME` | none | n/a |

## Phase 4 — Test File Audit

| Test file | Status | Notes |
|---|---|---|
| `backend/test_nlp.py` | KEEP | Direct analyzer test; six scenarios |
| `backend/test_visual.py` | KEEP | SSRF + live render + Vercel-unavailable branch |
| `backend/test_pipeline.py` | KEEP | End-to-end against running backend (incl. SSRF, NLP, form/iframe, normal URL, suspicious URL, invalid URL) |
| `backend/test_vercel_fallback.py` | KEEP | A–G coverage: Vercel env, scoring renormalization, SSRF, NLP, /api/analyze |

## Phase 5 — Documentation Audit

| File | Status | Action |
|---|---|---|
| `README.md` | KEEP | Authoritative project readme. Updated in earlier turns to include "Deployment notes", current tech stack, and the Vercel visual fallback explanation. |
| `PROJECT_SPEC.md` | KEEP | Original specification. Useful for readers to see the project's design history. |
| `VERCEL_FALLBACK_COMPLETE.md` | KEEP | Final hand-off document. Documents the Vercel visual fallback, the scoring renormalization, and that local Playwright remains enabled. |
| `DEPLOYMENT_READINESS.md` | REVIEW → DELETE | Pre-refactor (single Vercel project) research. Conclusions already incorporated into `VERCEL_FALLBACK_COMPLETE.md`. |
| `VERCEL_PREP_COMPLETE.md` | REVIEW → DELETE | Intermediate hand-off. Superseded by `VERCEL_FALLBACK_COMPLETE.md` (which references the same conclusions). |
| `VERCEL_CHROMIUM_RESEARCH.md` | REVIEW → DELETE | Research document that produced the "Option D" decision. Decision and rationale now live in `VERCEL_FALLBACK_COMPLETE.md`. |
| `frontend/README.md` | REVIEW → DELETE | Vite template "React + Vite" boilerplate. Superseded by the root README. |

## Phase 6 — Frontend Component Audit

| Component | Imported by | Rendered | Stale? | Action |
|---|---|---|---|---|
| `App.jsx` | `main.jsx` | yes | no | KEEP |
| `Header.jsx` | `App.jsx` | yes | no | KEEP |
| `Hero.jsx` | `App.jsx` | yes | no (recently polished) | KEEP |
| `Scanner.jsx` | `App.jsx` | yes | no | FIX (remove unused `Check` import) |
| `InvestigationScene.jsx` | `Scanner.jsx` | yes (in flight) | no | KEEP |
| `VerdictMoment.jsx` | `Scanner.jsx` | yes (in flight) | no | KEEP |
| `ResultsView.jsx` | `Scanner.jsx` | yes (on complete) | no | KEEP |
| `Mark.jsx` | `Header.jsx` | yes | no | KEEP |

Dead imports found: `Check` from `lucide-react` in `Scanner.jsx`.
Dead file: `App.css` (not imported anywhere).

## Phase 7 — CSS Audit

`index.css` — clean. All utility classes (`wob`, `wob-md`, `wob-lg`, `wob-sm`,
`wob-tag`, `wob-circle`, `tape`, `tack`, `press`) are referenced from JSX
components. No dead rules. No obsolete animation classes. No old colors.
No duplicate rules. The `bounce2` keyframe in `tailwind.config.js` is used
by the header pulse indicator.

`App.css` — DEAD. Vite scaffolding (`#center`, `#next-steps`, `.hero`,
`.ticks`, `.counter`); never imported. Will be deleted.

## Phase 8 — Configuration Audit

| Config | Status | Action |
|---|---|---|
| `frontend/package.json` | correct | KEEP (declaration of framer-motion, lucide-react, react, react-dom + dev deps for vite, tailwind, postcss, oxlint) |
| `frontend/vite.config.js` | correct | KEEP (Vite dev proxy `/api` → `http://localhost:8000` for local dev; build output `dist/`) |
| `frontend/tailwind.config.js` | correct | KEEP (color tokens, font tokens, box-shadow tokens, keyframes) |
| `frontend/postcss.config.js` | correct | KEEP (tailwind + autoprefixer) |
| `frontend/index.html` | correct | KEEP |
| `frontend/package-lock.json` | correct | KEEP |
| `backend/requirements.txt` | correct | KEEP (local venv deps: fastapi, uvicorn, httpx, beautifulsoup4, playwright) |
| `requirements.txt` (root) | correct | KEEP (Vercel Python deps: same as local) |
| `api/index.py` | correct | KEEP (Vercel Python serverless entry; re-exports `backend.main.app`) |
| `vercel.json` | absent | none — Vercel auto-detects Python functions in `/api` and the static build. Not needed. |
| `.env` / `.env.example` | absent | none — no env vars are required for the current build. (`ALLOWED_ORIGINS` is optional; `VERCEL` is provided by Vercel itself.) |
| `.gitignore` (root) | absent | DEFER — not blocking; can be added in a future housekeeping pass if the project is to be pushed to git. The repository is currently not a git repo (per the env info). |
| `backend/requirements.txt` vs `requirements.txt` | both correct, not duplicates | KEEP both — root is for Vercel's Python builder; backend/ is for the local venv. |

## Phase 9 — Safe Deletion + Fixes

### Files / content to DELETE

| File | Reason |
|---|---|
| `frontend/src/App.css` | Vite scaffolding, never imported |
| `frontend/src/assets/hero.png` | Vite template, not referenced |
| `frontend/src/assets/react.svg` | Vite template, not referenced |
| `frontend/src/assets/vite.svg` | Vite template, not referenced |
| `frontend/public/icons.svg` | Bluesky icons, Vite template leftover, not referenced |
| `frontend/README.md` | Vite template boilerplate |
| `backend/_tmp_envelope_test.py` | Debug script from earlier iteration |
| `DEPLOYMENT_READINESS.md` | Pre-refactor research, superseded |
| `VERCEL_PREP_COMPLETE.md` | Intermediate hand-off, superseded |
| `VERCEL_CHROMIUM_RESEARCH.md` | Research, conclusion in `VERCEL_FALLBACK_COMPLETE.md` |
| `cd backend.txt` | Scratch note, README has the proper instructions |

### Files to FIX

| File | Change |
|---|---|
| `frontend/src/components/Scanner.jsx` | Remove unused `Check` import from `lucide-react` |
| `frontend/public/favicon.svg` | Replace default Bolt.new purple favicon with a hand-drawn CaughtIn4K mark matching the existing `Mark.jsx` design |

### Files to KEEP

All other source files. In particular: every test file, every component
file, every config file, `README.md`, `PROJECT_SPEC.md`,
`VERCEL_FALLBACK_COMPLETE.md`.

## Phase 10 — Post-Cleanup Validation

Performed in the next steps:

1. `npm run build` (frontend)
2. `python test_nlp.py` (NLP)
3. `python test_visual.py` (visual analyzer + SSRF)
4. `python test_vercel_fallback.py` (Vercel fallback + scoring renormalization)
5. `python test_pipeline.py` (end-to-end against running backend)
6. `/api/health` and `/api/analyze` smoke tests against the live dev server

## Final tree (target)

```
CaughtIn4K/
├── api/
│   └── index.py                            (Vercel Python entry)
├── backend/
│   ├── analyzers/
│   │   ├── __init__.py
│   │   ├── nlp_analyzer.py
│   │   ├── url_analyzer.py
│   │   ├── visual_analyzer.py
│   │   └── webpage_analyzer.py
│   ├── main.py
│   ├── requirements.txt
│   ├── test_nlp.py
│   ├── test_pipeline.py
│   ├── test_vercel_fallback.py
│   └── test_visual.py
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── Hero.jsx
│   │   │   ├── InvestigationScene.jsx
│   │   │   ├── Mark.jsx
│   │   │   ├── ResultsView.jsx
│   │   │   ├── Scanner.jsx
│   │   │   └── VerdictMoment.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── PROJECT_SPEC.md
├── README.md
├── VERCEL_FALLBACK_COMPLETE.md
└── requirements.txt
```
