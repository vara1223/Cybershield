# -*- coding: utf-8 -*-
"""
DAST Shared helpers -- imported by every category script.
"""
import json, time, sys, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

# Force UTF-8 on Windows consoles so unicode chars don't crash
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_DIR = Path(__file__).parent

def ts():
    return datetime.now(timezone.utc).isoformat()

def http(method, url, body=None, headers=None, timeout=10):
    """Returns (status_code, body_str, elapsed_ms)"""
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    req  = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    t0   = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", errors="replace")
            elapsed = int((time.time()-t0)*1000)
            return r.status, raw, elapsed
    except urllib.error.HTTPError as e:
        elapsed = int((time.time()-t0)*1000)
        try:
            raw = e.read().decode("utf-8", errors="replace")
        except Exception:
            raw = str(e)
        return e.code, raw, elapsed
    except Exception as e:
        elapsed = int((time.time()-t0)*1000)
        return 0, str(e), elapsed

def record(endpoint, method, role, status, expected_status, finding,
           severity, elapsed_ms, category, note, body_snippet=""):
    return {
        "endpoint":         endpoint,
        "method":           method,
        "role":             role,
        "status":           status,
        "expected_status":  expected_status,
        "finding":          finding,
        "severity":         severity,
        "response_time_ms": elapsed_ms,
        "test_category":    category,
        "note":             note,
        "body_snippet":     body_snippet[:200],
        "timestamp":        ts(),
    }

def save(results, cat):
    out = SCRIPT_DIR / f"{cat}_results.json"
    with open(out, "w") as f:
        json.dump(results, f, indent=2)
    print(f"  Saved {len(results)} records -> {out.name}")

def sym(finding):
    return "[FAIL]" if finding else "[OK]  "
