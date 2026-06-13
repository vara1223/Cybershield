"""
STEP 5 — RBAC Matrix
Every role × every endpoint.  Expected = 401/403 for unauthenticated admin access.
"""
import sys, time
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from dast_helpers import http, record, save, sym

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
CAT  = "05_rbac_matrix"

ROLES = [
    ("anonymous",         {}),
    ("low_priv_user",     {"Authorization": "Bearer low-priv-jwt-abc123"}),
    ("high_priv_user",    {"Authorization": "Bearer high-priv-jwt-xyz789"}),
    ("admin_role_claim",  {"Authorization": "Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiI5OSIsInJvbGUiOiJhZG1pbiJ9."}),
]

ENDPOINT_MATRIX = [
    # (method, path, body, should_require_auth, role_needed)
    ("GET",  "/admin/logs",        None, True,  "admin"),
    ("GET",  "/admin/stats",       None, True,  "admin"),
    ("GET",  "/admin/export/csv",  None, True,  "admin"),
    ("POST", "/analyze/url",       {"url": "https://google.com"}, False, "any"),
    ("POST", "/analyze/otp",       {"message": "test otp message"}, False, "any"),
    ("POST", "/analyze/qr",        {"decoded_content": "test"}, False, "any"),
    ("POST", "/analyze/upi",       {"upi_id": "test@upi"}, False, "any"),
]

results = []
print(f"\n=== RBAC MATRIX  target={BASE} ===\n")
print(f"  {'Role':<25} {'Method':<6} {'Endpoint':<28} {'Status':<8} {'Expected':<10} {'Finding'}")
print(f"  {'-'*25} {'-'*6} {'-'*28} {'-'*8} {'-'*10} {'-'*8}")

for role_name, hdrs in ROLES:
    for method, path, body, needs_auth, role_needed in ENDPOINT_MATRIX:
        url = BASE + path
        status, raw, ms = http(method, url, body=body, headers=hdrs)

        if needs_auth:
            # All roles here are not real admins — 200 = finding
            expected = 401
            finding  = status in range(200, 300)
            severity = "CRITICAL" if finding else "INFO"
            note = f"RBAC FAILURE: {role_name} accessed admin endpoint" if finding else "OK"
        else:
            # Public endpoint — should work for all roles
            expected = 200
            finding  = False
            severity = "INFO"
            note = "Public endpoint OK"

        r = record(path, method, role_name, status, expected, finding, severity, ms, CAT, note)
        results.append(r)
        mark = "[FAIL]" if finding else "[OK]  "
        print(f"  {role_name:<25} {method:<6} {path:<28} {status:<8} {expected:<10} {mark} {note}")
        time.sleep(0.05)

save(results, CAT)
