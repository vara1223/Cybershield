"""
STEP 2+3 — AuthN Bypass
Every endpoint hit with: no token, malformed token, expired token.
2xx on a "should-require-auth" endpoint = FINDING.
"""
import sys, time
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from dast_helpers import http, record, save, sym

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
CAT  = "02_authn_bypass"

# All endpoints that *should* require auth (per spec / best practice).
# In this API there is currently NO auth layer — we flag that itself.
PROTECTED = [
    ("GET",  "/admin/logs",       None),
    ("GET",  "/admin/stats",      None),
    ("GET",  "/admin/export/csv", None),
]
ANALYZE_ENDPOINTS = [
    ("POST", "/analyze/url",        {"url": "https://google.com"}),
    ("POST", "/analyze/screenshot", {"image": "aGVsbG8="}),
    ("POST", "/analyze/qr",         {"decoded_content": "test"}),
    ("POST", "/analyze/otp",        {"message": "test"}),
    ("POST", "/analyze/upi",        {"upi_id": "test@upi"}),
    ("POST", "/analyze/voice",      {"audio": "aGVsbG8=", "format": "wav"}),
]

AUTH_VARIANTS = [
    ("no_token",       {}),
    ("malformed_jwt",  {"Authorization": "Bearer not.a.valid.jwt.at.all"}),
    ("expired_jwt",    {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0Iiwicm9sZSI6ImFkbWluIiwiZXhwIjoxfQ.EXPIRED_SIG"}),
    ("random_bearer",  {"Authorization": "Bearer AAAA-BBBB-CCCC-1234"}),
]

results = []
print(f"\n=== AUTH-N BYPASS  target={BASE} ===\n")

all_endpoints = PROTECTED + ANALYZE_ENDPOINTS

for method, path, body in all_endpoints:
    for variant_name, hdrs in AUTH_VARIANTS:
        url = BASE + path
        status, raw, ms = http(method, url, body=body, headers=hdrs)
        # If the API returns 2xx without a valid token it's a bypass
        finding  = (status in range(200, 300))
        severity = "CRITICAL" if (path.startswith("/admin") and finding) else \
                   "HIGH"     if finding else "INFO"
        note = (
            f"AUTHN BYPASS: endpoint returned {status} with {variant_name}"
            if finding else
            f"OK: {status} with {variant_name}"
        )
        r = record(path, method, variant_name, status, 401, finding, severity, ms, CAT, note)
        results.append(r)
        print(f"  {sym(finding)} [{method:4}] {path:28} | {variant_name:20} -> {status} ({ms}ms)")
        time.sleep(0.05)

# Extra: admin endpoints with no auth at all — flag once clearly
print("\n  -- Admin endpoint open-access summary --")
for method, path, body in PROTECTED:
    url = BASE + path
    status, raw, ms = http(method, url, body=body)
    finding  = status in range(200, 300)
    severity = "CRITICAL" if finding else "INFO"
    note = (
        "CRITICAL: Admin endpoint accessible with NO authentication"
        if finding else f"Returned {status}"
    )
    r = record(path, method, "unauthenticated", status, 401, finding, severity, ms, CAT, note)
    results.append(r)
    print(f"  {sym(finding)} [{method:4}] {path:28} -> {status}  {note}")
    time.sleep(0.05)

save(results, CAT)
