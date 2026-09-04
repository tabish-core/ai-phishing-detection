# CaughtIn4K — AI-Powered Phishing Detection

CaughtIn4K is a web-based cybersecurity tool that investigates a submitted URL
and produces a **heuristic phishing risk assessment** by combining four
independent signal layers:

```
URL → Webpage → NLP → Visual → Combined Preliminary Risk Score
```

This is **Iteration 6 (final)** — the project is feature-complete.

> CaughtIn4K is a *heuristic* phishing detection system, **not** a guaranteed
> classifier. The "Preliminary Risk Score" reflects handcrafted indicators
> across URL, webpage, language, and visual signals. It is **not** a phishing
> probability, certainty score, or machine-learning confidence.

## Features

- **URL Signal Analysis** — HTTPS, IP hostnames, length, subdomains, suspicious
  symbols, URL shorteners, and suspicious keywords.
- **Webpage Structure Analysis** — Forms, password fields, links (internal /
  external), script count, page title, suspicious text phrases, redirect count,
  response time, with HTTP/HTTPS scheme, redirect, and timeout safety limits.
- **NLP Language Analysis** — Six phishing language categories (Urgency,
  Account Verification, Credentials, Threats, Financial, Trust) with contextual
  combination scoring.
- **Visual Analysis** — Two render paths share the same response shape:
  - **Local development:** headless Playwright render at 1280×720 with
    structural feature extraction (forms, password fields, iframes, hidden
    elements, fixed/sticky positioning, external resources, images) and a
    screenshot returned inline as base64. The screenshot is held in
    memory only and never written to disk.
  - **Vercel deployment:** Playwright cannot run (Vercel's Python
    serverless runtime has no `apt-get` and lacks `libnss3` / `libnspr4`
    / `libgbm` / `libasound2`). The visual analyzer delegates the render
    to the **Microlink screenshot API** (serverless-friendly HTTPS
    service) and downloads the resulting PNG. Structural features are
    inherited from the webpage analyzer's already-parsed DOM so the
    heuristic risk scoring still works. If the Microlink call fails for
    any reason the analyzer returns the graceful *unavailable* envelope
    and the UI shows the existing hand-drawn fallback silhouette.
- **Combined Preliminary Risk Score** — URL 25% + Webpage 25% + NLP 30% +
  Visual 20%, with dynamic re-normalization when any component is unavailable.
- **SSRF protection** — localhost, 127.0.0.0/8, 0.0.0.0, private IPv4 ranges,
  link-local, internal hostnames (`*.local`, `*.internal`, `*.lan`), and
  hostname resolution to private IPs are all blocked.
- **Graceful failure handling** — Every analyzer fails independently; a single
  component failure does not destroy the investigation.

## Technology Stack

- **Frontend:** React, Vite, Tailwind CSS, Framer Motion, Lucide React
- **Backend:** Python, FastAPI, httpx, BeautifulSoup, Playwright

## Project Structure

```
CaughtIn4K/
├── api/
│   └── index.py                      # Vercel Python serverless entry
├── backend/
│   ├── analyzers/
│   │   ├── __init__.py
│   │   ├── nlp_analyzer.py
│   │   ├── url_analyzer.py
│   │   ├── visual_analyzer.py
│   │   └── webpage_analyzer.py
│   ├── main.py                       # FastAPI app + final risk engine
│   ├── requirements.txt              # local venv deps
│   ├── test_nlp.py
│   ├── test_pipeline.py
│   ├── test_vercel_fallback.py
│   └── test_visual.py
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/               # Header, Hero, Scanner, ResultsView, …
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── .gitignore
├── vercel.json                       # one-file Vercel config (Option A)
├── requirements.txt                  # Vercel Python deps (same as backend/)
├── README.md
└── VERCEL_FALLBACK_COMPLETE.md
```

## How to Run

### 1. Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Required for the visual (Playwright) analyzer:
python -m playwright install chromium-headless-shell
# (Optional fallback):
python -m playwright install chromium

uvicorn main:app --port 8000
```

The API will be available at `http://localhost:8000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:5173`.

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/analyze` | POST | Run full URL investigation |

`POST /api/analyze` accepts `{ "url": "https://example.com" }` and returns:

```json
{
  "target_url": "...",
  "url":      { "score", "findings", "features", "blocked" },
  "webpage":  { "available", "score", "findings", "features", "error" },
  "nlp":      { "score", "risk_level", "findings", "categories", "matched_phrases" },
  "visual":   { "score", "risk", "features", "findings", "screenshot_b64", "screenshot_mime", "error", "blocked" },
  "overall":  { "score", "risk", "summary", "findings",
                "weights_used", "available_components" },
  "preliminary_score": 0,
  "risk_level": "LOW"
}
```

### Risk thresholds

| Score | Risk |
|---|---|
| 0–34  | LOW |
| 35–64 | MEDIUM |
| 65–100 | HIGH |

## Testing

```bash
cd backend
source venv/bin/activate   # or: venv\Scripts\activate

# NLP analyzer unit tests
python test_nlp.py

# Visual analyzer + SSRF validation tests (covers the Vercel unavailable branch too)
python test_visual.py

# Vercel-fallback tests (7 groups: local path, unavailable envelope, scoring renormalization, …)
python test_vercel_fallback.py

