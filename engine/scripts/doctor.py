"""doctor — is this machine able to render a stickman video?

usage:  python scripts/doctor.py [--quick] [--json]

Prints PASS / WARN / FAIL for every requirement, with the exact command that fixes a
failure. Exit code 1 if any check FAILs, so CI and agents can gate on it.

The reference target is a CPU-only machine (Ryzen 7 5700G, 16 GB, integrated graphics):
software WebGL must work, and `--quick` skips the WebGL probe that actually renders a
frame through Chromium.
"""
from __future__ import annotations

import json
import os
import platform
import shutil
import socket
import subprocess
import sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
results: list[dict] = []


def record(name: str, status: str, detail: str, fix: str = "") -> None:
    results.append({"check": name, "status": status, "detail": detail, "fix": fix})
    colour = {"PASS": "\033[32m", "WARN": "\033[33m", "FAIL": "\033[31m", "SKIP": "\033[90m"}[status]
    print(f"{colour}{status:4}\033[0m {name:22} {detail}")
    if status in ("WARN", "FAIL") and fix:
        print(f"     \033[90mfix: {fix}\033[0m")


def node_version() -> None:
    exe = shutil.which("node")
    if not exe:
        record("node", "FAIL", "node not found", "install Node 20 LTS from https://nodejs.org")
        return
    raw = subprocess.run([exe, "--version"], capture_output=True, text=True).stdout.strip()
    major = int(raw.lstrip("v").split(".")[0] or 0)
    record("node", "PASS" if major >= 18 else "FAIL", f"{raw} (need >= 18)", "install Node 20 LTS: https://nodejs.org")
    npm = shutil.which("npm")
    record("npm", "PASS" if npm else "FAIL", npm or "not found", "npm ships with Node; reinstall Node")


def python_version() -> None:
    v = sys.version.split()[0]
    ok = sys.version_info >= (3, 10)
    record("python", "PASS" if ok else "FAIL", f"{v} on {platform.system()} (need >= 3.10)", "install Python 3.12: https://python.org/downloads")


def python_deps() -> None:
    mods = ["edge_tts", "imageio_ffmpeg", "numpy", "scipy", "PIL"]
    missing = []
    versions = []
    for m in mods:
        try:
            mod = __import__(m)
            versions.append(f"{m}={getattr(mod, '__version__', '?')}")
        except Exception:
            missing.append(m)
    if missing:
        record("python deps", "FAIL", f"missing: {', '.join(missing)}", "python -m pip install -r requirements.txt")
    else:
        record("python deps", "PASS", ", ".join(versions))


def node_deps() -> None:
    pkg = os.path.join(ROOT, "package.json")
    mods = os.path.join(ROOT, "node_modules")
    if not os.path.isdir(mods):
        record("node_modules", "FAIL", "not installed", "npm install")
        return
    try:
        data = json.load(open(pkg, encoding="utf8"))
    except Exception:
        data = {}
    required = list((data.get("dependencies") or {}).keys())
    bad = [r for r in required if not os.path.isdir(os.path.join(mods, r.split("/")[0]) if r.startswith("@") else os.path.join(mods, r))]
    record("node_modules", "PASS" if not bad else "FAIL", f"{len(required) - len(bad)}/{len(required)} packages present" + (f", missing {bad}" if bad else ""), "npm install")
    lock = os.path.join(ROOT, "package-lock.json")
    record("lockfile", "PASS" if os.path.exists(lock) else "WARN", "package-lock.json present" if os.path.exists(lock) else "no lockfile — installs can drift", "npm install --package-lock-only && commit package-lock.json")


def ffmpeg() -> None:
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        exe = shutil.which("ffmpeg") or ""
    if exe and os.path.exists(exe):
        record("ffmpeg", "PASS", exe)
    else:
        record("ffmpeg", "FAIL", "ffmpeg not reachable", "python -m pip install imageio-ffmpeg")


def ffprobe_check() -> None:
    exe = shutil.which("ffprobe")
    if exe:
        record("ffprobe", "PASS", exe)
    else:
        record("ffprobe", "WARN", "not on PATH — the video gate cannot inspect the MP4", "install full FFmpeg (https://ffmpeg.org/download.html) and add it to PATH")


