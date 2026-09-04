# Vercel Visual Layer — Microlink

CaughtIn4K is ready to deploy on Vercel. The visual analysis layer
(Playwright locally, Microlink on Vercel) now produces a real base64 PNG
screenshot in both environments, so the UI shows the rendered page on
the production deployment. If Microlink itself fails for any reason
(network, rate limit, …) the analyzer returns a graceful *unavailable*
envelope and the UI shows the existing hand-drawn fallback.

## Architecture

```
                                VERCEL=1 unset (local)        VERCEL=1 set (Vercel)
                                ──────────────────────        ───────────────────────
  analyze_visual(url, …)        Playwright headless render    Microlink screenshot API
                                → base64 PNG                  → base64 PNG
                                → DOM-evaluated features       → features inherited from
                                                                 webpage analyzer
  available                     true                          true
  screenshot_b64                ~13 KB PNG                    ~40–100 KB PNG
  screenshot_source             (omitted)                     "microlink"
  visual.score                  0-100                         0-100
  overall weights               25/25/30/20                   25/25/30/20 (unchanged)
                                                                (only on Microlink failure
                                                                 does it renormalize to
                                                                 31.25/31.25/37.5)
```

## Files changed

- `backend/analyzers/visual_analyzer.py`
  - Added `import httpx` and the `MICROLINK_*` constants
    (`MICROLINK_ENDPOINT`, `MICROLINK_TIMEOUT_S`, `MICROLINK_MAX_BYTES`).
  - New helpers: `_microlink_resolve(url)` (asks Microlink for a JSON
    envelope, returns the screenshot CDN URL) and
    `_microlink_download(screenshot_url)` (downloads the PNG, capped at
    1.5 MB, 12 s timeout).
  - New `_capture_via_microlink(url, webpage_features)` that returns the
    full analyzer envelope with `available: True` and a real base64 PNG.
    Structural features are inherited from `webpage_features` (the
    webpage analyzer's parsed DOM) so the heuristic risk scoring still
    runs.
  - `analyze_visual()` now takes an optional `webpage_features` kwarg.
    On Vercel, the SSRF gate runs first (unchanged), then control
    transfers to `_capture_via_microlink`. The local Playwright path is
    unchanged.
  - The graceful `_unavailable_envelope(...)` is still used as a
    fallback when Microlink itself fails.

- `backend/main.py`
  - Step 4 (Visual) now maps the webpage analyzer's features dict into
    the visual analyzer's expected `webpage_features` shape and passes
    it to `analyze_visual(target_url, webpage_features_for_visual)`.
  - The `webpage_features_for_visual` mapping is built only when
    `webpage_res.get("available")` is true; otherwise the visual
    analyzer runs without a feature hint and falls back to all-zero
    counts.
  - No scoring math was rewritten. The dynamic renormalization logic
    (URL/Webpage/NLP/Visual 25/25/30/20 → 31.25/31.25/37.5 when visual
    is unavailable) is unchanged.

- `backend/test_visual.py`
  - The Vercel branch now exercises three mocked Microlink scenarios
    (success / resolve failure / download failure) by patching
    `_microlink_resolve` and `_microlink_download` directly. The local
    Playwright branch is unchanged.

- `backend/test_vercel_fallback.py`
  - Group B split into B1 (Microlink success: real base64 screenshot
    flows through) and B2 (Microlink failure: graceful unavailable
    envelope). All other groups (A, C/D, E, F, G) unchanged.

## API contract

`POST /api/analyze` with `{"url": "https://example.com"}` now returns
the full four-component response on the Vercel path:

```json
{
  "target_url": "https://example.com",
  "url":     { "score": 0, "findings": [...], "features": {...}, "blocked": false },
  "webpage": { "available": true, "score": 0, "findings": [...], "features": {...}, "error": null },
  "nlp":     { "score": 0, "risk_level": "LOW", "findings": [...], "categories": [...], "matched_phrases": [] },
  "visual":  {
    "ok": true,
    "available": true,
    "blocked": false,
    "error": null,
    "score": 0,
    "risk": "LOW",
    "features": {
      "rendered": true,
      "screenshot_source": "microlink",
      "form_count": ..., "password_field_count": ...,
      "external_resource_count": ..., "page_title": "...",
      ...
    },
    "findings": ["...", "Screenshot rendered via Microlink ..."],
    "screenshot_b64": "<43–100 KB of base64 PNG>",
    "screenshot_mime": "image/png"
  },
  "overall": {
    "score": 0, "risk": "LOW", "summary": "...",
    "findings": [...],
    "weights_used": { "url": 0.25, "webpage": 0.25, "nlp": 0.3, "visual": 0.2 },
    "available_components": ["url", "webpage", "nlp", "visual"]
  },
  "preliminary_score": 0,
  "risk_level": "LOW"
}
```

If Microlink is unreachable the visual section collapses to the
unavailable envelope (same shape as before this change); everything
else is identical.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `VERCEL` | *(unset)* | Set automatically by Vercel on every serverless invocation. |
| `MICROLINK_API_KEY` | *(unset)* | Optional. Lifts the Microlink free-tier rate limit (~50 reqs/day/IP). |
| `ALLOWED_ORIGINS` | `*` | CORS allow-list for the FastAPI app. |

## Tests run

- `backend/test_visual.py` — 10 SSRF cases + 3 Vercel Microlink mocked
  cases + 6 local Playwright cases (all PASS).
- `backend/test_vercel_fallback.py` — 7 groups A/B1/B2/C/D/E/F/G (all
  PASS).
- `backend/test_pipeline.py` — 6 end-to-end cases against the running
  backend on `:8000` (all PASS).
- `backend/test_nlp.py` — 6 NLP cases (all PASS).
- Live `POST /api/analyze` with `VERCEL=1` via FastAPI `TestClient`:
  `available_components: ['url','webpage','nlp','visual']`,
  `screenshot_b64: 43,572 chars`, `mime: image/png`,
  `source: microlink`, `risk: LOW`, `score: 0`.
- `npm run build` (frontend) — 2228 modules, 376 KB JS / 25 KB CSS,
  0 warnings, ~1 s.
