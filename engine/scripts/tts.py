"""Narration via Microsoft Edge neural TTS (free, no API key) with per-word timestamps.

usage: python scripts/tts.py <text_file> <out_mp3> <out_words_json> [voice] [rate] [pitch]
                             [--lang en|bn] [--no-fallback] [--estimate-only]

writes the mp3 and a JSON list of {text, start, end} in seconds.

Both production languages go through this one path: the voice decides the language, and
`--lang` selects the text normalizer (bn: digits, punctuation, pronunciation dictionary —
scripts/bn_normalize.py). English behaviour is unchanged when --lang is omitted.

Bangla specifics (scripts/tts_bn.py):
  * chunked synthesis (sentence-aware) so a long script never becomes one giant request
  * voice fallback: a failing voice is retried, then replaced by a same-gender voice
  * word-boundary timing; if a voice returns none, forced alignment from the audio envelope
  * `--estimate-only` writes syllable-weighted timings and a silent placeholder (offline mode)
"""
import asyncio
import json
import os
import struct
import sys

import edge_tts

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))


def parse_args(argv):
    """Positional args first, then flags. Returns a dict."""
    flags = {"lang": "en", "no_fallback": False, "estimate_only": False}
    if "--lang" in argv:
        i = argv.index("--lang")
        flags["lang"] = argv[i + 1]
        argv = argv[:i] + argv[i + 2 :]
    if "--no-fallback" in argv:
        flags["no_fallback"] = True
        argv = [a for a in argv if a != "--no-fallback"]
    if "--estimate-only" in argv:
        flags["estimate_only"] = True
        argv = [a for a in argv if a != "--estimate-only"]
    text_file, out_mp3, out_json = argv[0:3]
    return {
        "text_file": text_file,
        "out_mp3": out_mp3,
        "out_json": out_json,
        "voice": argv[3] if len(argv) > 3 else "en-US-AndrewMultilingualNeural",
        "rate": argv[4] if len(argv) > 4 else "+12%",
        "pitch": argv[5] if len(argv) > 5 else "+0Hz",
        **flags,
    }


def normalize(text, lang, story_dir=None):
    """Language hook. English passes through unchanged; Bangla gets the full normalizer.

    A story may ship `stories/<slug>/pronunciation.json` to respell its own proper nouns; it is
    merged on top of the shipped dictionary.
    """
    if lang == "bn":
        if HERE not in sys.path:
            sys.path.insert(0, HERE)
        from bn_normalize import latin_leftovers, normalize_bangla

        extras = []
        if story_dir:
            p = os.path.join(story_dir, "pronunciation.json")
            if os.path.exists(p):
                extras.append(p)
        out = normalize_bangla(text, extras)
        leftovers = latin_leftovers(out)
        if leftovers:
            # The pack's latinPolicy is "warn": say exactly which words, so the agent can add them
            # to the story dictionary or rewrite the line.
            print(f"tts: BANGLA LATIN LEFTOVER {len(leftovers)} word(s): {', '.join(leftovers[:12])}"
                  + (" …" if len(leftovers) > 12 else ""))
        return out
    return text


async def synthesize(text, voice, rate, pitch, tries=4):
    """Single-request synthesis (English path, unchanged from V3)."""
    for attempt in range(1, tries + 1):
        audio, words = bytearray(), []
        try:
            comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    audio += chunk["data"]
                elif chunk["type"] == "WordBoundary":
                    start = chunk["offset"] / 1e7
                    words.append({"text": chunk["text"], "start": round(start, 3), "end": round(start + chunk["duration"] / 1e7, 3)})
            if not audio:
                raise RuntimeError("NoAudioReceived: no audio returned")
            return bytes(audio), words
        except Exception as e:
            if attempt == tries:
                raise
            print(f"tts: attempt {attempt} failed ({type(e).__name__}), retrying")
            await asyncio.sleep(3 * attempt)
    raise AssertionError("unreachable")


def mp3_duration_seconds(path: str) -> float:
    """Duration of an MP3 without ffmpeg: use the first frame header's bitrate and the file size."""
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        data = f.read(4096)
    # find a frame sync (0xFF 0xEx) and decode MPEG1 Layer III bitrate
    bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    for i in range(len(data) - 1):
        if data[i] == 0xFF and (data[i + 1] & 0xE0) == 0xE0:
            idx = (data[i + 1] >> 1) & 0x0F
            if 1 <= idx < len(bitrates):
                kbps = bitrates[idx]
                if kbps:
                    return size * 8 / (kbps * 1000)
    return 0.0


