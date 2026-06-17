"""
CyberShield DAST Runner
Orchestrates all test categories and produces report.json
"""
import json, os, sys, time, subprocess
from datetime import datetime, timezone
from pathlib import Path

# -- Paths ---------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR   = SCRIPT_DIR.parent
INPUT_JSON = ROOT_DIR / "input.json"
REPORT_PATH = SCRIPT_DIR / "report.json"
SAVEPOINT   = SCRIPT_DIR / "savepoint.json"

# -- Load config ----------------------------------------------------------
with open(INPUT_JSON) as f:
    cfg = json.load(f)
BASE_URL = cfg["baseUrl"].rstrip("/")

print(f"\n{'='*60}")
print(f"  CyberShield DAST Suite")
print(f"  Target: {BASE_URL}")
print(f"  Started: {datetime.now(timezone.utc).isoformat()}")
print(f"{'='*60}\n")

# -- Run sub-tests in order -----------------------------------------------
categories = [
    "01_endpoint_discovery",
    "02_authn_bypass",
    "03_authz_privesc",
    "04_idor",
    "05_rbac_matrix",
    "06_token_tampering",
    "07_injection",
    "08_rate_limit",
    "09_hardcoded_creds",
]

all_results = []
completed = []

# Load savepoint if exists
if SAVEPOINT.exists():
    with open(SAVEPOINT) as f:
        sp = json.load(f)
        completed = sp.get("completed", [])
        all_results = sp.get("results", [])
    print(f"Resuming from savepoint — already done: {completed}\n")

python = sys.executable

for cat in categories:
    script = SCRIPT_DIR / f"{cat}.py"
    if not script.exists():
        print(f"  [SKIP] {cat} — script not found")
        continue
    if cat in completed:
        print(f"  [SKIP] {cat} — already in savepoint")
        continue

    print(f"\n{'-'*60}")
    print(f"  Running: {cat}")
    print(f"{'-'*60}")

    try:
        result = subprocess.run(
            [python, str(script), BASE_URL],
            capture_output=True, text=True, timeout=300
        )
        print(result.stdout)
        if result.stderr:
            print("[STDERR]", result.stderr[:500])

        # Each sub-script writes its own partial JSON to automated_test/<cat>_results.json
        partial_file = SCRIPT_DIR / f"{cat}_results.json"
        if partial_file.exists():
            with open(partial_file) as f:
                partial = json.load(f)
            all_results.extend(partial)
            print(f"  -> Loaded {len(partial)} records from {cat}")
    except subprocess.TimeoutExpired:
        print(f"  [TIMEOUT] {cat} took > 300s, skipping")
    except Exception as e:
        print(f"  [ERROR] {cat}: {e}")

    completed.append(cat)
    with open(SAVEPOINT, "w") as f:
        json.dump({"completed": completed, "results": all_results}, f, indent=2)

# -- Write final report ---------------------------------------------------
with open(REPORT_PATH, "w") as f:
    json.dump(all_results, f, indent=2)

# -- Summary --------------------------------------------------------------
findings = [r for r in all_results if r.get("finding")]
by_sev = {}
for r in findings:
    s = r.get("severity", "INFO")
    by_sev.setdefault(s, []).append(r)

print(f"\n{'='*60}")
print(f"  DAST COMPLETE")
print(f"  Total tests : {len(all_results)}")
print(f"  Findings    : {len(findings)}")
print(f"{'='*60}")
for sev in ["CRITICAL","HIGH","MEDIUM","LOW","INFO"]:
    recs = by_sev.get(sev, [])
    sym = {"CRITICAL":"[FAIL]","HIGH":"[FAIL]","MEDIUM":"[WARN]","LOW":"[WARN]","INFO":"[OK]  "}.get(sev,"?")
    if recs:
        print(f"  {sym} {sev}: {len(recs)}")
        for r in recs:
            print(f"       -> [{r['method']}] {r['endpoint']} | {r['note']}")
print(f"\n  Report: {REPORT_PATH}\n")
