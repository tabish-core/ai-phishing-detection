import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from analyzers.url_analyzer import analyze_url
from analyzers.webpage_analyzer import fetch_and_analyze_webpage
from analyzers.nlp_analyzer import analyze_text
from analyzers.visual_analyzer import analyze_visual

app = FastAPI(
    title="CaughtIn4K API",
    description="CaughtIn4K — Heuristic Phishing Detection API (URL + Webpage + NLP + Visual).",
)

# In production (single Vercel project) the frontend and backend share an
# origin, so CORS is not required. We still accept any origin in case the
# app is run behind a custom split-domain setup.
_extra_origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_extra_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    url: str


# Final risk thresholds — bounded 0..100
RISK_THRESHOLDS = {"low_max": 34, "medium_max": 64}


def classify_risk(score: int) -> str:
    if score <= RISK_THRESHOLDS["low_max"]:
        return "LOW"
    if score <= RISK_THRESHOLDS["medium_max"]:
        return "MEDIUM"
    return "HIGH"


def _safe_url_section(target_url: str, url_res: dict) -> dict:
    """Build the URL section envelope for the SSRF-blocked path."""
    return {
        "target_url": target_url,
        "url": url_res,
        "webpage": {
            "available": False,
            "error": url_res.get("error"),
            "score": 0,
            "findings": ["Webpage fetch aborted due to SSRF security policy."],
            "features": {},
        },
        "nlp": {
            "score": 0,
            "risk_level": "LOW",
            "findings": ["NLP analysis skipped — target URL was blocked by security policy."],
            "categories": [],
            "matched_phrases": [],
        },
        "visual": {
            "score": 0,
            "risk": "LOW",
            "features": {"rendered": False},
            "findings": ["Visual analysis skipped — target URL was blocked by security policy."],
            "screenshot_b64": None,
            "screenshot_mime": None,
            "error": url_res.get("error"),
        },
    }


def _build_key_findings(url_res: dict, webpage_res: dict, nlp_res: dict, visual_res: dict) -> list:
    """
    Curate the most meaningful human-readable findings across analyzers.
    Limited to ~10 high-signal findings.
    """
    findings = []

    # URL signals
    url_feats = url_res.get("features", {}) or {}
    if not url_feats.get("is_https", True):
        findings.append("URL uses unencrypted HTTP instead of HTTPS.")
    if url_feats.get("has_ip_hostname"):
        findings.append("Hostname is a raw IP address rather than a domain name.")
    if url_feats.get("is_shortener"):
        findings.append("Known URL shortening service in use.")
    if url_feats.get("has_at_symbol"):
        findings.append("URL contains '@' symbol — a classic credential-trick pattern.")
    if url_feats.get("subdomain_count", 0) >= 3:
        findings.append(f"High subdomain depth ({url_feats.get('subdomain_count')} subdomains).")
    if url_feats.get("url_length", 0) > 100:
        findings.append("Unusually long URL structure.")
    if url_feats.get("detected_keywords"):
        keywords = ", ".join(url_feats["detected_keywords"][:3])
        findings.append(f"Suspicious security keywords in URL: {keywords}.")

    # Webpage signals
    wp = webpage_res.get("features", {}) or {}
    if webpage_res.get("available"):
        if wp.get("password_count", 0) > 0 and not webpage_res.get("final_url", "").startswith("https://"):
            findings.append("Password input field served over insecure HTTP.")
        if wp.get("password_count", 0) > 0:
            findings.append(f"Password input field detected on the page ({wp.get('password_count')}).")
        if wp.get("redirect_count", 0) >= 2:
            findings.append(f"Request underwent multiple redirects ({wp.get('redirect_count')}).")
        if wp.get("external_links", 0) > 0 and wp.get("total_links", 0) > 0:
            ratio = wp["external_links"] / max(1, wp["total_links"])
            if ratio > 0.5 and wp.get("password_count", 0) > 0:
                findings.append("Credential page dominated by external links.")
    else:
        findings.append("Webpage could not be fetched safely.")

    # NLP signals
    cats = nlp_res.get("categories", []) or []
    if "URGENCY" in cats and "ACCOUNT_VERIFICATION" in cats:
        findings.append("Urgency language combined with account-verification requests.")
    if "THREATS" in cats and "CREDENTIALS" in cats:
        findings.append("Threat language combined with credential submission prompts.")
    elif "THREATS" in cats:
        findings.append("Threatening or consequence language detected in page text.")
    elif "CREDENTIALS" in cats and "ACCOUNT_VERIFICATION" in cats:
        findings.append("Credential-related verification language detected.")
    if "FINANCIAL" in cats and "URGENCY" in cats:
        findings.append("Urgent financial action language detected.")

    # Visual signals
    vf = visual_res.get("features", {}) or {}
    if visual_res.get("blocked"):
        findings.append("Visual rendering was blocked for security reasons.")
    elif vf.get("rendered"):
        if vf.get("iframe_count", 0) >= 2 and vf.get("password_field_count", 0) >= 1:
            findings.append("Password form combined with embedded iframes — elevated concern.")
        if vf.get("form_count", 0) >= 5 and vf.get("external_resource_count", 0) >= 40:
            findings.append("Form-heavy page with unusually many external resources.")
        if vf.get("iframe_count", 0) >= 3:
            findings.append(f"Excessive iframe usage detected ({vf.get('iframe_count')} iframes).")
        if vf.get("hidden_element_count", 0) >= 50:
            findings.append("Very high number of hidden page elements.")
    else:
        findings.append("Visual rendering was unavailable for this target.")

    # De-duplicate while preserving order
    seen = set()
    unique = []
    for f in findings:
        if f not in seen:
            seen.add(f)
            unique.append(f)
    return unique[:10]


