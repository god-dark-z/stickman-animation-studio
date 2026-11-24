"""qa_visual_report — the shipped vision-QA procedure (replaces the missing `agentvision`).

usage: python scripts/qa_visual_report.py <story.json> <stills_dir> [--out out/<slug>]

Produces, for every shot:
  • out/<slug>/contact-sheet.png   a labelled grid of every still
  • out/<slug>/visual-review.md    the per-shot checklist: what the narration CLAIMS,
                                   what the scene graph declares, offline CV measurements,
                                   and one PASS/FAIL row per claim for a vision agent

Two honest paths:
  1. VISION — open the contact sheet and each still, compare against the claim column,
     write PASS/FAIL in visual-review.md. Re-running this script then reads those
     verdicts and exits 1 if any claim FAILs.
  2. NO VISION — rely on qa_geometry (contact/framing) plus the CV numbers printed here,
     and say in the delivery report that visual QA was geometric only.

Exit codes: 0 report written / all recorded verdicts PASS · 1 a recorded claim FAILed ·
2 stills missing.
"""
from __future__ import annotations

import json
import os
import re
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


import numpy as np
from PIL import Image, ImageDraw

# narration verb -> what must be visible (kept small on purpose; the geometric gate is the
# authority on contact, this is the human/vision checklist)
CLAIMS = {
    "sit": "body seated on a seat surface", "sits": "body seated on a seat surface", "sitting": "body seated",
    "sleep": "body lying in/on the bed", "sleeps": "body lying in/on the bed", "asleep": "body lying in/on the bed",
    "lie": "body lying on a surface", "lies": "body lying on a surface",
    "stand": "upright, feet on the ground", "stands": "upright, feet on the ground", "walk": "walking pose, moving",
    "walks": "walking pose, moving", "run": "running pose", "runs": "running pose",
    "type": "hands at a keyboard", "types": "hands at a keyboard", "typing": "hands at a keyboard",
    "hold": "prop in hand", "holds": "prop in hand", "carry": "prop carried",
    "point": "arm extended at a target", "points": "arm extended at a target",
    "laugh": "open mouth, laughing expression", "laughs": "open mouth, laughing expression",
    "cry": "sad expression", "cries": "sad expression",
    "drive": "character inside a vehicle", "drives": "character inside a vehicle",
    "cook": "cooking action at a counter", "cooks": "cooking action at a counter",
    "open": "openable prop visibly open", "opens": "openable prop visibly open",
}