# End-to-end pipeline tests (requires the backend running on :8000)
python test_pipeline.py
```

## Security Notes

- The visual browser enforces the same SSRF rules as the URL analyzer — it
  cannot access private hosts even when invoked through the visual layer.
- HTTP redirects are capped at 3; HTTP request timeout is 6 seconds; response
  body is capped at 1.5 MB; only the `screenshots/` directory is served.
- No Python stack traces are returned to the frontend.
- The frontend never hard-codes results — all displayed scores come from the
  backend response.

## Limitations

- Local visual analysis uses Playwright's `chromium-headless-shell`
  channel on Windows (the full Chromium build was crashing on this host;
  `chromium` is installed as a fallback). Install via
  `python -m playwright install chromium-headless-shell`.
- On Vercel the visual layer delegates to Microlink. The free tier
  is ~50 requests/day per IP without an API key. Set
  `MICROLINK_API_KEY` in the Vercel project env vars to lift that.
- Visual rendering is bounded to ~15 seconds locally and uses
  `domcontentloaded` plus a short `networkidle` attempt — very long
  pages do not block the API.
- The heuristic weights (URL 25% / Webpage 25% / NLP 30% / Visual 20%)
  are reasonable defaults, **not** scientifically validated.

## Deployment notes

CaughtIn4K is designed to run as a single Vercel project (React frontend
served as static assets + FastAPI exposed as a Python serverless function at
`/api/*`).

- **URL, Webpage, and NLP analysis run normally** on Vercel.
- **Live screenshots are rendered via Microlink** (`api.microlink.io`).
  Vercel's Python serverless runtime cannot launch Chromium (no `apt-get`,
  no system libraries), so the visual analyzer delegates the render to
  Microlink's screenshot API and downloads the resulting PNG. Structural
  features (`form_count`, `password_field_count`, `external_resource_count`,
  …) are inherited from the webpage analyzer's parsed DOM. The
  `MICROLINK_API_KEY` env var is optional (free tier is ~50 reqs/day/IP).
  If Microlink fails for any reason the analyzer returns the graceful
  *unavailable* envelope and the UI shows the existing hand-drawn fallback.
- **The combined risk score is the full 25/25/30/20 weighting on the
  Vercel path** because Microlink returns a real screenshot. Only if
  Microlink itself is unreachable does the visual layer become unavailable
  and the weights renormalize to URL 31.25% / Webpage 31.25% / NLP 37.5%.

For local development, install Playwright's browser (`python -m playwright
install chromium-headless-shell`) and the visual layer uses the real
headless renderer — full DOM extraction, base64 screenshot inline in the
API response, and the same 25/25/30/20 weighting.

## Deploy to Vercel

CaughtIn4K deploys to Vercel as a single project, using one `vercel.json`
at the project root (no separate frontend/backend repos). The repo
layout is already that of a single Vercel project: the React frontend
is a static site in `frontend/`, and the FastAPI backend is exposed as
a Python serverless function in `api/index.py` (which re-exports
`backend.main.app`).

**`vercel.json`** (already committed at the project root):

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": null,
  "installCommand": "pip install -r requirements.txt",
  "functions": {
    "api/index.py": { "maxDuration": 30, "memory": 1024 }
  }
}
```

**Deploy from GitHub (recommended, no CLI login needed):**

1. Push this repo to a new GitHub repository.
   ```bash
   git init
   git add .
   git commit -m "CaughtIn4K — final"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. In Vercel, click **Add New → Project → Import** the GitHub repo.
3. On the "Configure Project" screen:
   - **Root Directory:** `.` (project root — leave blank)
   - **Framework Preset:** `Other`
   - **Build & Output Settings:** leave empty (Vercel reads them from
     `vercel.json`).
   - **Environment Variables:** add `ALLOWED_ORIGINS` = `*` for
     testing, or your real frontend origin in production.
4. Click **Deploy**. Vercel will:
   1. `pip install -r requirements.txt` for the Python function
      (fastapi, uvicorn, httpx, beautifulsoup4, playwright).
   2. `cd frontend && npm install && npm run build` for the static
      site.
   3. Serve `frontend/dist` as static files and `api/index.py` as a
      Python serverless function under `/api/*`.
5. Open the assigned `*.vercel.app` URL — the UI loads, `GET /api/health`
   returns 200, and `POST /api/analyze` runs URL, Webpage, and NLP
   analysis (Visual returns its unavailable envelope and the UI shows
   the hand-drawn fallback).

**Optional environment variables (Vercel Project Settings → Environment Variables):**

| Variable | Default | Purpose |
|---|---|---|
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS allow-list for the FastAPI app. |
| `MICROLINK_API_KEY` | *(none)* | Optional Microlink API key. Without it, the visual layer uses the free tier (~50 requests/day/IP). Set this in production to lift the rate limit. |
| `PYTHON_VERSION` | (auto, 3.12) | Pin the Python runtime if needed. |

**Notes:**

- The `playwright` package is installed (used by the local-dev path) but
  **never launched on Vercel** — the visual analyzer delegates the
  render to the Microlink screenshot API instead. So Chromium is *not*
  downloaded by Vercel and the function stays small.
- If Microlink is rate-limited or unreachable, the analyzer returns the
  graceful unavailable envelope and the UI shows the hand-drawn
  fallback. The combined score renormalizes to URL 31.25% / Webpage
  31.25% / NLP 37.5% in that fallback case only.
- The frontend's Vite dev proxy (`/api → http://localhost:8000`) only
  applies to local development; in production the React app calls the
  same-origin `/api/analyze` directly.