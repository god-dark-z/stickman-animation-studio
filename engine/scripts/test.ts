/**
 * Node-side tests (no framework: plain assertions, run with tsx).
 *
 *   npm test      -> tsx scripts/test.ts
 *
 * Covers the pure units the pipeline depends on: tokenizer robustness, story-schema
 * narration defaults (English-only), timeline word alignment + beat resolution,
 * caption chunking, and the silent-shot marker.
 */
import assert from "node:assert/strict";
import { StorySchema } from "../src/schema";
import { buildTimeline, tokenize } from "../src/timeline";
import { chunkWords } from "../src/captions/Captions";
import { anchorWorld } from "../src/scene/layout";
import { poseMetrics, resolvePlacement, stageOf } from "../src/scene/layout";
import { checkShot } from "./qa_geometry";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}\n  ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

// ------------------------------------------------------------------ tokenizer
test("tokenize keeps English words", () => {
  const w = tokenize("The soldiers gave up. Twenty thousand emus!");
  assert.equal(w.length, 7);
  assert.equal(w[0], "The");
  assert.equal(w[4], "Twenty");
  assert.equal(w[6], "emus!");
});

test("tokenize ignores punctuation-only tokens", () => {
  assert.deepEqual(tokenize("— — ? !"), []);
});

test("tokenize keeps apostrophes and accented letters", () => {
  const w = tokenize("Sam doesn't like café noise.");
  assert.equal(w.length, 5);
  assert.equal(w[1], "doesn't");
  assert.equal(w[3], "café");
});

// ------------------------------------------------------------------ narration defaults (English-only)
test("StorySchema defaults to the edge provider and its English voice", () => {
  const story = StorySchema.parse({
    title: "Emu War", cast: { a: { color: "#ffffff" } },
    shots: [{ say: "The emus were winning.", actors: [{ id: "a" }] }],
  });
  assert.equal(story.provider, "edge");
  assert.equal(story.voice, "en-US-AndrewMultilingualNeural");
  assert.equal(story.rate, "+22%");
});

test("explicit provider kokoro converts the default rate to a multiplier and uses its voice", () => {
  const story = StorySchema.parse({
    title: "Offline", provider: "kokoro", cast: { a: { color: "#ffffff" } },
    shots: [{ say: "Still works offline.", actors: [{ id: "a" }] }],
  });
  assert.equal(story.provider, "kokoro");
  assert.equal(story.voice, "am_michael");
  assert.equal(story.rate, "0.82");
});

test("explicit voice and rate are kept untouched", () => {
  const story = StorySchema.parse({
    title: "Calm", voice: "en-US-ChristopherNeural", rate: "+8%", cast: { a: { color: "#ffffff" } },
    shots: [{ say: "A calm documentary read.", actors: [{ id: "a" }] }],
  });
  assert.equal(story.voice, "en-US-ChristopherNeural");
  assert.equal(story.rate, "+8%");
});

test("unknown narration providers are rejected", () => {
  assert.throws(() =>
    StorySchema.parse({
      title: "Bad", provider: "bn-vits", cast: { a: { color: "#ffffff" } },
      shots: [{ say: "No retired backends.", actors: [{ id: "a" }] }],
    }),
  );
});

// ------------------------------------------------------------------ timeline
const story = StorySchema.parse({
  title: "Phone Heat", cast: { sam: { color: "#ff8a2a", build: "kid" } },
  shots: [
    { say: "Your phone loses signal, and it gets hot.", actors: [{ id: "sam" }] },
    { say: "Not warm. Hot enough to worry you.", actors: [{ id: "sam" }] },
  ],
});

test("word timings drive the timeline (no collapse)", () => {
  const words = [
    { text: "Your", start: 0.1, end: 0.35 }, { text: "phone", start: 0.4, end: 0.8 },
    { text: "loses", start: 0.85, end: 1.2 }, { text: "signal,", start: 1.25, end: 1.9 },
    { text: "and", start: 1.95, end: 2.15 }, { text: "it", start: 2.2, end: 2.35 },
    { text: "gets", start: 2.4, end: 2.7 }, { text: "hot.", start: 2.75, end: 3.3 },
    { text: "Not", start: 3.9, end: 4.15 }, { text: "warm.", start: 4.2, end: 4.6 },
    { text: "Hot", start: 5.0, end: 5.3 }, { text: "enough", start: 5.35, end: 5.8 },
    { text: "to", start: 5.85, end: 6.0 }, { text: "worry", start: 6.05, end: 6.5 },
    { text: "you.", start: 6.55, end: 6.9 },
  ];
  const tl = buildTimeline(story, words, "voice/x.mp3", null);
  assert.equal(tl.shots.length, 2);
  assert.ok(tl.durationInFrames >= Math.ceil(7.5 * 30), "duration should come from real audio, not estimates");
  assert.equal(tl.shots[0].from, 0);
  assert.ok(tl.shots[1].from > 0, "second shot starts when its first word is spoken");
  assert.equal(tl.shots[1].words.length, 7, "words must be attributed to the right shot");
  assert.equal(tl.shots[1].words[0].text, "Not");
});

