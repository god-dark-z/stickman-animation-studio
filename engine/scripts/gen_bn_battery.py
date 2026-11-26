"""Generate engine/lang/bn/commonsense-battery.json — 40+ Bangla micro-stories.

Each entry follows the English battery's shape: one Bangla sentence a person could write, an
English gloss (the meaning layer), a plain-English statement of what a human expects to see, a
compact storyboard plan, and the machine-checkable part of that expectation. The runner
(scripts/battery.ts --lang bn) resolves the plan with the same code the renderer uses and asserts
the scene spec, the geometry gate and the Bangla glossary.

Coverage: at least 3 entries in each of the 14 categories the English battery uses.

Run: python -I scripts/gen_bn_battery.py [--check]
"""
from __future__ import annotations

import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "lang", "bn", "commonsense-battery.json")


def E(id_, category, sentence, gloss, expect, plan, check):
    return {"id": id_, "category": category, "sentence": sentence, "gloss": gloss, "expect": expect, "plan": plan, "check": check}


def shot(bg, framing="medium", camera="pushIn", actors=None, props=None, **kw):
    d = {"bg": bg, "framing": framing, "camera": camera, "actors": actors or [], "props": props or []}
    d.update(kw)
    return d


ACTOR = {"id": "a", "x": 0.5, "z": 0.55, "facing": "front"}

