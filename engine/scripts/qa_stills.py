"""Pixel-statistics QA for the stills gate (no vision model required).

usage: python scripts/qa_stills.py out/<slug>/stills [--night]

Reads every shotNN.png and reports, per still:
  lum    mean luminance 0..1        (day scenes want >= 0.16; night scenes can go lower)
  black  fraction of pixels < 0.08  (day scene > 0.5 usually means camera in a wall)
  white  fraction of pixels > 0.97  (flash frames / blown inserts)
  sat    mean saturation 0..1       (a grey 0.00 still usually means a rendering failure)
Exits 1 if any day scene fails the defaults, so CI/agents can gate on it.
"""
import os
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


import numpy as np
from PIL import Image  # pip install pillow  (already a transitive dep of many toolchains)

LUM_MIN = 0.16
BLACK_MAX = 0.5


def main():
    stills = sys.argv[1] if len(sys.argv) > 1 else "out"
    night = "--night" in sys.argv
    files = sorted(f for f in os.listdir(stills) if f.endswith(".png"))
    if not files:
        print(f"no PNG stills in {stills}")
        sys.exit(2)
    failures = 0
    for f in files:
        im = Image.open(os.path.join(stills, f)).convert("RGB")
        a = np.asarray(im, dtype=np.float32) / 255.0
        lum = a.mean(axis=2)
        mx, mn = a.max(axis=2), a.min(axis=2)
        sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
        row = {
            "lum": float(lum.mean()),
            "black": float((lum < 0.08).mean()),
            "white": float((lum > 0.97).mean()),
            "sat": float(sat.mean()),
        }
        bad = (not night and (row["lum"] < LUM_MIN or row["black"] > BLACK_MAX)) or row["sat"] < 0.02
        failures += bad
        print(f"{'FAIL' if bad else 'ok  '} {f}  lum={row['lum']:.2f} black={row['black']:.2f} "
              f"white={row['white']:.2f} sat={row['sat']:.2f}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