test("TTS word-split tokens still align to the script (contractions, numbers)", () => {
  const words = [
    { text: "It", start: 0.1, end: 0.3 }, { text: "didn", start: 0.35, end: 0.55 },
    { text: "'t", start: 0.55, end: 0.7 }, { text: "do", start: 0.75, end: 0.95 },
    { text: "anything.", start: 1.0, end: 1.6 },
    { text: "It", start: 2.0, end: 2.2 }, { text: "just", start: 2.25, end: 2.5 },
    { text: "shouted.", start: 2.55, end: 3.2 },
  ];
  const s = StorySchema.parse({
    title: "T", cast: { a: { color: "#ffffff" } },
    shots: [
      { say: "It didn't do anything.", actors: [{ id: "a" }] },
      { say: "It just shouted.", actors: [{ id: "a" }] },
    ],
  });
  const tl = buildTimeline(s, words, null, null);
  assert.equal(tl.shots[1].words[0].text, "It");
  assert.equal(tl.shots[1].words[2].text, "shouted.");
});

test("beat strings resolve to their spoken word", () => {
  const s = StorySchema.parse({
    title: "T", cast: { a: { color: "#ffffff" } },
    shots: [{ say: "In a dead zone, it screams.", beats: [{ at: "screams", expression: "furious" }], actors: [{ id: "a" }] }],
  });
  const tl = buildTimeline(s, [
    { text: "In", start: 0.1, end: 0.3 }, { text: "a", start: 0.35, end: 0.45 },
    { text: "dead", start: 0.5, end: 0.8 }, { text: "zone,", start: 0.85, end: 1.2 },
    { text: "it", start: 1.25, end: 1.4 }, { text: "screams.", start: 1.45, end: 2.1 },
  ], null, null);
  const beat = tl.shots[0].beatsResolved[0];
  assert.ok(beat.frame > 0, "beat 'screams' must map to its spoken moment, not shot start");
  assert.equal(beat.expression, "furious");
});

test("estimated timings (no TTS) still cover the whole script", () => {
  const tl = buildTimeline(story, null, null, null);
  const flat = tl.shots.flatMap((s) => s.words.map((w) => w.text)).join(" ");
  assert.ok(flat.includes("signal,"), "estimated words must be the script's own tokens");
  assert.ok(flat.includes("worry"));
});

// ------------------------------------------------------------------ captions
test("caption chunks break on sentence punctuation", () => {
  const words = [
    { text: "One", start: 0, end: 0.3 }, { text: "bar.", start: 0.3, end: 0.7 },
    { text: "Four", start: 1.0, end: 1.3 }, { text: "minutes.", start: 1.3, end: 1.9 },
  ];
  const chunks = chunkWords(words);
  assert.equal(chunks.length, 2, "sentence end must flush the chunk");
  assert.equal(chunks[0].text, "One bar.");
  assert.equal(chunks[1].text, "Four minutes.");
});

test("caption chunks stay short (1-3 words) for long runs", () => {
  const words = Array.from({ length: 8 }, (_, i) => ({ text: "incredible", start: i * 0.3, end: i * 0.3 + 0.25 }));
  const chunks = chunkWords(words);
  assert.ok(chunks.length >= 2, "long punctuation-free runs still chunk by size");
  assert.equal(chunks.map((c) => c.text).join(" "), "incredible ".repeat(8).trim());
});

test("silent shot marker parses and contributes no words", () => {
  const s = StorySchema.parse({
    title: "T", cast: { a: { color: "#ffffff" } },
    shots: [
      { say: "He waited. Nothing came.", actors: [{ id: "a" }] },
      { say: "…", actors: [{ id: "a" }] },
      { say: "Then the line died.", actors: [{ id: "a" }] },
    ],
  });
  const tl = buildTimeline(s, [
    { text: "He", start: 0.1, end: 0.3 }, { text: "waited.", start: 0.35, end: 0.9 },
    { text: "Nothing", start: 1.0, end: 1.4 }, { text: "came.", start: 1.45, end: 1.9 },
    { text: "Then", start: 2.5, end: 2.8 }, { text: "the", start: 2.85, end: 3.0 },
    { text: "line", start: 3.05, end: 3.3 }, { text: "died.", start: 3.35, end: 3.8 },
  ], null, null);
  assert.equal(tl.shots[1].words.length, 0, "silent shot owns no words");
  assert.equal(tl.durationInFrames, Math.ceil((3.8 + 0.6) * 30));
});

// ------------------------------------------------------------------ geometry / contact
const ENV = { horizon: 1180 };

const chairStory = StorySchema.parse({
  title: "chair", cast: { w: { color: "#ffffff" } },
  shots: [{
    say: "He sits at the desk.", bg: "office",
    actors: [{ id: "w", action: "sitOn", on: "chair" }],
    props: [{ type: "chair", x: 0.5, z: 0.4 }],
  }],
});
const chairShot = chairStory.shots[0];

