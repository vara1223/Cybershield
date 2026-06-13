"""
STEP 4 — IDOR (Insecure Direct Object Reference)
Vary id-like params to reach other users' data.
In this API, /admin/logs uses pagination (page/per_page) — we test
boundary/negative values and filter injection via feature/verdict params.
"""
import sys, time, json
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from dast_helpers import http, record, save, sym

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
CAT  = "04_idor"

results = []
print(f"\n=== IDOR  target={BASE} ===\n")

# Test 1: Negative / out-of-range page values
page_tests = [
    ("page=0",   "/admin/logs?page=0&per_page=5"),
    ("page=-1",  "/admin/logs?page=-1&per_page=5"),
    ("page=9999","/admin/logs?page=9999&per_page=5"),
    ("per_page=0", "/admin/logs?page=1&per_page=0"),
    ("per_page=9999", "/admin/logs?page=1&per_page=9999"),
    ("per_page=101", "/admin/logs?page=1&per_page=101"),  # exceeds max=100
]
print("  Pagination boundary tests on /admin/logs:")
for label, path in page_tests:
    url = BASE + path
    status, raw, ms = http("GET", url)
    try:
        body = json.loads(raw)
    except Exception:
        body = {}
    # per_page>100 returning 200 with data = potential IDOR-class overread
    finding  = (status == 200 and "per_page=101" in path)
    severity = "MEDIUM" if finding else "INFO"
    note = f"IDOR/overread: per_page limit not enforced" if finding else f"Status {status}"
    r = record(path, "GET", "anonymous", status, 422, finding, severity, ms, CAT,
               note + f" | {label}")
    results.append(r)
    print(f"  {sym(finding)} {label:25} -> {status} ({ms}ms)  {note}")
    time.sleep(0.05)

# Test 2: Filter param injection to enumerate data categories
filter_tests = [
    "/admin/logs?feature=url_scan",
    "/admin/logs?feature=voice_scan",
    "/admin/logs?verdict=DANGEROUS",
    "/admin/logs?verdict=SAFE",
    "/admin/logs?feature=url_scan&verdict=DANGEROUS",
]
print("\n  Data filter enumeration on /admin/logs:")
for path in filter_tests:
    url = BASE + path
    status, raw, ms = http("GET", url)
    try:
        data = json.loads(raw)
        count = len(data) if isinstance(data, list) else "?"
    except Exception:
        count = "?"
    # Returning user data records to anyone = IDOR (no ownership check)
    finding  = status == 200
    severity = "HIGH" if finding else "INFO"
    note = f"IDOR: Exposes {count} scan records to unauthenticated caller" if finding else f"{status}"
    r = record(path, "GET", "anonymous", status, 401, finding, severity, ms, CAT, note)
    results.append(r)
    print(f"  {sym(finding)} {path:45} -> {status} ({ms}ms) records={count}")
    time.sleep(0.05)

# Test 3: Export CSV — dumps entire DB to anyone
print("\n  Full data export test:")
url = BASE + "/admin/export/csv"
status, raw, ms = http("GET", url)
finding  = status == 200
severity = "CRITICAL" if finding else "INFO"
lines    = raw.count("\n") if raw else 0
note = f"IDOR/DATA-LEAK: CSV dump of ALL records accessible without auth ({lines} lines)" if finding else f"{status}"
r = record("/admin/export/csv", "GET", "anonymous", status, 401, finding, severity, ms, CAT, note)
results.append(r)
print(f"  {sym(finding)} /admin/export/csv -> {status} ({ms}ms) lines={lines}  {note}")

save(results, CAT)
