"""
STEP 3 — AuthZ / Privilege Escalation
Lower-privilege role calling higher-privilege endpoints.
Since this API has NO roles/auth, all endpoints are effectively wide open.
We flag the structural absence and probe cross-function access.
"""
import sys, time
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from dast_helpers import http, record, save, sym

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
CAT  = "03_authz_privesc"

# Role matrix: (role_name, token) — no real JWT system exists
ROLES = [
    ("anonymous",  None),
    ("fake_user",  "Bearer fake-user-token-12345"),
    ("fake_admin", "Bearer fake-admin-token-99999"),
]

# Admin-only endpoints (should require elevated privilege)
ADMIN_ENDPOINTS = [
    ("GET", "/admin/logs",        None),
    ("GET", "/admin/stats",       None),
    ("GET", "/admin/export/csv",  None),
]

results = []
print(f"\n=== AUTHZ / PRIV-ESC  target={BASE} ===\n")

for role_name, token in ROLES:
    hdrs = {"Authorization": token} if token else {}
    print(f"\n  Role: {role_name}")
    for method, path, body in ADMIN_ENDPOINTS:
        url = BASE + path
        status, raw, ms = http(method, url, body=body, headers=hdrs)
        finding  = status in range(200, 300)
        severity = "CRITICAL" if finding else "INFO"
        note = (
            f"PRIVESC: {role_name} can access admin endpoint (no authz enforced)"
            if finding else f"Blocked with {status}"
        )
        r = record(path, method, role_name, status, 403, finding, severity, ms, CAT, note)
        results.append(r)
        print(f"    {sym(finding)} [{method:4}] {path:28} -> {status} ({ms}ms)  {note}")
        time.sleep(0.05)

save(results, CAT)
