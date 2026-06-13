# CyberShield

A mobile cybersecurity app for **phishing, scam, and fraud detection** aimed at Indian users.
Six scan tools (URL, Screenshot, QR, OTP, UPI, Voice) backed by real ML models — scikit-learn,
HuggingFace BERT, and OpenAI Whisper / GPT-4o. Built with **React Native (Expo SDK 54)** +
**FastAPI**.

> 📐 For a deep dive on the models, scoring, and data flow see **[TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)**.

---

## Project Structure

```
CyberShield/
├── frontend/            ← React Native Expo frontend
│   ├── screens/         ← 10 screens (Home, 6 scan tools, Result, History, Admin)
│   ├── services/api.js  ← backend calls + auto IP detection
│   ├── store/           ← Zustand state
│   ├── plugins/         ← native Android cleartext-HTTP config (for APK builds)
│   └── app.json         ← Expo config
├── backend/             ← FastAPI backend
│   ├── main.py          ← app entry, routers, CORS
│   ├── routes/          ← one router per scan type + admin
│   ├── services/        ← the ML / analysis logic (the "brains")
│   ├── .env             ← OPENAI_API_KEY  (already filled in)
│   └── requirements.txt
└── README.md
```

---

## ⚡ Recommended way to run (Expo Go — no APK, no rebuilds)

This is the easiest path for a demo and **requires no IP hardcoding** — the app auto-detects the
laptop's IP from the Expo dev-server.

### 1. Start the backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate            # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt

# .env already contains OPENAI_API_KEY — nothing to configure.
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Verify: open `http://localhost:8000/health` → `{"status":"ok","version":"1.0.0"}`

### 2. Start the app

```powershell
cd frontend
npm install
npx expo start
```

Install **Expo Go** from the Play Store on the phone, scan the QR code from the terminal, and the
app opens. **The phone and laptop must be on the same Wi-Fi.** That's it — the app finds the
backend automatically.

> 💡 Why this works: in Expo Go the phone already talks to the laptop's Metro server, so
> `services/api.js` reads that host and points the backend at `http://<laptop-ip>:8000`
> automatically. Change networks, change laptops — no edits needed.

---

## 📦 Alternative: standalone APK

A prebuilt APK exists, but it **cannot auto-detect the IP** — a standalone APK has no dev-server to
read from, so it uses the hardcoded `FALLBACK_URL` in [frontend/services/api.js](frontend/services/api.js).

If you distribute an APK, you must:
1. Set `FALLBACK_URL` in [frontend/services/api.js](frontend/services/api.js) to the backend laptop's IP.
2. Rebuild: `cd frontend && eas build -p android --profile preview` (~15–20 min, cloud build).
3. Install the new APK.

Because of this rebuild cost, **Expo Go is recommended for demos.**

---

## Features

| Feature | Input | Model / technique |
|---|---|---|
| URL Scan | URL text | scikit-learn LogisticRegression (11 phishing features) + rules |
| Screenshot Scan | Image | OCR (Tesseract → GPT-4o Vision) + HuggingFace BERT-tiny spam classifier |
| QR Code Scan | Camera / image | pyzbar decode → routed through URL analyzer |
| OTP Scam | SMS text | Rule-based pattern engine (urgency, fake authority, money demand) |
| UPI Fraud | UPI ID + message | Rule-based handle + advance-fee detection |
| Voice Scan | Audio recording | OpenAI Whisper-1 STT → scam-call pattern analysis |

---

## API Endpoints

```
POST /analyze/url         → { url }
POST /analyze/screenshot  → { image: base64 }
POST /analyze/qr          → { image?: base64, decoded_content?: string }
POST /analyze/otp         → { message: string }
POST /analyze/upi         → { upi_id: string, message?: string }
POST /analyze/voice       → { audio: base64, format: "m4a"|"mp3" }
GET  /admin/logs          → paginated scan logs
GET  /admin/stats         → statistics and daily counts
GET  /admin/export/csv    → download all logs as CSV
GET  /health              → server health check
```

Every analysis endpoint returns:
```json
{
  "verdict": "SAFE | SUSPICIOUS | DANGEROUS",
  "confidence": 87,
  "explanation": "Plain-English reason this was flagged.",
  "tips": ["Prevention tip 1", "..."],
  "flags": ["brand_impersonation:sbi", "..."]
}
```

Interactive API docs: `http://localhost:8000/docs`

---

## Environment / Credentials

`backend/.env` (already included in this handoff):

```
OPENAI_API_KEY=sk-...      # powers Whisper-1 (voice) + GPT-4o Vision (screenshot OCR)
SECRET_KEY=change-me-in-production
```

The OpenAI key is **required** for voice transcription and is the default OCR path for screenshots.
Without it, the app falls back to local Whisper (voice) and Tesseract (screenshot) if installed.

---

## Where are the ML models?

There are **no large model files in this repo** — nothing to ship manually:

- **URL** — logistic-regression coefficients are written inline in `services/url_analyzer.py`.
- **Screenshot** — BERT-tiny **auto-downloads** from HuggingFace on first use (~17 MB, cached in
  `~/.cache/huggingface`). OCR uses the OpenAI **API** (or local Tesseract if installed).
- **Voice** — OpenAI Whisper runs in the **cloud** via the API. (Local Whisper is an offline
  fallback that downloads ~150 MB on first use only if there's no API key.)

So a fresh machine just needs `pip install -r requirements.txt`, the `.env`, and an internet
connection.

---

## Admin Panel

Open the **Admin** screen in the app. Default PIN: **1234**. Shows total scans, threats, safe rate,
a weekly activity chart, category breakdown, and a CSV export.

---

## Verify the ML pipeline (optional)

```powershell
cd backend
python test_ml.py
```

Runs each analyzer (URL, Screenshot, Voice, OTP, UPI) independently and prints verdicts — handy to
confirm the models and OpenAI key work after setup.

---

## Cybercrime Resources (India)

- **Cybercrime helpline:** 1930
- **Report online:** [cybercrime.gov.in](https://cybercrime.gov.in)
- **UPI fraud:** report in your payment app or call your bank