def disk_and_ram() -> None:
    out = os.path.join(ROOT, "out")
    os.makedirs(out, exist_ok=True)
    probe = os.path.join(out, ".doctor-write-test")
    try:
        with open(probe, "w", encoding="utf8") as f:
            f.write("ok")
        os.remove(probe)
        record("out/ writable", "PASS", out)
    except Exception as e:
        record("out/ writable", "FAIL", str(e), f"check permissions on {out}")

    try:
        if hasattr(os, "statvfs"):
            st = os.statvfs(ROOT)
            free_gb = st.f_bavail * st.f_frsize / 1e9
        else:
            import ctypes
            free = ctypes.c_ulonglong(0)
            ctypes.windll.kernel32.GetDiskFreeSpaceExW(ctypes.c_wchar_p(ROOT), None, None, ctypes.pointer(free))
            free_gb = free.value / 1e9
        record("disk", "PASS" if free_gb >= 3 else "WARN", f"{free_gb:.1f} GB free (3 GB recommended)", "free up disk space; renders need room for frames")
    except Exception as e:
        record("disk", "WARN", f"could not measure: {e}")

    try:
        total_gb = None
        if os.name == "nt":
            import ctypes
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                            ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                            ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                            ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                            ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
            m = MEMORYSTATUSEX(); m.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
            total_gb = m.ullTotalPhys / 1e9
        elif os.path.exists("/proc/meminfo"):
            for line in open("/proc/meminfo"):
                if line.startswith("MemTotal:"):
                    total_gb = int(line.split()[1]) / 1e6
        else:
            total_gb = int(subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True).stdout) / 1e9
    except Exception:
        total_gb = None
    if total_gb:
        record("ram", "PASS" if total_gb >= 7 else "WARN", f"{total_gb:.0f} GB (16 GB is the reference target)", "close other apps; the renderer lowers concurrency on low RAM")


def internet() -> bool:
    for host in ("speech.platform.bing.com", "github.com"):
        try:
            socket.create_connection((host, 443), timeout=5).close()
            record("internet", "PASS", f"reached {host}:443 (needed for edge-tts narration)")
            return True
        except Exception:
            continue
    record("internet", "WARN", "no outbound HTTPS — narration unavailable, --no-tts still works", "connect to the internet, or render with --no-tts")
    return False


def edge_tts_boundaries() -> None:
    # bundled fonts + glyph-check tooling: without these, Bangla captions can render as boxes
    sys.path.insert(0, os.path.join(ROOT, "scripts"))
    try:
        from fetch_fonts import expected_files

        missing = [f for f in expected_files() if not os.path.exists(os.path.join(ROOT, "public", "fonts", f))]
        if missing:
            record("bangla fonts", "FAIL", f"{len(missing)} bundled font file(s) missing", "python scripts/fetch_fonts.py")
        else:
            total = sum(os.path.getsize(os.path.join(ROOT, "public", "fonts", f)) for f in expected_files())
            record("bangla fonts", "PASS", f"{len(expected_files())} files, {total // 1024} KB, bundled (no CDN)")
    except Exception as e:  # noqa: BLE001
        record("bangla fonts", "WARN", f"could not check the font bundle ({type(e).__name__})", "python scripts/fetch_fonts.py")

    try:
        import brotli  # noqa: F401
        import fontTools  # noqa: F401

        record("glyph reader", "PASS", "fontTools + brotli available (woff2 character maps readable)")
    except ImportError as e:
        record("glyph reader", "WARN", f"{e.name} missing — the glyph-coverage gate cannot run", "python -m pip install -r requirements.txt")

    try:
        import asyncio
        import edge_tts
    except Exception:
        record("edge-tts words", "SKIP", "edge-tts not installed")
        return

    async def probe() -> int:
        count = 0
        comm = edge_tts.Communicate("One two three.", "en-US-AndrewMultilingualNeural", rate="+12%", boundary="WordBoundary")
        async for chunk in comm.stream():
            if chunk["type"] == "WordBoundary":
                count += 1
        return count

    try:
        n = asyncio.run(probe())
    except Exception as e:
        record("edge-tts words", "WARN", f"probe failed ({type(e).__name__}) — the pipeline will fall back to forced alignment", "check the network; word timings will be estimated from the audio")
        return
    if n >= 3:
        record("edge-tts words", "PASS", f"{n} word boundaries for 3 words")
    else:
        record("edge-tts words", "WARN", f"only {n} word boundaries — the pipeline will use forced alignment", "the engine falls back automatically; captions stay in sync, beats are slightly softer")


