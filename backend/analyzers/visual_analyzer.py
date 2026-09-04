import asyncio
import base64
import ipaddress
import os
import socket
from typing import Optional, Tuple
from urllib.parse import urlparse
import httpx
from playwright.async_api import async_playwright

VIEWPORT_WIDTH = 1280
VIEWPORT_HEIGHT = 720
NAV_TIMEOUT_MS = 10000
NETWORK_IDLE_TIMEOUT_MS = 3000
# Real overall deadline for the visual render + screenshot + extraction
# path. Surfaced as a graceful "visual analysis timed out" envelope rather
# than letting the host platform kill the function.
OVERALL_TIMEOUT_MS = 15000

# Microlink screenshot API (serverless-friendly, no Chromium needed).
# Free tier: ~50 requests/day/IP without an API key. Set MICROLINK_API_KEY
# in the environment to lift the rate limit.
MICROLINK_ENDPOINT = "https://api.microlink.io"
MICROLINK_TIMEOUT_S = 12.0
MICROLINK_MAX_BYTES = 1_500_000  # match the webpage analyzer's body cap

SCREENSHOT_MIME = "image/png"


def _is_vercel_environment() -> bool:
    """
    Detect whether the current process is running inside Vercel's Python
    serverless runtime. Vercel sets the ``VERCEL`` env var to ``"1"`` on
    every serverless invocation, and ``VERCEL_ENV`` to the deployment
    environment name (``production`` / ``preview`` / ``development``).
    """
    return bool(os.environ.get("VERCEL"))


def _unavailable_envelope(reason: str) -> dict:
    """
    Canonical "visual analysis unavailable" envelope. Same shape as the
    analyzer's normal output, but with ``score: None`` so the final risk
    engine in ``main.py`` excludes this component from the weighted
    average (dynamic renormalization). Distinct from a *failed* render
    (where the analyzer was attempted but errored) and from a *blocked*
    target (where SSRF protection rejected the URL).
    """
    return {
        "ok": False,
        "error": reason,
        "blocked": False,
        "available": False,
        "score": None,
        "risk": "LOW",
        "features": {
            "rendered": False,
            "viewport_width": VIEWPORT_WIDTH,
            "viewport_height": VIEWPORT_HEIGHT,
            "form_count": 0,
            "password_field_count": 0,
            "iframe_count": 0,
            "hidden_element_count": 0,
            "fixed_position_count": 0,
            "external_resource_count": 0,
            "image_count": 0,
        },
        "findings": [
            reason,
            "Visual rendering is a deployment-platform limitation; structural "
            "analysis from URL, webpage, and NLP layers continues normally.",
        ],
        "screenshot_b64": None,
        "screenshot_mime": None,
    }


async def _microlink_resolve(url: str) -> Optional[str]:
    """
    Call Microlink to obtain a CDN-hosted screenshot URL for ``url``.
    Returns the screenshot URL on success or ``None`` on any failure
    (network error, non-200, JSON parse, rate limit, …). Never raises.

    The endpoint returns a JSON envelope (``data.screenshot.url``) only
    when the request is made with ``Accept: application/json`` and the
    minimal ``screenshot=true`` flag. Extra dimension params on the URL
    cause Microlink to return the PNG artifact directly instead of the
    JSON metadata envelope, so we deliberately keep the query string
    small.
    """
    params = {
        "url": url,
        "screenshot": "true",
        "meta": "false",
    }
    headers = {"Accept": "application/json"}
    api_key = os.environ.get("MICROLINK_API_KEY")
    if api_key:
        headers["x-api-key"] = api_key

    try:
        async with httpx.AsyncClient(
            timeout=MICROLINK_TIMEOUT_S, follow_redirects=True
        ) as client:
            resp = await client.get(
                MICROLINK_ENDPOINT, params=params, headers=headers
            )
    except Exception:
        return None

    if resp.status_code != 200:
        return None
    if "json" not in (resp.headers.get("content-type", "") or "").lower():
        return None
    try:
        data = resp.json()
    except Exception:
        return None
    if str(data.get("status", "")).lower() != "success":
        return None
    screenshot = (data.get("data") or {}).get("screenshot") or {}
    return screenshot.get("url")


