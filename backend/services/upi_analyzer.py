import re
from utils.confidence import clamp, score_to_verdict

VALID_UPI_PATTERN = re.compile(r"^[\w.\-]+@[\w.\-]+$")
KNOWN_FRAUD_HANDLES = [
    "paytm-support", "sbi-help", "hdfc-care", "icici-care", "phonepe-help",
    "googlepay-support", "npci-help", "rbi-official", "refund", "cashback",
    "lottery", "winner", "prize", "reward",
]
SUSPICIOUS_WORDS_IN_UPI = [
    "refund", "cashback", "prize", "winner", "lottery", "support", "help",
    "official", "care", "customer", "service", "verify", "kyc", "update",
    "alert", "secure", "safety", "fraud", "crime", "cyber",
]
SUSPICIOUS_MSG_PATTERNS = [
    r"collect.{0,30}money", r"send.{0,30}₹", r"transfer.{0,30}₹",
    r"pay.{0,20}to.{0,20}claim", r"small.{0,20}fee", r"processing.{0,20}fee",
    r"registration.{0,20}fee", r"advance.{0,20}payment", r"token.{0,20}amount",
    r"pay.{0,20}first", r"send.{0,20}₹?\d+", r"receive.{0,30}lakh",
]

def analyze_upi(upi_id: str, message: str = "") -> dict:
    flags = []
    score = 0
    upi_lower = upi_id.lower().strip()
    msg_lower = message.lower() if message else ""

    # Format validation
    if not VALID_UPI_PATTERN.match(upi_id):
        score += 20
        flags.append("invalid_upi_format")

    parts = upi_lower.split("@")
    handle = parts[0] if parts else upi_lower
    vpa = parts[1] if len(parts) > 1 else ""

    # Known fraud handle patterns
    for fraud_handle in KNOWN_FRAUD_HANDLES:
        if fraud_handle in handle:
            score += 40
            flags.append(f"fraud_handle_pattern:{fraud_handle}")
            break

    # Suspicious words in UPI handle
    sus_words = [w for w in SUSPICIOUS_WORDS_IN_UPI if w in handle]
    if sus_words:
        score += min(30, len(sus_words) * 10)
        flags.append(f"suspicious_handle_words:{','.join(sus_words[:3])}")

    # Numeric-heavy handle (random numbers often indicate temp/fraud accounts)
    digit_count = sum(c.isdigit() for c in handle)
    if digit_count > 6:
        score += 15
        flags.append("numeric_heavy_handle")

    # VPA checks
    suspicious_vpas = ["ybl", "okhdfcbank", "okicici", "oksbi", "okaxis"]
    legitimate_vpas = ["paytm", "upi", "apl", "ibl", "rajpay", "freecharge"]
    if vpa and vpa not in legitimate_vpas and vpa not in suspicious_vpas:
        # Unknown VPA is mildly suspicious in certain contexts
        pass

    # Message analysis
    if message:
        msg_pattern_hits = sum(1 for p in SUSPICIOUS_MSG_PATTERNS if re.search(p, msg_lower))
        if msg_pattern_hits:
            score += min(35, msg_pattern_hits * 12)
            flags.append(f"suspicious_message_patterns:{msg_pattern_hits}")

        # Advance fee fraud signals
        if re.search(r"pay.{0,20}first.{0,30}(receive|get|claim)", msg_lower):
            score += 30
            flags.append("advance_fee_pattern")

        # Too-good-to-be-true amounts
        if re.search(r"₹?\s*[1-9]\d{4,}", msg_lower):
            score += 10
            flags.append("large_amount_mentioned")

    score = clamp(score)
    verdict = score_to_verdict(score)
    explanation = _build_explanation(verdict, flags, upi_id)

    return {
        "verdict": verdict,
        "confidence": round(score, 1),
        "explanation": explanation,
        "flags": flags,
        "upi_id": upi_id,
        "handle": handle,
        "vpa": vpa,
    }

def _build_explanation(verdict: str, flags: list, upi_id: str) -> str:
    if verdict == "SAFE":
        return f"The UPI ID '{upi_id}' appears to follow a legitimate format and does not match known fraud patterns."

    reasons = []
    for flag in flags:
        if flag.startswith("fraud_handle_pattern"):
            reasons.append(f"the handle matches a known fraud pattern ({flag.split(':')[1]})")
        if flag.startswith("suspicious_handle_words"):
            reasons.append("contains words like 'support', 'refund', or 'official' — scammers add these to appear legitimate")
        if flag == "invalid_upi_format":
            reasons.append("does not follow the standard UPI ID format (name@bank)")
        if flag.startswith("suspicious_message_patterns"):
            reasons.append("the accompanying message asks you to pay upfront to receive money — a classic advance-fee scam")
        if flag == "advance_fee_pattern":
            reasons.append("asks you to send money first in order to 'receive' a larger amount — this is always a scam")

    tier = "a likely fraudulent UPI ID" if verdict == "DANGEROUS" else "a suspicious UPI ID"
    return (
        f"'{upi_id}' is {tier}. It {'; '.join(reasons[:3])}. "
        "Never pay a 'processing fee' or 'advance amount' to receive money. Legitimate transactions never work this way."
    )