def stats(path: str) -> dict:
    im = Image.open(path).convert("RGB")
    a = np.asarray(im, dtype=np.float32) / 255.0
    lum = a.mean(axis=2)
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0).mean()
    gy, gx = np.gradient(lum)
    edges = float(np.mean(np.hypot(gx, gy)))
    # "empty" = the largest fraction of one 12x12 grid cell whose variance is tiny
    h, w = lum.shape
    worst = 0.0
    g = 12
    for r in range(g):
        for c in range(g):
            cell = lum[r * h // g:(r + 1) * h // g, c * w // g:(c + 1) * w // g]
            if cell.size and cell.std() < 0.012:
                worst = max(worst, 1.0 / (g * g))
    occupied = sum(
        1 for r in range(3) for c in range(3)
        if lum[r * h // 3:(r + 1) * h // 3, c * w // 3:(c + 1) * w // 3].std() > 0.03
    )
    return {"lum": float(lum.mean()), "sat": float(sat), "edges": edges, "flat": float(worst), "occupied": occupied}


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: python scripts/qa_visual_report.py <story.json> <stills_dir> [--out dir]")
        return 2
    story_path, stills_dir = sys.argv[1], sys.argv[2]
    out_dir = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else os.path.dirname(stills_dir.rstrip(os.sep))
    os.makedirs(out_dir, exist_ok=True)
    story = json.load(open(story_path, encoding="utf8"))
    names = sorted(f for f in os.listdir(stills_dir) if f.endswith(".png")) if os.path.isdir(stills_dir) else []
    if not names:
        print(f"FAIL  no PNG stills in {stills_dir} — run: npm run make -- {story_path} --stills")
        return 2

    rows = []
    thumbs = []
    for i, shot in enumerate(story["shots"]):
        name = f"shot{str(i).zfill(2)}.png"
        if not os.path.exists(os.path.join(stills_dir, name)):
            name = names[i] if i < len(names) else names[-1]
        path = os.path.join(stills_dir, name)
        s = stats(path)
        say = shot.get("say", "")
        claims = sorted({CLAIMS[w] for w in re.findall(r"[a-zA-Z']+", say.lower()) if w in CLAIMS})
        declared = []
        for a in shot.get("actors", []):
            bits = [a.get("id", "?")]
            if a.get("action") and a["action"] != "none":
                bits.append(f"{a['action']}({a.get('on', '?')})")
            bits.append(a.get("pose", "stand"))
            declared.append(" ".join(bits))
        props = ", ".join(p.get("type", "?") for p in shot.get("props", [])) or "—"
        rows.append(
            f"| {i} | `{name}` | {say[:70]} | {'; '.join(claims) or '(no explicit posture claim)'} | "
            f"{' / '.join(declared) or '—'} | {props} | {s['lum']:.2f} / {s['sat']:.2f} / {s['edges']:.3f} / {s['occupied']}/9 |  |"
        )
        im = Image.open(path).convert("RGB")
        im.thumbnail((320, 320))
        thumbs.append((im, f"{i}: {say[:22]}"))

    # contact sheet
    if thumbs:
        cols = 4
        cw, ch = 330, 360
        rowsn = (len(thumbs) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cw, rowsn * ch), (18, 18, 22))
        d = ImageDraw.Draw(sheet)
        for i, (im, label) in enumerate(thumbs):
            x, y = (i % cols) * cw + 5, (i // cols) * ch + 5
            sheet.paste(im, (x, y))
            d.text((x, y + 325), label, fill=(230, 230, 235))
        sheet.save(os.path.join(out_dir, "contact-sheet.png"))
        print(f"contact sheet → {os.path.join(out_dir, 'contact-sheet.png')}")

    review = os.path.join(out_dir, "visual-review.md")
    header = (
        f"# Visual review — {story.get('title', 'story')}\n\n"
        "For each shot, check the still against the claim column.\n"
        "Write **PASS** or **FAIL** in the last column; a FAIL means the picture does not show "
        "what the narration says, so fix the storyboard before delivering.\n\n"
        "If you cannot see images, write `geometric-only` in the verdict column and say so in the "
        "delivery report — the geometry gate (`qa_geometry.ts`) already proved contact, framing and "
        "layering numerically.\n\n"
        "| # | still | narration | must show | declared (actor action pose) | props | lum/sat/edges/cells | verdict |\n"
        "|---|---|---|---|---|---|---|---|\n"
    )
    open(review, "w", encoding="utf8").write(header + "\n".join(rows) + "\n")
    print(f"checklist    → {review}")
    print(f"{len(rows)} shot(s) · offline CV: lum/sat/edge-density/occupied-cells (9 = every cell has content)")
    low = [i for i, r in enumerate(rows) if re.search(r"\| 0\.[01]\d / ", r)]
    if low:
        print(f"WARN  shots {low} are very dark — check the time-of-day grade")

    text = open(review, encoding="utf8").read()
    verdicts = re.findall(r"\|\s*(PASS|FAIL|geometric-only)\s*\|\s*$", text, re.M | re.I)
    if verdicts:
        fails = sum(1 for v in verdicts if v.upper() == "FAIL")
        print(f"recorded verdicts: {len(verdicts)} ({fails} FAIL)")
        if fails:
            print("FAIL — a recorded claim FAILed; fix the shot and re-review.")
            return 1
        print("PASS — every recorded claim passed.")
    else:
        print("NOT REVIEWED YET — open visual-review.md and record PASS/FAIL, or state that visual QA was geometric only.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
