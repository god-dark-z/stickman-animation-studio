"""resolve_language (Python bridge) — same decision as scripts/resolve_language.ts.

usage: python scripts/resolve_language.py --text "…" [--lang bn] [--voice female] [--json]

The TypeScript resolver is the source of truth (scripts/resolve_language.ts, 59 unit tests).
This bridge exists so Python stages and the doctor can ask the same question without a Node
round-trip. It calls the TS CLI and parses its JSON — one implementation, two entry points.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)


def resolve(text: str, flag: str | None = None, voice: str | None = None) -> dict:
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not npx:
        raise RuntimeError("npx not found — the resolver needs Node (install Node 20 LTS)")
    args = [npx, "tsx", "scripts/resolve_language.ts", "--text", text, "--json"]
    if flag:
        args += ["--lang", flag]
    if voice:
        args += ["--voice", voice]
    out = subprocess.run(args, cwd=ENGINE, capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        raise RuntimeError(f"resolve_language.ts failed: {out.stderr.strip()}")
    return json.loads(out.stdout)


def main(argv: list[str]) -> int:
    def opt(f):
        return argv[argv.index(f) + 1] if f in argv else None

    text = opt("--text") or " ".join(a for i, a in enumerate(argv) if not a.startswith("--") and (i == 0 or argv[i - 1] not in ("--text", "--lang", "--voice")))
    try:
        res = resolve(text, opt("--lang"), opt("--voice"))
    except Exception as e:  # noqa: BLE001 — surface as a clean CLI error
        print(f"resolve_language: {e}", file=sys.stderr)
        return 1
    if "--print-lang" in argv:
        print(res["lang"])
        return 0
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
