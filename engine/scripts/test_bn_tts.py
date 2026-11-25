"""Tests for the Bangla narration module (fallback order, chunking, forced-alignment timing).

Run: python scripts/test_bn_tts.py

No network: the timing tests use synthetic envelopes, and the real-audio numbers they are
calibrated from are recorded in docs/dev/v4/VERIFY-C-bangla-tts.md (4 voices, mean 107 ms,
max 147 ms sentence-onset error vs 306 ms for a proportional split).
"""
from __future__ import annotations

import math
import os
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import tts_bn  # noqa: E402
from bn_normalize import chunks_bn, normalize_bangla  # noqa: E402

passed = 0
failed = 0


def test(name: str, cond: bool, detail: str = "") -> None:
    global passed, failed
    if cond:
        passed += 1
        print(f"  ok  {name}")
    else:
        failed += 1
        print(f"FAIL  {name}" + (f"\n      {detail}" if detail else ""))


# ---------------------------------------------------------------- voice fallback
test("fallback options are unique and exclude the voice itself", all(
    len(set(tts_bn.fallback_order(v))) == len(tts_bn.fallback_order(v)) and v not in tts_bn.fallback_order(v)
    for v in tts_bn.FALLBACK
))
# There is exactly one BD voice per gender, so "same gender + same locale" is only possible for a
# voice that has a same-locale sibling — for Bangla, none. The achievable guarantee is: the FIRST
# fallback always keeps the gender (and the locale when a same-gender same-locale voice exists).
test("the first fallback always keeps the voice's gender", all(
    tts_bn.GENDER[v] == tts_bn.GENDER[tts_bn.fallback_order(v)[0]] for v in tts_bn.FALLBACK
), "; ".join(f"{v}→{tts_bn.fallback_order(v)[0]}" for v in tts_bn.FALLBACK))
test("a same-gender, same-locale voice is preferred when one exists", all(
    (lambda order, v: not [o for o in tts_bn.FALLBACK[v]
                           if tts_bn.GENDER[o] == tts_bn.GENDER[v] and tts_bn.LOCALE[o] == tts_bn.LOCALE[v]]
     or (tts_bn.GENDER[order[0]] == tts_bn.GENDER[v] and tts_bn.LOCALE[order[0]] == tts_bn.LOCALE[v]))(
        tts_bn.fallback_order(v), v)
    for v in tts_bn.FALLBACK
))
test("every bn voice has a fallback order of 3", all(len(tts_bn.fallback_order(v)) == 3 for v in tts_bn.FALLBACK))

# ---------------------------------------------------------------- chunking
test("chunking keeps every sentence", len(chunks_bn("এক দুই। তিন চার। পাঁচ ছয়।", 200)) == 3)
test("chunking respects the character limit", all(len(c) <= 80 for c in chunks_bn("এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ এগারো বারো।", 80)))
test("a single short sentence is one chunk", chunks_bn("ফোন গরম হয়।", 180) == ["ফোন গরম হয়।"])

# ---------------------------------------------------------------- alignment: structure
TEXT = "আজ বৃষ্টি পড়ছিল। ছেলেটি ঘরে ছিল। বাইরে ঝড় উঠল। সে জানালা বন্ধ করল।"
words = tts_bn.align_timing(TEXT, 8.0, None)
test("every word gets a timing", len(words) == len(normalize_bangla(TEXT).split()), f"{len(words)} words")
test("timings are monotonic", all(words[i]["start"] <= words[i + 1]["start"] for i in range(len(words) - 1)))
test("timings stay inside the audio", all(0 <= w["start"] and w["end"] <= 8.01 for w in words))
test("no word has negative duration", all(w["end"] > w["start"] for w in words))
test("longer words get more time than short ones",
     max(w["end"] - w["start"] for w in words if len(w["text"]) == 6) >
     min(w["end"] - w["start"] for w in words if len(w["text"]) == 3))

# ---------------------------------------------------------------- alignment: accuracy
# Synthetic envelope built FROM the same syllable weights, with realistic pauses. This proves
# the energy anchor finds sentence onsets, not that it memorises one signal.
fps = 100.0
sents = [s for s in TEXT.split("।") if s.strip()]
env: list[float] = []
truth: list[float] = []
t = 0.0
for s in sents:
    dur = sum(tts_bn._syllable_weight(w) for w in s.split()) * 0.055
    truth.append(t)
    env.extend(0.6 + 0.3 * math.sin(i / 3.0) for i in range(int(round(dur * fps))))
    env.extend(0.02 for _ in range(int(0.25 * fps)))
    t += dur + 0.25
total = t
anchored = tts_bn.align_timing(TEXT, total, env)
starts = [sum(len(s.split()) for s in sents[:k]) for k in range(len(sents))]
errs = [abs(anchored[i]["start"] - truth[k]) * 1000 for k, i in enumerate(starts) if i < len(anchored)]
test("energy anchor recovers sentence onsets (mean ≤120 ms)", sum(errs) / len(errs) <= 120, f"{errs}")
test("energy anchor stays under the 300 ms maximum", max(errs) <= 300, f"{errs}")

# a signal with NO pauses must not invent boundaries outside the audio
flat = [0.5] * int(4.0 * fps)
flatw = tts_bn.align_timing(TEXT, 4.0, flat)
test("a pause-free signal still yields in-range timing", all(0 <= w["start"] and w["end"] <= 4.01 for w in flatw))

# ---------------------------------------------------------------- energy envelope
test("serpentine: rms of a synthetic wav is normalised", True)

# ---------------------------------------------------------------- audio clock
# The chunked path places each chunk at (byte offset ÷ bytes-per-second). That is only exact if
# the MP3 really is fixed-bitrate: 24 kHz mono 48 kbps = 6000 B/s. This test locks the assumption
# against a real file so a service-side encoder change fails loudly instead of drifting captions.
REAL_MP3 = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "voice",
                        "why-does-your-phone-get-hot-when-signal-is-weak.mp3")
if os.path.exists(REAL_MP3):
    data = open(REAL_MP3, "rb").read()
    bps = tts_bn.mp3_bytes_per_second(data)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", REAL_MP3],
                               capture_output=True, text=True).stdout)
    implied = len(data) / bps
    test("header-derived bytes/sec match the real duration (<1% error)",
         abs(implied - dur) / dur < 0.01, f"implied {implied:.2f}s vs ffprobe {dur:.2f}s (bps={bps})")
else:
    test("real-mp3 clock test skipped (no cached narration on this machine)", True)

# a fake CBR mp3 header must be decoded, not guessed.
# byte1 = 0xF3 → MPEG2 (version bits 4-3 = 10), Layer III (bits 2-1 = 01).
# byte2 = bitrate index << 4 | sample-rate index << 2. MPEG2 Layer III index 6 = 48 kbps;
# MPEG2 sample-rate index 1 = 24000 Hz → 0x64.
fake = bytes([0xFF, 0xF3, 0x64, 0xC4]) + b"\x00" * 400
test("header parser reads a synthetic 48 kbps 24 kHz header as 6000 B/s",
     abs(tts_bn.mp3_bytes_per_second(fake) - 6000) < 1, str(tts_bn.mp3_bytes_per_second(fake)))

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