async def _microlink_download(screenshot_url: str) -> Optional[bytes]:
    """
    Download the PNG bytes from Microlink's CDN. Cap at
    ``MICROLINK_MAX_BYTES`` and use a short timeout. Returns ``None`` on
    any failure.
    """
    try:
        async with httpx.AsyncClient(
            timeout=MICROLINK_TIMEOUT_S, follow_redirects=True
        ) as client:
            async with client.stream("GET", screenshot_url) as resp:
                if resp.status_code != 200:
                    return None
                buf = bytearray()
                async for chunk in resp.aiter_bytes():
                    if not chunk:
                        continue
                    buf.extend(chunk)
                    if len(buf) > MICROLINK_MAX_BYTES:
                        return None
                return bytes(buf)
    except Exception:
        return None


async def _capture_via_microlink(
    url: str, webpage_features: Optional[dict] = None
) -> dict:
    """
    Vercel-friendly visual path: ask Microlink to render the page, then
    fetch the resulting PNG. Returns the standard analyzer envelope on
    success, or ``_unavailable_envelope(...)`` on any failure.

    Structural features (``form_count``, ``password_field_count``, …) are
    *inherited* from the webpage analyzer's parsed DOM when available, so
    the heuristic risk scoring remains meaningful on the serverless path.
    """
    screenshot_url = await _microlink_resolve(url)
    if not screenshot_url:
        return _unavailable_envelope(
            "Live visual capture is unavailable: the Microlink screenshot "
            "service could not be reached. URL, webpage, and NLP analysis "
            "continue normally."
        )

    png_bytes = await _microlink_download(screenshot_url)
    if not png_bytes:
        return _unavailable_envelope(
            "Live visual capture is unavailable: the screenshot returned by "
            "Microlink could not be downloaded. URL, webpage, and NLP "
            "analysis continue normally."
        )

    screenshot_b64 = base64.b64encode(png_bytes).decode("ascii")

    # Inherit structural features from the webpage analyzer when available.
    # The webpage analyzer already counts forms, password inputs, iframes,
    # hidden elements, fixed/sticky positioning, external resources, and
    # images from the live HTML. We add ``rendered=True`` + a screenshot
    # source marker so the UI / scoring know the visual layer succeeded.
    wf = webpage_features or {}
    features = {
        "rendered": True,
        "viewport_width": VIEWPORT_WIDTH,
        "viewport_height": VIEWPORT_HEIGHT,
        "form_count": int(wf.get("form_count", 0) or 0),
        "password_field_count": int(wf.get("password_field_count", 0) or 0),
        "iframe_count": int(wf.get("iframe_count", 0) or 0),
        "hidden_element_count": int(wf.get("hidden_element_count", 0) or 0),
        "fixed_position_count": int(wf.get("fixed_position_count", 0) or 0),
        "external_resource_count": int(wf.get("external_resource_count", 0) or 0),
        "image_count": int(wf.get("image_count", 0) or 0),
        "page_title": wf.get("page_title"),
        "screenshot_source": "microlink",
    }

    # Reuse the same heuristic scoring as the local Playwright path so
    # weights and findings stay consistent across deployments.
    findings: list[str] = []
    penalty = 0

    if features["form_count"] >= 5:
        penalty += 10
        findings.append(f"Unusually form-heavy page ({features['form_count']} forms).")
    elif features["form_count"] >= 2:
        findings.append(f"Page contains {features['form_count']} form(s).")

    if features["password_field_count"] >= 1:
        findings.append(
            f"Page contains {features['password_field_count']} password input field(s)."
        )

    if features["iframe_count"] >= 3:
        penalty += 25
        findings.append(
            f"Excessive iframe usage detected ({features['iframe_count']} iframes)."
        )
    elif features["iframe_count"] >= 1:
        penalty += 5
        findings.append(
            f"Page embeds {features['iframe_count']} iframe(s); warrants inspection."
        )

    if features["hidden_element_count"] >= 50:
        penalty += 10
        findings.append(
            f"High number of hidden elements ({features['hidden_element_count']})."
        )
    elif features["hidden_element_count"] >= 15:
        penalty += 3
        findings.append(
            f"Notable number of hidden elements ({features['hidden_element_count']})."
        )

    if features["fixed_position_count"] >= 10:
        findings.append(
            f"Many fixed/sticky-positioned elements ({features['fixed_position_count']})."
        )

    if features["external_resource_count"] >= 50:
        penalty += 15
        findings.append(
            f"High external resource count ({features['external_resource_count']})."
        )
    elif features["external_resource_count"] >= 15:
        penalty += 3
        findings.append(
            f"Moderate external resource count ({features['external_resource_count']})."
        )

    if features["password_field_count"] >= 1 and features["iframe_count"] >= 2:
        penalty += 25
        findings.append(
            "Context: Password/login form combined with iframe embedding — elevated heuristic concern."
        )
    if features["form_count"] >= 5 and features["external_resource_count"] >= 40:
        penalty += 15
        findings.append(
            "Context: Form-heavy layout combined with many external resources."
        )
    if features["iframe_count"] >= 1 and features["hidden_element_count"] >= 30:
        penalty += 10
        findings.append(
            "Context: Iframe embedding with notable hidden elements."
        )

    if not findings:
        findings.append(
            "Visual structure analyzed (Microlink). No notable layout anomalies detected."
        )

    score = max(0, min(100, penalty))

    return {
        "ok": True,
        "available": True,
        "blocked": False,
        "error": None,
        "features": features,
        "findings": findings + [
            "Screenshot rendered via Microlink (serverless-friendly external renderer)."
        ],
        "score": score,
        "risk": _classify_risk(score),
        "screenshot_b64": screenshot_b64,
        "screenshot_mime": SCREENSHOT_MIME,
    }