def _build_summary(risk: str, available_components: list, key_findings: list) -> str:
    """
    Human-readable, non-promotional heuristic summary.
    """
    if not available_components:
        return "Investigation could not be performed."
    components_str = ", ".join(available_components)
    if risk == "HIGH":
        return (
            f"Multiple phishing indicators were detected across the {components_str} "
            f"analysis. This is a heuristic signal — manual verification is recommended."
        )
    if risk == "MEDIUM":
        return (
            f"Some suspicious patterns were observed across the {components_str} "
            f"analysis. Heuristic assessment recommends caution."
        )
    return (
        f"No major phishing indicators were detected by the current heuristic "
        f"checks ({components_str})."
    )


def _empty_visual_block(reason: str) -> dict:
    return {
        "score": 0,
        "risk": "LOW",
        "features": {"rendered": False},
        "findings": [reason],
        "screenshot_b64": None,
        "screenshot_mime": None,
        "error": reason,
    }


def _empty_webpage_block(reason: str) -> dict:
    return {
        "available": False,
        "error": reason,
        "score": 0,
        "findings": [reason],
        "features": {},
    }


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze_website(request: AnalyzeRequest):
    target_url = request.url.strip()
    if not target_url:
        raise HTTPException(status_code=400, detail="URL field cannot be empty.")

    # Step 1: URL & Security Analysis (SSRF gate)
    url_res = analyze_url(target_url)

    if url_res.get("blocked"):
        sections = _safe_url_section(target_url, url_res)
        return {
            **sections,
            "overall": {
                "score": 100,
                "risk": "HIGH",
                "summary": "Investigation refused: target URL failed the SSRF safety policy.",
                "findings": [url_res.get("error") or "URL blocked."],
                "weights_used": {"url": 1.0},
                "available_components": ["url"],
            },
            "target_url": target_url,
            "preliminary_score": 100,
            "risk_level": "HIGH",
        }

    # Step 2: Webpage Analysis
    try:
        webpage_res = await fetch_and_analyze_webpage(target_url)
    except Exception as e:
        webpage_res = _empty_webpage_block(f"Webpage analyzer error: {e}")

    # Step 3: NLP Analysis
    extracted_text = (webpage_res.get("features", {}) or {}).get("extracted_text", "")
    try:
        nlp_res = analyze_text(extracted_text)
    except Exception as e:
        nlp_res = {
            "score": 0,
            "risk_level": "LOW",
            "findings": [f"NLP analyzer error: {e}"],
            "categories": [],
            "matched_phrases": [],
        }

    # Step 4: Visual Analysis
    # The Vercel visual path (Microlink) inherits structural features from
    # the webpage analyzer's parsed DOM since the external screenshot API
    # does not expose the live page. The local Playwright path ignores
    # ``webpage_features`` and re-derives everything via page.evaluate().
    webpage_features_for_visual: dict | None = None
    if webpage_res.get("available"):
        wf = webpage_res.get("features") or {}
        webpage_features_for_visual = {
            "form_count": int(wf.get("form_count", 0) or 0),
            "password_field_count": int(wf.get("password_count", 0) or 0),
            "iframe_count": 0,  # not parsed by the webpage analyzer
            "hidden_element_count": 0,
            "fixed_position_count": 0,
            "external_resource_count": int(wf.get("external_links", 0) or 0),
            "image_count": 0,
            "page_title": wf.get("page_title"),
        }
    try:
        visual_res = await analyze_visual(target_url, webpage_features_for_visual)
    except Exception as e:
        visual_res = _empty_visual_block(f"Visual analyzer error: {e}")

    # Normalize per-component scores into the canonical 0-100 range used
    # for the overall scoring (visual already returns 0-100; nlp also does).
    # "None" means the component is unavailable / blocked / failed — those
    # components are excluded from the weighted average and the remaining
    # weights are dynamically renormalized below.
    url_score = url_res.get("score", 0) if not url_res.get("blocked") else None
    webpage_score = webpage_res.get("score", 0) if webpage_res.get("available") else None
    nlp_score = nlp_res.get("score", 0) if extracted_text else None
    visual_score = (
        visual_res.get("score", 0)
        if (visual_res.get("screenshot_b64") or (visual_res.get("features") or {}).get("rendered"))
        else None
    )

    base_weights = {
        "url": 0.25,
        "webpage": 0.25,
        "nlp": 0.30,
        "visual": 0.20,
    }
    components = {
        "url": (url_score, base_weights["url"]),
        "webpage": (webpage_score, base_weights["webpage"]),
        "nlp": (nlp_score, base_weights["nlp"]),
        "visual": (visual_score, base_weights["visual"]),
    }
    available = {k: v for k, v in components.items() if v[0] is not None}
    total_weight = sum(w for _, w in available.values()) or 1.0

    combined_score = 0
    used_weights = {}
    for key, (score, weight) in available.items():
        normalized = weight / total_weight
        used_weights[key] = round(normalized, 3)
        combined_score += score * normalized
    combined_score = max(0, min(100, round(combined_score)))
    risk_level = classify_risk(combined_score)

    key_findings = _build_key_findings(url_res, webpage_res, nlp_res, visual_res)
    summary = _build_summary(risk_level, list(available.keys()), key_findings)

    return {
        "target_url": target_url,
        "preliminary_score": combined_score,
        "risk_level": risk_level,
        "url": url_res,
        "webpage": webpage_res,
        "nlp": nlp_res,
        "visual": visual_res,
        "overall": {
            "score": combined_score,
            "risk": risk_level,
            "summary": summary,
            "findings": key_findings,
            "weights_used": used_weights,
            "available_components": list(available.keys()),
        },
    }