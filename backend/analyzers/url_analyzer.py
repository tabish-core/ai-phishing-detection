import re
import ipaddress
from urllib.parse import urlparse

# Common URL Shortening Domains
SHORTENER_DOMAINS = {
    'bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'ow.ly',
    'buff.ly', 'adf.ly', 'bit.do', 'cutt.ly', 'rb.gy'
}

# Suspicious keywords indicative of potential credential harvesting or phishing
SUSPICIOUS_KEYWORDS = [
    'login', 'verify', 'verification', 'account', 'secure', 'update',
    'password', 'banking', 'signin', 'auth', 'webmail', 'confirm', 'wallet',
    'credential', 'service-update', 'account-security'
]

def is_ip_address(hostname: str) -> bool:
    """Check if string is a valid IPv4 address."""
    try:
        ipaddress.IPv4Address(hostname)
        return True
    except ValueError:
        return False

def validate_and_check_ssrf(parsed_url):
    """
    Validates URL scheme and checks for potential SSRF targets.
    Rejects localhost, 127.0.0.1, private IP ranges, link-local, and internal hostnames.
    """
    scheme = parsed_url.scheme.lower()
    if scheme not in ('http', 'https'):
        return False, f"Unsupported protocol '{scheme}:'. Only HTTP and HTTPS are allowed."

    hostname = parsed_url.hostname
    if not hostname:
        return False, "Invalid URL structure: Missing hostname."

    hostname_lower = hostname.lower()

    # Block obvious local hostnames
    if hostname_lower in ('localhost', '0.0.0.0') or hostname_lower.endswith(('.local', '.internal', '.lan')):
        return False, f"Access to internal host '{hostname}' is blocked for security (SSRF prevention)."

    # Check IP literal ranges
    if is_ip_address(hostname_lower):
        ip = ipaddress.IPv4Address(hostname_lower)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_unspecified:
            return False, f"Access to private/internal IP address '{hostname}' is blocked for security (SSRF prevention)."

    return True, None

def analyze_url(raw_url: str) -> dict:
    """
    Analyzes URL characteristics and calculates a preliminary URL risk score.
    Returns structured findings and feature flags.
    """
    if not raw_url.startswith(('http://', 'https://')):
        url_to_parse = 'https://' + raw_url
    else:
        url_to_parse = raw_url

    try:
        parsed = urlparse(url_to_parse)
    except Exception as e:
        return {
            "error": f"Failed to parse URL: {str(e)}",
            "score": 0,
            "findings": ["Malformed URL string."],
            "features": {}
        }

    # Step 1: Security & SSRF Validation
    is_safe, ssrf_reason = validate_and_check_ssrf(parsed)
    if not is_safe:
        return {
            "error": ssrf_reason,
            "blocked": True,
            "score": 100,
            "findings": [f"SECURITY BLOCK: {ssrf_reason}"],
            "features": {"is_ssrf_blocked": True}
        }

    hostname = parsed.hostname.lower() if parsed.hostname else ""
    path_and_query = parsed.path + ("?" + parsed.query if parsed.query else "")

    findings = []
    penalty = 0

    # 1. Scheme Check (HTTP vs HTTPS)
    is_https = parsed.scheme.lower() == 'https'
    if not is_https:
        penalty += 15
        findings.append("URL uses unencrypted HTTP protocol instead of HTTPS.")
    else:
        findings.append("URL uses encrypted HTTPS protocol.")

    # 2. IP Address Hostname
    has_ip_hostname = is_ip_address(hostname)
    if has_ip_hostname:
        penalty += 35
        findings.append(f"Hostname is a raw IP address ({hostname}) rather than a domain name.")

    # 3. URL Length
    url_len = len(url_to_parse)
    if url_len > 100:
        penalty += 15
        findings.append(f"Unusually long URL structure ({url_len} characters).")
    elif url_len > 75:
        penalty += 10
        findings.append(f"Moderately long URL structure ({url_len} characters).")

    # 4. Subdomain Complexity
    domain_parts = [p for p in hostname.split('.') if p != 'www']
    subdomain_count = max(0, len(domain_parts) - 2)
    if subdomain_count >= 3:
        penalty += 20
        findings.append(f"High subdomain depth detected ({subdomain_count} subdomains).")
    elif subdomain_count == 2:
        penalty += 10
        findings.append("Multiple subdomains present in hostname.")

    # 5. Suspicious Symbols
    if '@' in url_to_parse:
        penalty += 25
        findings.append("URL contains '@' symbol, often used in credential embedding or URL redirection tricks.")

    hyphen_count = hostname.count('-')
    if hyphen_count >= 3:
        penalty += 15
        findings.append(f"Excessive hyphens in hostname ({hyphen_count} hyphens).")

    if '%' in path_and_query:
        penalty += 10
        findings.append("URL contains URL-encoded characters.")

    # 6. URL Shortener Detection
    is_shortener = hostname in SHORTENER_DOMAINS
    if is_shortener:
        penalty += 25
        findings.append(f"Known URL shortening service detected ({hostname}).")

    # 7. Suspicious Keywords
    detected_keywords = [kw for kw in SUSPICIOUS_KEYWORDS if kw in url_to_parse.lower()]
    if detected_keywords:
        kw_penalty = min(30, len(detected_keywords) * 10)
        penalty += kw_penalty
        findings.append(f"Suspicious security/authentication keywords found in URL: {', '.join(detected_keywords)}")

    # Score bounded 0 to 100
    preliminary_score = min(100, max(0, penalty))

    return {
        "error": None,
        "blocked": False,
        "score": preliminary_score,
        "findings": findings,
        "features": {
            "is_https": is_https,
            "has_ip_hostname": has_ip_hostname,
            "url_length": url_len,
            "subdomain_count": subdomain_count,
            "is_shortener": is_shortener,
            "hyphen_count": hyphen_count,
            "has_at_symbol": '@' in url_to_parse,
            "detected_keywords": detected_keywords
        }
    }
