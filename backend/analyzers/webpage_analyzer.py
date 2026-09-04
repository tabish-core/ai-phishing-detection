import time
import httpx
from bs4 import BeautifulSoup
from urllib.parse import urlparse

SUSPICIOUS_TEXT_PHRASES = [
    'verify your account',
    'confirm your identity',
    'update your password',
    'urgent action required',
    'account suspended',
    'login immediately',
    'security notice',
    'unauthorized login'
]

MAX_RESPONSE_BYTES = 1_500_000  # 1.5 MB cap on response body

async def fetch_and_analyze_webpage(target_url: str) -> dict:
    """
    Safely fetches a webpage using httpx, extracts structural HTML features,
    and returns findings and metrics without executing any scripts or downloads.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True, max_redirects=3, headers=headers) as client:
            response = await client.get(target_url)
            elapsed_ms = round((time.time() - start_time) * 1000)

            # Enforce response size cap to avoid loading huge bodies
            if len(response.content) > MAX_RESPONSE_BYTES:
                return {
                    "available": False,
                    "error": f"Response exceeded {MAX_RESPONSE_BYTES // 1024} KB size limit.",
                    "score": 0,
                    "findings": ["Webpage body too large to analyze safely."],
                    "features": {
                        "status_code": response.status_code,
                        "response_time_ms": elapsed_ms,
                        "content_type": response.headers.get('content-type', '').lower(),
                    },
                }

    except httpx.TimeoutException:
        return {
            "available": False,
            "error": "Connection timed out (server did not respond within 6 seconds).",
            "score": 0,
            "findings": ["Webpage fetch failed due to request timeout."],
            "features": {}
        }
    except httpx.ConnectError:
        return {
            "available": False,
            "error": "Unable to establish connection to the remote server.",
            "score": 0,
            "findings": ["Webpage fetch failed: Connection refused or server offline."],
            "features": {}
        }
    except Exception as e:
        return {
            "available": False,
            "error": f"Webpage fetch failed: {str(e)}",
            "score": 0,
            "findings": [f"Webpage fetch error: {str(e)}"],
            "features": {}
        }

    # Record basic response metrics
    status_code = response.status_code
    final_url = str(response.url)
    redirect_count = len(response.history)
    content_type = response.headers.get('content-type', '').lower()

    if status_code >= 400:
        return {
            "available": False,
            "error": f"Server returned HTTP error status {status_code}.",
            "score": 10,
            "findings": [f"HTTP error status code {status_code} received."],
            "features": {
                "status_code": status_code,
                "final_url": final_url,
                "redirect_count": redirect_count,
                "response_time_ms": elapsed_ms
            }
        }

    # Verify if response contains HTML
    if 'text/html' not in content_type and 'application/xhtml+xml' not in content_type:
        return {
            "available": True,
            "error": None,
            "score": 0,
            "findings": [f"Non-HTML resource retrieved (Content-Type: {content_type}). HTML structural analysis skipped."],
            "features": {
                "status_code": status_code,
                "final_url": final_url,
                "redirect_count": redirect_count,
                "content_type": content_type,
                "response_time_ms": elapsed_ms,
                "is_html": False
            }
        }

    # Parse HTML using BeautifulSoup
    try:
        soup = BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        return {
            "available": True,
            "error": f"HTML parsing error: {str(e)}",
            "score": 0,
            "findings": ["Unable to parse HTML structure."],
            "features": {}
        }

    # Extract Structural Features
    title_tag = soup.find('title')
    page_title = title_tag.string.strip() if title_tag and title_tag.string else "(No Title)"

    forms = soup.find_all('form')
    form_count = len(forms)

    password_inputs = soup.find_all('input', attrs={'type': 'password'})
    password_count = len(password_inputs)

    script_tags = soup.find_all('script')
    script_count = len(script_tags)

    # Links analysis
    all_links = soup.find_all('a', href=True)
    total_links = len(all_links)

    target_domain = urlparse(final_url).netloc.lower()
    external_links = 0
    for link in all_links:
        href = link['href']
        parsed_href = urlparse(href)
        if parsed_href.netloc and parsed_href.netloc.lower() != target_domain:
            external_links += 1

    # Text content extraction for NLP
    for script_or_style in soup(['script', 'style', 'noscript', 'meta', 'link']):
        script_or_style.decompose()
        
    raw_text = soup.get_text(separator=' ', strip=True)
    # Limit text length to prevent overload on massive pages
    extracted_text = raw_text[:10000]
    
    page_text_lower = extracted_text.lower()
    detected_phrases = [phrase for phrase in SUSPICIOUS_TEXT_PHRASES if phrase in page_text_lower]

    # Evaluate Webpage Findings & Preliminary Score
    findings = []
    penalty = 0

    if redirect_count > 0:
        findings.append(f"Request underwent {redirect_count} redirect(s) to reach final URL.")
        if redirect_count >= 3:
            penalty += 10

    if password_count > 0:
        findings.append(f"Page contains {password_count} password input field(s).")
        if not final_url.startswith('https://'):
            penalty += 40
            findings.append("CRITICAL: Password input field served over insecure HTTP!")
        if external_links > 0 and total_links > 0 and (external_links / total_links) > 0.5:
            penalty += 15
            findings.append("High ratio of external links on a page requesting login/credentials.")

    if detected_phrases:
        penalty += min(30, len(detected_phrases) * 10)
        findings.append(f"Suspicious security/urgent text phrases detected in visible page: {', '.join(detected_phrases)}")

    if form_count > 0 and not findings:
        findings.append(f"Page contains {form_count} form(s).")

    if not findings:
        findings.append("Webpage structure analyzed. No immediate structural anomalies detected.")

    preliminary_score = min(100, max(0, penalty))

    return {
        "available": True,
        "error": None,
        "score": preliminary_score,
        "findings": findings,
        "features": {
            "status_code": status_code,
            "final_url": final_url,
            "redirect_count": redirect_count,
            "response_time_ms": elapsed_ms,
            "content_type": content_type,
            "is_html": True,
            "page_title": page_title,
            "form_count": form_count,
            "password_count": password_count,
            "total_links": total_links,
            "external_links": external_links,
            "script_count": script_count,
            "detected_phrases": detected_phrases,
            "extracted_text": extracted_text
        }
    }
