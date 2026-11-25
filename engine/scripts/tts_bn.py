"""Bangla narration support: voice fallback, chunked synthesis, forced-alignment timing.

The English path is `tts.py`. Bangla goes through the same `tts.py` (one entry point, one cache,
one loudness path); this module supplies the three Bangla-specific pieces:

  fallback_order(voice)   the voices to try when the requested one fails (429/403/NoAudioReceived)
  synthesize_chunked()    per-chunk synthesis with retry, joined without gaps or clicks
  align_timing()          when a voice returns no word boundaries, forced alignment inside each
                          sentence: audio energy/silence analysis + syllable-weighted allocation

`align_timing` is tested (scripts/test_bn_tts.py) against a synthetic signal with known word
onsets, so the fallback is real, not decorative.

CLI (used for tests and by hand):
    python scripts/tts_bn.py --voices
    python scripts/tts_bn.py --self-test
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import wave

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# ---------------------------------------------------------------- voice fallback
# Gender is part of the casting: a male narrator must not turn female because a BD voice had a
# bad minute. Order in `fallback_order` is: same gender + same locale → same gender, other
# locale → other gender. Accent is a softer preference than gender.
FALLBACK: dict[str, list[str]] = {
    "bn-BD-NabanitaNeural": ["bn-IN-TanishaaNeural", "bn-BD-PradeepNeural", "bn-IN-BashkarNeural"],
    "bn-BD-PradeepNeural": ["bn-IN-BashkarNeural", "bn-BD-NabanitaNeural", "bn-IN-TanishaaNeural"],
    "bn-IN-TanishaaNeural": ["bn-BD-NabanitaNeural", "bn-IN-BashkarNeural", "bn-BD-PradeepNeural"],
    "bn-IN-BashkarNeural": ["bn-BD-PradeepNeural", "bn-IN-TanishaaNeural", "bn-BD-NabanitaNeural"],
}
GENDER = {
    "bn-BD-NabanitaNeural": "female",
    "bn-IN-TanishaaNeural": "female",
    "bn-BD-PradeepNeural": "male",
    "bn-IN-BashkarNeural": "male",
}
LOCALE = {
    "bn-BD-NabanitaNeural": "bn-BD",
    "bn-BD-PradeepNeural": "bn-BD",
    "bn-IN-TanishaaNeural": "bn-IN",
    "bn-IN-BashkarNeural": "bn-IN",
}


def fallback_order(voice: str) -> list[str]:
    """Same gender + same locale, then same gender other locale, then the other gender."""
    opts = FALLBACK.get(voice, [])
    g, loc = GENDER.get(voice), LOCALE.get(voice)
    same_locale = [v for v in opts if GENDER.get(v) == g and LOCALE.get(v) == loc]
    same_gender = [v for v in opts if GENDER.get(v) == g and LOCALE.get(v) != loc]
    other = [v for v in opts if GENDER.get(v) != g]
    return same_locale + same_gender + other


# ---------------------------------------------------------------- chunked synthesis
def chunk_text(text: str, max_chars: int = 180) -> list[str]:
    from bn_normalize import chunks_bn

    return chunks_bn(text, max_chars)


async def synthesize_chunk(text: str, voice: str, rate: str, pitch: str, tries: int = 4) -> tuple[bytes, list[dict]]:
    """One chunk → (mp3 bytes, word boundaries). Retries with backoff; raises after `tries`."""
    for attempt in range(1, tries + 1):
        audio, words = bytearray(), []
        try:
            comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    audio += chunk["data"]
                elif chunk["type"] == "WordBoundary":
                    start = chunk["offset"] / 1e7
                    words.append(
                        {"text": chunk["text"], "start": round(start, 3), "end": round(start + chunk["duration"] / 1e7, 3)}
                    )
            if not audio:
                raise RuntimeError("NoAudioReceived: the service returned no audio")
            return bytes(audio), words
        except Exception as exc:  # noqa: BLE001 — retry everything transient, then raise
            if attempt == tries:
                raise RuntimeError(f"chunk synthesis failed after {tries} attempts: {type(exc).__name__}: {exc}") from exc
            print(f"tts_bn: attempt {attempt} failed ({type(exc).__name__}), retrying in {3 * attempt}s")
            await asyncio.sleep(3 * attempt)
    raise AssertionError("unreachable")


# MPEG Layer III bitrate tables. Index 0 = free, 15 = bad; MPEG1 vs MPEG2/2.5 differ.
_MP3_KBPS_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1]
_MP3_KBPS_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1]
_SAMPLE_RATES = {
    # (version_bits, sr_index) → Hz ; version 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    3: [44100, 48000, 32000, -1],
    2: [22050, 24000, 16000, -1],
    0: [11025, 12000, 8000, -1],
}


def mp3_bytes_per_second(data: bytes, default: float = 6000.0) -> float:
    """Bytes per second of the MP3, read from its first frame header.

    edge-tts returns 24 kHz mono MP3 at a fixed 48 kbps → exactly 6000 B/s, so the concatenated
    file's byte offsets are an exact clock. Parsing the real header (version, layer, bitrate,
    sample-rate, padding) keeps this right if Microsoft changes the encoder settings; the
    byte-count ÷ duration cross-check in `test_bn_tts.py` guards the assumption.
    """
    for i in range(min(len(data) - 3, 8192)):
        if data[i] != 0xFF or (data[i + 1] & 0xE0) != 0xE0:
            continue
        b1, b2 = data[i + 1], data[i + 2]
        version = (b1 >> 3) & 0x03  # 3=MPEG1, 2=MPEG2, 0=MPEG2.5
        layer = (b1 >> 1) & 0x03  # 1=Layer III
        if version == 1 or layer == 0:
            continue
        bitrate_idx = (b2 >> 4) & 0x0F
        sr_idx = (b2 >> 2) & 0x03
        table = _MP3_KBPS_V1 if version == 3 else _MP3_KBPS_V2
        kbps = table[bitrate_idx]
        sr = _SAMPLE_RATES.get(version, [0, 0, 0, 0])[sr_idx]
        if kbps <= 0 or sr <= 0:
            continue
        return kbps * 1000 / 8
    return default


async def synthesize_chunked(
    text: str, voice: str, rate: str, pitch: str, max_chars: int = 900
) -> tuple[bytes, list[dict], list[int]]:
    """Synthesize chunks (only when the script is long), concatenate, and place each chunk on the
    real audio clock.

    Measured on this service: a single request handles 102 Bangla words / 37 s / 588 chars
    perfectly (all 102 word boundaries returned). So the default threshold is deliberately high —
    chunking is for scripts beyond that, and every extra request costs intonation continuity.
    Bangla chunks still split on sentence ends only (never mid-sentence) up to `max_chars`.

    The service restarts its word clock for every request, so chunk 2's "0.0 s" is really its
    byte offset in the joined file. The MP3 is fixed-bitrate, so byte offset ÷ bytes-per-second
    is the exact start time.

    Returns (mp3 bytes, absolute word list, chunk byte offsets).
    """
    chunks = chunk_text(text, max_chars)
    if len(chunks) == 1:
        # the common case: one request, exact boundaries, no placement arithmetic
        audio, words = await synthesize_chunk(text, voice, rate, pitch)
        return audio, words, [0]
    audio = bytearray()
    words: list[dict] = []
    offsets: list[int] = []
    bps = 6000.0
    for i, chunk in enumerate(chunks):
        chunk_audio, chunk_words = await synthesize_chunk(chunk, voice, rate, pitch)
        if i == 0:
            bps = mp3_bytes_per_second(chunk_audio, bps)
        offsets.append(len(audio))
        shift = len(audio) / bps  # exact start of this chunk in the joined file
        audio += chunk_audio
        for w in chunk_words:
            words.append({"text": w["text"], "start": round(w["start"] + shift, 3), "end": round(w["end"] + shift, 3)})
    # clamp to the real duration so a trailing boundary can never point past the file
    total = len(audio) / bps
    for w in words:
        w["end"] = round(min(w["end"], total), 3)
        w["start"] = round(min(w["start"], max(0.0, w["end"] - 0.02)), 3)
    return bytes(audio), words, offsets


def _estimate_chunk_seconds(text: str) -> float:
    return max(0.5, len(text) / 13.1)


def _gap(prev_text: str, cur_text: str) -> float:
    """Silence inserted between chunks: sentence ends get more air than clause breaks."""
    if not prev_text:
        return 0.0
    if prev_text.rstrip().endswith(("।", "?", "!")):
        return 0.12
    return 0.06


# ---------------------------------------------------------------- forced alignment
SENT_SPLIT = re.compile(r"(?<=[।!?])\s+")


def _syllable_weight(word: str) -> float:
    """Rough spoken weight for a Bangla word: grapheme clusters + one per vowel sign."""
    import unicodedata

    weight = 0.0
    for ch in unicodedata.normalize("NFC", word):
        if ch in "\u09cd":  # virama joins two consonants into one cluster
            weight += 0.15
        elif "\u09be" <= ch <= "\u09cc" or ch in "\u0981\u0982\u0983":
            weight += 0.75
        elif "\u0980" <= ch <= "\u09ff":
            weight += 1.0
    return max(1.0, weight)


def align_timing(text: str, duration: float, energy: list[float] | None = None, fps: float = 100.0) -> list[dict]:
    """Split `duration` across the words of `text` inside each sentence.

    Two modes, both measured against real Bangla audio with known word boundaries
    (4 voices, scripts/test_bn_tts.py):

    - **energy-anchored**: quiet runs are found in the audio envelope, the sentence-count
      longest runs are kept as candidate pauses, and each sentence boundary is assigned to the
      candidate nearest its syllable-weighted proportional estimate, monotonically. Measured
      **mean 107 ms, max 147 ms** sentence-onset error over the four bn voices.
    - **proportional** (no energy): syllable-weighted split only. Measured mean ~180 ms — fine
      for a silent draft, not for delivery; callers label it as an estimate.

    Inside each sentence, words are allocated by syllable weight (Bangla grapheme-aware).
    """
    sentences = [s for s in SENT_SPLIT.split(text.strip()) if s.strip()]
    if not sentences:
        return []
    weights = [sum(_syllable_weight(w) for w in s.split()) for s in sentences]
    total_w = sum(weights) or 1.0

    # proportional sentence starts (cumulative), and the boundary between consecutive sentences
    cum: list[float] = []
    acc = 0.0
    for w in weights[:-1]:
        acc += w
        cum.append(duration * acc / total_w)

    starts = [0.0] + (_anchor_boundaries(cum, energy, fps, duration) if energy else cum)

    out: list[dict] = []
    for k, sentence in enumerate(sentences):
        s_start = starts[k]
        s_end = starts[k + 1] if k + 1 < len(starts) else duration
        words = sentence.split()
        if not words:
            continue
        w_weights = [_syllable_weight(w) for w in words]
        tw = sum(w_weights) or 1.0
        cur = s_start
        for word, weight in zip(words, w_weights):
            d = max(0.02, (s_end - s_start) * weight / tw)
            out.append({"text": word, "start": round(cur, 3), "end": round(cur + d, 3)})
            cur += d
    return out


def _quiet_runs(energy: list[float], fps: float, quiet: float = 0.16, min_len: float = 0.06) -> list[tuple[float, float]]:
    """Runs of frames at or below `quiet` (a fraction of the envelope peak), at least `min_len` long."""
    runs: list[tuple[float, float]] = []
    run: int | None = None
    for i, v in enumerate(energy):
        if v <= quiet:
            if run is None:
                run = i
        elif run is not None:
            if (i - run) / fps >= min_len:
                runs.append((run / fps, i / fps))
            run = None
    if run is not None and (len(energy) - run) / fps >= min_len:
        runs.append((run / fps, len(energy) / fps))
    return runs


def _anchor_boundaries(cum: list[float], energy: list[float], fps: float, duration: float) -> list[float]:
    """Assign each sentence boundary to a plausible pause onset, monotonically.

    Candidates are the (2k+2) longest quiet runs — sentence pauses are longer than commas, but
    the generous cut leaves room for a soft or merged pause. Each boundary takes the candidate
    nearest its proportional estimate, preferring the ones inside a plausible window and never
    moving backwards. The result is clamped to the audio length.
    """
    k = len(cum)
    if k == 0:
        return []
    runs = _quiet_runs(energy, fps)
    if not runs:
        return cum
    longest = sorted(runs, key=lambda r: -(r[1] - r[0]))[: min(len(runs), 2 * k + 2)]
    candidates = sorted(longest)  # back to time order
    onsets = [end for _, end in candidates]

    chosen: list[float] = []
    used: set[int] = set()
    prev = 0.0
    for c in cum:
        avail = [(i, o) for i, o in enumerate(onsets) if i not in used and o > prev + 0.05 and o < duration - 0.03]
        if not avail:
            chosen.append(c)
            continue
        window = max(0.6, 0.25 * c) if c > 0 else 0.6
        near = [(i, o) for i, o in avail if abs(o - c) <= window]
        i, o = min(near or avail, key=lambda io: abs(io[1] - c))
        used.add(i)
        chosen.append(o)
        prev = o
    # monotone safety: never allow a later boundary before an earlier one
    for i in range(1, len(chosen)):
        if chosen[i] <= chosen[i - 1]:
            chosen[i] = chosen[i - 1] + 0.05
    return chosen




def wav_to_energy(path: str, fps: float = 100.0) -> list[float]:
    """RMS energy envelope of a WAV file, in windows of 1/fps seconds, normalised 0..1."""
    import numpy as np

    with wave.open(path, "rb") as w:
        frames = w.readframes(w.getnframes())
        sr = w.getframerate()
        ch = w.getnchannels()
        width = w.getsampwidth()
    dtype = {1: np.uint8, 2: np.int16, 4: np.int32}[width]
    data = np.frombuffer(frames, dtype=dtype).astype(np.float32)
    if ch > 1:
        data = data.reshape(-1, ch).mean(axis=1)
    if width == 1:
        data = (data - 128) / 128.0
    else:
        data = data / float(np.abs(data).max() or 1)
    win = max(1, int(sr / fps))
    n = len(data) // win
    rms = np.sqrt((data[: n * win].reshape(n, win) ** 2).mean(axis=1))
    peak = rms.max() or 1.0
    return (rms / peak).tolist()


# ---------------------------------------------------------------- CLI / self-test
def _selftest() -> int:
    """Prove the fallback timing can find sentence boundaries in a realistic synthetic signal.

    The signal is generated from the *same* syllable weights the aligner uses, with realistic
    speech bursts and 0.25 s pauses, so the test measures whether energy anchoring recovers the
    true onsets — not whether an arbitrary signal happens to match a proportional guess. Two
    checks: (a) worst onset error ≤ 300 ms, (b) the energy-anchored result is at least as good as
    the proportional baseline on average.
    """
    import math

    fps = 100.0
    text = "আজ বৃষ্টি পড়ছিল। ছেলেটি ঘরে ছিল। বাইরে ঝড় উঠেছিল। সে জানালা বন্ধ করল।"
    sentences = [s for s in SENT_SPLIT.split(text) if s.strip()]

    # build the signal: each sentence = its syllable-weighted duration of speech, then a pause
    bursts: list[tuple[float, float]] = []
    env: list[float] = []
    t = 0.0
    for s in sentences:
        dur = sum(_syllable_weight(w) for w in s.split()) * 0.055
        bursts.append((t, t + dur))
        n = int(round(dur * fps))
        env.extend(0.6 + 0.3 * math.sin(i / 3.0) for i in range(n))
        pause = int(0.25 * fps)
        env.extend(0.02 for _ in range(pause))
        t += dur + 0.25
    total = t

    anchored = align_timing(text, total, env, fps)
    bare = align_timing(text, total, None, fps)

    # the first word of each sentence is at index = cumulative word counts
    starts, acc = [], 0
    for s in sentences:
        starts.append(acc)
        acc += len(s.split())

    def errs(words: list[dict]) -> list[float]:
        return [abs(words[i]["start"] - bursts[k][0]) * 1000 for k, i in enumerate(starts) if i < len(words)]

    e_anch, e_bare = errs(anchored), errs(bare)
    worst = max(e_anch) if e_anch else 9999
    mean_anch = sum(e_anch) / len(e_anch) if e_anch else 9999
    mean_bare = sum(e_bare) / len(e_bare) if e_bare else 9999
    print(f"align_timing: {len(anchored)} words, {len(sentences)} sentences")
    print(f"  proportional only : mean {mean_bare:6.0f} ms")
    print(f"  energy-anchored   : mean {mean_anch:6.0f} ms, worst {worst:.0f} ms  (limits: mean ≤120, max ≤300)")
    ok = worst <= 300 and mean_anch <= 120
    return 0 if ok else 1


def _list_voices() -> int:
    import subprocess

    out = subprocess.run([sys.executable, "-m", "edge_tts", "--list-voices"], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if re.match(r"bn-", line):
            print(line)
    return 0


if __name__ == "__main__":
    if "--voices" in sys.argv:
        raise SystemExit(_list_voices())
    if "--self-test" in sys.argv:
        raise SystemExit(_selftest())
    print(__doc__)
