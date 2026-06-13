# CyberShield — Technical Architecture

A reference for how CyberShield detects scams: the models, the scoring, and the data flow end to
end. Companion to the setup-focused [README.md](README.md).

---

## 1. High-level overview

```
┌─────────────────────────┐         HTTP/JSON          ┌──────────────────────────┐
│   React Native (Expo)   │  ───────────────────────▶  │      FastAPI backend     │
│   Phone — Expo Go / APK │  ◀───────────────────────  │   (runs on laptop:8000)  │
└─────────────────────────┘     verdict + reasons      └────────────┬─────────────┘
                                                                     │
                       ┌─────────────────────────────────────────────┼───────────────────────┐
                       ▼                          ▼                   ▼                       ▼
                 scikit-learn             HuggingFace BERT      OpenAI API               SQLite
                 (URL phishing)           (screenshot spam)   (Whisper-1 STT,         (scan logs,
                                                               GPT-4o Vision OCR)      admin stats)
```

- **Frontend**: 10 screens, captures user input (text / image / audio / camera), base64-encodes
  binary payloads, calls the backend, renders the verdict on a shared Result screen.
- **Backend**: one FastAPI router per scan type. Each delegates to a `services/*_analyzer.py`
  module that produces a `{verdict, confidence, explanation, flags}` result, logs it to SQLite, and
  returns it.
- **Verdict scale** (shared by every analyzer, see `utils/confidence.py`):

  | Score (0–100) | Verdict |
  |---|---|
  | `0 – 30` | **SAFE** |
  | `31 – 60` | **SUSPICIOUS** |
  | `61 – 100` | **DANGEROUS** |

---

## 2. Frontend (React Native / Expo SDK 54)

| Concern | Choice |
|---|---|
| Framework | React Native 0.81 on Expo SDK 54 (New Architecture enabled) |
| Navigation | React Navigation v7 — native-stack + bottom-tabs |
| State | Zustand (`store/useScanStore.js`) — theme, scan history, current result |
| HTTP | Axios (`services/api.js`), 30 s default timeout, 120 s for voice |
| Camera / QR | `expo-camera` (live barcode scanning) |
| Image picker | `expo-image-picker` (screenshot + QR upload) |
| Audio | `expo-av` (voice recording → `.m4a`) |
| File encoding | `expo-file-system/legacy` → base64 for image/audio payloads |
| Fonts | Inter + JetBrains Mono via `@expo-google-fonts` |

### Backend URL resolution (`services/api.js`)

The single trickiest piece of the frontend. Resolved at startup:

1. **Expo Go / dev** — reads the Metro dev-server host from `expo-constants`
   (`Constants.expoConfig.hostUri`, e.g. `192.168.1.50:8081`), strips the port, and targets
   `http://<that-ip>:8000`. **No hardcoding; works on any network automatically.**
2. **Standalone APK** — no dev-server exists, so it falls back to the hardcoded `FALLBACK_URL`.
   An APK must be rebuilt to change this value.

### Why the APK needed a native networking fix

Android 9+ blocks cleartext (`http://`) traffic by default. Expo Go permits it internally, but a
standalone APK does not. `frontend/plugins/withNetworkSecurityConfig.js` is a custom Expo config plugin
that, at build time, writes a `network_security_config.xml` with
`cleartextTrafficPermitted="true"` and references it from the Android manifest — allowing the APK to
reach the local HTTP backend.

---

## 3. Backend (FastAPI)

```
main.py            → app, CORS (open), mounts routers under /analyze and /admin, /health
routes/*.py        → thin HTTP layer: parse body → call analyzer → log to DB → return ScanResponse
services/*.py      → the analysis logic (models + rules) — no HTTP, no DB; pure functions
utils/confidence.py→ clamp() + score_to_verdict() (the 30/60 thresholds)
utils/tips.py      → per-feature prevention tips attached to responses
models/scan_log.py → SQLAlchemy ORM model for the scan_logs table
database.py        → SQLite engine + session (cybershield.db, auto-created)
```

Design rule: **routes are thin, services are pure.** Each analyzer takes plain inputs and returns a
dict — which is why `test_ml.py` can exercise them directly without HTTP.

---

## 4. The six detectors

### 4.1 URL Scan — `services/url_analyzer.py`
**Model: scikit-learn `LogisticRegression`** with pretrained coefficients (no training at runtime;
weights derived from the ISCX-URL-2016 / PhiUSIIL phishing datasets).

- Extracts **11 features** from the URL: IP-based host, missing HTTPS, suspicious TLD
  (`.tk .ml .xyz` …), URL shortener, excess subdomains, hyphen abuse, brand impersonation
  (paytm/sbi/hdfc…), phishing keywords (`verify`, `kyc`, `otp-confirm` …), long URL, special-char
  abuse, numeric-heavy domain.
- Feeds the vector to the LR model → phishing probability (`ml_prob`).
- Runs a parallel **interpretable rule score** over the same signals.
- **Final = 60 % ML + 40 % rules**, clamped, mapped to a verdict.

