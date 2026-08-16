import requests

cases = [
    ("SCAM (transcript only)", {"audio": "", "format": "webm", "transcript": "I am CBI officer pay 50000 immediately or face arrest"}),
    ("SAFE (transcript only)", {"audio": "", "format": "webm", "transcript": "Your HDFC loan EMI of 3500 is due on 15th please pay via app"}),
    ("Empty (no audio no transcript)", {"audio": "", "format": "webm"}),
]

print("\n== VoiceRoute Multi-Case Test ==")
for name, payload in cases:
    r = requests.post("http://localhost:8000/analyze/voice", json=payload, timeout=30)
    d = r.json()
    if r.status_code == 200:
        print(f"  {name}: HTTP {r.status_code} | verdict={d['verdict']} | confidence={d['confidence']}")
    else:
        print(f"  {name}: HTTP {r.status_code} | detail={d.get('detail', d)}")
