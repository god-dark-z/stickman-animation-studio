"""Multi-speaker narration: one audio track, several voices, one timeline.

usage: python scripts/dialogue_tts.py <plan.json> <out_mp3> <out_words.json> [--lang en|bn]

The plan is a list of narration runs in playback order:

    [
      {"speaker": "narrator", "text": "In 1952 the police opened fire.", "voice": "en-US-AndrewMultilingualNeural", "rate": "+22%"},
      {"speaker": "rahim",    "text": "\"They did not expect us to sing.\"", "voice": "en-US-GuyNeural", "rate": "+8%"}
    ]

Each run is synthesized with its own voice, the pieces are joined on an exact byte clock (the
MP3 is fixed-bitrate), and the word timings are shifted into absolute time — so the timeline,
captions, beats and lip-sync consume the result exactly as they consume a single-voice track.
This is what makes two-character dialogue sound like two people.

The single-voice path in make.ts does NOT use this script: with one voice, one request and its
own boundaries are strictly better (no joins, no shifts).
"""
from __future__ import annotations

import asyncio
import json
import os
import sys

import edge_tts

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
if HERE not in sys.path:
    sys.path.insert(0, HERE)


def load_pack(lang: str) -> dict:
    return json.load(open(os.path.join(ENGINE, "lang", lang, "pack.json"), encoding="utf8"))


async def synth_run(text: str, voice: str, rate: str, pitch: str, tries: int = 4):
    last = None
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
        except Exception as e:  # noqa: BLE001
            last = e
            if attempt < tries:
                print(f"dialogue_tts: run failed ({type(e).__name__}), retry {attempt}")
                await asyncio.sleep(2 * attempt)
    raise RuntimeError(f"run synthesis failed: {last}")


async def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    lang = "en"
    if "--lang" in sys.argv:
        lang = sys.argv[sys.argv.index("--lang") + 1]
    plan_path, out_mp3, out_json = args[:3]
    plan = json.load(open(plan_path, encoding="utf8"))
    if not plan:
        raise SystemExit("empty plan")

    default_voice = load_pack(lang)["tts"]["defaultVoice"]
    from tts_bn import mp3_bytes_per_second

    audio = bytearray()
    words: list[dict] = []
    bps = 6000.0
    for i, run in enumerate(plan):
        text = (run.get("text") or "").strip()
        if not text or text == "…":
            continue
        piece, piece_words = await synth_run(
            text, run.get("voice") or default_voice, run.get("rate") or "+0%", run.get("pitch") or "+0Hz"
        )
        if bps == 6000.0:
            bps = mp3_bytes_per_second(piece, bps)
        shift = len(audio) / bps
        audio += piece
        for w in piece_words:
            words.append({"text": w["text"], "start": round(w["start"] + shift, 3), "end": round(w["end"] + shift, 3)})
        print(f"dialogue_tts: {run.get('speaker', i)} → {run.get('voice') or default_voice} @ {run.get('rate') or '+0%'} ({len(piece_words)} words)")

    total = len(audio) / bps
    for w in words:
        w["end"] = round(min(w["end"], total), 3)
        w["start"] = round(min(w["start"], max(0.0, w["end"] - 0.02)), 3)
    open(out_mp3, "wb").write(bytes(audio))
    json.dump(words, open(out_json, "w", encoding="utf8"), indent=0)
    print(f"dialogue_tts: {len(plan)} run(s), {len(words)} words, {total:.2f}s")


asyncio.run(main())
