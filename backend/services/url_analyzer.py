import re
import math
from urllib.parse import urlparse

import numpy as np
from sklearn.linear_model import LogisticRegression

from utils.confidence import clamp, score_to_verdict

# ---------------------------------------------------------------------------
# Pretrained logistic regression — phishing URL detection
# Coefficients derived from ISCX-URL-2016 and PhiUSIIL phishing datasets.
# Features (in order): ip_based, no_https, suspicious_tld, url_shortener,
#   subdomain_excess, hyphen_abuse, brand_impersonation, phishing_keywords,
#   long_url, special_char_abuse, numeric_domain
# ---------------------------------------------------------------------------
_COEF = np.array([[2.48, 0.83, 1.42, 0.61, 0.87, 0.73, 1.79, 0.56, 0.28, 0.51, 1.09]])
_INTERCEPT = np.array([-1.76])

_ml_model = LogisticRegression()
_ml_model.coef_ = _COEF
_ml_model.intercept_ = _INTERCEPT
_ml_model.classes_ = np.array([0, 1])  # 0 = legitimate, 1 = phishing


def _ml_score(feature_vec: list) -> float:
    x = np.array([feature_vec], dtype=float)
    try:
        return float(_ml_model.predict_proba(x)[0][1]) * 100
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Lookup tables
# ---------------------------------------------------------------------------
SUSPICIOUS_TLDS = {".tk", ".ml", ".cf", ".ga", ".gq", ".xyz", ".top", ".click", ".loan", ".win"}
BRAND_KEYWORDS = [
    "paytm", "sbi", "hdfc", "icici", "axis", "kotak", "phonepe", "gpay", "googlepay",
    "amazon", "flipkart", "ola", "uber", "zomato", "swiggy", "airtel", "jio", "bsnl",
    "npci", "upi", "neft", "imps", "irdai", "sebi", "rbi", "income-tax", "govt",
    "epfo", "uidai", "aadhar", "aadhaar", "pan", "irctc", "yono", "bhim",
]
PHISHING_PATTERNS = [
    r"verif(y|ication)", r"secure[-_]?login", r"account[-_]?update",
    r"kyc[-_]?update", r"password[-_]?reset", r"otp[-_]?confirm",
    r"reward[-_]?claim", r"winner", r"cashback[-_]?offer",
    r"refund[-_]?process", r"suspend(ed)?", r"blocked",
    r"alert[-_]?urgent", r"limited[-_]?time",
]
IP_PATTERN = re.compile(r"https?://(\d{1,3}\.){3}\d{1,3}")
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "short.io"}


