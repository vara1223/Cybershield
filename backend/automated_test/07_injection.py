"""
STEP 7 — Injection Detection
SQLi / NoSQLi detection payloads in all string fields.
Flags: anomalous status codes, server errors (5xx), timing anomalies.
Detection only — no data extraction.
"""
import sys, time
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from dast_helpers import http, record, save, sym

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
CAT  = "07_injection"

# SQLi / NoSQLi detection payloads
SQLI = [
    "' OR '1'='1",
    "' OR 1=1--",
    "'; DROP TABLE scan_logs;--",
    "1 UNION SELECT NULL,NULL,NULL--",
    "' AND SLEEP(3)--",           # time-based
    "\" OR \"\"=\"",
    "admin'--",
    "%27 OR %271%27=%271",
]
NOSQLI = [
    '{"$gt": ""}',
    '{"$ne": null}',
    '{"$where": "sleep(3000)"}',
]
XSS_PROBE = [
    "<script>alert(1)</script>",
    "javascript:alert(1)",
    "<img src=x onerror=alert(1)>",
]
CMD_PROBE = [
    "; ls -la",
    "| whoami",
    "`id`",
    "$(sleep 3)",
]

BASELINES = {}  # store normal response time per endpoint for timing anomaly

def baseline(method, url, body):
    status, raw, ms = http(method, url, body=body)
    BASELINES[url] = ms
    return status, ms

results = []
print(f"\n=== INJECTION DETECTION  target={BASE} ===\n")

# Endpoints with string params
TARGETS = [
    # (method, path, field, normal_val)
    ("POST", "/analyze/url",   "url",             "https://google.com"),
    ("POST", "/analyze/otp",   "message",         "Your OTP is 123456"),
    ("POST", "/analyze/qr",    "decoded_content",  "https://google.com"),
    ("POST", "/analyze/upi",   "upi_id",           "test@upi"),
    # Admin filter params
    ("GET",  "/admin/logs",    "feature",          "url_scan"),   # query param
    ("GET",  "/admin/logs",    "verdict",          "SAFE"),
]

ALL_PAYLOADS = SQLI + NOSQLI + XSS_PROBE + CMD_PROBE

for method, path, field, normal_val in TARGETS:
    # Baseline
    if method == "POST":
        b_url  = BASE + path
        b_body = {field: normal_val}
        b_status, b_ms = baseline(method, b_url, b_body)
    else:
        b_url  = f"{BASE}{path}?{field}={normal_val}"
        b_body = None
        b_status, b_ms = baseline(method, b_url, b_body)

    print(f"\n  [{method}] {path} (field={field}) baseline={b_status}/{b_ms}ms")

    for payload in ALL_PAYLOADS:
        if method == "POST":
            url  = BASE + path
            body = {field: payload}
        else:
            import urllib.parse
            url  = f"{BASE}{path}?{field}={urllib.parse.quote(payload)}"
            body = None

        status, raw, ms = http(method, url, body=body)
        time.sleep(0.08)

        # Findings:
        # 1. 5xx server error (unhandled exception = likely injection)
        # 2. Timing anomaly > 2.5x baseline AND > 2000ms (time-based SQLi)
        server_err    = status in range(500, 600)
        timing_anomaly = (ms > max(b_ms * 2.5, 2000)) and ("SLEEP" in payload.upper() or "sleep" in payload)
        finding       = server_err or timing_anomaly

        severity = "HIGH"   if server_err    else \
                   "MEDIUM" if timing_anomaly else "INFO"

        note = (
            f"INJECTION: server error {status} on payload: {payload[:40]!r}"
            if server_err else
            f"TIMING ANOMALY: {ms}ms vs baseline {b_ms}ms (payload: {payload[:30]!r})"
            if timing_anomaly else
            f"OK: {status} ({ms}ms)"
        )

        r = record(path, method, "anonymous", status, b_status, finding, severity, ms, CAT, note)
        results.append(r)
        mark = "[FAIL]" if finding else "[OK]  "
        print(f"    {mark} {payload[:38]:40} -> {status} ({ms}ms)")

save(results, CAT)
