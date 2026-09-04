import re

NLP_CATEGORIES = {
    "URGENCY": [
        "urgent", "immediately", "act now", "action required",
        "don't wait", "expires today", "do it now", "within 24 hours"
    ],
    "ACCOUNT_VERIFICATION": [
        "verify your account", "verify your identity", "confirm your account",
        "confirm your identity", "account verification", "security verification",
        "validate your account"
    ],
    "CREDENTIALS": [
        "password", "username", "login", "sign in", "credentials",
        "enter your password", "auth code", "two-factor", "2fa"
    ],
    "THREATS": [
        "account suspended", "account locked", "access will be removed",
        "account will be closed", "security breach", "unauthorized activity",
        "restricted access", "will be permanently deleted"
    ],
    "FINANCIAL": [
        "payment", "bank account", "credit card", "debit card",
        "billing information", "transaction", "invoice", "wire transfer"
    ],
    "TRUST": [
        "security alert", "unusual activity", "suspicious activity",
        "confirm now", "protected account", "trusted device"
    ]
}

def analyze_text(text: str) -> dict:
    if not text or not text.strip():
        return {
            "score": 0,
            "risk_level": "LOW",
            "findings": ["No webpage text available for NLP analysis."],
            "categories": [],
            "matched_phrases": []
        }

    # Normalize text: lowercase and normalize spaces
    normalized_text = re.sub(r'\s+', ' ', text.lower())

    detected_categories = set()
    matched_phrases = set()

    # Find matches
    for category, phrases in NLP_CATEGORIES.items():
        for phrase in phrases:
            # We use word boundaries to avoid partial matches
            pattern = r'\b' + re.escape(phrase) + r'\b'
            if re.search(pattern, normalized_text):
                detected_categories.add(category)
                matched_phrases.add(phrase)

    detected_categories = list(detected_categories)
    matched_phrases = list(matched_phrases)
    findings = []
    penalty = 0

    # Contextual Scoring
    # Base penalties for single categories
    if "CREDENTIALS" in detected_categories:
        penalty += 10
    if "FINANCIAL" in detected_categories:
        penalty += 10
    if "URGENCY" in detected_categories:
        penalty += 15
    if "TRUST" in detected_categories:
        penalty += 15
    if "ACCOUNT_VERIFICATION" in detected_categories:
        penalty += 15
    if "THREATS" in detected_categories:
        penalty += 20
    
    # Contextual combinations (higher penalties)
    if "URGENCY" in detected_categories and "ACCOUNT_VERIFICATION" in detected_categories:
        penalty += 35
        findings.append("High Risk Context: Urgency combined with account verification.")
        
    if "THREATS" in detected_categories and "CREDENTIALS" in detected_categories:
        penalty += 40
        findings.append("High Risk Context: Threats combined with credential requests.")

    if "THREATS" in detected_categories and "ACCOUNT_VERIFICATION" in detected_categories:
        penalty += 40
        findings.append("High Risk Context: Threats combined with account verification.")
        
    if "FINANCIAL" in detected_categories and "URGENCY" in detected_categories:
        penalty += 30
        findings.append("High Risk Context: Urgent financial actions requested.")

    # Weak indicators standalone finding
    if not findings and matched_phrases:
        findings.append("Some weak linguistic indicators detected, but lacking strong contextual phishing combinations.")

    if not matched_phrases:
        findings.append("No common phishing linguistic patterns detected in visible text.")

    score = min(100, penalty)
    
    if score < 25:
        risk_level = "LOW"
    elif score < 60:
        risk_level = "MEDIUM"
    else:
        risk_level = "HIGH"

    return {
        "score": score,
        "risk_level": risk_level,
        "findings": findings,
        "categories": detected_categories,
        "matched_phrases": matched_phrases
    }