### 4.2 Screenshot Scan — `services/screenshot_analyzer.py`
Two-stage: **OCR → text classification.**

- **OCR**: Tesseract LSTM if installed → otherwise **OpenAI GPT-4o Vision** (`detail: low`) extracts
  the on-screen text.
- **ML classifier**: HuggingFace **`mrm8488/bert-tiny-finetuned-sms-spam-detection`** (BERT-tiny),
  loaded lazily, CPU, auto-downloaded & cached on first use. A spam label contributes up to 60
  points.
- **Rule signals** add to the score: scam keywords, brand-spoof regex (`s[b8]i`, `payt[mn]` …),
  visible OTP digits, phone numbers, ₹ amounts, urgency language, embedded URLs.

### 4.3 QR Scan — `services/qr_analyzer.py`
- Decodes the QR from the uploaded image with **pyzbar** (or accepts pre-decoded camera content).
- Routes by payload:
  - `http(s)://` → handed to the **URL analyzer** (full phishing pipeline).
  - `upi://pay?...` → parses payee (`pa`/`pn`/`am`); flags suspicious payee terms
    (`refund`, `cashback`, `prize` …).
  - plain text → low-risk informational verdict.

### 4.4 OTP Scam — `services/otp_analyzer.py`
Rule-based pattern engine over SMS text. Scores: OTP-sharing patterns (regex), urgency keywords,
fake-authority impersonation (RBI/CBI/income-tax …), bank impersonation (`dear customer`,
`kyc update`), money demands (`₹`, `lakh`, `fine of`), prize/lottery scams, embedded links/phone
numbers.

### 4.5 UPI Fraud — `services/upi_analyzer.py`
Rule-based over the UPI ID (+ optional message). Checks: handle format validity, known fraud-handle
patterns (`sbi-help`, `refund` …), suspicious words in the handle, numeric-heavy handles, and
**advance-fee** message patterns (“pay first to receive”, processing/registration fee).

### 4.6 Voice Scan — `services/voice_analyzer.py`
**STT → scam-call pattern analysis.**

- **STT (primary)**: **OpenAI Whisper-1 API** transcribes the recorded `.m4a`.
- **STT (fallback)**: local `openai-whisper` (`base` model) via bundled `static-ffmpeg`, used only
  when no API key is present.
- **Pattern analysis** over the transcript across 7 categories: fake authority, Aadhaar-link scam,
  money demand, arrest threat, urgency, **personal-data request (OTP/PIN/CVV)**, remote-access
  (AnyDesk/TeamViewer). Scoring scales with how many categories hit; high-signal categories pin the
  score high on their own (e.g. asking for an OTP on an unsolicited call → ≥ 80, DANGEROUS).

---

## 5. OpenAI integration

| Use | Model | Where | Required? |
|---|---|---|---|
| Voice transcription | `whisper-1` | `voice_analyzer.py` | Yes (local Whisper is the offline fallback) |
| Screenshot OCR | `gpt-4o` Vision | `screenshot_analyzer.py` | Default unless Tesseract is installed |

Key is read from `backend/.env` → `OPENAI_API_KEY`, loaded by `python-dotenv` in `main.py` **before**
any service import (so the OpenAI clients initialize correctly).

---

## 6. Persistence & Admin

- Every scan is written to **SQLite** (`cybershield.db`) via SQLAlchemy as a `ScanLog` row
  (feature, input preview, verdict, confidence, flags, timestamp). The DB auto-creates on startup.
- `routes/admin.py` serves paginated logs, aggregate stats (totals, threats, safe-rate, daily
  counts), and CSV export. The in-app Admin screen (PIN **1234**) visualizes these.

---

## 7. Request lifecycle (example: URL scan)

```
1. User pastes a URL on URLScanScreen.
2. api.analyzeURL(url) → POST http://<laptop-ip>:8000/analyze/url  { url }
3. routes/url.py validates the body (pydantic).
4. services/url_analyzer.analyze_url(url):
     - extract 11 features
     - LogisticRegression.predict_proba → ml_prob
     - rule score → combined = 0.6*ml + 0.4*rules
     - score_to_verdict(combined)
5. Route logs the ScanLog row and attaches prevention tips.
6. JSON { verdict, confidence, explanation, flags, tips } → phone.
7. ResultScreen renders verdict color, confidence, explanation, and tips.
```

---

## 8. Tech stack summary

| Layer | Technology |
|---|---|
| Mobile | React Native 0.81, Expo SDK 54, React Navigation v7, Zustand, Axios |
| Backend | FastAPI, Uvicorn, Pydantic, SQLAlchemy + SQLite |
| ML — URL | scikit-learn LogisticRegression + NumPy |
| ML — Screenshot | HuggingFace Transformers (BERT-tiny) + PyTorch; Tesseract / GPT-4o Vision OCR |
| ML — Voice | OpenAI Whisper-1 API (local openai-whisper fallback) |
| Imaging | Pillow, pyzbar |
| Cloud AI | OpenAI (`whisper-1`, `gpt-4o`) |
