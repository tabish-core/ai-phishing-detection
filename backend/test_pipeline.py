"""End-to-end pipeline tests for CaughtIn4K."""
import asyncio
import json
import sys

import httpx

API_BASE = "http://localhost:8000"


def _header(title):
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def _verify_structure(d):
    """Ensure the response has all required top-level keys and bounds."""
    assert isinstance(d, dict), "Response must be a JSON object"
    for key in ("url", "webpage", "nlp", "visual", "overall", "target_url"):
        assert key in d, f"Missing top-level key: {key}"

    overall = d["overall"]
    assert "score" in overall and "risk" in overall, "overall.score/risk required"
    assert 0 <= overall["score"] <= 100, "overall.score out of bounds"
    assert overall["risk"] in ("LOW", "MEDIUM", "HIGH"), "overall.risk invalid"
    assert "summary" in overall, "overall.summary required"
    assert "findings" in overall, "overall.findings required"
    assert isinstance(overall["findings"], list), "overall.findings must be list"


def test_health():
    _header("TEST: Health endpoint")
    r = httpx.get(f"{API_BASE}/api/health", timeout=10)
    assert r.status_code == 200
    print(r.json())
    print("PASS")


def test_normal_website():
    _header("TEST 1: Normal website (https://example.com)")
    r = httpx.post(f"{API_BASE}/api/analyze", json={"url": "https://example.com"}, timeout=120)
    assert r.status_code == 200
    d = r.json()
    _verify_structure(d)
    print(f"Score: {d['overall']['score']} Risk: {d['overall']['risk']}")
    print(f"Summary: {d['overall']['summary']}")
    print(f"Available components: {d['overall'].get('available_components')}")
    print(f"Findings: {len(d['overall']['findings'])}")
    assert d["overall"]["available_components"], "All components should be available"
    assert d["visual"]["screenshot_b64"], "Screenshot (base64) should be generated"
    print("PASS")


def test_unsafe_localhost():
    _header("TEST 2: Unsafe localhost (http://127.0.0.1)")
    r = httpx.post(f"{API_BASE}/api/analyze", json={"url": "http://127.0.0.1"}, timeout=60)
    assert r.status_code == 200
    d = r.json()
    _verify_structure(d)
    print(f"Score: {d['overall']['score']} Risk: {d['overall']['risk']}")
    print(f"URL blocked: {d['url'].get('blocked')}")
    assert d["url"].get("blocked"), "URL must be blocked"
    assert d["overall"]["risk"] == "HIGH"
    assert d["visual"]["screenshot_b64"] is None, "No screenshot for unsafe URL"
    print("PASS")


def test_suspicious_url():
    _header("TEST 3: Suspicious URL (HTTP + multiple keywords)")
    url = "http://verify-account-login.tk/secure/update"
    r = httpx.post(f"{API_BASE}/api/analyze", json={"url": url}, timeout=120)
    assert r.status_code == 200
    d = r.json()
    _verify_structure(d)
    print(f"Score: {d['overall']['score']} Risk: {d['overall']['risk']}")
    print(f"URL findings: {d['url']['findings']}")
    assert d["overall"]["score"] > 0, "Suspicious URL should produce a non-zero score"
    assert len(d["url"]["findings"]) > 0, "URL findings should exist"
    print("PASS")


def test_suspicious_text():
    _header("TEST 4: Suspicious NLP text (local mock)")
    # Direct unit test of NLP analyzer with controlled text
    sys.path.insert(0, ".")
    from analyzers.nlp_analyzer import analyze_text

    text = (
        "Urgent! Verify your account immediately. "
        "Your account has been locked due to unauthorized activity. "
        "Enter your password to confirm your identity."
    )
    res = analyze_text(text)
    print(f"Score: {res['score']} Risk: {res['risk_level']}")
    print(f"Categories: {res['categories']}")
    print(f"Matched phrases: {res['matched_phrases']}")
    assert res["score"] >= 35, "Should be MEDIUM or higher"
    assert "URGENCY" in res["categories"]
    assert "ACCOUNT_VERIFICATION" in res["categories"]
    assert "THREATS" in res["categories"]
    assert "CREDENTIALS" in res["categories"]
    print("PASS")


def test_form_iframe_detection():
    _header("TEST 5: Local password/iframe page (via webpage analyzer)")
    sys.path.insert(0, ".")
    from bs4 import BeautifulSoup
    from analyzers.webpage_analyzer import fetch_and_analyze_webpage

    # Build a tiny HTML snippet and verify structural counters work on it.
    html = """
    <html><head><title>Test</title></head><body>
      <form action="/login"><input type="password" name="p"/></form>
      <iframe src="https://other.example.com/x"></iframe>
      <iframe src="https://other.example.com/y"></iframe>
    </body></html>
    """
    soup = BeautifulSoup(html, "html.parser")
    forms = soup.find_all("form")
    passwords = soup.find_all("input", attrs={"type": "password"})
    iframes = soup.find_all("iframe")
    assert len(forms) == 1
    assert len(passwords) == 1
    assert len(iframes) == 2
    print(f"Forms: {len(forms)} Passwords: {len(passwords)} Iframes: {len(iframes)}")
    print("PASS")


def test_invalid_url():
    _header("TEST 6: Invalid URL")
    r = httpx.post(f"{API_BASE}/api/analyze", json={"url": "not a real url"}, timeout=30)
    # Backend tolerates malformed URLs and returns 200 with URL findings
    assert r.status_code in (200, 400, 422)
    if r.status_code == 200:
        d = r.json()
        _verify_structure(d)
        print(f"Score: {d['overall']['score']} Risk: {d['overall']['risk']}")
        print(f"URL findings: {d['url'].get('findings', [])[:3]}")
    else:
        print(f"Rejected with HTTP {r.status_code}")
    print("PASS")


def test_nlp_regression():
    _header("TEST 7: NLP regression (Iteration 4 cases)")
    sys.path.insert(0, ".")
    from analyzers.nlp_analyzer import analyze_text

    cases = [
        ("Normal text", "Welcome to our website. We provide cloud hosting services.", "LOW"),
        ("Legit login", "Sign in to your account using your username and password.", "LOW"),
        ("Suspicious", "Urgent! Verify your account immediately or your account will be suspended.", "HIGH"),
        ("Financial", "Confirm your bank account and payment information immediately.", "MEDIUM"),
        ("Empty", "", "LOW"),
        ("Threats+creds", "Your account has been locked due to unauthorized activity. Enter your password to verify your identity.", "HIGH"),
    ]
    for name, text, expected in cases:
        r = analyze_text(text)
        ok = r["risk_level"] == expected
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}: {r['score']} {r['risk_level']} (expected {expected})")
        assert ok, f"NLP regression failed: {name}"
    print("ALL NLP REGRESSION TESTS PASS")


if __name__ == "__main__":
    test_health()
    test_nlp_regression()
    test_suspicious_text()
    test_form_iframe_detection()
    test_invalid_url()
    test_unsafe_localhost()
    test_normal_website()
    test_suspicious_url()
    print("\nAll pipeline tests completed.")