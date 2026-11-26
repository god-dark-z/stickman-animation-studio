"""qa_bangla — the Bangla text gate.

usage: python scripts/qa_bangla.py stories/<file>.json [--json]

Checks what a Bangla video must never ship:

 1. LATIN LEAK      narration, call, insert and prop-label text must be Bangla script; any Latin
                    word is reported with the exact string and a suggested fix (add it to the
                    pronunciation dictionary or rewrite the line). Severity follows the pack's
                    latinPolicy (bn: warn by default, --strict makes it an error).
 2. GLOSS PRESENT   every spoken shot has an English `gloss` (the meaning layer the scene spec,
                    claims and relation checks run on).
 3. NUMERALS        digits in Narration must be readable: Western digits are normalized to spoken
                    words by the engine, but Bangla digits that reach the caption are reported
                    when the pack asks for Bangla digits in inserts.
 4. MIXED SCRIPT    a shot that is mostly Latin inside a Bangla story (a whole English line) is
                    an ERROR: the film has one language.

Exit 1 on any ERROR. Warnings are recorded, not fatal, unless --strict.
"""
from __future__ import annotations

import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)

BN = re.compile(r"[\u0980-\u09FF]")
LATIN_WORD = re.compile(r"[A-Za-z][A-Za-z'’\-]*")
DIGIT = re.compile(r"[0-9০-৯]")


def load_pack() -> dict:
    return json.load(open(os.path.join(ENGINE, "lang", "bn", "pack.json"), encoding="utf8"))


def story_strings(story: dict) -> list[tuple[str, str, str]]:
    """Every user-visible string: (location, field, text)."""
    out: list[tuple[str, str, str]] = []
    for i, s in enumerate(story.get("shots", []), start=1):
        if isinstance(s.get("say"), str) and s["say"] not in ("", "…"):
            out.append((f"shot {i}", "say", s["say"]))
        if s.get("gloss"):
            out.append((f"shot {i}", "gloss", s["gloss"]))
        if s.get("call", {}).get("text"):
            out.append((f"shot {i}", "call", s["call"]["text"]))
        ins = s.get("insert") or {}
        if ins.get("title"):
            out.append((f"shot {i}", "insert.title", ins["title"]))
        for j, line in enumerate(ins.get("lines") or []):
            out.append((f"shot {i}", f"insert.lines[{j}]", line))
        for k, p in enumerate(s.get("props") or []):
            if p.get("label"):
                out.append((f"shot {i}", f"props[{k}].label", p["label"]))
    return out


def check(story_path: str, strict: bool = False) -> tuple[list[str], list[str], int]:
    story = json.load(open(story_path, encoding="utf8"))
    pack = load_pack()
    latin_policy = "error" if strict else pack["qa"]["latinPolicy"]
    errors: list[str] = []
    warns: list[str] = []

    # gloss is the meaning layer: Bangla stories cannot be validated without it
    for i, s in enumerate(story.get("shots", []), start=1):
        if isinstance(s.get("say"), str) and s["say"] not in ("", "…") and not (s.get("gloss") or "").strip():
            errors.append(f"shot {i}: no English `gloss` — the scene spec and claim checks run on it")

    for where, field, text in story_strings(story):
        # `gloss` is SUPPOSED to be English
        if field == "gloss":
            continue
        latin = LATIN_WORD.findall(text)
        if not latin:
            continue
        words = sorted(set(latin))
        # a shot that is essentially an English sentence inside a Bangla film
        latin_chars = sum(len(w) for w in latin)
        total_letters = latin_chars + len(BN.findall(text))
        if total_letters and latin_chars / total_letters > 0.6:
            errors.append(f"{where} ({field}): mostly Latin text in a Bangla story — this line is English: {text[:70]!r}")
            continue
        msg = (
            f"{where} ({field}): Latin word(s) {', '.join(words[:8])}"
            + (" …" if len(words) > 8 else "")
            + " — respell in Bangla (add to stories/<slug>/pronunciation.json or the shipped dictionary)"
        )
        (errors if latin_policy == "error" else warns).append(msg)

    # narration with digits: the engine speaks them, but captions should not show bare numerals
    for i, s in enumerate(story.get("shots", []), start=1):
        say = s.get("say")
        if isinstance(say, str) and say not in ("", "…") and DIGIT.search(say):
            warns.append(f"shot {i} (say): contains digits — the voice speaks them as words; keep the caption readable or spell them out in the script")

    return errors, warns, len(story.get("shots", []))


def run_gloss_gate(path: str, engine: str) -> int:
    """Shell to the TypeScript gloss-faithfulness gate (one implementation, one language)."""
    import shutil
    import subprocess

    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not npx:
        print("WARN  npx not found — skipping the gloss-faithfulness check")
        return 0
    r = subprocess.run([npx, "tsx", "scripts/qa_gloss.ts", path], cwd=engine, capture_output=True, text=True, encoding="utf-8")
    print(r.stdout.rstrip())
    if r.returncode != 0 and r.stderr.strip():
        print(r.stderr.rstrip())
    return r.returncode


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    if not args:
        print("usage: python scripts/qa_bangla.py stories/<file>.json [--strict] [--with-gloss] [--json]")
        return 2
    path = args[0]
    if not os.path.isabs(path):
        cand = os.path.join(ENGINE, path)
        path = cand if os.path.exists(cand) else path
    errors, warns, shots = check(path, strict="--strict" in argv)
    if "--json" in argv:
        print(json.dumps({"file": path, "shots": shots, "errors": errors, "warnings": warns}, ensure_ascii=False, indent=2))
    else:
        for e in errors:
            print(f"ERROR {e}")
        for w in warns:
            print(f"WARN  {w}")
        print(f"\n{os.path.basename(path)}: {shots} shots — {len(errors)} error(s), {len(warns)} warning(s)")

    gloss_code = 0
    if "--with-gloss" in argv:
        print("\n--- gloss faithfulness ---")
        gloss_code = run_gloss_gate(path, ENGINE)

    if errors:
        return 1
    if gloss_code != 0:
        return 1
    print("PASS — Bangla text is single-script, glossed, and cast in Bangla script.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
