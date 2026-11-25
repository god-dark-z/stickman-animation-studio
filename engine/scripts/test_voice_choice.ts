/**
 * Voice-choice tests — 30 topics with an expected gender, plus precedence and distinctness.
 *
 *   npx tsx scripts/test_voice_choice.ts
 *
 * The expectation is the *gender*, not an exact voice id: the id comes from the pack's catalog
 * and may legitimately change if a voice is replaced, while the narrative decision must not.
 */
import { checkDistinctSpeakers, chooseVoice, decisionMarkdown, scoreText } from "./choose_voice";

type Case = { topic: string; lang: "en" | "bn"; expect: "male" | "female" | "any" };

const CASES: Case[] = [
  // ---------------------------------------------------------------- English, male-leaning
  { topic: "The trench warfare of world war one and the soldiers who survived", lang: "en", expect: "male" },
  { topic: "How the Roman empire built roads that still exist", lang: "en", expect: "male" },
  { topic: "Why your phone gets hot when the signal is weak", lang: "en", expect: "male" },
  { topic: "How a computer chip is actually made", lang: "en", expect: "male" },
  { topic: "The 2008 financial crash and the market that learned nothing", lang: "en", expect: "male" },
  { topic: "The detective who solved a crime with a single hair", lang: "en", expect: "male" },
  { topic: "How the boxing champion trained in secret", lang: "en", expect: "male" },
  { topic: "The heist that almost worked", lang: "en", expect: "male" },
  // ---------------------------------------------------------------- English, female-leaning
  { topic: "A gentle explainer for beginners: why do we dream", lang: "en", expect: "female" },
  { topic: "How to sleep better, explained simply", lang: "en", expect: "female" },
  { topic: "What a baby hears in the first month", lang: "en", expect: "female" },
  { topic: "A mother's letters to her daughter", lang: "en", expect: "female" },
  { topic: "Cooking rice the way my grandmother taught me", lang: "en", expect: "female" },
  { topic: "Self-care and meditation for a busy week", lang: "en", expect: "female" },
  { topic: "A children's story about a lost kitten", lang: "en", expect: "female" },
  { topic: "A poem about longing and memory", lang: "en", expect: "female" },
  // ---------------------------------------------------------------- Bangla, male-leaning
  { topic: "১৯৭১ সালের যুদ্ধের এক সৈনিকের গল্প", lang: "bn", expect: "male" },
  { topic: "সিগন্যাল দুর্বল হলে ফোন গরম হয় কেন", lang: "bn", expect: "male" },
  { topic: "মোগল সাম্রাজ্যের ইতিহাস", lang: "bn", expect: "male" },
  { topic: "ক্রিকেট ম্যাচে শেষ ওভারের রহস্য", lang: "bn", expect: "male" },
  { topic: "অর্থনীতি ও বাজারের ওপর একটি থ্রিলার", lang: "bn", expect: "male" },
  { topic: "একজন গোয়েন্দার তদন্তের গল্প", lang: "bn", expect: "male" },
  // ---------------------------------------------------------------- Bangla, female-leaning
  { topic: "মায়ের চিঠি ও স্মৃতির গল্প", lang: "bn", expect: "female" },
  { topic: "শিশুদের জন্য একটি মজার গল্প", lang: "bn", expect: "female" },
  { topic: "রান্নাঘরে দাদির রেসিপি", lang: "bn", expect: "female" },
  { topic: "স্বাস্থ্য নিয়ে সহজভাবে জানুন", lang: "bn", expect: "female" },
  { topic: "ঘুমিয়ে পড়ার আগে একটি কবিতা", lang: "bn", expect: "female" },
  { topic: "পরিবার ও মায়ের ভালোবাসার গল্প", lang: "bn", expect: "female" },
  // ---------------------------------------------------------------- weak/no signal → any
  { topic: "A video about tides", lang: "en", expect: "any" },
  { topic: "একটি ভিডিও নদী নিয়ে", lang: "bn", expect: "any" },
];

let passed = 0;
let failed = 0;

const check = (name: string, ok: boolean, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`);
  }
};

for (const c of CASES) {
  const choice = chooseVoice({ text: c.topic, lang: c.lang });
  const ok = c.expect === "any" ? true : choice.gender === c.expect;
  check(`[${c.lang}] ${c.topic.slice(0, 52)} → ${c.expect}`, ok, `got ${choice.gender} (${choice.voice}), source=${choice.source}, score=m${choice.score.male}/f${choice.score.female}: ${choice.reason}`);
}

// ---------------------------------------------------------------- precedence
const pref = chooseVoice({ text: "The trench warfare of world war one", lang: "en", pref: "female" });
check("user preference beats the genre score", pref.gender === "female" && pref.source === "user", `${pref.gender} ${pref.source}`);
const explicit = chooseVoice({ text: "a gentle story about a baby", lang: "bn", pref: "bn-BD-PradeepNeural" });
check("an explicit voice id is honoured exactly", explicit.voice === "bn-BD-PradeepNeural" && explicit.source === "user", explicit.voice);

const firstPerson = chooseVoice({ text: "I lost my mother in the flood, and this is my story", lang: "en" });
check("first-person story follows its narrator", firstPerson.source === "first-person" && firstPerson.gender === "female", `${firstPerson.source} ${firstPerson.gender}`);

// ---------------------------------------------------------------- scoring table is data
const bnScore = scoreText("bn", "সিগন্যাল ও যুদ্ধ ও ইতিহাস");
check("multiple groups accumulate evidence", bnScore.male >= 4 && bnScore.rows.length >= 2, JSON.stringify(bnScore));
const noHit = scoreText("en", "a quiet video without genre words");
check("a signal-free topic scores zero", noHit.male === 0 && noHit.female === 0);

// ---------------------------------------------------------------- distinct dialogue voices
const sameVoice = checkDistinctSpeakers("bn", [{ id: "a", voice: "bn-BD-NabanitaNeural" }, { id: "b", voice: "bn-BD-NabanitaNeural" }], "+22%");
check("two speakers on one identical voice are rejected", sameVoice.length === 1, JSON.stringify(sameVoice));
const rateDiff = checkDistinctSpeakers("bn", [
  { id: "a", voice: "bn-BD-NabanitaNeural", rate: "+22%" },
  { id: "b", voice: "bn-BD-NabanitaNeural", rate: "+8%" },
], "+22%");
check("the same voice at a clearly different rate is accepted", rateDiff.length === 0, JSON.stringify(rateDiff));
const twoVoices = checkDistinctSpeakers("bn", [{ id: "a", voice: "bn-BD-NabanitaNeural" }, { id: "b", voice: "bn-BD-PradeepNeural" }], "+22%");
check("different voices are accepted", twoVoices.length === 0);
check("bangla has at least one voice per gender for dialogue", checkDistinctSpeakers("bn", [
  { id: "m1", voice: "bn-BD-PradeepNeural" },
  { id: "f1", voice: "bn-BD-NabanitaNeural" },
], "+22%").length === 0);

// ---------------------------------------------------------------- decision file
const md = decisionMarkdown("Why phones get hot", "bn", chooseVoice({ text: "সিগন্যাল দুর্বল হলে ফোন গরম হয় কেন", lang: "bn" }));
check("decision file names the voice, the source and the score", md.includes("**Voice:**") && md.includes("**Chosen by:**") && md.includes("**Score:**"));
check("decision file lists the evidence groups", md.includes("| Signal group |"));

console.log(`\n${passed} passed, ${failed} failed of ${passed + failed}`);
if (failed) process.exitCode = 1;
