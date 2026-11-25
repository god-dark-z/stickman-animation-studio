"""Run every Python test in one command (used by CI and by `npm run qa:py`).

    python scripts/test_all.py

Runs each test module in a subprocess so one crash never hides the others, and prints a summary.
Exit code 1 if any module fails.
"""
from __future__ import annotations

import os
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
MODULES = ["test_bn_normalize.py", "test_bn_tts.py"]

failures: list[str] = []
for m in MODULES:
    path = os.path.join(HERE, m)
    if not os.path.exists(path):
        print(f"MISSING  {m}")
        failures.append(m)
        continue
    print(f"\n===== {m} =====")
    r = subprocess.run([sys.executable, "-I", path], capture_output=True, text=True, encoding="utf-8")
    print(r.stdout.rstrip())
    if r.returncode != 0:
        if r.stderr.strip():
            print(r.stderr.rstrip())
        failures.append(m)

print("\n" + ("FAILED: " + ", ".join(failures) if failures else f"all {len(MODULES)} Python test modules passed"))
sys.exit(1 if failures else 0)
