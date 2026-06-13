"""
STEP 6 — JWT Token Tampering
Forge JWTs with flipped claims (role/sub) WITHOUT valid signature.
Server must reject these. 2xx = critical finding.
Also tests alg:none attack.
"""
import sys, time, base64, json as _json
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from dast_helpers import http, record, save, sym

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
CAT  = "06_token_tampering"

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def make_jwt_none(payload: dict) -> str:
    """Create alg=none JWT (forged, no signature)."""
    header  = b64url(_json.dumps({"alg": "none", "typ": "JWT"}).encode())
    pay     = b64url(_json.dumps(payload).encode())
    return f"{header}.{pay}."

def make_jwt_hs256_bad(payload: dict) -> str:
    """Create HS256 JWT with WRONG signature (unsigned zeros)."""
    header  = b64url(_json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    pay     = b64url(_json.dumps(payload).encode())
    return f"{header}.{pay}.BADSIGNATURE_AAAA_BBBB_CCCC"

FORGED_TOKENS = [
    ("alg_none_admin",  make_jwt_none({"sub": "1", "role": "admin", "exp": 9999999999})),
    ("alg_none_user",   make_jwt_none({"sub": "999", "role": "user", "exp": 9999999999})),
    ("hs256_bad_sig_admin", make_jwt_hs256_bad({"sub": "1", "role": "admin", "exp": 9999999999})),
    ("hs256_bad_sig_user",  make_jwt_hs256_bad({"sub": "2", "role": "user",  "exp": 9999999999})),
    ("claim_flip_role",     make_jwt_none({"sub": "1", "role": "superadmin", "exp": 9999999999})),
]

ADMIN_ENDPOINTS = [
    ("GET", "/admin/logs",       None),
    ("GET", "/admin/stats",      None),
    ("GET", "/admin/export/csv", None),
]

results = []
print(f"\n=== TOKEN TAMPERING  target={BASE} ===\n")

for tok_name, token in FORGED_TOKENS:
    hdrs = {"Authorization": f"Bearer {token}"}
    print(f"\n  Token variant: {tok_name}")
    for method, path, body in ADMIN_ENDPOINTS:
        url = BASE + path
        status, raw, ms = http(method, url, body=body, headers=hdrs)
        finding  = status in range(200, 300)
        severity = "CRITICAL" if finding else "INFO"
        note = (
            f"CRITICAL: Server accepted forged/tampered JWT ({tok_name})"
            if finding else f"Correctly rejected with {status}"
        )
        r = record(path, method, tok_name, status, 401, finding, severity, ms, CAT, note)
        results.append(r)
        print(f"    {sym(finding)} [{method:4}] {path:28} -> {status} ({ms}ms)  {note}")
        time.sleep(0.05)

# Bonus: send token with modified SECRET_KEY='change-me-in-production'
# (as found in .env — try signing with that known weak key)
try:
    import hmac, hashlib
    def make_jwt_known_secret(payload, secret="change-me-in-production"):
        header = b64url(_json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        pay    = b64url(_json.dumps(payload).encode())
        msg    = f"{header}.{pay}".encode()
        sig    = b64url(hmac.new(secret.encode(), msg, hashlib.sha256).digest())
        return f"{header}.{pay}.{sig}"

    tok = make_jwt_known_secret({"sub": "1", "role": "admin", "exp": 9999999999})
    hdrs = {"Authorization": f"Bearer {tok}"}
    print(f"\n  Token variant: known_weak_secret (change-me-in-production)")
    for method, path, body in ADMIN_ENDPOINTS:
        url = BASE + path
        status, raw, ms = http(method, url, body=body, headers=hdrs)
        finding  = status in range(200, 300)
        severity = "CRITICAL" if finding else "HIGH"  # HIGH even if blocked — secret is known
        note = (
            f"CRITICAL: Server accepted JWT signed with known weak secret from .env"
            if finding else
            f"JWT with known secret returned {status} — but SECRET_KEY still hardcoded in .env!"
        )
        r = record(path, method, "known_weak_secret", status, 401, finding, severity, ms, CAT, note)
        results.append(r)
        print(f"    {sym(finding)} [{method:4}] {path:28} -> {status} ({ms}ms)  {note}")
        time.sleep(0.05)
except Exception as e:
    print(f"    [SKIP] known_weak_secret test failed: {e}")

save(results, CAT)
