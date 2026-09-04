"""Quick test script for visual_analyzer.py"""
import asyncio
import sys
sys.path.insert(0, '.')

from analyzers.visual_analyzer import (
    analyze_visual,
    validate_visual_target,
    _is_vercel_environment,
)


def _validate(name, url, expect_safe):
    print(f"\n{'-'*60}\nTEST (SSRF validation): {name}")
    is_safe, _, reason = validate_visual_target(url)
    expected = "safe" if expect_safe else "blocked"
    actual = "safe" if is_safe else "blocked"
    status = "PASS" if actual == expected else "FAIL"
    print(f"  URL: {url}")
    print(f"  Expected: {expected} | Got: {actual} | {status}")
    if reason:
        print(f"  Reason: {reason}")
    assert status == "PASS", f"SSRF validation test failed: {name}"


async def _async_test(name, url, expect_render):
    print(f"\n{'-'*60}\nTEST: {name}")
    result = await analyze_visual(url)
    score = result.get("score", 0)
    risk = result.get("risk", "LOW")
    features = result.get("features", {})
    findings = result.get("findings", [])
    ssb = result.get("screenshot_b64")
    ssm = result.get("screenshot_mime")
    err = result.get("error")
    blocked = result.get("blocked", False)
    available = result.get("available", True)
    print(f"  URL: {url}")
    print(f"  Blocked: {blocked}")
    print(f"  Available: {available}")
    print(f"  Rendered: {features.get('rendered', False)}")
    print(f"  Score: {score} | Risk: {risk}")
    if ssb:
        print(f"  Screenshot: <{len(ssb)} chars base64, mime={ssm}>")
    else:
        print(f"  Screenshot: (none)")
    if err:
        print(f"  Error: {err}")
    for f in findings:
        print(f"  - {f}")
    assert 0 <= score <= 100 if isinstance(score, int) else score is None, "Score out of bounds"
    assert risk in ("LOW", "MEDIUM", "HIGH"), "Risk classification invalid"
    if expect_render:
        assert features.get("rendered", False), "Expected successful render"
        assert ssb, "Expected screenshot (base64)"
    if blocked or features.get("rendered") is False:
        assert ssb is None, "Should not return screenshot on failure"
    print("  -> PASS")


def run_sync_tests():
    # SSRF validation tests
    _validate("Unsafe localhost", "http://localhost", False)
    _validate("Unsafe 127.0.0.1", "http://127.0.0.1", False)
    _validate("Unsafe 0.0.0.0", "http://0.0.0.0", False)
    _validate("Private 10.0.0.1", "http://10.0.0.1", False)
    _validate("Private 192.168.1.1", "http://192.168.1.1", False)
    _validate("Private 172.16.0.1", "http://172.16.0.1", False)
    _validate("Link-local 169.254.169.254", "http://169.254.169.254", False)
    _validate("Internal .local", "http://printer.local", False)
    _validate("Invalid scheme", "ftp://example.com", False)
    _validate("Safe https example", "https://example.com", True)


async def main():
    print(f"Vercel environment detected: {_is_vercel_environment()}")
    run_sync_tests()

    # Async rendering tests. On Vercel we now route through the Microlink
    # screenshot API (serverless-friendly external renderer), so we
    # exercise that path with mocked httpx responses to keep the test
    # hermetic. Locally we still hit the real Playwright path.
    if _is_vercel_environment():
        print("\n(Running Microlink-path tests with mocked httpx; "
              "the Vercel visual layer delegates to the Microlink API.)")
        await _test_microlink_path_success()
        await _test_microlink_path_resolve_failure()
        await _test_microlink_path_download_failure()
    else:
        # Async rendering tests
        await _async_test("Normal webpage", "https://example.com", True)
        await _async_test("Login page (github)", "https://github.com/login", True)
        await _async_test("Iframe-heavy page", "https://www.w3schools.com/html/html_iframe.asp", True)
        await _async_test("Unsafe localhost URL", "http://localhost:8000", False)
        await _async_test("Invalid URL", "not-a-real-domain.invalid.tld", False)

        # Screenshot failure simulated by unreachable host
        await _async_test("Unreachable URL", "https://this-host-does-not-exist-xyz123abc.test", False)

    print("\n\nAll visual analyzer tests completed.")


# --- Mocked Microlink-path tests (used in the Vercel environment) ---------

async def _test_microlink_path_success():
    """Vercel + Microlink success: a real base64 PNG is returned and the
    envelope is the *normal* available shape (not the unavailable one)."""
    import base64
    from unittest.mock import patch
    print(f"\n{'-'*60}\nTEST: Microlink success path (Vercel)")
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100

    async def _fake_resolve(_url):
        return "https://iad.microlink.io/fake-screenshot"

    async def _fake_download(_url):
        return png_bytes

    with patch("analyzers.visual_analyzer._microlink_resolve", new=_fake_resolve), \
         patch("analyzers.visual_analyzer._microlink_download", new=_fake_download):
        res = await analyze_visual(
            "https://example.com",
            webpage_features={"form_count": 1, "password_field_count": 0,
                              "external_resource_count": 3, "page_title": "Example"},
        )
    assert res.get("available") is True, f"available should be True: {res}"
    assert res.get("ok") is True
    assert res.get("screenshot_b64") is not None, "should return a base64 screenshot"
    assert res.get("screenshot_mime") == "image/png"
    assert res.get("features", {}).get("screenshot_source") == "microlink"
    assert res.get("score") == 0
    assert res.get("risk") == "LOW"
    print("  -> PASS")


async def _test_microlink_path_resolve_failure():
    """Vercel + Microlink resolve failure: returns the unavailable envelope."""
    from unittest.mock import patch
    print(f"\n{'-'*60}\nTEST: Microlink resolve failure (Vercel)")

    async def _fake_resolve(_url):
        return None

    with patch("analyzers.visual_analyzer._microlink_resolve", new=_fake_resolve):
        res = await analyze_visual("https://example.com")
    assert res.get("available") is False
    assert res.get("screenshot_b64") is None
    assert res.get("score") is None
    assert "Microlink" in (res.get("error") or ""), res.get("error")
    print("  -> PASS")


async def _test_microlink_path_download_failure():
    """Vercel + Microlink download failure: also returns the unavailable envelope."""
    from unittest.mock import patch
    print(f"\n{'-'*60}\nTEST: Microlink download failure (Vercel)")

    async def _fake_resolve(_url):
        return "https://iad.microlink.io/missing"

    async def _fake_download(_url):
        return None

    with patch("analyzers.visual_analyzer._microlink_resolve", new=_fake_resolve), \
         patch("analyzers.visual_analyzer._microlink_download", new=_fake_download):
        res = await analyze_visual("https://example.com")
    assert res.get("available") is False
    assert res.get("screenshot_b64") is None
    assert res.get("score") is None
    print("  -> PASS")


if __name__ == "__main__":
    asyncio.run(main())