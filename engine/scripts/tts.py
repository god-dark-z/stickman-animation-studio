"""Narration via Microsoft Edge neural TTS (free, no API key) with per-word timestamps.

usage: python scripts/tts.py <text_file> <out_mp3> <out_words_json> [voice] [rate] [pitch] [--lang en|bn]
writes the mp3 and a JSON list of {text, start, end} in seconds.

Both production languages go through this one path: the voice decides the language, and
`--lang` selects the text normalizer (bn: digits, punctuation, pronunciation dictionary —
see scripts/bn_normalize.py). English behaviour is unchanged when --lang is omitted.
"""
import asyncio
import json
import sys

import edge_tts


def parse_args(argv):
    """Positional args first, then `--lang xx`. Returns (text_file, out_mp3, out_json, voice, rate, pitch, lang)."""
    lang = "en"
    if "--lang" in argv:
        i = argv.index("--lang")
        lang = argv[i + 1]
        argv = argv[:i] + argv[i + 2 :]
    text_file, out_mp3, out_json = argv[0:3]
    voice = argv[3] if len(argv) > 3 else "en-US-AndrewMultilingualNeural"
    rate = argv[4] if len(argv) > 4 else "+12%"
    pitch = argv[5] if len(argv) > 5 else "+0Hz"
    return text_file, out_mp3, out_json, voice, rate, pitch, lang


def normalize(text, lang):
    """Language hook. English passes through unchanged; Bangla gets the full normalizer."""
    if lang == "bn":
        try:
            from bn_normalize import normalize_bangla
        except ImportError:  # running from another cwd — add the script directory
            import os

            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from bn_normalize import normalize_bangla
        return normalize_bangla(text)
    return text


async def synthesize(text, voice, rate, pitch, tries=4):
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
            return bytes(audio), words
        except Exception as e:
            if attempt == tries:
                raise
            print(f"tts: attempt {attempt} failed ({type(e).__name__}), retrying")
            await asyncio.sleep(3 * attempt)


async def main():
    text_file, out_mp3, out_json, voice, rate, pitch, lang = parse_args(sys.argv[1:])
    raw_text = open(text_file, encoding="utf8").read()
    text = normalize(raw_text, lang)
    audio, words = await synthesize(text, voice, rate, pitch)
    with open(out_mp3, "wb") as f:  # only touched once everything arrived
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
    json.dump(words, open(out_json, "w", encoding="utf8"), indent=0)
    print(f"tts: {lang} {len(words)} words, {words[-1]['end'] if words else 0:.2f}s")


asyncio.run(main())