def _resolve_host_ips(hostname: str):
    try:
        infos = socket.getaddrinfo(hostname, None)
        ips = list({info[4][0] for info in infos})
        return ips
    except Exception:
        return []


def _ip_is_unsafe(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True
    if isinstance(ip, ipaddress.IPv4Address):
        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        )
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _hostname_is_internal(hostname: str) -> bool:
    h = (hostname or "").lower()
    return h in ("localhost", "0.0.0.0") or h.endswith((".local", ".internal", ".lan"))


def validate_visual_target(raw_url: str):
    """
    Validate URL before browser rendering to prevent SSRF.
    Returns (is_safe: bool, normalized_url: Optional[str], reason: Optional[str]).
    """
    url_to_check = raw_url.strip()
    if not url_to_check.startswith(("http://", "https://")):
        url_to_check = "https://" + url_to_check

    try:
        parsed = urlparse(url_to_check)
    except Exception as e:
        return False, None, f"Invalid URL: {e}"

    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https"):
        return False, None, f"Unsupported protocol '{scheme}'. Only HTTP/HTTPS allowed."

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return False, None, "Missing hostname in URL."

    if _hostname_is_internal(hostname):
        return False, None, f"Access to internal host '{hostname}' blocked (SSRF prevention)."

    try:
        ipaddress.IPv4Address(hostname)
        if _ip_is_unsafe(hostname):
            return False, None, f"Access to private/internal IP '{hostname}' blocked (SSRF prevention)."
    except ValueError:
        resolved = _resolve_host_ips(hostname)
        if not resolved:
            return False, None, f"Hostname '{hostname}' could not be resolved."
        for ip in resolved:
            if _ip_is_unsafe(ip):
                return False, None, (
                    f"Hostname '{hostname}' resolves to unsafe IP '{ip}' "
                    f"(SSRF prevention)."
                )

    return True, url_to_check, None


