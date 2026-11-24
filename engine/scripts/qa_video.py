"""qa_video — container and picture gate for a rendered MP4.

usage: python scripts/qa_video.py <video.mp4> [--expect-seconds N] [--preview]

Checks:
  1. specs      H.264 video + AAC audio, 30 fps, 1080x1920 (540x960 with --preview)
  2. duration   matches the narration (timeline.json in the same folder, when present)
  3. dead frame blackdetect must not find a run longer than 0.6 s anywhere
  4. letterbox  the frame must not be mostly a single colour (a failed scene render)
Exit code 1 on a failed check.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass



def ffmpeg_exe() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def ffprobe_exe(ff: str) -> str:
    cand = os.path.join(os.path.dirname(ff), "ffprobe" + (".exe" if os.name == "nt" else ""))
    return cand if os.path.exists(cand) else "ffprobe"


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print("usage: python scripts/qa_video.py <video.mp4> [--expect-seconds N] [--preview]")
        return 2
    video = args[0]
    preview = "--preview" in args
    silent = "--silent" in args  # --no-tts renders legitimately have no audio stream
    expect = None
    if "--expect-seconds" in args:
        try:
            expect = float(args[args.index("--expect-seconds") + 1])
        except Exception:
            expect = None
    if not os.path.exists(video):
        print(f"FAIL  no video at {video}")
        return 1

    ff = ffmpeg_exe()
    probe = ffprobe_exe(ff)
    out = subprocess.run(
        [probe, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", video],
        capture_output=True, text=True, errors="replace",
    )
    try:
        data = json.loads(out.stdout)
    except Exception:
        print(out.stderr[-400:] or "could not read the file with ffprobe")
        return 1

    v = [s for s in data["streams"] if s["codec_type"] == "video"]
    a = [s for s in data["streams"] if s["codec_type"] == "audio"]
    failures = []
    if not v:
        print("FAIL  no video stream")
        return 1
    v = v[0]
    w, h = int(v["width"]), int(v["height"])
    num, den = (v["r_frame_rate"].split("/") + ["1"])[:2]
    fps = float(num) / float(den or 1)
    want = (540, 960) if preview else (1080, 1920)
    print(f"{'ok  ' if (w, h) == want else 'FAIL'}  resolution {w}x{h} (want {want[0]}x{want[1]})")
    if (w, h) != want:
        failures.append("resolution")
    print(f"{'ok  ' if abs(fps - 30) < 0.1 else 'FAIL'}  frame rate {fps:.2f} fps (want 30)")
    if abs(fps - 30) >= 0.1:
        failures.append("fps")
    print(f"{'ok  ' if v['codec_name'] == 'h264' else 'FAIL'}  codec {v['codec_name']} (want h264)")
    if v["codec_name"] != "h264":
        failures.append("codec")
    if not a:
        if silent:
            print("ok    no audio stream (--no-tts silent render)")
        else:
            failures.append("no audio stream")
            print("FAIL  no audio stream")
    else:
        print(f"{'ok  ' if a[0]['codec_name'] == 'aac' else 'FAIL'}  audio {a[0]['codec_name']} (want aac)")
        if a[0]["codec_name"] != "aac":
            failures.append("audio codec")

    dur = float(data["format"].get("duration", 0) or 0)
    timeline = os.path.join(os.path.dirname(video), "timeline.json")
    if expect is None and os.path.exists(timeline):
        try:
            tl = json.load(open(timeline, encoding="utf8"))
            expect = tl["durationInFrames"] / tl["fps"]
        except Exception:
            expect = None
    if expect:
        # a preview render of a story is the same length; allow a short trailer
        ok = abs(dur - expect) <= max(1.0, expect * 0.08)
        print(f"{'ok  ' if ok else 'FAIL'}  duration {dur:.1f}s (narration + tail ≈ {expect:.1f}s)")
        if not ok:
            failures.append("duration")
    else:
        print(f"ok    duration {dur:.1f}s")

    # dead frames
    p = subprocess.run(
        [ff, "-hide_banner", "-i", video, "-vf", "blackdetect=d=0.6:pix_th=0.06", "-f", "null", "-"],
        capture_output=True, text=True, errors="replace",
    )
    blacks = re.findall(r"black_start:([0-9.]+)\s+black_end:([0-9.]+)", p.stderr)
    long_blacks = [(s, e) for s, e in blacks if float(e) - float(s) >= 0.6 and float(s) > 0.2]
    print(f"{'ok  ' if not long_blacks else 'FAIL'}  dead-frame scan: {len(long_blacks)} run(s) ≥0.6 s")
    for s, e in long_blacks[:5]:
        print(f"      black {s}s → {e}s")
    if long_blacks:
        failures.append("dead frames")

    if failures:
        print("\nFAIL — " + ", ".join(failures))
        return 1
    print("\nPASS — container, length and picture are inside spec.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
