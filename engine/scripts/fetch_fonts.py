"""Fetch the bundled Bangla font subsets into engine/public/fonts/.

The repository ships the woff2 files (342 KB total), so this script is only needed when they are
missing — a fresh clone already has them. Keeping the URL list + licence here documents exactly
where the files came from and under which licence.

usage: python scripts/fetch_fonts.py [--check]

Fonts (all SIL Open Font License 1.1):
  Noto Sans Bengali  — Google Fonts, the UI/body face with full conjunct coverage
  Hind Siliguri      — Google Fonts, a second Bengali face (fallback + alternates)
  Baloo Da 2         — Google Fonts, heavier display face for titles and inserts

The woff2 URLs are the "bengali" and "latin" subsets from @remotion/google-fonts' own metadata,
downloaded once and committed. Rendering never touches the network.
"""
from __future__ import annotations

import os
import re
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
FONT_DIR = os.path.join(ENGINE, "public", "fonts")
MODULES = os.path.join(ENGINE, "node_modules", "@remotion", "google-fonts", "dist", "esm")

FAMILIES = {
    "NotoSansBengali": {"bengali": "NotoSansBengali-bengali.woff2", "latin": "NotoSansBengali-latin.woff2"},
    "HindSiliguri": {"bengali": "HindSiliguri-bengali.woff2", "latin": "HindSiliguri-latin.woff2"},
    "BalooDa2": {"bengali": "BalooDa2-bengali.woff2", "latin": "BalooDa2-latin.woff2"},
}


def expected_files() -> list[str]:
    return [fn for kinds in FAMILIES.values() for fn in kinds.values()]


def main(argv: list[str]) -> int:
    missing = [f for f in expected_files() if not os.path.exists(os.path.join(FONT_DIR, f))]
    if "--check" in argv:
        if missing:
            print(f"missing bundled fonts: {', '.join(missing)}")
            print("fix: python scripts/fetch_fonts.py")
            return 1
        total = sum(os.path.getsize(os.path.join(FONT_DIR, f)) for f in expected_files())
        print(f"all {len(expected_files())} Bangla font files present ({total // 1024} KB)")
        return 0

    if not missing:
        print("fonts already bundled — nothing to do")
        return 0

    os.makedirs(FONT_DIR, exist_ok=True)
    for fam, kinds in FAMILIES.items():
        mod = os.path.join(MODULES, f"{fam}.mjs")
        if not os.path.exists(mod):
            print(f"WARN  module not found for {fam} (run npm install first) — skipping")
            continue
        src = open(mod, encoding="utf8").read()
        urls: dict[str, str] = {}
        for kind, u in re.findall(r'(bengali|latin):\s*"(https://fonts\.gstatic\.com/[^"]+\.woff2)"', src):
            urls.setdefault(kind, u)
        for kind, fn in kinds.items():
            dest = os.path.join(FONT_DIR, fn)
            if os.path.exists(dest) and os.path.getsize(dest) > 1000:
                continue
            u = urls.get(kind)
            if not u:
                print(f"WARN  no {kind} url for {fam}")
                continue
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
            data = urllib.request.urlopen(req, timeout=30).read()
            open(dest, "wb").write(data)
            print(f"wrote {fn} ({len(data)} bytes)")

    still = [f for f in expected_files() if not os.path.exists(os.path.join(FONT_DIR, f))]
    if still:
        print(f"FAIL  still missing: {', '.join(still)}")
        return 1
    print("all Bangla fonts bundled")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
