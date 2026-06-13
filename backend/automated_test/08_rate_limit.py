"""
STEP 8 — Rate Limiting
Send ~30 rapid requests to each endpoint.
Finding: if all 30 return 2xx (no 429 ever seen), rate limiting is absent.
"""
import sys, time, threading
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from dast_helpers import http, record, save, sym

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
CAT  = "08_rate_limit"

BURST = 30
CONCURRENCY = 5

ENDPOINTS = [
    ("POST", "/analyze/url",   {"url": "https://google.com"}),
    ("POST", "/analyze/otp",   {"message": "Your OTP is 123456"}),
    ("GET",  "/admin/stats",   None),
    ("GET",  "/admin/logs",    None),
    ("GET",  "/admin/export/csv", None),
]

results = []
print(f"\n=== RATE LIMITING  target={BASE}  burst={BURST} ===\n")

for method, path, body in ENDPOINTS:
    url = BASE + path
    statuses = []
    times    = []
    lock     = threading.Lock()

    def fire(_):
        status, raw, ms = http(method, url, body=body, timeout=8)
        with lock:
            statuses.append(status)
            times.append(ms)

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        list(ex.map(fire, range(BURST)))

    got_429     = any(s == 429 for s in statuses)
    got_503     = any(s == 503 for s in statuses)
    all_2xx     = all(s in range(200, 300) for s in statuses)
    rate_ok     = got_429 or got_503
    finding     = not rate_ok
    severity    = "MEDIUM" if finding else "INFO"

    cnt_429 = statuses.count(429)
    cnt_2xx = sum(1 for s in statuses if s in range(200, 300))
    avg_ms  = int(sum(times) / len(times)) if times else 0

    note = (
        f"NO RATE LIMIT: all {BURST} requests succeeded without throttling"
        if finding else
        f"Rate limit enforced: {cnt_429} x 429 out of {BURST} requests"
    )

    r = record(path, method, "anonymous", cnt_429, "429", finding, severity, avg_ms, CAT, note)
    results.append(r)
    mark = "[FAIL]" if finding else "[OK]  "
    print(f"  {mark} [{method:4}] {path:28} | 2xx={cnt_2xx} 429={cnt_429}  avg={avg_ms}ms  {note}")

save(results, CAT)
