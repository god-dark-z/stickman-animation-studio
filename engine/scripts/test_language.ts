/**
 * Resolver tests — the language trigger is the one decision that must never surprise.
 *
 *   npx tsx scripts/test_language.ts        (also imported by scripts/test.ts so `npm test` runs it)
 *
 * Groups: English phrasings, Bangla-script phrasings, Banglish, negations, false positives,
 * flag precedence, voice preference.
 */
import assert from "node:assert/strict";
import { resolveLanguage, type Resolution } from "./resolve_language";

type Case = { name: string; text: string; flag?: string; voice?: string; lang: "en" | "bn"; pref?: string; note?: boolean };

const CASES: Case[] = [
  // ---------------------------------------------------------------- English phrasings (12)
  { name: "en: in Bangla", text: "Why does your phone get hot when signal is weak? in Bangla", lang: "bn" },
  { name: "en: in Bengali", text: "Explain the emu war in Bengali", lang: "bn" },
  { name: "en: Bangla narration", text: "Make a video about rain with Bangla narration", lang: "bn" },
  { name: "en: Bangla voice", text: "A story about a rickshaw driver, Bangla voice", lang: "bn" },
  { name: "en: make it in Bangla", text: "Make it in Bangla", lang: "bn" },
  { name: "en: with Bengali voiceover", text: "Why do cats purr? with Bengali voiceover", lang: "bn" },
  { name: "en: narration in Bangla", text: "The history of tea — narration in Bangla", lang: "bn" },
  { name: "en: everything in Bangla", text: "Explain photosynthesis, everything in Bangla please", lang: "bn" },
  { name: "en: create in Bangla", text: "Create a 60 second video in Bangla about the monsoon", lang: "bn" },
  { name: "en: produce in Bangla", text: "Produce this as a video in Bangla", lang: "bn" },
  { name: "en: speak Bangla", text: "Speak Bangla for this one: why do we dream?", lang: "bn" },
  { name: "en: Bangla captions", text: "Make the video with Bangla captions and narration", lang: "bn" },

  // ---------------------------------------------------------------- Bangla script (10)
  { name: "bn: বাংলায়", text: "সিগন্যাল দুর্বল হলে ফোন গরম হয় কেন? বাংলায়", lang: "bn" },
  { name: "bn: বাংলা ভাষায়", text: "বৃষ্টি কীভাবে হয় বাংলা ভাষায় বানাও", lang: "bn" },
  { name: "bn: বাংলা ন্যারেশন", text: "চায়ের ইতিহাস নিয়ে ভিডিও, বাংলা ন্যারেশন", lang: "bn" },
  { name: "bn: বাংলা ভয়েসে", text: "এই গল্পটা বাংলা ভয়েসে বলো", lang: "bn" },
  { name: "bn: বাংলায় বানাও", text: "ফোন কেন গরম হয় বাংলায় বানাও", lang: "bn" },
  { name: "bn: অডিও বাংলায়", text: "অডিও বাংলায় চাই", lang: "bn" },
  { name: "bn: ভিডিও বাংলায়", text: "ভিডিও বাংলায় করো", lang: "bn" },
  { name: "bn: বাংলা ভাষায় করো", text: "এই বিষয়ে বাংলা ভাষায় করো", lang: "bn" },
  { name: "bn: বাংলায় বলো", text: "গল্পটা বাংলায় বলো", lang: "bn" },
  { name: "bn: বাংলা ন্যারেশন চাই", text: "বাংলা ন্যারেশন চাই এই ভিডিওতে", lang: "bn" },

  // ---------------------------------------------------------------- Banglish (9)
  { name: "banglish: bangla te banao", text: "Phone gormo hoy keno, bangla te banao", lang: "bn" },
  { name: "banglish: bangla bhashay", text: "Brishti kivabe hoy, bangla bhashay bolo", lang: "bn" },
  { name: "banglish: bengali te chai", text: "Ei golpo ta bengali te chai", lang: "bn" },
  { name: "banglish: bangla e koro", text: "Video ta bangla e koro", lang: "bn" },
  { name: "banglish: bangla te bolo", text: "Eta bangla te bolo", lang: "bn" },
  { name: "banglish: bangla narration", text: "Chayer itihash, bangla narration diye", lang: "bn" },
  { name: "banglish: bangla voice", text: "Golpo ta bangla voice e chai", lang: "bn" },
  { name: "banglish: bangla bhasha", text: "Bishoy ta bangla bhasha y banao", lang: "bn" },
  { name: "banglish: bengali version", text: "Ekta bengali version banao ei topic e", lang: "bn" },

  // ---------------------------------------------------------------- Negations (7)
  { name: "neg: not in Bangla", text: "Why do we yawn? not in Bangla", lang: "en" },
  { name: "neg: English only", text: "A video about tides, English only", lang: "en" },
  { name: "neg: no Bangla", text: "No Bangla please — explain rainbows", lang: "en" },
  { name: "neg: don't do it in Bangla", text: "Don't do it in Bangla, keep English", lang: "en" },
  { name: "neg: বাংলা নয়", text: "এই ভিডিওটা বাংলা নয়, ইংরেজিতে করো", lang: "en" },
  { name: "neg: ইংরেজিতে", text: "ইংরেজিতে করো এই ভিডিওটা", lang: "en" },
  { name: "neg: without Bangla", text: "Without Bangla narration, about volcanoes", lang: "en" },

  // ---------------------------------------------------------------- False positives (8)
  { name: "topic: Bangla literature", text: "A story about Bangla literature and its poets", lang: "en" },
  { name: "topic: Bengal tiger", text: "Why the Bengal tiger is disappearing", lang: "en" },
  { name: "topic: Bangla language movement", text: "The Bangla language movement of 1952", lang: "en" },
  { name: "topic: Bangla music", text: "The rise of Bangla music in the 1990s", lang: "en" },
  { name: "topic: history of Bengali cinema", text: "The history of Bengali cinema", lang: "en" },
  { name: "topic: Bangla new year", text: "How Bangla new year is celebrated", lang: "en" },
  { name: "topic: Bengali food", text: "Bengali food and why it uses mustard oil", lang: "en" },
  { name: "topic: Bangla script history", text: "The origin of the Bangla script", lang: "en" },

  // ---------------------------------------------------------------- Flag precedence (4)
  { name: "flag: --lang en beats in Bangla", text: "Make it in Bangla", flag: "en", lang: "en" },
  { name: "flag: --lang bn beats English only", text: "English only please", flag: "bn", lang: "bn" },
  { name: "flag: --lang bn on plain topic", text: "Why do cats purr", flag: "bn", lang: "bn" },
  { name: "flag: --lang en on plain topic", text: "Why do cats purr", flag: "en", lang: "en" },

  // ---------------------------------------------------------------- Bangla script, no request (3)
  { name: "topic-only Bangla script stays en + note", text: "সিগন্যাল দুর্বল হলে ফোন গরম হয় কেন", lang: "en", note: true },
  { name: "topic-only Bangla script 2 stays en + note", text: "বৃষ্টি কীভাবে হয়", lang: "en", note: true },
  { name: "plain English topic stays en", text: "Why does the moon look bigger at the horizon", lang: "en" },

  // ---------------------------------------------------------------- Voice preference (6)
  { name: "voice: female voice", text: "A gentle story about a mother, female voice", lang: "en", pref: "female" },
  { name: "voice: male narrator", text: "A war documentary in Bangla with a male narrator", lang: "bn", pref: "male" },
  { name: "voice: মহিলা কণ্ঠে", text: "গল্পটা মহিলা কণ্ঠে বলো", lang: "bn", pref: "female" },
  { name: "voice: পুরুষ কণ্ঠে", text: "ইতিহাসটা পুরুষ কণ্ঠে বলো", lang: "bn", pref: "male" },
  { name: "voice: --voice female flag", text: "Why do we dream? in Bangla", voice: "female", lang: "bn", pref: "female" },
  { name: "voice: explicit voice id", text: "in Bangla", voice: "bn-BD-PradeepNeural", lang: "bn", pref: "bn-BD-PradeepNeural" },
];

export function runLanguageTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  for (const c of CASES) {
    const res: Resolution = resolveLanguage({ text: c.text, flag: c.flag, voice: c.voice });
    const problems: string[] = [];
    if (res.lang !== c.lang) problems.push(`lang ${res.lang} ≠ expected ${c.lang}`);
    if (c.pref && res.voice_pref !== c.pref) problems.push(`voice_pref ${res.voice_pref} ≠ expected ${c.pref}`);
    if (c.note !== undefined && Boolean(res.note) !== c.note) problems.push(`note ${res.note ? "present" : "absent"} ≠ expected`);
    if (problems.length) {
      failed++;
      console.error(`FAIL  ${c.name}\n      "${c.text}"${c.flag ? ` [--lang ${c.flag}]` : ""}\n      ${problems.join("; ")}\n      got ${JSON.stringify(res)}`);
    } else {
      passed++;
      console.log(`  ok  ${c.name}`);
    }
  }
  return { passed, failed };
}

if (process.argv[1] && /test_language\.[tj]s$/.test(process.argv[1])) {
  const { passed, failed } = runLanguageTests();
  console.log(`\n${passed} passed, ${failed} failed of ${CASES.length}`);
  if (failed) process.exitCode = 1;
}
