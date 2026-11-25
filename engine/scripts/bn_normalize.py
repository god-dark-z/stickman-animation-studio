"""Bangla text normalizer for the narration path (deterministic, unit-tested).

What it does, in order:
  1. Unicode NFC, strip zero-width / control junk, unify punctuation (Bangla danda, quotes).
  2. Convert numbers to spoken Bangla words: integers, years, decimals, percentages, ordinals,
     currency (৳ / টাকা), times, dates, phone-style digit runs, and common units.
  3. Apply the pronunciation dictionary (engine/lang/bn/pronunciation.json): English loanwords,
     brand names, acronyms and tricky proper nouns respelled in Bangla so the voice reads them
     consistently. Longest match first, word-boundary safe for Bangla and Latin.
  4. Segment into sentences (danda / question / exclamation / newline), keep sentences intact.
  5. Chunk each sentence for prosody: short enough for the neural voice, never cutting inside a
     sentence where avoidable, and never splitting a word.

Public API:
    normalize_bangla(text) -> str                     full pipeline (1-3), sentences joined by "। "
    sentences_bn(text) -> list[str]                   segmentation on normalized text
    chunks_bn(text, max_chars=180) -> list[str]       sentence-aware chunking for synthesis
    to_bn_digits(s) / to_ascii_digits(s)              digit conversion helpers
    number_to_bangla_words(n)                         integer → spoken Bangla

Run directly for a self-test:  python scripts/bn_normalize.py
"""
from __future__ import annotations

import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
PRON_PATH = os.path.join(ENGINE, "lang", "bn", "pronunciation.json")

# Windows consoles default to cp1252 and crash on Bangla / arrows (V3 DECISIONS #16).
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BN_DIGITS = "০১২৩৪৫৬৭৮৯"
DIGIT_MAP = {str(i): BN_DIGITS[i] for i in range(10)}
ASCII_MAP = {BN_DIGITS[i]: str(i) for i in range(10)}

# ---------------------------------------------------------------- number words
ONES = [
    "শূন্য", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়",
    "দশ", "এগারো", "বারো", "তেরো", "চৌদ্দ", "পনেরো", "ষোলো", "সতেরো", "আঠারো", "উনিশ",
    "বিশ", "একুশ", "বাইশ", "তেইশ", "চব্বিশ", "পঁচিশ", "ছাব্বিশ", "সাতাশ", "আঠাশ", "ঊনত্রিশ",
    "ত্রিশ", "একত্রিশ", "বত্রিশ", "তেত্রিশ", "চৌত্রিশ", "পঁয়ত্রিশ", "ছত্রিশ", "সাঁইত্রিশ", "আটত্রিশ", "ঊনচল্লিশ",
    "চল্লিশ", "একচল্লিশ", "বিয়াল্লিশ", "তেতাল্লিশ", "চুয়াল্লিশ", "পঁয়তাল্লিশ", "ছেচল্লিশ", "সাতচল্লিশ", "আটচল্লিশ", "ঊনপঞ্চাশ",
    "পঞ্চাশ", "একান্ন", "বায়ান্ন", "তিপ্পান্ন", "চুয়ান্ন", "পঞ্চান্ন", "ছাপ্পান্ন", "সাতান্ন", "আটান্ন", "ঊনষাট",
    "ষাট", "একষট্টি", "বাষট্টি", "তেষট্টি", "চৌষট্টি", "পঁয়ষট্টি", "ছেষট্টি", "সাতষট্টি", "আটষট্টি", "ঊনসত্তর",
    "সত্তর", "একাত্তর", "বাহাত্তর", "তিয়াত্তর", "চুয়াত্তর", "পঁচাত্তর", "ছিয়াত্তর", "সাতাত্তর", "আটাত্তর", "ঊনআশি",
    "আশি", "একাশি", "বিরাশি", "তিরাশি", "চুরাশি", "পঁচাশি", "ছিয়াশি", "সাতাশি", "আটাশি", "ঊননব্বই",
    "নব্বই", "একানব্বই", "বিরানব্বই", "তিরানব্বই", "চুরানব্বই", "পঁচানব্বই", "ছিয়ানব্বই", "সাতানব্বই", "আটানব্বই", "নিরানব্বই",
]

# Common year readings: 1990 → উনিশশো নব্বই (not "এক হাজার নয়শো নব্বই")
YEAR_SUFFIX = "শো"


def _below_hundred(n: int) -> str:
    return ONES[n]


def _below_thousand(n: int) -> str:
    if n < 100:
        return _below_hundred(n)
    h, r = divmod(n, 100)
    head = ONES[h] + "শো"
    return head if r == 0 else head + " " + _below_hundred(r)