def write_silence_mp3(path: str, seconds: float) -> None:
    """A tiny silent MP3 (no ffmpeg): repeated 24 kHz mono silent frames."""
    # MPEG1 Layer III, 24 kbps, 24 kHz — a valid header is enough for the renderer to see a track
    frames = max(1, int(seconds / 0.048))  # one frame ≈ 48 ms at 24 kHz
    frame = b"\xff\xf3\x44\xc4" + b"\x00" * 100  # header + zeroed side info/main data
    with open(path, "wb") as f:
        f.write(frame * frames)


async def main():
    cfg = parse_args(sys.argv[1:])
    lang = cfg["lang"]
    raw_text = open(cfg["text_file"], encoding="utf8").read()
    # the story directory lives beside the words file: out/<slug>/words.json ← stories/<slug>/
    story_dir = None
    outdir = os.path.dirname(os.path.abspath(cfg["out_json"]))
    cand = os.path.join(os.path.dirname(HERE), "stories")
    slug = os.path.basename(outdir)
    if os.path.isdir(os.path.join(cand, slug)):
        story_dir = os.path.join(cand, slug)
    text = normalize(raw_text, lang, story_dir)

    if cfg["estimate_only"]:
        if HERE not in sys.path:
            sys.path.insert(0, HERE)
        from tts_bn import align_timing
        from tts_bn import _syllable_weight  # noqa: F401 — documented dependency

        # measured speed for the language, from its pack
        pack = json.load(open(os.path.join(os.path.dirname(HERE), "lang", lang, "pack.json"), encoding="utf8"))
        wps = pack["rates"]["wordsPerSecond"]
        duration = max(1.0, len(text.split()) / wps)
        words = align_timing(text, duration, None)
        write_silence_mp3(cfg["out_mp3"], duration)
        json.dump(words, open(cfg["out_json"], "w", encoding="utf8"), indent=0)
        print(f"tts: {lang} ESTIMATED {len(words)} words, {duration:.2f}s (silent placeholder, no TTS)")
        return

    if lang == "bn":
        if HERE not in sys.path:
            sys.path.insert(0, HERE)
        from tts_bn import align_timing, fallback_order, synthesize_chunked

        voices = [cfg["voice"]] + ([] if cfg["no_fallback"] else fallback_order(cfg["voice"]))
        last_err = None
        for i, voice in enumerate(voices):
            try:
                audio, words, _ = await synthesize_chunked(text, voice, cfg["rate"], cfg["pitch"])
                if i > 0:
                    print(f"tts: bangla voice fallback → {voice}")
                break
            except Exception as e:  # noqa: BLE001 — try the next voice, then re-raise
                last_err = e
                print(f"tts: voice {voice} failed ({type(e).__name__}) — trying the next")
        else:
            raise RuntimeError(f"every Bangla voice failed; last error: {last_err}")
        with open(cfg["out_mp3"], "wb") as f:
            f.write(audio)
        if not words:
            # the voice returned audio but no boundaries: forced alignment in the audio envelope
            import subprocess, tempfile

            dur = mp3_duration_seconds(cfg["out_mp3"])
            words = align_timing(text, dur, None)
            print(f"tts: bangla — no word boundaries; estimated {len(words)} timings over {dur:.2f}s")
    else:
        audio, words = await synthesize(text, cfg["voice"], cfg["rate"], cfg["pitch"])
        with open(cfg["out_mp3"], "wb") as f:
            f.write(audio)

    # Re-attach punctuation from the (normalized) text so captions read naturally. Bangla word
    # boundaries keep their own text when no token matches: never lose a spoken word.
    tokens = text.split()
    ti = 0
    norm = lambda s: "".join(c for c in s.lower() if c.isalnum())
    for w in words:
        for k in range(ti, min(ti + 4, len(tokens))):
            if norm(tokens[k]) == norm(w["text"]):
                w["text"] = tokens[k]
                ti = k + 1
                break
    if not words:
        raise RuntimeError("no word timings produced — the narration would be uncaptioned")
    json.dump(words, open(cfg["out_json"], "w", encoding="utf8"), indent=0)
    print(f"tts: {lang} {len(words)} words, {words[-1]['end'] if words else 0:.2f}s")


asyncio.run(main())
