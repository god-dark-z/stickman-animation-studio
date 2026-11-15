"""Kokoro ONNX TTS (local, no internet) with word timings via faster-whisper.

usage: python scripts/tts_kokoro.py <text_file> <out_wav> <out_words_json> [voice] [speed]
- voice: default "am_michael" (matches PROVIDER_VOICES in schema)
- speed: speed multiplier (e.g. "0.82"), NOT a percentage. Default "0.82".

Outputs:
- WAV at native 24000 Hz mono PCM_16 (ffmpeg in make.ts resamples to 44.1k for final MP4)
- words.json: [{"text": "...", "start": 0.123, "end": 0.456}, ...] (absolute seconds from start of audio)

Model paths (preinstalled):
- ONNX model: C:\\Users\\black\\.cache\\hyperframes\\tts\\models\\kokoro-v1.0.onnx
- Voices:    C:\\Users\\black\\.cache\\hyperframes\\tts\\voices\\voices-v1.0.bin

Strategy for word timings (Kokoro v1.0 has no duration head; create_timed returns empty):
synthesize FULL text as one take (natural prosody) -> save WAV ->
run faster-whisper base.en with word_timestamps=True on that WAV ->
write word timings to words.json
"""
import json
import sys
import os

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from faster_whisper import WhisperModel


MODEL_PATH = r"C:\Users\black\.cache\hyperframes\tts\models\kokoro-v1.0.onnx"
VOICES_PATH = r"C:\Users\black\.cache\hyperframes\tts\voices\voices-v1.0.bin"


def main():
    if len(sys.argv) < 4:
        print("usage: python scripts/tts_kokoro.py <text_file> <out_wav> <out_words_json> [voice] [speed]", file=sys.stderr)
        sys.exit(1)

    text_file = sys.argv[1]
    out_wav = sys.argv[2]
    out_words_json = sys.argv[3]
    voice = sys.argv[4] if len(sys.argv) > 4 else "am_michael"
    speed = float(sys.argv[5]) if len(sys.argv) > 5 else 0.82

    text = open(text_file, encoding="utf8").read().strip()
    if not text:
        raise SystemExit("empty narration text")

    # 1) Synthesize with Kokoro ONNX (24 kHz mono)
    print(f"kokoro: synthesizing with voice={voice}, speed={speed}")
    k = Kokoro(MODEL_PATH, VOICES_PATH)
    # create_timed returns (audio, sample_rate, timings) but timings is empty in v1.0
    audio, sr, _ = k.create_timed(text, voice=voice, speed=speed, lang="en-us")
    # audio is float32 numpy array, sr is 24000

    # Save WAV at native 24000 Hz PCM_16
    os.makedirs(os.path.dirname(os.path.abspath(out_wav)), exist_ok=True)
    sf.write(out_wav, audio, sr, subtype="PCM_16")
    print(f"kokoro: saved {out_wav} ({len(audio)/sr:.2f}s @ {sr}Hz)")

    # 2) Run faster-whisper base.en on the generated WAV for word timings
    # Use int8 compute_type on CPU, local_files_only=True for offline operation
    print("kokoro: running faster-whisper for word timings...")
    model = WhisperModel("base.en", device="cpu", compute_type="int8", local_files_only=True)
    segments, _ = model.transcribe(out_wav, word_timestamps=True, language="en")

    words = []
    for segment in segments:
        if hasattr(segment, 'words') and segment.words:
            for w in segment.words:
                # word has .word, .start, .end (in seconds, absolute from audio start)
                word_text = w.word.strip()
                if word_text:  # skip empty
                    words.append({
                        "text": word_text,
                        "start": round(w.start, 3),
                        "end": round(w.end, 3)
                    })

    # 3) Write words.json in the engine's expected format
    tmp = out_words_json + ".tmp"
    with open(tmp, "w", encoding="utf8") as f:
        json.dump(words, f, ensure_ascii=False)
    os.replace(tmp, out_words_json)
    print(f"kokoro: {len(words)} words -> {out_words_json}")


if __name__ == "__main__":
    main()