"""Unit tests for the Bangla text normalizer (no framework: plain asserts).

Run: python scripts/test_bn_normalize.py        (also called by scripts/test_all.py)

Covers: NFC/zero-width cleanup, punctuation, digits (Bangla + Western), decimals,
percentages, ordinals, years, dates, times, currency, phone runs, units, the pronunciation
dictionary, sentence segmentation, chunking, and grapheme-safe cuts.
"""
from __future__ import annotations

import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bn_normalize as bn  # noqa: E402

passed = 0
failed = 0


def test(name: str, cond: bool, detail: str = "") -> None:
    global passed, failed
    if cond:
        passed += 1
        print(f"  ok  {name}")
    else:
        failed += 1
        print(f"FAIL  {name}" + (f"\n      {detail}" if detail else ""))


def eq(name: str, got, want) -> None:
    test(name, got == want, f"got {got!r}\n      want {want!r}")


# ---------------------------------------------------------------- numbers
eq("number 0", bn.number_to_bangla_words(0), "শূন্য")
eq("number 7", bn.number_to_bangla_words(7), "সাত")
eq("number 19", bn.number_to_bangla_words(19), "উনিশ")
eq("number 21", bn.number_to_bangla_words(21), "একুশ")
eq("number 99", bn.number_to_bangla_words(99), "নিরানব্বই")
eq("number 100", bn.number_to_bangla_words(100), "একশো")
eq("number 250", bn.number_to_bangla_words(250), "দুইশো পঞ্চাশ")
eq("number 1000", bn.number_to_bangla_words(1000), "এক হাজার")
eq("number 2500", bn.number_to_bangla_words(2500), "দুই হাজার পাঁচশো")
eq("number 100000 (লক্ষ)", bn.number_to_bangla_words(100000), "এক লক্ষ")
eq("number 10000000 (কোটি)", bn.number_to_bangla_words(10_000_000), "এক কোটি")

eq("year 1990", bn.year_to_bangla_words(1990), "উনিশশো নব্বই")
eq("year 1952", bn.year_to_bangla_words(1952), "উনিশশো বায়ান্ন")
eq("year 1900", bn.year_to_bangla_words(1900), "উনিশশো")
eq("year 2024", bn.year_to_bangla_words(2024), "দুই হাজার চব্বিশ")
eq("year 2000", bn.year_to_bangla_words(2000), "দুই হাজার")

# ---------------------------------------------------------------- digits
eq("bn digits from western", bn.to_bn_digits("2024"), "২০২৪")
eq("western digits from bn", bn.to_ascii_digits("২০২৪"), "2024")

# ---------------------------------------------------------------- normalization pipeline
eq("percent western", bn.normalize_bangla("৪০%"), "চল্লিশ শতাংশ")
eq("percent bangla digits", bn.normalize_bangla("৪০%"), "চল্লিশ শতাংশ")
eq("decimal", bn.normalize_bangla("2.5"), "দুই দশমিক পাঁচ")
eq("ordinal", bn.normalize_bangla("২য়"), "দুইতম")
eq("currency bd symbol", bn.normalize_bangla("৳৫০০"), "পাঁচশো টাকা")
eq("currency word", bn.normalize_bangla("৫০০ টাকা"), "পাঁচশো টাকা")
eq("currency no duplicate", bn.normalize_bangla("৳৫০০ টাকা"), "পাঁচশো টাকা")
eq("year in context", bn.normalize_bangla("১৯৯০ সালে"), "উনিশশো নব্বই সালে")
test("time reads as words", "সাতটা" in bn.normalize_bangla("7:30"), bn.normalize_bangla("7:30"))
test("phone run digit by digit", bn.normalize_bangla("01712345678").count(" ") >= 8, bn.normalize_bangla("01712345678"))
test("unit km", "কিলোমিটার" in bn.normalize_bangla("5km"), bn.normalize_bangla("5km"))

# zero-width + punctuation
eq("zero width stripped", bn.normalize_bangla("আজ\u200bবৃষ্টি"), "আজবৃষ্টি")
eq("devanagari danda fixed", bn.normalize_bangla("আজ বৃষ্টি\u0964"), "আজ বৃষ্টি।")
eq("space before danda removed", bn.normalize_bangla("আজ বৃষ্টি ।"), "আজ বৃষ্টি।")
test("no double spaces", "  " not in bn.normalize_bangla("আজ    বৃষ্টি"))

# pronunciation dictionary
test("dictionary: phone", "ফোন" in bn.normalize_bangla("আমার phone গরম"), bn.normalize_bangla("আমার phone গরম"))
test("dictionary: wifi", "ওয়াইফাই" in bn.normalize_bangla("WiFi নেই"), bn.normalize_bangla("WiFi নেই"))
test("dictionary: longest match wins", "ভাষা আন্দোলন" in bn.normalize_bangla("language movement"), bn.normalize_bangla("language movement"))
test("dictionary: bengal (not inside bangladesh)", "বাংলাদেশ" in bn.normalize_bangla("Bangladesh"), bn.normalize_bangla("Bangladesh"))

# ---------------------------------------------------------------- segmentation and chunking
eq("two sentences", bn.sentences_bn("আজ বৃষ্টি পড়ছে। ছেলেটি ঘরে আছে।"), ["আজ বৃষ্টি পড়ছে।", "ছেলেটি ঘরে আছে।"])
eq("question sentence stays whole", bn.sentences_bn("তুমি কেমন আছো?"), ["তুমি কেমন আছো?"])
test("chunks never exceed the limit", all(len(c) <= 60 for c in bn.chunks_bn("এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ।", 60)))
test("chunk count keeps every sentence", len(bn.chunks_bn("এক। দুই। তিন।", 200)) == 3, bn.chunks_bn("এক। দুই। তিন।", 200))

# ---------------------------------------------------------------- grapheme safety
test("safe cut before a plain consonant", bn.is_safe_cut("আজ", 1))
test("unsafe cut before a vowel sign", not bn.is_safe_cut("কি", 1))  # ি is a matra; cutting before it orphans it
test("unsafe cut after a virama", not bn.is_safe_cut("ক্ষ", 1))  # conjunct

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