def validate_post_navigation_url(final_url: str) -> Tuple[bool, Optional[str]]:
    """
    Re-validate the URL after Playwright has followed redirects. The browser
    may have landed on a host whose DNS differs from the pre-navigation
    resolve. Returns (is_safe, reason).
    """
    if not final_url:
        return True, None
    try:
        parsed = urlparse(final_url)
    except Exception:
        return True, None  # nothing useful to check; defer to upstream error

    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        return False, f"Post-navigation scheme '{scheme}' is not allowed."

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return False, "Post-navigation URL is missing a hostname."

    if _hostname_is_internal(hostname):
        return False, f"Post-navigation redirected to internal host '{hostname}' (SSRF prevention)."

    # Re-resolve and re-check IPs.
    try:
        ipaddress.IPv4Address(hostname)
        if _ip_is_unsafe(hostname):
            return False, f"Post-navigation IP '{hostname}' is private/unsafe (SSRF prevention)."
    except ValueError:
        resolved = _resolve_host_ips(hostname)
        for ip in resolved:
            if _ip_is_unsafe(ip):
                return False, (
                    f"Post-navigation hostname '{hostname}' resolves to unsafe IP '{ip}' "
                    f"(SSRF prevention)."
                )

    return True, None


def _classify_risk(score: int) -> str:
    if score < 25:
        return "LOW"
    if score < 60:
        return "MEDIUM"
    return "HIGH"


