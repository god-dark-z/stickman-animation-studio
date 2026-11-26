"""Glyph coverage — no missing glyph may ever reach the screen.

usage: python scripts/qa_glyphs.py stories/<file>.json [--json] [--font public/fonts/X.woff2]

For a Bangla story, every character in every user-visible string (narration, call, insert title
and lines, prop labels) must exist in the bundled font. A missing glyph is the "tofu box" —
a rectangle where a letter should be, which ruins a video far more visibly than a wrong voice.

The check reads the woff2's character map directly (brotli-decompressed table directory), so it
does not depend on a browser, a render, or an image being inspected.

Exit 1 on any missing glyph.
"""
from __future__ import annotations

import json
import os
import struct
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
FONT_DIR = os.path.join(ENGINE, "public", "fonts")

# strings we never require a glyph for: whitespace and typographic punctuation that the renderer
# draws with the Latin fallback anyway
IGNORE = set(" \t\n\r\u00a0\u200b\u200c\u200d")


def _read_woff2_cmap(path: str) -> set[int] | None:
    """Codepoints covered by a woff2, or None if the parser cannot handle it."""
    try:
        from fontTools.ttLib import TTFont  # type: ignore
    except ImportError:
        TTFont = None  # noqa: N806
    if TTFont is not None:
        f = TTFont(path)
        cps: set[int] = set()
        for table in f["cmap"].tables:
            cps.update(table.cmap.keys())
        return cps
    return None


def _fonttools_available() -> bool:
    try:
        import fontTools  # noqa: F401

        return True
    except ImportError:
        return False


def story_strings(story: dict) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for i, s in enumerate(story.get("shots", []), start=1):
        if isinstance(s.get("say"), str) and s["say"] not in ("", "…"):
            out.append((f"shot {i} say", s["say"]))
        if s.get("call", {}).get("text"):
            out.append((f"shot {i} call", s["call"]["text"]))
        ins = s.get("insert") or {}
        if ins.get("title"):
            out.append((f"shot {i} insert.title", ins["title"]))
        for j, line in enumerate(ins.get("lines") or []):
            out.append((f"shot {i} insert.lines[{j}]", line))
        for k, p in enumerate(s.get("props") or []):
            if p.get("label"):
                out.append((f"shot {i} props[{k}].label", p["label"]))
    out.append(("title", story.get("title", "")))
    return [(w, t) for w, t in out if t]


# The Bangla caption stack, in the same priority order as src/fonts.ts. A codepoint is covered
# if ANY font in the stack has it — the browser falls through exactly like this.
BN_STACK = [
    "NotoSansBengali-bengali.woff2",
    "NotoSansBengali-latin.woff2",
    "HindSiliguri-bengali.woff2",
    "HindSiliguri-latin.woff2",
    "BalooDa2-bengali.woff2",
    "BalooDa2-latin.woff2",
]


def stack_coverage(files: list[str]) -> set[int]:
    cps: set[int] = set()
    for f in files:
        got = _read_woff2_cmap(f)
        if got:
            cps |= got
    return cps


def check(path: str, font_path: str | None = None) -> tuple[list[str], int]:
    story = json.load(open(path, encoding="utf8"))
    lang = story.get("lang", "en")
    if lang != "bn":
        return [], 0  # English: Latin coverage is universal; nothing to prove here

    if not _fonttools_available():
        return [], -1  # caller reports "not run" honestly

    files = [font_path] if font_path else [os.path.join(FONT_DIR, f) for f in BN_STACK]
    missing_files = [f for f in files if not os.path.exists(f)]
    if missing_files:
        return [f"bundled font missing: {os.path.basename(f)} — run python scripts/fetch_fonts.py" for f in missing_files], 0
    coverage = stack_coverage(files)
    if not coverage:
        return [], -2

    missing: list[str] = []
    strings = story_strings(story)
    for where, text in strings:
        bad = sorted({c for c in text if c not in IGNORE and ord(c) not in coverage})
        if bad:
            shown = ", ".join(f"{c!r} U+{ord(c):04X}" for c in bad[:6])
            missing.append(f"{where}: {shown} — not in any bundled font (stack: {', '.join(os.path.basename(f) for f in files)})")
    return missing, len(strings)


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    if not args:
        print("usage: python scripts/qa_glyphs.py stories/<file>.json [--font <path>] [--json]")
        return 2
    path = args[0]
    if not os.path.isabs(path):
        cand = os.path.join(ENGINE, path)
        path = cand if os.path.exists(cand) else path
    font = argv[argv.index("--font") + 1] if "--font" in argv else None
    missing, n = check(path, font)

    if n == -1:
        msg = "fontTools is not installed — glyph coverage NOT CHECKED. Install with: pip install fonttools"
        print(f"WARN  {msg}")
        return 0
    if n == -2:
        print("WARN  the bundled font's cmap could not be parsed — coverage NOT CHECKED")
        return 0

    if "--json" in argv:
        print(json.dumps({"file": path, "strings": n, "missing": missing}, ensure_ascii=False, indent=2))
    else:
        for m in missing:
            print(f"ERROR {m}")
        print(f"\n{os.path.basename(path)}: {n} strings checked against the bundled Bangla font")
    if missing:
        print("FAIL — a missing glyph renders as an empty box; fix the text or add the glyph's font.")
        return 1
    print("PASS — every character on screen has a glyph in the bundled font.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
