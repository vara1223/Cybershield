"""
STEP 9 — Hardcoded Credentials / Secrets Scanner
Static scan of all non-venv source files for secrets, keys, tokens.
Produces findings for each hit. No network calls.
"""
import sys, re, os, json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dast_helpers import record, save, sym, ts

CAT = "09_hardcoded_creds"

ROOT = Path(__file__).parent.parent  # backend dir

# Patterns: (label, regex, severity)
PATTERNS = [
    ("openai_key",       r"sk-[A-Za-z0-9\-_]{40,}",                          "CRITICAL"),
    ("aws_access_key",   r"AKIA[0-9A-Z]{16}",                                 "CRITICAL"),
    ("aws_secret",       r"(?i)aws[_\-]?secret[_\-]?access[_\-]?key\s*=\s*\S+","CRITICAL"),
    ("generic_secret",   r"(?i)(secret[_\-]?key|secret)\s*[=:]\s*['\"]?(?!change-me|example|your-|<|{)[A-Za-z0-9!@#$%^&*\-_]{8,}['\"]?", "HIGH"),
    ("hardcoded_passwd", r"(?i)password\s*[=:]\s*['\"](?!change-me|example|your-|<|{)[^'\"]{4,}['\"]", "HIGH"),
    ("jwt_token",        r"eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*", "HIGH"),
    ("private_key_pem",  r"-----BEGIN (RSA |EC )?PRIVATE KEY-----",            "CRITICAL"),
    ("db_url_with_pw",   r"(?i)(mysql|postgresql|mongodb|redis)://[^:]+:[^@]+@", "HIGH"),
    ("basic_auth_url",   r"https?://[^:]+:[^@]+@",                             "MEDIUM"),
    ("change_me_secret", r"(?i)secret[_\-]?key\s*[=:]\s*['\"]?change-me['\"]?","MEDIUM"),
    ("todo_secret",      r"(?i)(TODO|FIXME|HACK).*?(key|secret|password|token)","LOW"),
]

# Files/dirs to skip
SKIP_DIRS  = {"venv", ".git", "__pycache__", "node_modules", ".idea"}
SKIP_FILES = {".pyc", ".db", ".xlsx", ".png", ".jpg", ".wav", ".mp3"}

results = []
print(f"\n=== HARDCODED CREDS / SECRETS SCAN  root={ROOT} ===\n")

hit_count = 0
for fpath in ROOT.rglob("*"):
    if fpath.is_dir():
        continue
    if any(part in SKIP_DIRS for part in fpath.parts):
        continue
    if fpath.suffix.lower() in SKIP_FILES:
        continue

    try:
        content = fpath.read_text(errors="replace")
    except Exception:
        continue

    rel = str(fpath.relative_to(ROOT))
    for label, pattern, severity in PATTERNS:
        for m in re.finditer(pattern, content, re.MULTILINE):
            lineno = content[:m.start()].count("\n") + 1
            snippet = m.group(0)[:60].replace("\n", " ")
            # Redact actual secrets in output
            if label in ("openai_key","aws_access_key","aws_secret","jwt_token","private_key_pem"):
                display = snippet[:10] + "…[REDACTED]"
            else:
                display = snippet

            note = f"HARDCODED SECRET [{label}] in {rel}:{lineno} -> {display}"
            r = record(
                endpoint=rel,
                method="STATIC",
                role="N/A",
                status=0,
                expected_status=0,
                finding=True,
                severity=severity,
                elapsed_ms=0,
                category=CAT,
                note=note,
            )
            results.append(r)
            mark = "[FAIL]"
            print(f"  {mark} [{severity:8}] {rel}:{lineno}  ({label})")
            print(f"           -> {display}")
            hit_count += 1

if hit_count == 0:
    print("  [OK]   No obvious hardcoded credentials found in source files.")
    r = record("/", "STATIC", "N/A", 0, 0, False, "INFO", 0, CAT,
               "No hardcoded credentials detected in static scan")
    results.append(r)

# Special check: .env committed to repo (not in .gitignore)
gitignore = ROOT / ".gitignore"
env_file  = ROOT / ".env"
if env_file.exists():
    ignored = False
    if gitignore.exists():
        gi_content = gitignore.read_text()
        ignored = ".env" in gi_content
    finding  = not ignored
    severity = "HIGH" if finding else "INFO"
    note = (
        ".env file exists and is NOT in .gitignore — secrets may be committed to git"
        if finding else ".env exists and is listed in .gitignore"
    )
    r = record(".env", "STATIC", "N/A", 0, 0, finding, severity, 0, CAT, note)
    results.append(r)
    print(f"\n  {'[FAIL]' if finding else '[OK]  '} [{severity}] .env gitignore check: {note}")

save(results, CAT)
print(f"\n  Total findings: {hit_count}")