def chromium() -> None:
    cache = os.path.join(ROOT, "node_modules", ".remotion")
    found = os.path.isdir(cache) and any("chrom" in d.lower() or "headless" in d.lower() for d in os.listdir(cache))
    record("chromium", "PASS" if found else "WARN", (cache if found else "not downloaded yet (first render downloads it)"), "npm run doctor -- --webgl (or just render once)")


def webgl(quick: bool) -> None:
    if quick:
        record("webgl", "SKIP", "--quick: skipped the frame probe", "run without --quick to prove software WebGL renders")
        return
    script = os.path.join(ROOT, "scripts", "doctor_gl.ts")
    if not os.path.exists(script):
        record("webgl", "SKIP", "scripts/doctor_gl.ts missing")
        return
    print("     \033[90mrendering one three.js frame (this takes ~30-60 s)…\033[0m")
    try:
        p = subprocess.run(["npx", "tsx", script, "--json"], cwd=ROOT, capture_output=True, text=True, timeout=240)
        line = [l for l in p.stdout.splitlines() if l.startswith("{")]
        data = json.loads(line[-1]) if line else {}
        lum = None
        if data.get("path") and os.path.exists(data["path"]):
            try:
                import numpy as np
                from PIL import Image
                lum = float(np.asarray(Image.open(data["path"]).convert("RGB"), dtype=np.float32).mean() / 255.0)
            except Exception:
                lum = None
        if not data.get("ok") and data.get("error"):
            record("webgl", "FAIL", str(data["error"])[:300], "npx remotion browser ensure, then re-run doctor --webgl")
        elif lum is None:
            record("webgl", "FAIL", (p.stderr or p.stdout or "no output").strip()[-300:], "npx remotion browser ensure, then re-run doctor")
        elif lum < 0.02:
            record("webgl", "FAIL", f"frame rendered black (mean luminance {lum:.3f})", "set REMOTION_GL=angle or swiftshader; the engine falls back to 2D when WebGL fails")
        else:
            record("webgl", "PASS", f"three.js frame rendered, mean luminance {lum:.2f}, gl={data.get('gl')}")
    except subprocess.TimeoutExpired:
        record("webgl", "FAIL", "frame probe timed out after 240 s", "reduce concurrency; check that Chromium can start (headless)")
    except Exception as e:
        record("webgl", "FAIL", f"{type(e).__name__}: {e}", "npx remotion browser ensure")


