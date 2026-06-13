import re
from utils.confidence import clamp, score_to_verdict

URGENCY_KEYWORDS = [
    "urgent", "immediately", "right now", "asap", "expire", "expired", "last chance",
    "final warning", "suspended", "blocked", "locked", "compromised", "unauthorized",
    "action required", "act now", "within 24 hours", "within 1 hour",
]
OTP_SCAM_PATTERNS = [
    r"\botp\b", r"\bone.?time.?password\b", r"share.{0,20}otp",
    r"otp.{0,20}(share|send|provide|give)", r"do not share.{0,10}otp",
]
FAKE_AUTHORITY = [
    "rbi governor", "sbi head office", "income tax department", "cbi officer",
    "cybercrime", "police", "court", "judiciary", "enforcement directorate", "ed officer",
    "customs", "airport authority", "trai", "uidai", "aadhaar authority",
]
BANK_IMPERSONATION = [
    "your account", "your sbi", "your hdfc", "your icici", "your axis",
    "your kotak", "dear customer", "dear user", "dear valued", "esteemed customer",
    "kyc update", "kyc verification", "kyc pending", "re-kyc",
]
MONEY_DEMAND = [
    r"transfer.{0,30}₹", r"send.{0,30}₹", r"pay.{0,30}₹",
    r"deposit.{0,30}₹", r"₹\s*\d+", r"rs\.?\s*\d+",
    r"lakh", r"crore", r"fine of", r"penalty of",
]
PRIZE_SCAM = [
    "congratulations", "you have won", "winner", "selected", "lucky draw",
    "lottery", "prize money", "claim your", "free gift", "cashback of",
]

def analyze_otp(message: str) -> dict:
    text = message.lower()
    flags = []
    score = 0

    # OTP sharing patterns
    otp_matches = sum(1 for p in OTP_SCAM_PATTERNS if re.search(p, text))
    if otp_matches:
        score += 30 * otp_matches
        flags.append(f"otp_sharing_pattern:{otp_matches}")

    # Urgency language
    urgency_hits = [kw for kw in URGENCY_KEYWORDS if kw in text]
    if urgency_hits:
        score += min(25, len(urgency_hits) * 8)
        flags.append(f"urgency_language:{len(urgency_hits)}")

    # Fake authority
    auth_hits = [a for a in FAKE_AUTHORITY if a in text]
    if auth_hits:
        score += 35
        flags.append(f"fake_authority:{auth_hits[0]}")

    # Bank impersonation
    bank_hits = [b for b in BANK_IMPERSONATION if b in text]
    if bank_hits:
        score += 20
        flags.append(f"bank_impersonation:{len(bank_hits)}")

    # Money demand
    money_matches = sum(1 for p in MONEY_DEMAND if re.search(p, text))
    if money_matches:
        score += 25
        flags.append(f"money_demand:{money_matches}")

    # Prize/lottery scam
    prize_hits = [p for p in PRIZE_SCAM if p in text]
    if prize_hits:
        score += 30
        flags.append(f"prize_scam:{len(prize_hits)}")

    # Suspicious links in message
    if re.search(r"https?://", text):
        score += 10
        flags.append("contains_link")

    # Suspicious phone numbers
    if re.search(r"\+?[6-9]\d{9}", text):
        score += 5
        flags.append("contains_phone")

    score = clamp(score)
    verdict = score_to_verdict(score)
    explanation = _build_explanation(verdict, flags, message[:100])

    return {
        "verdict": verdict,
        "confidence": round(score, 1),
        "explanation": explanation,
        "flags": flags,
        "message_preview": message[:100] + ("..." if len(message) > 100 else ""),
    }

def _build_explanation(verdict: str, flags: list, preview: str) -> str:
    if verdict == "SAFE":
        return "This message does not match known OTP scam or phishing patterns. It appears to be a legitimate notification."

    reasons = []
    for flag in flags:
        if flag.startswith("otp_sharing_pattern"):
            reasons.append("asks you to share or confirm an OTP — legitimate services never ask for OTPs over SMS")
        if flag.startswith("urgency_language"):
            reasons.append("uses artificial urgency to pressure you into acting without thinking")
        if flag.startswith("fake_authority"):
            reasons.append(f"impersonates a government or law enforcement authority ({flag.split(':')[1]})")
        if flag.startswith("bank_impersonation"):
            reasons.append("impersonates a bank or financial institution using generic 'dear customer' language")
        if flag.startswith("money_demand"):
            reasons.append("contains a money demand or transfer request")
        if flag.startswith("prize_scam"):
            reasons.append("claims you've won a prize or lottery — a classic advance-fee scam tactic")

    tier = "a high-confidence scam message" if verdict == "DANGEROUS" else "a suspicious message"
    return (
        f"This is {tier}. It {'; '.join(reasons[:3])}. "
        "Never share OTPs, PINs, or personal information in response to such messages."
    )