async def _capture_and_analyze(url: str) -> dict:
    """
    Render the URL with Playwright and extract lightweight page-structure
    features. The screenshot is captured IN MEMORY and returned as
    base64; nothing is written to disk.
    """
    features = {
        "rendered": False,
        "viewport_width": VIEWPORT_WIDTH,
        "viewport_height": VIEWPORT_HEIGHT,
        "form_count": 0,
        "password_field_count": 0,
        "iframe_count": 0,
        "hidden_element_count": 0,
        "fixed_position_count": 0,
        "external_resource_count": 0,
        "image_count": 0,
    }

    findings = []
    penalty = 0
    page_title = None
    screenshot_b64: Optional[str] = None
    screenshot_mime: Optional[str] = None

    overall_seconds = OVERALL_TIMEOUT_MS / 1000.0
    try:
        async with asyncio.timeout(overall_seconds):
            async with async_playwright() as p:
                try:
                    browser = await p.chromium.launch(
                        headless=True,
                        channel="chromium-headless-shell",
                        args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
                    )
                except Exception:
                    browser = await p.chromium.launch(
                        headless=True,
                        args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
                    )
                context = None
                try:
                    context = await browser.new_context(
                        viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
                        ignore_https_errors=True,
                        java_script_enabled=True,
                    )
                    # Block downloads and large resources where practical
                    await context.route(
                        "**/*",
                        lambda route: route.abort()
                        if route.request.resource_type in ("media", "font")
                        else route.continue_(),
                    )

                    page = await context.new_page()
                    response = await page.goto(
                        url,
                        wait_until="domcontentloaded",
                        timeout=NAV_TIMEOUT_MS,
                    )
                    try:
                        await page.wait_for_load_state("networkidle", timeout=NETWORK_IDLE_TIMEOUT_MS)
                    except Exception:
                        # Do not wait indefinitely for network activity
                        pass

                    # Post-navigation SSRF re-check on the final URL.
                    final_url = page.url
                    safe, reason = validate_post_navigation_url(final_url)
                    if not safe:
                        await context.close()
                        await browser.close()
                        return {
                            "ok": False,
                            "error": reason or "Post-navigation SSRF block.",
                            "features": features,
                            "findings": [f"Visual analysis blocked: {reason}"],
                            "score": 0,
                            "risk": "LOW",
                            "screenshot_b64": None,
                            "screenshot_mime": None,
                        }

                    features["rendered"] = True
                    features["http_status"] = response.status if response else None
                    page_title = await page.title()

                    # Structural feature extraction via page.evaluate
                    metrics = await page.evaluate(
                        """() => {
                            const forms = document.querySelectorAll('form');
                            const passwords = document.querySelectorAll('input[type="password"]');
                            const iframes = document.querySelectorAll('iframe');
                            const hiddenEls = document.querySelectorAll(
                                '[hidden], [aria-hidden="true"], [style*="display:none"], [style*="visibility:hidden"]'
                            );
                            const allEls = document.querySelectorAll('*');
                            let fixedPos = 0;
                            for (const el of allEls) {
                                try {
                                    const style = window.getComputedStyle(el);
                                    if (style && (style.position === 'fixed' || style.position === 'sticky')) {
                                        fixedPos += 1;
                                    }
                                } catch (e) {}
                            }
                            const loc = window.location;
                            const host = loc.hostname;
                            const isExternal = (u) => {
                                try {
                                    const a = document.createElement('a');
                                    a.href = u;
                                    return a.hostname && a.hostname !== '' && a.hostname !== host;
                                } catch (e) { return false; }
                            };
                            const resources = document.querySelectorAll(
                                'script[src], link[href], iframe[src]'
                            );
                            let extResources = 0;
                            for (const r of resources) {
                                const u = r.getAttribute('src') || r.getAttribute('href');
                                if (u && isExternal(u)) extResources += 1;
                            }
                            const images = document.querySelectorAll('img');
                            return {
                                formCount: forms.length,
                                passwordCount: passwords.length,
                                iframeCount: iframes.length,
                                hiddenCount: hiddenEls.length,
                                fixedPositionCount: fixedPos,
                                externalResourceCount: extResources,
                                imageCount: images.length,
                            };
                        }"""
                    )

                    features.update(
                        {
                            "form_count": metrics.get("formCount", 0),
                            "password_field_count": metrics.get("passwordCount", 0),
                            "iframe_count": metrics.get("iframeCount", 0),
                            "hidden_element_count": metrics.get("hiddenCount", 0),
                            "fixed_position_count": metrics.get("fixedPositionCount", 0),
                            "external_resource_count": metrics.get("externalResourceCount", 0),
                            "image_count": metrics.get("imageCount", 0),
                            "page_title": page_title,
                        }
                    )

                    # Capture screenshot in memory (no `path=` so Playwright
                    # never touches the filesystem).
                    png_bytes = await page.screenshot(type="png", full_page=False)
                    if png_bytes:
                        screenshot_b64 = base64.b64encode(png_bytes).decode("ascii")
                        screenshot_mime = SCREENSHOT_MIME
                finally:
                    if context is not None:
                        try:
                            await context.close()
                        except Exception:
                            pass
                    try:
                        await browser.close()
                    except Exception:
                        pass
    except asyncio.TimeoutError:
        return {
            "ok": False,
            "error": (
                f"Visual analysis exceeded the {OVERALL_TIMEOUT_MS} ms overall deadline."
            ),
            "features": features,
            "findings": [
                f"Visual render timed out after {OVERALL_TIMEOUT_MS} ms; analysis aborted safely."
            ],
            "score": 0,
            "risk": "LOW",
            "screenshot_b64": None,
            "screenshot_mime": None,
        }
    except Exception as e:
        return {
            "ok": False,
            "error": f"Screenshot/render failure: {str(e)}",
            "features": features,
            "findings": [f"Visual render failed: {str(e)}"],
            "score": 0,
            "risk": "LOW",
            "screenshot_b64": None,
            "screenshot_mime": None,
        }

    # Heuristic scoring (bounded 0-100) — unchanged from the previous logic
    # so analysis weights and rules are preserved exactly.
    if features["form_count"] >= 5:
        penalty += 10
        findings.append(f"Unusually form-heavy page ({features['form_count']} forms).")
    elif features["form_count"] >= 2:
        findings.append(f"Page contains {features['form_count']} form(s).")

    if features["password_field_count"] >= 1:
        findings.append(
            f"Page contains {features['password_field_count']} password input field(s)."
        )

    if features["iframe_count"] >= 3:
        penalty += 25
        findings.append(
            f"Excessive iframe usage detected ({features['iframe_count']} iframes)."
        )
    elif features["iframe_count"] >= 1:
        penalty += 5
        findings.append(
            f"Page embeds {features['iframe_count']} iframe(s); warrants inspection."
        )

    if features["hidden_element_count"] >= 50:
        penalty += 10
        findings.append(
            f"High number of hidden elements ({features['hidden_element_count']})."
        )
    elif features["hidden_element_count"] >= 15:
        penalty += 3
        findings.append(
            f"Notable number of hidden elements ({features['hidden_element_count']})."
        )

    if features["fixed_position_count"] >= 10:
        findings.append(
            f"Many fixed/sticky-positioned elements ({features['fixed_position_count']})."
        )

    if features["external_resource_count"] >= 50:
        penalty += 15
        findings.append(
            f"High external resource count ({features['external_resource_count']})."
        )
    elif features["external_resource_count"] >= 15:
        penalty += 3
        findings.append(
            f"Moderate external resource count ({features['external_resource_count']})."
        )

    if (
        features["password_field_count"] >= 1
        and features["iframe_count"] >= 2
    ):
        penalty += 25
        findings.append(
            "Context: Password/login form combined with iframe embedding — elevated heuristic concern."
        )

    if (
        features["form_count"] >= 5
        and features["external_resource_count"] >= 40
    ):
        penalty += 15
        findings.append(
            "Context: Form-heavy layout combined with many external resources."
        )

    if features["iframe_count"] >= 1 and features["hidden_element_count"] >= 30:
        penalty += 10
        findings.append(
            "Context: Iframe embedding with notable hidden elements."
        )

    if not features["rendered"]:
        findings.append("Page did not render successfully in the headless browser.")

    if not findings:
        findings.append(
            "Visual structure analyzed. No notable layout anomalies detected."
        )

    score = max(0, min(100, penalty))

    return {
        "ok": True,
        "error": None,
        "features": features,
        "findings": findings,
        "score": score,
        "risk": _classify_risk(score),
        "screenshot_b64": screenshot_b64,
        "screenshot_mime": screenshot_mime,
    }