def bangla_support() -> None:
    """The Bangla engine must be usable out of the box: pack, normalizer, voices, 1-sentence synth."""
    pack_path = os.path.join(ROOT, "lang", "bn", "pack.json")
    try:
        pack = json.load(open(pack_path, encoding="utf8"))
        voices = [v["id"] for v in pack["tts"]["voices"]]
        record("bangla pack", "PASS", f"{len(voices)} voices, default {pack['tts']['defaultVoice']}")
    except Exception as e:  # noqa: BLE001 — a missing pack is a FAIL with a fix
        record("bangla pack", "FAIL", f"cannot read lang/bn/pack.json ({type(e).__name__})",
               "re-clone the repository: the pack ships with the engine")
        return

    try:
        sys.path.insert(0, os.path.join(ROOT, "scripts"))
        from bn_normalize import normalize_bangla
        from gen_bn_pronunciation import OUT as PRON_PATH

        out = normalize_bangla("১৯৯০ সালে ৪০% মানুষ ৳৫০০ দিয়েছিল।")
        assert "শতাংশ" in out and "টাকা" in out, out
        n = len(json.load(open(PRON_PATH, encoding="utf8"))["entries"])
        if n >= 200:
            record("bangla text", "PASS", f"normalizer ok, pronunciation dictionary {n} entries")
        else:
            record("bangla text", "WARN", f"pronunciation dictionary has only {n} entries (want >= 200)",
                   "python scripts/gen_bn_pronunciation.py")
    except Exception as e:  # noqa: BLE001
        record("bangla text", "FAIL", f"normalizer failed: {type(e).__name__}: {e}",
               "re-clone; scripts/bn_normalize.py and lang/bn/pronunciation.json ship with the engine")

    try:
        listed = subprocess.run([sys.executable, "-m", "edge_tts", "--list-voices"], capture_output=True, text=True).stdout
        missing = [v for v in voices if v not in listed]
        if missing:
            record("bangla voices", "WARN", f"{len(voices) - len(missing)}/{len(voices)} listed; missing {', '.join(missing)}",
                   "the voice may be temporarily gone; the engine falls back to another bn voice")
        else:
            record("bangla voices", "PASS", f"all {len(voices)} bn voices listed")
    except Exception as e:  # noqa: BLE001
        record("bangla voices", "WARN", f"could not list voices ({type(e).__name__})", "check the network")

    # bundled fonts + glyph-check tooling: without these, Bangla captions can render as boxes
    sys.path.insert(0, os.path.join(ROOT, "scripts"))
    try:
        from fetch_fonts import expected_files

        missing = [f for f in expected_files() if not os.path.exists(os.path.join(ROOT, "public", "fonts", f))]
        if missing:
            record("bangla fonts", "FAIL", f"{len(missing)} bundled font file(s) missing", "python scripts/fetch_fonts.py")
        else:
            total = sum(os.path.getsize(os.path.join(ROOT, "public", "fonts", f)) for f in expected_files())
            record("bangla fonts", "PASS", f"{len(expected_files())} files, {total // 1024} KB, bundled (no CDN)")
    except Exception as e:  # noqa: BLE001
        record("bangla fonts", "WARN", f"could not check the font bundle ({type(e).__name__})", "python scripts/fetch_fonts.py")

    try:
        import brotli  # noqa: F401
        import fontTools  # noqa: F401

        record("glyph reader", "PASS", "fontTools + brotli available (woff2 character maps readable)")
    except ImportError as e:
        record("glyph reader", "WARN", f"{e.name} missing — the glyph-coverage gate cannot run", "python -m pip install -r requirements.txt")

    try:
        import asyncio
        import edge_tts

        async def probe():
            n, audio = 0, 0
            comm = edge_tts.Communicate("আজ বৃষ্টি।", pack["tts"]["defaultVoice"], boundary="WordBoundary")
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    audio += len(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    n += 1
            return n, audio

        n, audio = asyncio.run(probe())
        if audio > 2000 and n >= 1:
            record("bangla tts", "PASS", f"1-sentence synthesis: {n} word boundaries, {audio} bytes")
        else:
            record("bangla tts", "WARN", f"thin result ({n} boundaries, {audio} bytes) — retry before assuming it is broken",
                   "python scripts/tts.py sample.txt out.mp3 words.json bn-BD-NabanitaNeural +22% +0Hz --lang bn")
    except Exception as e:  # noqa: BLE001
        record("bangla tts", "WARN", f"probe failed ({type(e).__name__}) — the engine retries and falls back",
               "check the network; --no-tts still renders silent for staging")


def main() -> int:
    quick = "--quick" in sys.argv
    as_json = "--json" in sys.argv
    print("\033[1mStickman Animation Studio — doctor\033[0m\n")
    node_version()
    python_version()
    python_deps()
    node_deps()
    ffmpeg()
    ffprobe_check()
    disk_and_ram()
    online = internet()
    if online:
        edge_tts_boundaries()
        bangla_support()
    else:
        record("edge-tts words", "SKIP", "offline")
        record("bangla tts", "SKIP", "offline")
    chromium()
    webgl(quick or not online)

    fails = [r for r in results if r["status"] == "FAIL"]
    warns = [r for r in results if r["status"] == "WARN"]
    print(f"\n{len(results)} checks: {len(fails)} fail, {len(warns)} warn")
    if as_json:
        print(json.dumps({"results": results}, indent=2))
    if fails:
        print("\n\033[31mNot ready.\033[0m Fix the FAIL lines above, then re-run: npm run doctor")
        return 1
    print("\n\033[32mReady.\033[0m Next: npm run studio -- stories/tests/chair-office.json --tier draft")
    return 0


if __name__ == "__main__":
    sys.exit(main())
