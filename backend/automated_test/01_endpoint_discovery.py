"""
STEP 1 — Endpoint Discovery
Hits OpenAPI docs and enumerates all routes.
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout,'reconfigure') else None
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from dast_helpers import http, record, save, sym

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
CAT  = "01_endpoint_discovery"

# Full manually-enumerated endpoint list (from codebase analysis)
ENDPOINTS = [
    # (method, path, description, public)
    ("GET",  "/health",            "System health check",        True),
    ("POST", "/analyze/url",       "URL scan",                   True),
    ("POST", "/analyze/screenshot","Screenshot OCR scan",        True),
    ("POST", "/analyze/qr",        "QR code scan",               True),
    ("POST", "/analyze/otp",       "OTP message scan",           True),
    ("POST", "/analyze/upi",       "UPI fraud scan",             True),
    ("POST", "/analyze/voice",     "Voice audio scan",           True),
    ("GET",  "/admin/logs",        "Admin: paginated scan logs", True),
    ("GET",  "/admin/stats",       "Admin: aggregate stats",     True),
    ("GET",  "/admin/export/csv",  "Admin: export all logs CSV", True),
    # Swagger / OpenAPI
    ("GET",  "/docs",             "Swagger UI",                  True),
    ("GET",  "/openapi.json",     "OpenAPI spec",                True),
    ("GET",  "/redoc",            "ReDoc UI",                    True),
]

# Also probe common undiscovered paths
PROBE_PATHS = [
    "/v1/", "/api/", "/api/v1/", "/.env", "/config",
    "/admin", "/admin/", "/admin/users", "/admin/delete",
    "/debug", "/internal", "/metrics",
]

results = []
print(f"\n=== ENDPOINT DISCOVERY  target={BASE} ===\n")

print("  Known endpoints (from codebase):")
for method, path, desc, pub in ENDPOINTS:
    url  = BASE + path
    body = {"url": "https://test.com"} if path == "/analyze/url" else None
    status, raw, ms = http(method, url, body=body)
    reachable = status not in (0,)
    finding   = False  # discovery only
    r = record(path, method, "public", status, 200, finding, "INFO", ms, CAT,
               f"Discovered: {desc} | reachable={reachable}")
    results.append(r)
    print(f"  {sym(finding)} [{method:4}] {path:30} -> {status}  ({ms}ms)  {desc}")

print("\n  Probing unlisted paths (looking for hidden/forgotten endpoints):")
for path in PROBE_PATHS:
    url = BASE + path
    status, raw, ms = http("GET", url)
    # Flag anything that returns non-404 and non-405
    finding  = status not in (404, 405, 307, 308) and status != 0
    severity = "MEDIUM" if finding else "INFO"
    note     = f"Unexpected response on unlisted path" if finding else "Expected 404/405"
    r = record(path, "GET", "public", status, 404, finding, severity, ms, CAT, note)
    results.append(r)
    print(f"  {sym(finding)} [GET ] {path:30} -> {status}  ({ms}ms)  {note}")

save(results, CAT)

# Print clean endpoint list for user confirmation
print("\n+-----------------------------------------------------------------+")
print("|  CONFIRMED ENDPOINT LIST (DAST scope)                          |")
print("+----------+------------------------------+----------------------+")
print("|  Method  |  Path                        |  Auth required?      |")
print("+----------+------------------------------+----------------------+")
for method, path, desc, pub in ENDPOINTS:
    auth = "No (public)"
    print(f"|  {method:<6}  |  {path:<28}|  {auth:<20}|")
print("+----------+------------------------------+----------------------+")
print(f"\n  Total: {len(ENDPOINTS)} endpoints (excl. /health already scoped out)")