ENTRIES = [
    # ================================================================ posture (4)
    E("bn-posture-01-chair", "posture",
      "ক্লান্ত এক কর্মী চেয়ারে বসে টাইপ করছে।",
      "A tired office worker sits on the chair and types.",
      "He is on the chair — hips on the seat, hands at the desk, tired face.",
      shot("office", "full", actors=[{"id": "a", "action": "sitOn", "on": "chair", "pose": "sit", "facing": "right", "expression": "sleepy"}],
           props=[{"type": "chair", "x": 0.5, "z": 0.55}, {"type": "desk", "x": 0.62, "z": 0.5}]),
      {"props": ["chair", "desk"], "actionAnyOf": ["sitOn"]}),
    E("bn-posture-02-bed", "posture",
      "ছেলেটি বিছানায় শুয়ে ঘুমিয়ে আছে।",
      "The boy is lying in bed asleep.",
      "He lies on the mattress, head on the pillow, eyes closed, blanket over him.",
      shot("bedroom", "full", actors=[{"id": "a", "action": "sleepOn", "on": "bed", "underBlanket": True, "pose": "lie"}],
           props=[{"type": "bed", "x": 0.5, "z": 0.55}]),
      {"props": ["bed"], "actionAnyOf": ["sleepOn"]}),
    E("bn-posture-03-window", "posture",
      "মেয়েটি জানালার পাশে দাঁড়িয়ে বাইরে তাকিয়ে আছে।",
      "The girl stands beside the window, looking out.",
      "She stands facing a visible window; the window is in frame.",
      shot("livingroom", "medium", actors=[{"id": "d", "x": 0.42, "z": 0.55, "facing": "right"}],
           props=[{"type": "window", "x": 0.7, "z": 0.35}]),
      {"props": ["window"], "poseAnyOf": ["stand"]}),
    E("bn-posture-04-floor", "posture",
      "বৃদ্ধা মেঝেতে বসে চা খাচ্ছেন।",
      "The old woman sits on the floor drinking tea.",
      "She is seated on the floor, cup in hand, no chair involved.",
      shot("field", "medium", time="day", actors=[{"id": "d", "action": "hold", "holding": "cup", "pose": "sit", "expression": "happy"}],
           props=[{"type": "cup", "x": 0.5, "z": 0.55}]),
      # no seat prop in frame: the point is that she is on the floor
      {"poseAnyOf": ["sit"], "holding": "cup"}),

    # ================================================================ location (4)
    E("bn-location-01-other-room", "location",
      "ছেলেটি অন্য ঘরে ঘুমিয়ে আছে।",
      "The boy is asleep in the other room.",
      "A different room, with a bed, and a body asleep on it — plus a cut that shows the change.",
      shot("bedroom", "full", transition="dissolve",
           actors=[{"id": "a", "action": "sleepOn", "on": "bed", "underBlanket": True, "pose": "lie"}],
           props=[{"type": "bed", "x": 0.5, "z": 0.55}]),
      {"props": ["bed"], "actionAnyOf": ["sleepOn"], "transitionAnyOf": ["dissolve", "fade"]}),
    E("bn-location-02-outside", "location",
      "বৃষ্টি পড়ছে, আর ছেলেটি রাস্তায় দাঁড়িয়ে আছে।",
      "It is raining, and the boy is standing on the street.",
      "Outdoors: street ground, rain falling, the boy exposed to it.",
      shot("street", "full", fx=["rain"], actors=[{"id": "a", "pose": "stand", "expression": "sad"}],
           props=[]),
      {"bgAnyOf": ["street"], "fxAnyOf": ["rain"], "poseAnyOf": ["stand"]}),
    E("bn-location-03-kitchen", "location",
      "মা রান্নাঘরে ভাত রান্না করছেন।",
      "The mother is cooking rice in the kitchen.",
      "A kitchen with a stove and a pot, the cook at the counter.",
      shot("kitchen", "medium", actors=[{"id": "d", "action": "standAt", "on": "counter", "facing": "right"}],
           props=[{"type": "counter", "x": 0.55, "z": 0.5}, {"type": "pot", "x": 0.55, "y": 230, "z": 0.5}, {"type": "plate", "x": 0.42, "y": 230, "z": 0.5}]),
      {"propsAny": ["counter", "pot", "stove"]}),
    E("bn-location-04-village", "location",
      "গ্রামের মাটির বাড়ির সামনে বাচ্চারা খেলছে।",
      "Children are playing in front of a mud house in the village.",
      "A village scene with a modest house, ground, children.",
      shot("village_dawn", "wide", actors=[{"id": "b", "x": 0.36, "z": 0.5, "expression": "happy"},
                                        {"id": "c", "x": 0.62, "z": 0.5, "expression": "happy"}]),
      {"bgAnyOf": ["village_dawn", "field", "field"], "minActors": 2}),

    # ================================================================ containment (3)
    E("bn-containment-01-inside", "containment",
      "মেয়েটি ঘরের ভেতরে বসে বই পড়ছে।",
      "The girl sits inside the room reading a book.",
      "Indoors: walls, furniture, the reader with an open book.",
      shot("livingroom", "medium", actors=[{"id": "d", "action": "sitOn", "on": "chair", "holding": "book", "facing": "front"}],
           props=[{"type": "chair", "x": 0.5, "z": 0.55}, {"type": "book", "x": 0.5, "z": 0.6}]),
      {"bgAnyOf": ["livingroom", "bedroom", "office"], "holding": "book"}),
    E("bn-containment-02-blanket", "containment",
      "শিশুটি কম্বলের নিচে ঘুমাচ্ছে।",
      "The child is sleeping under the blanket.",
      "A bed with a blanket over the body; only the head shows.",
      shot("bedroom", "full", actors=[{"id": "b", "action": "sleepOn", "on": "bed", "underBlanket": True, "pose": "lie"}],
           props=[{"type": "bed", "x": 0.5, "z": 0.55}]),
      {"props": ["bed"], "actionAnyOf": ["sleepOn"]}),
    E("bn-containment-03-car", "containment",
      "ড্রাইভার গাড়ির ভেতরে বসে গাড়ি চালাচ্ছে।",
      "The driver sits inside the car driving it.",
      "The body sits on the car seat, inside the vehicle, hands at the wheel.",
      shot("street", "medium", actors=[{"id": "e", "action": "sitOn", "on": "car", "inside": True, "facing": "right"}],
           props=[{"type": "car", "x": 0.55, "z": 0.6}]),
      {"props": ["car"], "actionAnyOf": ["sitOn"]}),

    # ================================================================ held (3)
    E("bn-held-01-cup", "held",
      "ছেলেটি হাতে চায়ের কাপ ধরে আছে।",
      "The boy is holding a cup of tea in his hand.",
      "The cup sits in his hand at chest height, not floating beside it.",
      shot("livingroom", "medium", actors=[{"id": "a", "action": "hold", "holding": "cup", "facing": "front"}],
           props=[{"type": "cup", "x": 0.5, "z": 0.55}]),
      {"holding": "cup", "props": ["cup"]}),
    E("bn-held-02-phone", "held",
      "মেয়েটি হাতে ফোন নিয়ে স্ক্রিনের দিকে তাকিয়ে আছে।",
      "The girl holds a phone in her hand and looks at the screen.",
      "The phone is in her hand, screen visible, eyes on it.",
      shot("livingroom", "medium", actors=[{"id": "d", "action": "hold", "holding": "phone", "facing": "front"}],
           props=[{"type": "phone", "x": 0.5, "z": 0.55}]),
      {"holding": "phone", "props": ["phone"]}),
    E("bn-held-03-letter", "held",
      "বৃদ্ধ লোকটি হাতে একটি চিঠি ধরে পড়ছে।",
      "The old man is holding a letter and reading it.",
      "The letter is in his hands, his eyes on the paper.",
      shot("livingroom", "medium", actors=[{"id": "e", "action": "hold", "holding": "letter", "facing": "front", "expression": "sad"}],
           props=[{"type": "letter", "x": 0.5, "z": 0.55}]),
      {"holding": "letter", "props": ["letter"]}),

    # ================================================================ in-use (3)
    E("bn-inuse-01-typing", "in-use",
      "কর্মীটি কম্পিউটারে টাইপ করছে।",
      "The worker is typing on the computer.",
      "Seated at the desk, hands on the keyboard, screen on.",
      shot("office", "medium", actors=[{"id": "a", "action": "sitOn", "on": "chair", "pose": "type", "facing": "right"}],
           props=[{"type": "chair", "x": 0.45, "z": 0.55}, {"type": "desk", "x": 0.62, "z": 0.5}, {"type": "computer", "x": 0.66, "y": 230, "z": 0.5}]),
      {"propsAny": ["computer", "desk"], "actionAnyOf": ["sitOn"]}),
    E("bn-inuse-02-phone-call", "in-use",
      "মহিলাটি ফোনে কথা বলছে।",
      "The woman is talking on the phone.",
      "Phone at her ear, mouth open, eyes away.",
      shot("livingroom", "medium", actors=[{"id": "d", "action": "hold", "holding": "phone", "pose": "phone", "facing": "front", "expression": "worried"}],
           props=[{"type": "phone", "x": 0.5, "z": 0.55}]),
      {"holding": "phone", "props": ["phone"]}),
    E("bn-inuse-03-eating", "in-use",
      "পরিবার একসাথে বসে ভাত খাচ্ছে।",
      "The family sits together eating rice.",
      "Several people at a table, plates and rice in front of them.",
      shot("livingroom", "wide", actors=[{"id": "a", "action": "sitOn", "on": "chair", "x": 0.38, "z": 0.55},
                                     {"id": "d", "action": "sitOn", "on": "chair", "x": 0.62, "z": 0.55}],
           props=[{"type": "chair", "x": 0.38, "z": 0.55}, {"type": "chair", "x": 0.62, "z": 0.55},
                  {"type": "table", "x": 0.5, "z": 0.6}, {"type": "plate", "x": 0.5, "y": 230, "z": 0.6}]),
      {"propsAny": ["plate", "table"], "minActors": 2}),

    # ================================================================ state (4)
    E("bn-state-01-asleep", "state",
      "শিশুটি বিছানায় ঘুমিয়ে আছে।",
      "The child is asleep in the bed.",
      "Body on the mattress, eyes closed, in bed.",
      shot("bedroom", "medium", actors=[{"id": "b", "action": "sleepOn", "on": "bed", "underBlanket": True, "pose": "lie"}],
           props=[{"type": "bed", "x": 0.5, "z": 0.55}]),
      {"props": ["bed"], "actionAnyOf": ["sleepOn"]}),
    E("bn-state-02-scared", "state",
      "ছেলেটি ভয় পেয়ে পিছিয়ে গেল।",
      "The boy stepped back, scared.",
      "Wide eyes, body leaning away, a scared face.",
      shot("livingroom", "medium", actors=[{"id": "a", "pose": "stand", "expression": "scared", "facing": "left"}]),
      {"expressionAnyOf": ["scared", "shocked", "surprised"]}),
    E("bn-state-03-angry", "state",
      "বাবা খুব রেগে গেলেন।",
      "The father got very angry.",
      "Furious face: pulled brows, clenched jaw, tense body.",
      shot("livingroom", "medium", actors=[{"id": "f", "pose": "stand", "expression": "furious", "facing": "front"}]),
      {"expressionAnyOf": ["angry", "furious"]}),
    E("bn-state-04-tired", "state",
      "শ্রমিকটি খুব ক্লান্ত হয়ে বসে পড়ল।",
      "The worker sat down, exhausted.",
      "Slumped body, heavy eyes, sitting because standing is too much.",
      shot("livingroom", "medium", actors=[{"id": "e", "action": "sitOn", "on": "chair", "expression": "sleepy", "facing": "front"}],
           props=[{"type": "chair", "x": 0.5, "z": 0.55}]),
      {"expressionAnyOf": ["sleepy", "sad", "bored"]}),

    # ================================================================ time-weather (4)
    E("bn-weather-01-rain", "time-weather",
      "বাইরে বৃষ্টি পড়ছে।",
      "It is raining outside.",
      "Outdoor scene with rain falling and wet ground or shelter.",
      shot("street", "wide", fx=["rain"], actors=[], props=[]),
      {"fxAnyOf": ["rain"]}),
    E("bn-weather-02-night", "time-weather",
      "রাতে ছেলেটি জেগে বসে আছে।",
      "At night the boy is sitting awake.",
      "Night grade, dark sky, a lamp for light, the boy sitting up.",
      shot("livingroom", "medium", time="night", actors=[{"id": "a", "action": "sitOn", "on": "chair", "expression": "worried", "facing": "front"}],
           props=[{"type": "chair", "x": 0.5, "z": 0.55}]),
      {"timeAnyOf": ["night"], "actionAnyOf": ["sitOn"]}),
    E("bn-weather-03-sunset", "time-weather",
      "সূর্য ডুবে গেল, আকাশ লাল হয়ে গেল।",
      "The sun went down and the sky turned red.",
      "Sunset: orange-red sky, long shadows.",
      shot("street", "wide", time="sunset", actors=[], props=[]),
      {"timeAnyOf": ["sunset", "dawn"]}),
    E("bn-weather-04-storm", "time-weather",
      "ঝড় উঠল, গাছগুলো দুলতে লাগল।",
      "A storm rose and the trees began to sway.",
      "Wind, bending trees, movement in the frame.",
      shot("field", "wide", fx=["debris", "shake"], actors=[]),
      {"fxAnyOf": ["rain", "lightning", "debris", "shake"]}),

    # ================================================================ motion (3)
    E("bn-motion-01-walk", "motion",
      "ছেলেটি রাস্তা দিয়ে হেঁটে যাচ্ছে।",
      "The boy is walking down the street.",
      "Walking pose, direction clear, street underfoot.",
      shot("street", "full", actors=[{"id": "a", "pose": "walk", "facing": "right", "moveTo": 0.8}]),
      {"poseAnyOf": ["walk", "run"]}),
    E("bn-motion-02-run", "motion",
      "মেয়েটি প্রাণপণে দৌড়ে পালাচ্ছে।",
      "The girl is running away as fast as she can.",
      "Running pose, speed lines, body leaning forward.",
      shot("street", "full", fx=["speedlines"], actors=[{"id": "d", "pose": "run", "facing": "right", "expression": "scared"}]),
      {"poseAnyOf": ["run"], "fxAnyOf": ["speedlines"]}),
    E("bn-motion-03-fall", "motion",
      "লোকটি হোঁচট খেয়ে মাটিতে পড়ে গেল।",
      "The man tripped and fell to the ground.",
      "Body on the ground, impact dust or lines, sprawled limbs.",
      shot("street", "full", fx=["dust", "shake"], actors=[{"id": "e", "pose": "fall", "expression": "shocked", "facing": "left"}]),
      {"poseAnyOf": ["fall", "lie"], "fxAnyOf": ["dust", "debris", "smoke"]}),

    # ================================================================ count-scale (3)
    E("bn-count-01-two", "count-scale",
      "দুই বন্ধু মাঠে বসে কথা বলছে।",
      "Two friends sit in the field talking.",
      "Two separate bodies, facing each other, both visible.",
      shot("field", "wide", actors=[{"id": "a", "x": 0.38, "action": "sitOn", "on": "bench", "facing": "right"},
                                      {"id": "b", "x": 0.62, "action": "sitOn", "on": "bench", "facing": "left"}],
           props=[{"type": "bench", "x": 0.5, "z": 0.55}]),
      {"minActors": 2, "facingEachOther": True}),
    E("bn-count-02-crowd", "count-scale",
      "বাজারে 많은 মানুষের ভিড়।",
      "There is a crowd of many people in the market.",
      "Four or more bodies, packed, market behind.",
      shot("street", "wide", actors=[{"id": "a", "x": 0.2}, {"id": "b", "x": 0.4}, {"id": "c", "x": 0.6}, {"id": "d", "x": 0.8}]),
      {"minActors": 4}),
    E("bn-count-03-three-cups", "count-scale",
      "টেবিলে তিনটি কাপ রাখা আছে।",
      "Three cups are placed on the table.",
      "Three separate cups on a table.",
      shot("livingroom", "medium", props=[{"type": "table", "x": 0.5, "z": 0.55}, {"type": "cup", "x": 0.5, "y": 230, "z": 0.55, "count": 3}]),
      {"propCount": {"type": "cup", "min": 3}}),

    # ================================================================ people (3)
    E("bn-people-01-alien-giant", "people",
      "দৈত্যটি শহরের মাঝখানে দাঁড়িয়ে আছে।",
      "The giant stands in the middle of the city.",
      "One enormously scaled body among normal buildings.",
      shot("street", "wide", actors=[{"id": "a", "x": 0.5, "z": 0.45, "scale": 2.2, "facing": "front"}]),
      {"minScale": 1.6}),
    E("bn-people-02-alone", "people",
      "ঘরে কেউ নেই, চেয়ারটা খালি।",
      "No one is in the room; the chair is empty.",
      "An empty room with an empty chair, no bodies at all.",
      shot("livingroom", "wide", actors=[], props=[{"type": "chair", "x": 0.5, "z": 0.55}]),
      {"maxActors": 1, "props": ["chair"]}),
    E("bn-people-03-dialogue", "people",
      "দুজন মানুষ মুখোমুখি হয়ে কথা বলছে।",
      "Two people face each other and talk.",
      "Two bodies facing each other, only the speaker's mouth moving.",
      shot("livingroom", "medium", actors=[{"id": "a", "x": 0.36, "facing": "right", "talking": True},
                                       {"id": "b", "x": 0.64, "facing": "left"}], quote="a"),
      {"minActors": 2, "facingEachOther": True}),

    # ================================================================ emotion (3)
    E("bn-emotion-01-cry", "emotion",
      "মেয়েটি কাঁদছে।",
      "The girl is crying.",
      "Tears, lowered face, an unmistakably sad expression.",
      shot("livingroom", "medium", actors=[{"id": "d", "pose": "stand", "expression": "sad", "facing": "front"}]),
      {"expressionAnyOf": ["sad", "worried"]}),
    E("bn-emotion-02-laugh", "emotion",
      "ছেলেটি হো হো করে হেসে উঠল।",
      "The boy burst out laughing.",
      "Open mouth, shaking shoulders, a laugh expression.",
      shot("livingroom", "medium", actors=[{"id": "a", "pose": "stand", "expression": "laugh", "facing": "front"}]),
      {"expressionAnyOf": ["laugh", "grin", "happy"]}),
    E("bn-emotion-03-shocked", "emotion",
      "মহিলাটি অবাক হয়ে চেয়ে রইল।",
      "The woman stared, astonished.",
      "Wide eyes, open mouth, a startled pose.",
      shot("livingroom", "medium", actors=[{"id": "d", "pose": "stand", "expression": "shocked", "facing": "front"}]),
      {"expressionAnyOf": ["shocked", "surprised"]}),

    # ================================================================ negation (3)
    E("bn-negation-01-empty-chair", "negation",
      "চেয়ারটা খালি ছিল, কেউ বসে ছিল না।",
      "The chair was empty; no one was sitting there.",
      "The chair is visible, and nobody is on it.",
      shot("livingroom", "medium", actors=[], props=[{"type": "chair", "x": 0.5, "z": 0.55}]),
      {"props": ["chair"], "maxActors": 1}),
    E("bn-negation-02-no-one-home", "negation",
      "বাড়িতে কেউ ছিল না।",
      "No one was home.",
      "An empty house: furniture present, no bodies.",
      shot("livingroom", "wide", actors=[], props=[{"type": "chair", "x": 0.35, "z": 0.55}, {"type": "table", "x": 0.6, "z": 0.55}]),
      {"maxActors": 1}),
    E("bn-negation-03-not-raining", "negation",
      "বৃষ্টি হচ্ছিল না, রোদ উঠেছিল।",
      "It was not raining; the sun had come out.",
      "Dry, bright scene, no rain effects.",
      shot("street", "wide", time="day", actors=[]),
      {"forbidFx": ["rain"]}),

    # ================================================================ cause (3)
    E("bn-cause-01-because", "cause",
      "ফোন বেশি খোঁজে, তাই ব্যাটারি দ্রুত শেষ হয়।",
      "The phone searches harder, so the battery drains fast.",
      "An insert that shows the cost — a counter or chart, not just words.",
      shot("livingroom", "medium", insert={"type": "counter", "title": "ব্যাটারি", "value": 15, "suffix": "%"},
           actors=[{"id": "a", "pose": "stand", "expression": "worried"}]),
      {"insertAnyOf": ["counter", "chart", "list"]}),
    E("bn-cause-02-clicks", "cause",
      "ছেলেটি ফোনের স্ক্রিনে ক্লিক করল।",
      "The boy tapped the screen of his device.",
      "A finger on the screen, the device in hand, the contact visible.",
      shot("livingroom", "medium", actors=[{"id": "a", "action": "hold", "holding": "phone", "pose": "reach", "facing": "front"}],
           props=[{"type": "phone", "x": 0.5, "z": 0.55}]),
      {"holding": "phone", "props": ["phone"]}),
    E("bn-cause-03-learns", "cause",
      "মেয়েটি বুঝে গেল আসল কারণটা কী।",
      "The girl realised what the real reason was.",
      "A face that shows understanding arriving: light in the eyes, sudden stillness.",
      shot("livingroom", "close", actors=[{"id": "d", "expression": "surprised", "facing": "front"}]),
      {"expressionAnyOf": ["surprised", "happy", "smug", "grin"]}),

    # ================================================================ abstract (3)
    E("bn-abstract-01-chart", "abstract",
      "গ্রাফে দেখা যাচ্ছে দাম বাড়ছে।",
      "The graph shows the price rising.",
      "An insert chart with rising bars, not a talking head.",
      shot("livingroom", "medium", insert={"type": "chart", "title": "দাম", "data": [3, 5, 7, 9], "lines": ["২০২০", "২০২১", "২০২২", "২০২৩"]},
           actors=[], props=[{"type": "money", "x": 0.8, "z": 0.4}]),
      {"insertAnyOf": ["chart"]}),
    E("bn-abstract-02-money", "abstract",
      "পাঁচশো টাকার একটা নোট ভাঁজ করে রেখেছে।",
      "A five-hundred-taka note was folded and put away.",
      "A note or coin visible, or a counter insert showing the amount.",
      shot("livingroom", "medium", insert={"type": "counter", "title": "দাম", "value": 500, "suffix": " টাকা"},
           actors=[{"id": "a", "action": "hold", "holding": "money", "facing": "front"}],
           props=[{"type": "money", "x": 0.5, "z": 0.55}]),
      {"propsAny": ["money", "banknote", "coin", "wallet", "price"], "insertAnyOf": ["counter", "chart", "bigtext"]}),
    E("bn-abstract-03-signal", "abstract",
      "ফোনের সিগন্যাল দুর্বল হয়ে গেল।",
      "The phone signal became weak.",
      "A signal indicator or waves drawn — an insert or a phone with bars.",
      shot("livingroom", "medium", insert={"type": "chart", "title": "সিগন্যাল", "data": [9, 6, 3, 1], "lines": ["", "", "", ""]},
           actors=[{"id": "a", "action": "hold", "holding": "phone", "expression": "worried"}],
           props=[{"type": "phone", "x": 0.5, "z": 0.55}]),
      {"insertAnyOf": ["chart", "bigtext", "list"], "propsAny": ["phone"]}),

    # ================================================================ cross-category extras (3)
    E("bn-extra-01-rain-window", "time-weather",
      "জানালার বাইরে বৃষ্টি পড়ছে, ভেতরে মেয়েটি দাঁড়িয়ে দেখছে।",
      "It is raining outside the window; inside the girl stands watching.",
      "A window in frame with rain beyond it; the girl inside facing it.",
      shot("livingroom", "medium", fx=["rain"], actors=[{"id": "d", "x": 0.4, "z": 0.55, "facing": "right"}],
           props=[{"type": "window", "x": 0.72, "z": 0.35}]),
      {"fxAnyOf": ["rain"], "props": ["window"], "poseAnyOf": ["stand"]}),
    E("bn-extra-02-years-later", "time-weather",
      "বছর পরে ছেলেটি আবার সেই চায়ের দোকানে ফিরে এল।",
      "Years later the boy returned to that tea stall.",
      "A clear time jump: a transition, and the same place aged.",
      shot("street", "wide", transition="dissolve",
           actors=[{"id": "a", "pose": "stand", "expression": "sad", "facing": "front"}]),
      {"transitionAnyOf": ["dissolve", "fade", "flash", "whip"]}),
    E("bn-extra-03-tired-window", "state",
      "ক্লান্ত ছেলেটি জানালার পাশে দাঁড়িয়ে বৃষ্টি দেখছে।",
      "The tired boy stands by the window watching the rain.",
      "A window in frame, rain beyond it, a tired face turned toward it.",
      shot("livingroom", "medium", fx=["rain"], actors=[{"id": "a", "x": 0.4, "z": 0.55, "facing": "right", "expression": "sleepy"}],
           props=[{"type": "window", "x": 0.72, "z": 0.35}]),
      {"props": ["window"], "fxAnyOf": ["rain"], "expressionAnyOf": ["sleepy", "sad", "bored"]}),
]

CATS = sorted({e["category"] for e in ENTRIES})


def build() -> dict:
    return {
        "version": 1,
        "language": "bn",
        "note": (
            "Bangla commonsense battery: one sentence a person could write, its English gloss, "
            "what a human expects to see, a storyboard plan, and the machine-checkable expectation. "
            "Run with `npx tsx scripts/battery.ts --lang bn`."
        ),
        "entries": ENTRIES,
    }


def main(argv: list[str]) -> int:
    if "--check" in argv:
        d = json.load(open(OUT, encoding="utf8"))
        n = len(d["entries"])
        cats = sorted({e["category"] for e in d["entries"]})
        per = {c: sum(1 for e in d["entries"] if e["category"] == c) for c in cats}
        print(f"{OUT}: {n} entries, {len(cats)} categories")
        print("per category:", per)
        return 0 if n >= 40 and len(cats) >= 14 and min(per.values()) >= 3 else 1
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(build(), open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    per = {c: sum(1 for e in ENTRIES if e["category"] == c) for c in CATS}
    print(f"wrote {OUT}: {len(ENTRIES)} entries, {len(CATS)} categories")
    print("per category:", per)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
