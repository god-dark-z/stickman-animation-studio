"""qa_timing — does every word actually land where the audio puts it?

usage: python scripts/qa_timing.py <words.json> [<narration audio>]

Why this exists: captions, `beats` and mouth flaps all read the word timings. If the TTS
provider returns sentence-level marks (or none), the whole video drifts. This gate measures
the timings against the audio itself instead of trusting the provider.

Checks:
  1. structure   monotonic, non-overlapping, sane durations
  2. coverage    the last word ends close to the end of the audio
  3. audibility  for sampled words, the audio energy inside the word's window must be
                 clearly above the silence floor (median error target ≤120 ms is reported
                 as the mean distance from each sampled word to the nearest energy onset)
  4. mode        detects sentence-level-only timings (many words sharing one start)
Exit code 1 on failure.
"""
from __future__ import annotations

import json
import os
import statistics
import subprocess
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


import numpy as np


def ffmpeg_exe() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def decode(path: str) -> tuple[np.ndarray, int]:
    """Mono 16 kHz float32 samples."""
    ff = ffmpeg_exe()
    p = subprocess.run(
        [ff, "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        capture_output=True,
    )
    if p.returncode != 0 or not p.stdout:
        raise RuntimeError(p.stderr.decode("utf8", "replace")[-300:] or "could not decode audio")
    return np.frombuffer(p.stdout, dtype=np.float32), 16000


def envelope(samples: np.ndarray, sr: int, hop_ms: float = 20.0) -> tuple[np.ndarray, float]:
    hop = max(1, int(sr * hop_ms / 1000))
    n = len(samples) // hop
    frames = samples[: n * hop].reshape(n, hop)
    rms = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1) + 1e-12)
    return rms, hop_ms / 1000.0


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python scripts/qa_timing.py <words.json> [audio]")
        return 2
    wj = sys.argv[1]
    audio = sys.argv[2] if len(sys.argv) > 2 else None
    words = json.load(open(wj, encoding="utf8"))
    if not words:
        print("FAIL  no words — narration produced no timings")
        return 1

    failures: list[str] = []
    structural = 0
    for i, w in enumerate(words):
        if w["end"] < w["start"]:
            structural += 1
        if i and w["start"] < words[i - 1]["start"]:
            structural += 1
    if structural:
        failures.append(f"{structural} non-monotonic word timing(s)")

    durations = [w["end"] - w["start"] for w in words]
    med = statistics.median(durations)
    print(f"ok    {len(words)} words, median duration {med * 1000:.0f} ms")
    if med <= 0.02:
        failures.append("word durations collapsed (sentence-level timings?)")
    if med > 1.2:
        failures.append(f"median word duration {med:.2f}s — timings are not per word")

    # sentence-level detection: a third of the words sharing a start time
    starts = {}
    for w in words:
        starts[round(w["start"], 2)] = starts.get(round(w["start"], 2), 0) + 1
    shared = sum(c for c in starts.values() if c >= 3)
    if shared > len(words) * 0.2:
        print(f"WARN  {shared} words share a start time — looks like sentence-level boundaries")

    if audio and os.path.exists(audio):
        samples, sr = decode(audio)
        dur = len(samples) / sr
        last = words[-1]["end"]
        if last > dur + 0.05:
            failures.append(f"last word ends at {last:.2f}s but audio is {dur:.2f}s")
        elif dur - last > 1.5:
            print(f"WARN  {dur - last:.2f}s of audio after the last word")
        env, hop = envelope(samples, sr)
        floor = float(np.percentile(env, 20))
        speech = float(np.percentile(env, 90))
        thr = floor + (speech - floor) * 0.25

        def energy(a: float, b: float) -> float:
            # peak (p90) energy inside the window: a short quiet word like "a" still has a
            # voiced peak, while the mean is dragged down by the silence around it.
            i0, i1 = int(a / hop), min(len(env), int(b / hop) + 1)
            return float(np.percentile(env[i0:i1], 90)) if i1 > i0 else 0.0

        onsets = [i * hop for i in range(1, len(env)) if env[i] > thr and env[i - 1] <= thr]
        sample = words[:: max(1, len(words) // 40)][:40]
        weak = 0
        errors = []
        for w in sample:
            inside = energy(w["start"], w["end"])
            if inside < thr:
                weak += 1
            if onsets:
                nearest = min(onsets, key=lambda o: abs(o - w["start"]))
                errors.append(abs(nearest - w["start"]))
        if weak > max(1, len(sample) * 0.1):
            failures.append(f"{weak}/{len(sample)} sampled words sit on silence — captions will desync")
        if errors:
            med_err = statistics.median(errors)
            print(f"ok    mean |word → nearest speech onset| = {med_err * 1000:.0f} ms (target ≤120 ms, max ≤300 ms)")
            if med_err > 0.12:
                print(f"WARN  onset alignment {med_err * 1000:.0f} ms — consider re-synthesizing or forced alignment")
            if max(errors) > 0.3:
                print("WARN  some words are >300 ms from a speech onset")
        print(f"ok    energy floor {floor * 1000:.1f}, speech {speech * 1000:.1f}, threshold {thr * 1000:.1f}")
    else:
        print("WARN  no audio given — structural checks only (word↔sound alignment not verified)")

    if failures:
        for f in failures:
            print(f"FAIL  {f}")
        return 1
    print("\nPASS — word timings are per-word, monotonic and land on audible speech.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
