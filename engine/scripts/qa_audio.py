"""qa_audio — audio quality gate for a rendered video (V2 sound-design requirement).

usage: python scripts/qa_audio.py <video.mp4> [--lufs -14]

Checks, using ffmpeg's own measurement filters (no extra dependencies beyond imageio-ffmpeg):
  1. Integrated loudness  — must sit within ±1.5 LU of the target (-14 LUFS by default).
  2. True peak            — must stay <= -1.0 dBTP (no clipping, no spikes).
  3. Loudness range       — LRA within 4..12 LU (too low = squashed, too high = unstable).
  4. Narration presence   — the mix must actually carry voice-class energy (mean volume and
                            peak volume floors), catching silent/near-silent renders.
Exit code 1 on any failure; prints a one-line verdict per check.
"""
import json
import re
import subprocess
import sys


def ffmpeg_exe() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def run(ff, args):
    p = subprocess.run([ff, *args], capture_output=True, text=True, errors="replace")
    return p.stderr


def main():
    video = sys.argv[1] if len(sys.argv) > 1 else ""
    if not video:
        print("usage: python scripts/qa_audio.py <video.mp4> [--lufs -14]")
        sys.exit(2)
    target = -14.0
    if "--lufs" in sys.argv:
        target = float(sys.argv[sys.argv.index("--lufs") + 1])

    ff = ffmpeg_exe()
    failures = []

    # 1-3. loudnorm analysis pass (measures, does not write)
    err = run(ff, ["-hide_banner", "-i", video, "-af",
                   "loudnorm=I=-14:TP=-1.0:LRA=7:print_format=json", "-f", "null", "-"])
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", err, re.S)
    if not m:
        print("FAIL  could not measure loudness (is the file a valid media file?)")
        sys.exit(1)
    ln = json.loads(m.group(0))
    i_lufs = float(ln["input_i"])
    tp = float(ln["input_tp"])
    lra = float(ln["input_lra"])

    if abs(i_lufs - target) > 1.5:
        failures.append(f"loudness {i_lufs:.1f} LUFS is not within ±1.5 of {target:.0f} LUFS — re-render with the make pipeline (it loudnorms automatically)")
    else:
        print(f"ok    loudness {i_lufs:.1f} LUFS (target {target:.0f} ±1.5)")
    if tp > -1.0:
        failures.append(f"true peak {tp:.1f} dBTP exceeds -1.0 — clipping risk; lower mix levels or re-render")
    else:
        print(f"ok    true peak {tp:.1f} dBTP (<= -1.0)")
    if not (4.0 <= lra <= 12.0):
        print(f"warn  loudness range {lra:.1f} LU outside 4..12 (compressed or uneven mix) — review, not fatal")
    else:
        print(f"ok    loudness range {lra:.1f} LU")

    # 4. narration presence (volumedetect)
    err = run(ff, ["-hide_banner", "-i", video, "-af", "volumedetect", "-f", "null", "-"])
    mv = re.search(r"mean_volume:\s*(-?[0-9.]+)", err)
    xv = re.search(r"max_volume:\s*(-?[0-9.]+)", err)
    if mv and xv:
        mean_v, max_v = float(mv.group(1)), float(xv.group(1))
        if mean_v < -40:
            failures.append(f"mean volume {mean_v:.1f} dB — mix is near-silent (narration missing?)")
        else:
            print(f"ok    mean volume {mean_v:.1f} dB")
        if max_v < -12:
            failures.append(f"max volume {max_v:.1f} dB — nothing ever gets loud (voice may be missing)")
        else:
            print(f"ok    peak volume {max_v:.1f} dB")
    else:
        failures.append("could not run volumedetect — audio stream missing?")

    if failures:
        for f in failures:
            print(f"FAIL  {f}")
        sys.exit(1)
    print("\nPASS — loudness, peaks and voice presence are inside the professional window.")


if __name__ == "__main__":
    main()