def number_to_bangla_words(n: int) -> str:
    """Integer → spoken Bangla, South-Asian grouping (হাজার, লক্ষ, কোটি)."""
    if n < 0:
        return "মাইনাস " + number_to_bangla_words(-n)
    if n < 1000:
        return _below_thousand(n)
    if n < 100_000:  # হাজার
        t, r = divmod(n, 1000)
        return _below_thousand(t) + " হাজার" + (" " + _below_thousand(r) if r else "")
    if n < 10_000_000:  # লক্ষ
        l, r = divmod(n, 100_000)
        return _below_hundred(l) + " লক্ষ" + (" " + number_to_bangla_words(r) if r else "")
    c, r = divmod(n, 10_000_000)
    return number_to_bangla_words(c) + " কোটি" + (" " + number_to_bangla_words(r) if r else "")


def year_to_bangla_words(n: int) -> str:
    """Years read naturally: 1990 → উনিশশো নব্বই; 2024 → দুই হাজার চব্বিশ."""
    if 1000 <= n <= 1999:
        h, r = divmod(n, 100)
        # the first two digits are a two-digit number: 19 → উনিশ, then শো
        head = _below_hundred(h) + YEAR_SUFFIX
        return head if r == 0 else head + " " + _below_hundred(r)
    if 2000 <= n <= 2099:
        r = n % 100
        return "দুই হাজার" + (" " + _below_hundred(r) if r else "")
    return number_to_bangla_words(n)


# ---------------------------------------------------------------- digit helpers
def to_bn_digits(s: str) -> str:
    return "".join(DIGIT_MAP.get(c, c) for c in s)


def to_ascii_digits(s: str) -> str:
    return "".join(ASCII_MAP.get(c, c) for c in s)


def _spoken_decimal(raw: str) -> str:
    """12.5 → বারো দশমিক পাঁচ ; 0.75 → শূন্য দশমিক সাত পাঁচ"""
    if "." in raw:
        whole, frac = raw.split(".", 1)
        w = number_to_bangla_words(int(whole)) if whole else "শূন্য"
        return w + " দশমিক " + " ".join(ONES[int(d)] for d in frac)
    return number_to_bangla_words(int(raw))


# ---------------------------------------------------------------- normalization
ZERO_WIDTH = dict.fromkeys(map(ord, "\u200b\u200c\u200d\u2060\ufeff"), None)

# characters that edge-tts handles badly or that are typographic noise
PUNCT_FIX = [
    ("\u0964", "।"),  # Devanagari danda → Bangla danda
    ("\u2014", " — "),
    ("\u2013", " – "),
    ('"', '"'),
    ('"', '"'),
    ("''", '"'),
    ("\u00a0", " "),
    ("…", "..."),
]