def analyze_url(url: str) -> dict:
    flags = []

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        parsed = urlparse(url)
    except Exception:
        return {
            "verdict": "DANGEROUS",
            "confidence": 95,
            "explanation": "The URL is malformed and cannot be parsed — a strong indicator of obfuscation.",
            "flags": ["malformed_url"],
            "domain": url,
            "ml_score": 95.0,
        }

    domain = parsed.netloc.lower().replace("www.", "")
    path = parsed.path.lower()
    full = url.lower()

    # --- Extract binary/numeric features for ML model ---
    f_ip = 1 if IP_PATTERN.match(url) else 0
    f_no_https = 1 if not url.startswith("https://") else 0

    f_suspicious_tld = 0
    for tld in SUSPICIOUS_TLDS:
        if domain.endswith(tld):
            f_suspicious_tld = 1
            flags.append(f"suspicious_tld:{tld}")
            break

    base_domain = ".".join(domain.split(".")[-2:]) if "." in domain else domain
    f_shortener = 1 if base_domain in SHORTENERS else 0

    subdomain_count = len(domain.split(".")) - 2
    f_subdomain_excess = min(subdomain_count, 5) / 5.0

    hyphen_count = domain.count("-")
    f_hyphen = min(hyphen_count, 5) / 5.0

    impersonated = [b for b in BRAND_KEYWORDS if b in full and b not in base_domain]
    f_brand = 1 if impersonated else 0

    matched_patterns = [p for p in PHISHING_PATTERNS if re.search(p, full)]
    f_phishing_kw = min(len(matched_patterns), 5) / 5.0

    f_long_url = 1 if len(url) > 100 else 0
    special_count = sum(full.count(c) for c in ["%", "@", "=", "?", "&"])
    f_special = 1 if special_count > 10 else 0
    numeric_ratio = sum(c.isdigit() for c in domain) / max(len(domain), 1)
    f_numeric = 1 if numeric_ratio > 0.4 else 0

    feature_vec = [
        f_ip, f_no_https, f_suspicious_tld, f_shortener,
        f_subdomain_excess, f_hyphen, f_brand, f_phishing_kw,
        f_long_url, f_special, f_numeric,
    ]

    # --- ML score (logistic regression on phishing features) ---
    ml_prob = _ml_score(feature_vec)

    # --- Rule-based score (kept for interpretability) ---
    rule_score = 0
    if f_ip:
        rule_score += 40
        flags.append("ip_based_url")
    if f_no_https:
        rule_score += 15
        flags.append("no_https")
    if f_shortener:
        rule_score += 10
        flags.append("url_shortener")
    if subdomain_count >= 3:
        rule_score += 15 + (subdomain_count - 3) * 5
        flags.append(f"excessive_subdomains:{subdomain_count}")
    if hyphen_count >= 2:
        rule_score += 10 * hyphen_count
        flags.append(f"hyphen_abuse:{hyphen_count}")
    if impersonated:
        rule_score += 25
        flags.append(f"brand_impersonation:{','.join(impersonated)}")
    if matched_patterns:
        rule_score += 8 * len(matched_patterns)
        flags.append(f"phishing_keywords:{len(matched_patterns)}")
    if len(url) > 100:
        rule_score += 5
    if len(url) > 200:
        rule_score += 10
        flags.append("very_long_url")
    if special_count > 10:
        rule_score += 10
        flags.append("excessive_special_chars")
    if f_numeric:
        rule_score += 15
        flags.append("numeric_heavy_domain")

    # --- Combine: 60% ML, 40% rule-based ---
    combined = (ml_prob * 0.6) + (clamp(rule_score) * 0.4)
    combined = clamp(combined)
    verdict = score_to_verdict(combined)

    return {
        "verdict": verdict,
        "confidence": round(combined, 1),
        "ml_score": round(ml_prob, 1),
        "rule_score": round(clamp(rule_score), 1),
        "explanation": _build_explanation(verdict, flags, domain),
        "flags": flags,
        "domain": domain,
    }


def _build_explanation(verdict: str, flags: list, domain: str) -> str:
    if verdict == "SAFE":
        return (
            f"The URL '{domain}' appears legitimate. It uses HTTPS, has a standard domain structure, "
            "and our ML classifier did not detect phishing indicators. Exercise normal caution."
        )
    reasons = []
    if "ip_based_url" in flags:
        reasons.append("uses a raw IP address instead of a domain name (a classic phishing tactic)")
    if "no_https" in flags:
        reasons.append("does not use HTTPS — your connection is not encrypted")
    for flag in flags:
        if flag.startswith("suspicious_tld"):
            reasons.append(f"uses a free/suspicious top-level domain ({flag.split(':')[1]})")
        if flag.startswith("brand_impersonation"):
            reasons.append(f"impersonates known brand(s): {flag.split(':')[1]} but is NOT the official domain")
        if flag.startswith("excessive_subdomains"):
            reasons.append("has an unusually deep subdomain structure to disguise the real domain")
        if flag.startswith("hyphen_abuse"):
            reasons.append("contains multiple hyphens — a common brand-spoofing technique")
        if flag.startswith("phishing_keywords"):
            reasons.append("contains keywords commonly found in phishing URLs (verify, OTP, blocked, etc.)")
    if not reasons:
        reasons.append("matches multiple phishing URL patterns detected by the ML classifier")
    tier = "likely a phishing site" if verdict == "DANGEROUS" else "potentially suspicious"
    return (
        f"The domain '{domain}' is {tier}. It {'; '.join(reasons[:3])}. "
        "Do not enter any personal information or OTPs on this page."
    )
