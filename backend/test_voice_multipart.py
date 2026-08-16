"""
Test the new multipart /analyze/voice endpoint.
Generates a synthetic WAV file (1kHz sine wave, 3 seconds) and posts it.
Also tests transcript-only and empty-both cases.
"""
import requests
import struct
import math

def make_sine_wav(freq=1000, duration=3, sample_rate=16000) -> bytes:
    """Generate a PCM WAV with a sine tone — at least has valid audio data."""
    num_samples = sample_rate * duration
    samples = [int(32767 * math.sin(2 * math.pi * freq * i / sample_rate)) for i in range(num_samples)]
    data_bytes = struct.pack(f'<{num_samples}h', *samples)
    data_size = len(data_bytes)
    header = struct.pack('<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + data_size, b'WAVE',
        b'fmt ', 16, 1, 1, sample_rate, sample_rate * 2, 2, 16,
        b'data', data_size)
    return header + data_bytes

URL = "http://localhost:8000/analyze/voice"
print("\n== Multipart Voice Endpoint Tests ==")

# TC-1: Real WAV audio file
wav = make_sine_wav()
print(f"\nTC-1: WAV audio only ({len(wav)}B)")
r = requests.post(URL, files={'audio': ('test.wav', wav, 'audio/wav')}, data={'format': 'wav'}, timeout=120)
print(f"  HTTP {r.status_code} | verdict={r.json().get('verdict','ERR')} | conf={r.json().get('confidence','?')}")
if r.status_code != 200:
    print(f"  Detail: {r.json()}")

# TC-2: Transcript only (no audio)
print(f"\nTC-2: Transcript only (no audio file)")
r = requests.post(URL, data={'format': 'webm', 'transcript': 'I am CBI officer pay 50000 immediately or face arrest'}, timeout=30)
print(f"  HTTP {r.status_code} | verdict={r.json().get('verdict','ERR')} | conf={r.json().get('confidence','?')}")

# TC-3: Empty — should get 422
print(f"\nTC-3: Empty (no audio, no transcript)")
r = requests.post(URL, data={'format': 'webm'}, timeout=10)
print(f"  HTTP {r.status_code} | detail={r.json().get('detail', r.text[:100])}")

# TC-4: Tiny blob — should warn on server
print(f"\nTC-4: Tiny blob (200 bytes)")
r = requests.post(URL, files={'audio': ('tiny.webm', b'\x1a\x45\xdf\xa3' + b'\x00'*196, 'audio/webm')},
                  data={'format': 'webm', 'transcript': 'Your bank account is blocked pay OTP now'}, timeout=30)
print(f"  HTTP {r.status_code} | verdict={r.json().get('verdict','ERR')} | conf={r.json().get('confidence','?')}")
print(f"  (tiny audio used client transcript for classification)")