def _clean(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.translate(ZERO_WIDTH)
    for a, b in PUNCT_FIX:
        text = text.replace(a, b)
    # collapse whitespace but keep paragraph breaks
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()




# units that should be read as words when attached to a number
UNITS = {
    "km": "কিলোমিটার", "m": "মিটার", "cm": "সেন্টিমিটার", "kg": "কেজি", "g": "গ্রাম",
    "mb": "মেগাবাইট", "gb": "গিগাবাইট", "tb": "টেরাবাইট", "kb": "কিলোবাইট",
    "ms": "মিলিসেকেন্ড", "hz": "হার্টজ", "ghz": "গিগাহার্জ", "mhz": "মেগাহার্টজ",
    "w": "ওয়াট", "kw": "কিলোওয়াট", "v": "ভোল্ট", "mm": "মিলিমিটার", "%": "শতাংশ",
}

_ABBREV = {
    "ডঃ": "ডক্টর", "ডা.": "ডাক্তার", "মি.": "মিস্টার", "মিসেস": "মিসেস",
}


def _number_phrases(text: str) -> str:
    """Convert numeric expressions in `text` (already cleaned) to spoken Bangla words."""

    # percentages first: 40% / ৪০% / 40 % / 40 শতাংশ
    def pct(m: re.Match) -> str:
        raw = to_ascii_digits(m.group(1))
        return _spoken_decimal(raw) + " শতাংশ"

    text = re.sub(r"(\d+(?:\.\d+)?)\s*%", pct, text)
    text = re.sub(r"(\d+(?:\.\d+)?)\s*শতাংশ", pct, text)

    # currency: ৳ 500 / 500 টাকা / 500 টাকায়. The ৳ pattern already emits "টাকা", so consume
    # an existing "টাকা" right after it instead of duplicating it.
    def taka(m: re.Match) -> str:
        raw = to_ascii_digits(m.group(1))
        words = _spoken_decimal(raw)
        try:
            val = int(float(raw))
            if val >= 100000:
                words = number_to_bangla_words(val)
        except ValueError:
            pass
        return words + " টাকা"

    text = re.sub(r"[৳]\s*(\d+(?:\.\d+)?)\s*(?:টাকা(?:র)?)?", taka, text)
    text = re.sub(r"(\d+(?:\.\d+)?)\s*টাকার?", taka, text)

    # times: 5:30 → পাঁচটা ত্রিশ / 10 PM
    def clock(m: re.Match) -> str:
        h, mi = int(to_ascii_digits(m.group(1))), int(to_ascii_digits(m.group(2)))
        head = _below_hundred(h) + "টা"
        return head if mi == 0 else head + " " + _below_hundred(mi) + " মিনিট"

    text = re.sub(r"\b(\d{1,2}):(\d{2})\b", clock, text)
    text = re.sub(r"\b(\d{1,2})\s*(?:এএম|am|AM)\b", lambda m: _below_hundred(int(to_ascii_digits(m.group(1)))) + "টার সময়", text)
    text = re.sub(r"\b(\d{1,2})\s*(?:পিএম|pm|PM)\b", lambda m: _below_hundred(int(to_ascii_digits(m.group(1)))) + "টার পর", text)

    # dates: 12/05/2024 → বারো মে দুই হাজার চব্বিশ (numeric dates ambiguous: read day, month, year)
    MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"]

    def date_dmy(m: re.Match) -> str:
        d, mo, y = (int(to_ascii_digits(g)) for g in m.groups())
        if not 1 <= mo <= 12 or not 1 <= d <= 31:
            return m.group(0)
        return f"{_below_hundred(d)} {MONTHS[mo - 1]} {year_to_bangla_words(y)}"

    text = re.sub(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b", date_dmy, text)

    # ordinal: 2nd / ২য় / 2য় / 3টি / ৪র্থ
    text = re.sub(r"\b(\d+)\s*(?:st|nd|rd|th)\b", lambda m: _below_hundred(int(to_ascii_digits(m.group(1)))) + "তম", text, flags=re.IGNORECASE)
    text = re.sub(r"(\d+)\s*য়", lambda m: _below_hundred(int(to_ascii_digits(m.group(1)))) + "তম", text)
    text = re.sub(r"(\d+)\s*তম", lambda m: _below_hundred(int(to_ascii_digits(m.group(1)))) + "তম", text)
    text = re.sub(r"(\d+)\s*র্থ", lambda m: _below_hundred(int(to_ascii_digits(m.group(1)))) + "তম", text)

    # years: "1990 সালে" / "২০২৪ সালে" — read the year as a year
    def year_ctx(m: re.Match) -> str:
        y = int(to_ascii_digits(m.group(1)))
        return year_to_bangla_words(y) + " " + m.group(2)

    text = re.sub(r"\b(\d{4})\s*(সালে|সাল|সনের)\b", year_ctx, text)

    # phone-like runs (7+ digits, optional +, spaces/dashes): read digit by digit
    def phone(m: re.Match) -> str:
        digits = re.sub(r"\D", "", to_ascii_digits(m.group(0)))
        return " ".join(ONES[int(d)] for d in digits)

    text = re.sub(r"(?<!\d)(?:\+?৮?\d[\d\s-]{6,}\d)(?!\d)", phone, text)

    # units attached to a number: 5km → পাঁচ কিলোমিটার
    def unit(m: re.Match) -> str:
        raw, u = to_ascii_digits(m.group(1)), m.group(2).lower()
        return _spoken_decimal(raw) + " " + UNITS.get(u, u)

    text = re.sub(r"\b(\d+(?:\.\d+)?)\s*(km|cm|mm|kg|gb|tb|kb|mb|ghz|mhz|hz|ms|kw|w|v|m|g)\b", unit, text, flags=re.IGNORECASE)

    # any remaining number, in place (keeps order)
    def bare(m: re.Match) -> str:
        raw = to_ascii_digits(m.group(0))
        return _spoken_decimal(raw)

    text = re.sub(r"\d+(?:\.\d+)?", bare, text)
    return text


def load_pronunciation(extra_paths: list[str] | None = None) -> dict[str, str]:
    """Base dictionary plus any story-level extensions (later files win)."""
    entries: dict[str, str] = {}
    paths = [PRON_PATH] + (extra_paths or [])
    for p in paths:
        try:
            with open(p, encoding="utf8") as f:
                data = json.load(f)
            entries.update({k: v for k, v in data.get("entries", {}).items() if k and v})
        except FileNotFoundError:
            continue
    return entries


def _apply_pronunciation(text: str, entries: dict[str, str]) -> str:
    """Longest-match dictionary substitution, safe for Bangla and Latin keys."""
    if not entries:
        return text
    keys = sorted(entries, key=len, reverse=True)
    # one alternation pass, case-insensitive for Latin keys, exact for Bangla
    pattern = re.compile("|".join(re.escape(k) for k in keys), re.IGNORECASE)

    def sub(m: re.Match) -> str:
        hit = m.group(0)
        for k in keys:
            if k.lower() == hit.lower():
                return entries[k]
        return hit

    return pattern.sub(sub, text)


LATIN_WORD = re.compile(r"[A-Za-z][A-Za-z'’\-]*")


def latin_leftovers(text: str) -> list[str]:
    """Latin-script words the dictionary did not respell — a Bangla video should not show them.

    Returns the distinct words in order, so a caller can warn (or fail, per the pack's
    latinPolicy) with the exact list instead of a generic message.
    """
    seen: list[str] = []
    for m in LATIN_WORD.finditer(text):
        w = m.group(0)
        if w not in seen:
            seen.append(w)
    return seen


def _fix_spacing(text: str) -> str:
    # Bangla danda / punctuation spacing: no space before, one after
    text = re.sub(r"\s+([।,!?;:])", r"\1", text)
    text = re.sub(r"([।,!?;:])(?=[^\s।,!?;:])", r"\1 ", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def normalize_bangla(text: str, extra_pronunciation: list[str] | None = None) -> str:
    """Full pipeline. `extra_pronunciation` is a list of story-level dictionary files merged on
    top of the shipped one, so a single story can respell its own proper nouns."""
    text = _clean(text)
    text = _number_phrases(text)
    text = _apply_pronunciation(text, load_pronunciation(extra_pronunciation))
    for a, b in _ABBREV.items():
        text = text.replace(a, b)
    text = _fix_spacing(text)
    return text


# ---------------------------------------------------------------- segmentation
SENT_END = re.compile(r"(?<=[।!?])\s+|\n+")


def sentences_bn(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    parts = [p.strip() for p in SENT_END.split(text) if p and p.strip()]
    # a trailing fragment without a danda is still a sentence
    return parts


def chunks_bn(text: str, max_chars: int = 180) -> list[str]:
    """Sentence-aware chunks: never split a sentence under the limit; split long ones on clauses."""
    out: list[str] = []
    for s in sentences_bn(text):
        if len(s) <= max_chars:
            out.append(s)
            continue
        # long sentence: break after danda-less clause punctuation, then on word boundaries
        pieces = re.split(r"(?<=[,;—])\s+", s)
        cur = ""
        for p in pieces:
            if not cur:
                cur = p
            elif len(cur) + 1 + len(p) <= max_chars:
                cur += " " + p
            else:
                out.append(cur)
                cur = p
        while len(cur) > max_chars:
            cut = cur.rfind(" ", 0, max_chars)
            if cut <= 0:
                cut = max_chars
            out.append(cur[:cut].strip())
            cur = cur[cut:].strip()
        if cur:
            out.append(cur)
    return [c for c in out if c]


# ---------------------------------------------------------------- grapheme safety
BN_VIRAMA = "\u09cd"
BN_SIGNS = set("\u09be\u09bf\u09c0\u09c1\u09c2\u09c3\u09c7\u09c8\u09cb\u09cc\u0981\u0982\u0983\u09cd\u09bc")


def is_safe_cut(text: str, i: int) -> bool:
    """True if cutting `text` at index i does not split a Bangla grapheme cluster."""
    if i <= 0 or i >= len(text):
        return True
    prev, nxt = text[i - 1], text[i]
    if prev == BN_VIRAMA:  # conjunct
        return False
    if nxt in BN_SIGNS:  # vowel sign / anusvara / candrabindu would be orphaned
        return False
    return True


if __name__ == "__main__":
    samples = [
        "আজ সকালে ৪০% মানুষ বৃষ্টিতে ভিজেছে।",
        "১৯৯০ সালে তার জন্ম। এখন ৳৫০০ টাকা দাম।",
        "ফোনের চার্জ 100% থেকে 2.5 ঘণ্টায় 15% হয়ে গেল।",
        "সে 12/05/2024 তারিখে এসেছিল, সকাল 7:30 এ।",
    ]
    for s in samples:
        n = normalize_bangla(s)
        print(f"IN : {s}\nOUT: {n}\n")
    print("words for 1990:", year_to_bangla_words(1990))
    print("words for 2024:", year_to_bangla_words(2024))
    print("chunks:", chunks_bn(normalize_bangla(" ".join(samples)), 120))