// THE regression: a character described as sitting must be numerically on the seat.
test("sitOn puts the hip joint on the chair seat", () => {
  const place = resolvePlacement(chairShot.actors[0], chairShot.props, ENV)!;
  assert.ok(place && !place.error, place?.error);
  const seat = anchorWorld(chairShot.props[0], ENV, "seat")!;
  assert.ok(place.contact, "a contact must be reported for a seated actor");
  assert.ok(Math.abs(place.contact!.hip.y - seat.cy) < 1, `hip y ${place.contact!.hip.y} vs seat ${seat.cy}`);
  assert.ok(Math.abs(place.contact!.hip.x - seat.cx) < 1, "hip must be centred on the seat");
  assert.ok(place.z > (chairShot.props[0].z ?? 0), "the body must draw in front of the chair");
  assert.equal(place.pose, "sit");
});

test("sitting feet stay within a foot of the floor (no dangle, no sink)", () => {
  const place = resolvePlacement(chairShot.actors[0], chairShot.props, ENV)!;
  const floor = stageOf(ENV).y(chairShot.props[0].z ?? 0.45);
  assert.ok(place.y <= floor + 8, "root must not be below the floor");
  assert.ok(floor - place.y < 40, `feet ${(floor - place.y).toFixed(1)}px above the floor`);
});

const bedStory = StorySchema.parse({
  title: "bed", cast: { m: { color: "#ffffff" } },
  shots: [{
    say: "He sleeps.", bg: "bedroom", time: "night",
    actors: [{ id: "m", action: "sleepOn", on: "bed", underBlanket: true }],
    props: [{ type: "bed", x: 0.5, z: 0.35 }],
  }],
});
const bedShot = bedStory.shots[0];

// THE other regression: "sleeping in a bed" must put the body on the mattress, head on the pillow.
test("sleepOn rests the body on the mattress with the head on the pillow", () => {
  const place = resolvePlacement(bedShot.actors[0], bedShot.props, ENV)!;
  assert.ok(place && !place.error, place?.error);
  const mat = anchorWorld(bedShot.props[0], ENV, "mattress")!;
  const pillow = anchorWorld(bedShot.props[0], ENV, "pillow")!;
  assert.ok(Math.abs(place.contact!.bodyBottom - mat.cy) < 1, `body bottom ${place.contact!.bodyBottom} vs mattress ${mat.cy}`);
  assert.ok(Math.abs(place.contact!.head.x - pillow.cx) < 1, `head x ${place.contact!.head.x} vs pillow ${pillow.cx}`);
  assert.ok(place.contact!.head.x > mat.left && place.contact!.head.x < mat.right, "head must be over the mattress");
  assert.equal(place.pose, "lie");
});

test("a lying body is horizontal: head and feet share a height", () => {
  const m = poseMetrics("normal", "lie");
  assert.ok(m.rotated, "lie must be the rotated pose");
  assert.ok(Math.abs(m.bodyBottom - (m.headY + m.headR)) < 1, "the lowest point is the head's underside");
  assert.ok(m.bodyBottom - m.bodyTop > 100, "a lying body must be a wide, flat shape");
});

// The gate must reject what the old engine happily passed: "sit" with a chair on screen.
test("the geometry gate flags a seated pose that never touched the chair", () => {
  const bad = StorySchema.parse({
    title: "bad", cast: { w: { color: "#ffffff" } },
    shots: [{
      say: "He sits at the desk.", bg: "office",
      actors: [{ id: "w", pose: "sit" }],
      props: [{ type: "chair", x: 0.5, z: 0.4 }],
    }],
  });
  const findings = checkShot(buildTimeline(bad, null, null, null).shots[0], bad.cast, 0);
  assert.ok(
    findings.some((f) => f.kind === "MISSING-ACTION" && f.sev === "ERROR"),
    `expected a MISSING-ACTION error, got ${JSON.stringify(findings)}`,
  );
});

test("the geometry gate passes the anchored chair story", () => {
  const findings = checkShot(buildTimeline(chairStory, null, null, null).shots[0], chairStory.cast, 0);
  assert.equal(findings.filter((f) => f.sev === "ERROR").length, 0, JSON.stringify(findings));
});

test("an action without a prop anchor is an error, not a silent guess", () => {
  const s = StorySchema.parse({
    title: "t", cast: { w: { color: "#ffffff" } },
    shots: [{ say: "He sits on the lamp.", bg: "office", actors: [{ id: "w", action: "sitOn", on: "lamp" }], props: [{ type: "lamp", x: 0.5, z: 0.4 }] }],
  });
  const place = resolvePlacement(s.shots[0].actors[0], s.shots[0].props, ENV)!;
  assert.ok(place.error, "a lamp has no seat anchor, so the resolver must refuse");
});

test("inside=true puts a driver behind the car body", () => {
  const s = StorySchema.parse({
    title: "t", cast: { d: { color: "#ffffff" } },
    shots: [{ say: "He drives.", bg: "city", actors: [{ id: "d", action: "sitOn", on: "car", inside: true }], props: [{ type: "car", x: 0.5, z: 0.5 }] }],
  });
  const place = resolvePlacement(s.shots[0].actors[0], s.shots[0].props, ENV)!;
  assert.ok(place.z < (s.shots[0].props[0].z ?? 0.5), "an inside actor must draw behind the vehicle");
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}`);
