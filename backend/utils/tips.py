TIPS = {
    "url": {
        "DANGEROUS": [
            "Do not click or open this link under any circumstances",
            "Report this URL to your bank or the impersonated organization",
            "Clear your browser history if you accidentally visited it",
            "Never enter personal details or OTP on suspicious pages",
        ],
        "SUSPICIOUS": [
            "Verify the official domain before entering any credentials",
            "Look for HTTPS and a valid SSL certificate (padlock icon)",
            "Contact the organization directly via their official website",
            "Do not enter passwords or financial details on this page",
        ],
        "SAFE": [
            "Always double-check URLs before entering sensitive information",
            "Keep your browser and security software updated",
            "Enable two-factor authentication on important accounts",
        ],
    },
    "screenshot": {
        "DANGEROUS": [
            "This message appears to be a scam — do not act on it",
            "Never share OTPs, PINs, or passwords in response to such messages",
            "Block and report the sender immediately",
            "Forward to cybercrime helpline: 1930",
        ],
        "SUSPICIOUS": [
            "Verify the sender's identity through official channels",
            "Legitimate organizations never ask for OTPs via message",
            "Do not click any links in this message",
        ],
        "SAFE": [
            "Stay vigilant — scammers constantly evolve their tactics",
            "Never share OTPs with anyone, including bank officials",
        ],
    },
    "qr": {
        "DANGEROUS": [
            "Do not scan this QR code again — it leads to a malicious URL",
            "Report tampered QR codes to the venue or organization",
            "If scanned accidentally, clear your browser cache immediately",
            "Never make payments via QR codes you did not request",
        ],
        "SUSPICIOUS": [
            "Verify the destination URL before completing any transaction",
            "Only use QR codes from trusted, official sources",
            "Avoid scanning QR codes in public places without verification",
        ],
        "SAFE": [
            "Always review the URL after scanning before proceeding",
            "Prefer official apps over QR-based payment flows",
        ],
    },
    "otp": {
        "DANGEROUS": [
            "Never share this OTP with anyone — your bank will never ask for it",
            "Block the sender number immediately",
            "If you shared an OTP, contact your bank's fraud helpline now",
            "File a complaint at cybercrime.gov.in or call 1930",
        ],
        "SUSPICIOUS": [
            "Legitimate services never urgently demand OTPs via SMS",
            "Verify any account activity directly through your banking app",
            "Do not call back numbers mentioned in suspicious messages",
        ],
        "SAFE": [
            "Keep OTPs private — they expire quickly and are one-time only",
            "Enable notifications for all banking transactions",
        ],
    },
    "upi": {
        "DANGEROUS": [
            "Do not proceed with this UPI transaction",
            "Report this UPI ID to your payment app's fraud team",
            "Block the requester immediately",
            "If money was transferred, contact your bank within 24 hours",
        ],
        "SUSPICIOUS": [
            "Verify the recipient's identity before sending money",
            "Official merchants use verified UPI IDs — check for the blue tick",
            "Never pay upfront fees to receive a prize or refund",
        ],
        "SAFE": [
            "Always verify the recipient name before confirming payment",
            "Keep your UPI PIN strictly confidential",
        ],
    },
    "voice": {
        "DANGEROUS": [
            "Hang up immediately — this is a scam call pattern",
            "Real police, CBI, or courts never demand money over phone",
            "Do not transfer any money under threat or urgency",
            "Report to cybercrime helpline: 1930 or cybercrime.gov.in",
        ],
        "SUSPICIOUS": [
            "Verify caller identity by calling the official organization number",
            "Take time to think — scammers create artificial urgency",
            "Discuss with a trusted family member before taking any action",
        ],
        "SAFE": [
            "Stay alert — scammers often pretend to be government officials",
            "Register on TRAI DND to reduce spam calls",
        ],
    },
}

def get_tips(feature: str, verdict: str) -> list:
    return TIPS.get(feature, {}).get(verdict, [
        "Stay vigilant and verify all communications",
        "When in doubt, contact the organization directly via official channels",
    ])
