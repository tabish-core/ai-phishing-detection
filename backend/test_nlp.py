"""Quick test script for nlp_analyzer.py"""
import sys
sys.path.insert(0, '.')
from analyzers.nlp_analyzer import analyze_text

def test(name, text):
    result = analyze_text(text)
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"Score: {result['score']} | Risk: {result['risk_level']}")
    print(f"Categories: {result['categories']}")
    print(f"Phrases: {result['matched_phrases']}")
    for f in result['findings']:
            print(f"  - {f}")

# 1. Normal text
test("Normal informational text",
     "Welcome to our website. We provide cloud hosting services and documentation for developers.")

# 2. Legitimate login page
test("Legitimate login page",
     "Sign in to your account using your username and password.")

# 3. Suspicious verification
test("Suspicious verification language",
     "Urgent! Verify your account immediately or your account will be suspended.")

# 4. Financial phishing
test("Financial phishing text",
     "Confirm your bank account and payment information immediately. Urgent action required.")

# 5. Empty text
test("Empty text", "")

# 6. Combined threats + credentials
test("Threats + Credentials combo",
     "Your account has been locked due to unauthorized activity. Enter your password to verify your identity.")

print("\n\nAll tests completed successfully.")