async def analyze_visual(raw_url: str, webpage_features: Optional[dict] = None) -> dict:
    """
    Public entry point: validates the URL against SSRF protections, then
    renders and analyzes the page. Always returns a valid result envelope
    even on failure.

    On Vercel's Python serverless runtime the headless Chromium browser
    cannot be launched (Vercel does not expose ``apt-get`` and the build
    image lacks the ``libnss3``/``libnspr4``/``libgbm`` shared libraries
    Chromium requires at runtime). In that environment we delegate the
    render to the Microlink screenshot API — a serverless-friendly
    external renderer that returns a PNG via HTTPS. Structural features
    are inherited from ``webpage_features`` (the webpage analyzer's
    already-parsed DOM) so the heuristic risk scoring remains meaningful.
    If the Microlink call fails for any reason we fall back to the
    graceful ``unavailable`` envelope so the rest of the investigation
    (URL + Webpage + NLP) continues unaffected. The local development
    path keeps the real Playwright renderer.
    """
    is_safe, normalized_url, reason = validate_visual_target(raw_url)
    if not is_safe:
        return {
            "score": 0,
            "risk": "LOW",
            "features": {"rendered": False},
            "findings": [f"Visual analysis skipped: {reason}"],
            "screenshot_b64": None,
            "screenshot_mime": None,
            "error": reason,
            "blocked": True,
        }

    if _is_vercel_environment():
        try:
            return await _capture_via_microlink(normalized_url, webpage_features)
        except Exception as e:
            return _unavailable_envelope(
                f"Live visual capture is unavailable on Vercel: {str(e)}. "
                "URL, webpage, and NLP analysis continue normally."
            )

    try:
        result = await _capture_and_analyze(normalized_url)
    except Exception as e:
        return {
            "score": 0,
            "risk": "LOW",
            "features": {"rendered": False},
            "findings": [f"Visual analyzer error: {str(e)}"],
            "screenshot_b64": None,
            "screenshot_mime": None,
            "error": str(e),
            "blocked": False,
        }

    return {
        "score": result.get("score", 0),
        "risk": result.get("risk", "LOW"),
        "features": result.get("features", {}),
        "findings": result.get("findings", []),
        "screenshot_b64": result.get("screenshot_b64"),
        "screenshot_mime": result.get("screenshot_mime"),
        "error": result.get("error"),
        "blocked": False,
    }
