"""One-off generator for engine/lang/bn/pronunciation.json (200+ Bangla-respelling entries).

Run: python scripts/gen_bn_pronunciation.py [--check]

`--check` only reports whether the file exists and how many entries it has (used by doctor).
Keeping the generator in the repo documents where the list came from and makes it easy to extend.
"""
from __future__ import annotations

import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "lang", "bn", "pronunciation.json")

ENTRIES = {
    # ---------------------------------------------------------------- tech / devices
    "phone": "ফোন", "Phone": "ফোন", "mobile": "মোবাইল", "Internet": "ইন্টারনেট", "internet": "ইন্টারনেট",
    "WiFi": "ওয়াইফাই", "Wi-Fi": "ওয়াইফাই", "Bluetooth": "ব্লুটুথ", "signal": "সিগন্যাল", "Signal": "সিগন্যাল",
    "network": "নেটওয়ার্ক", "battery": "ব্যাটারি", "Battery": "ব্যাটারি", "charger": "চার্জার", "charge": "চার্জ",
    "app": "অ্যাপ", "App": "অ্যাপ", "apps": "অ্যাপস", "software": "সফটওয়্যার", "hardware": "হার্ডওয়্যার",
    "computer": "কম্পিউটার", "laptop": "ল্যাপটপ", "screen": "স্ক্রিন", "display": "ডিসপ্লে", "keyboard": "কীবোর্ড",
    "camera": "ক্যামেরা", "video": "ভিডিও", "audio": "অডিও", "email": "ইমেইল", "Email": "ইমেইল",
    "password": "পাসওয়ার্ড", "download": "ডাউনলোড", "upload": "আপলোড", "online": "অনলাইন", "offline": "অফলাইন",
    "website": "ওয়েবসাইট", "browser": "ব্রাউজার", "server": "সার্ভার", "cloud": "ক্লাউড", "file": "ফাইল",
    "Google": "গুগল", "YouTube": "ইউটিউব", "Facebook": "ফেসবুক", "WhatsApp": "হোয়াটসঅ্যাপ", "TikTok": "টিকটক",
    "Instagram": "ইনস্টাগ্রাম", "Twitter": "টুইটার", "Microsoft": "মাইক্রোসফট", "Windows": "উইন্ডোজ",
    "Android": "অ্যান্ড্রয়েড", "iPhone": "আইফোন", "Apple": "অ্যাপল", "Samsung": "স্যামসাং", "Nokia": "নোকিয়া",
    "Intel": "ইন্টেল", "Amazon": "অ্যামাজন", "Netflix": "নেটফ্লিক্স", "ChatGPT": "চ্যাটজিপিটি",
    "router": "রাউটার", "modem": "মডেম", "tower": "টাওয়ার", "antenna": "অ্যান্টেনা", "satellite": "স্যাটেলাইট",
    "chip": "চিপ", "processor": "প্রসেসর", "memory": "মেমোরি", "storage": "স্টোরেজ", "data": "ডেটা",
    "system": "সিস্টেম", "technology": "প্রযুক্তি", "robot": "রোবট", "sensor": "সেন্সর", "email address": "ইমেইল ঠিকানা",
    "power bank": "পাওয়ার ব্যাংক", "charging": "চার্জিং", "overheat": "ওভারহিট", "heating": "হিটিং",
    # ---------------------------------------------------------------- science
    "science": "সায়েন্স", "energy": "এনার্জি", "power": "পাওয়ার", "voltage": "ভোল্টেজ", "current": "কারেন্ট",
    "physics": "ফিজিক্স", "chemistry": "কেমিস্ট্রি", "biology": "বায়োলজি", "oxygen": "অক্সিজেন", "carbon": "কার্বন",
    "atom": "অ্যাটম", "molecule": "অণু", "electron": "ইলেকট্রন", "radiation": "রেডিয়েশন", "wave": "ওয়েভ",
    "frequency": "ফ্রিকোয়েন্সি", "magnet": "চুম্বক", "gravity": "মহাকর্ষ", "virus": "ভাইরাস", "bacteria": "ব্যাকটেরিয়া",
    "cell": "সেল", "protein": "প্রোটিন", "vitamin": "ভিটামিন", "calorie": "ক্যালরি", "mineral": "খনিজ",
    "electricity": "বিদ্যুৎ", "circuit": "সার্কিট", "battery cell": "ব্যাটারি সেল", "thermal": "থার্মাল",
    # ---------------------------------------------------------------- society / history / money
    "history": "ইতিহাস", "History": "ইতিহাস", "economy": "অর্থনীতি", "market": "বাজার", "bank": "ব্যাংক",
    "tax": "ট্যাক্স", "budget": "বাজেট", "inflation": "মূল্যস্ফীতি", "dollar": "ডলার", "rupee": "রুপি",
    "loan": "ঋণ", "business": "ব্যবসা", "company": "কোম্পানি", "government": "সরকার", "president": "প্রেসিডেন্ট",
    "minister": "মন্ত্রী", "parliament": "সংসদ", "election": "নির্বাচন", "democracy": "গণতন্ত্র", "war": "যুদ্ধ",
    "army": "সেনাবাহিনী", "soldier": "সৈনিক", "general": "জেনারেল", "empire": "সাম্রাজ্য", "king": "রাজা",
    "queen": "রানী", "prince": "রাজপুত্র", "princess": "রাজকুমারী", "revolution": "বিপ্লব", "independence": "স্বাধীনতা",
    "freedom": "স্বাধীনতা", "colony": "উপনিবেশ", "colonial": "ঔপনিবেশিক", "British": "ব্রিটিশ", "Mughal": "মোগল",
    "Mughals": "মোগল", "Sultan": "সুলতান", "Dhaka": "ঢাকা", "Bangladesh": "বাংলাদেশ", "Bengal": "বাংলা",
    "Kolkata": "কলকাতা", "India": "ভারত", "Pakistan": "পাকিস্তান", "London": "লন্ডন", "America": "আমেরিকা",
    "Europe": "ইউরোপ", "Africa": "আফ্রিকা", "China": "চীন", "Japan": "জাপান", "Russia": "রাশিয়া",
    "Ukraine": "ইউক্রেইন", "Israel": "ইসরায়েল", "Palestine": "ফিলিস্তিন", "Gaza": "গাজা", "Saudi": "সৌদি",
    "Arab": "আরব", "Persian": "পারসিক", "Turkish": "তুর্কি", "Ottoman": "অটোমান", "Roman": "রোমান",
    "Greek": "গ্রিক", "Egypt": "মিশর", "Nile": "নীলনদ", "Himalaya": "হিমালয়", "Padma": "পদ্মা",
    "Meghna": "মেঘনা", "Jamuna": "যমুনা", "Sundarbans": "সুন্দরবন", "Chittagong": "চট্টগ্রাম", "Sylhet": "সিলেট",
    "Rajshahi": "রাজশাহী", "Khulna": "খুলনা", "Barishal": "বরিশাল", "Rangpur": "রংপুর", "Mymensingh": "ময়মনসিংহ",
    "democracy movement": "গণতন্ত্র আন্দোলন", "language movement": "ভাষা আন্দোলন", "liberation war": "মুক্তিযুদ্ধ",
    "Mujib": "মুজিব", "Tagore": "ঠাকুর", "Nazrul": "নজরুল", "Fazlul": "ফজলুল", "Suhrawardy": "সোহরাওয়ার্দী",
    # ---------------------------------------------------------------- culture / daily life
    "tea": "চা", "Tea": "চা", "coffee": "কফি", "Coffee": "কফি", "rickshaw": "রিকশা", "Rickshaw": "রিকশা",
    "CNG": "সিএনজি", "bus": "বাস", "train": "ট্রেন", "plane": "বিমান", "airport": "এয়ারপোর্ট",
    "hospital": "হাসপাতাল", "doctor": "ডাক্তার", "Doctor": "ডাক্তার", "nurse": "নার্স", "medicine": "ওষুধ",
    "vaccine": "ভ্যাকসিন", "surgery": "সার্জারি", "diabetes": "ডায়াবেটিস", "cancer": "ক্যান্সার", "heart attack": "হার্ট অ্যাটাক",
    "blood pressure": "ব্লাড প্রেসার", "stress": "স্ট্রেস", "fever": "জ্বর", "cold": "সর্দি", "cough": "কাশি",
    "school": "স্কুল", "college": "কলেজ", "university": "বিশ্ববিদ্যালয়", "exam": "পরীক্ষা", "student": "ছাত্র",
    "teacher": "শিক্ষক", "class": "ক্লাস", "result": "রেজাল্ট", "degree": "ডিগ্রি",
    "cinema": "সিনেমা", "movie": "সিনেমা", "song": "গান", "music": "মিউজিক", "guitar": "গিটার",
    "football": "ফুটবল", "cricket": "ক্রিকেট", "Olympics": "অলিম্পিক", "stadium": "স্টেডিয়াম", "match": "ম্যাচ",
    "champion": "চ্যাম্পিয়ন", "trophy": "ট্রফি", "coach": "কোচ", "team": "টিম", "player": "খেলোয়াড়",
    "monsoon": "বর্ষা", "rain": "বৃষ্টি", "flood": "বন্যা", "storm": "ঝড়", "cyclone": "সাইক্লোন",
    "earthquake": "ভূমিকম্প", "drought": "খরা", "climate": "জলবায়ু", "temperature": "তাপমাত্রা", "celsius": "সেলসিয়াস",
    "pollution": "দূষণ", "plastic": "প্লাস্টিক", "recycle": "রিসাইকেল", "environment": "পরিবেশ", "forest": "জঙ্গল",
    "village": "গ্রাম", "city": "শহর", "town": "শহর", "bazar": "বাজার", "marketplace": "বাজার",
    "family": "পরিবার", "mother": "মা", "father": "বাবা", "brother": "ভাই", "sister": "বোন",
    "son": "ছেলে", "daughter": "মেয়ে", "child": "শিশু", "children": "শিশুরা", "baby": "বাচ্চা",
    "friend": "বন্ধু", "neighbour": "প্রতিবেশী", "neighbor": "প্রতিবেশী", "wedding": "বিয়ে", "marriage": "বিবাহ",
    "festival": "উৎসব", "Eid": "ঈদ", "Puja": "পূজা", "Boishakh": "বৈশাখ", "Ramadan": "রমজান",
    "ramadan": "রমজান", "iftar": "ইফতার", "mosque": "মসজিদ", "temple": "মন্দির", "religion": "ধর্ম",
    "prayer": "নামাজ", "faith": "বিশ্বাস", "belief": "বিশ্বাস", "tradition": "ঐতিহ্য", "culture": "সংস্কৃতি",
    "language": "ভাষা", "translation": "অনুবাদ", "meaning": "অর্থ", "identity": "পরিচয়",
    # ---------------------------------------------------------------- media / abstract
    "research": "গবেষণা", "study": "সমীক্ষা", "survey": "জরিপ", "report": "রিপোর্ট", "news": "খবর",
    "newspaper": "সংবাদপত্র", "journalist": "সাংবাদিক", "interview": "ইন্টারভিউ", "story": "গল্প",
    "documentary": "ডকুমেন্টারি", "episode": "পর্ব", "channel": "চ্যানেল", "media": "মিডিয়া",
    "viral": "ভাইরাল", "trend": "ট্রেন্ড", "follower": "ফলোয়ার", "comment": "কমেন্ট", "share": "শেয়ার",
    "subscribe": "সাবস্ক্রাইব", "content": "কনটেন্ট", "creator": "ক্রিয়েটর", "platform": "প্ল্যাটফর্ম",
    "algorithm": "অ্যালগরিদম", "update": "আপডেট", "version": "ভার্সন", "settings": "সেটিংস", "notification": "নোটিফিকেশন",
    "message": "মেসেজ", "call": "কল", "chat": "চ্যাট", "group": "গ্রুপ", "profile": "প্রোফাইল",
    "question": "প্রশ্ন", "answer": "উত্তর", "problem": "সমস্যা", "solution": "সমাধান", "reason": "কারণ",
    "example": "উদাহরণ", "effect": "প্রভাব", "cause": "কারণ", "change": "পরিবর্তন", "future": "ভবিষ্যৎ",
    "past": "অতীত", "present": "বর্তমান", "time": "সময়", "minute": "মিনিট", "hour": "ঘণ্টা",
    "day": "দিন", "week": "সপ্তাহ", "month": "মাস", "year": "বছর", "century": "শতাব্দী",
    "decade": "দশক", "morning": "সকাল", "evening": "সন্ধ্যা", "night": "রাত", "afternoon": "দুপুর",
    # ---------------------------------------------------------------- acronyms / units
    "USA": "ইউএসএ", "UK": "ইউকে", "UN": "ইউএন", "WHO": "ডব্লিউএইচও", "IMF": "আইএমএফ", "NASA": "নাসা",
    "NGO": "এনজিও", "CEO": "সিইও", "TV": "টিভি", "SMS": "এসএমএস", "PIN": "পিন", "ID": "আইডি",
    "PDF": "পিডিএফ", "ATM": "এটিএম", "USB": "ইউএসবি", "GPS": "জিপিএস", "SIM": "সিম",
    "OTP": "ওটিপি", "AI": "এআই", "DNA": "ডিএনএ", "GDP": "জিডিপি", "5G": "ফাইভ জি",
    "4G": "ফোর জি", "3G": "থ্রি জি", "LTE": "এলটিই", "FM": "এফএম", "AM": "এএম",
    "MB": "মেগাবাইট", "GB": "গিগাবাইট", "TB": "টেরাবাইট", "KB": "কিলোবাইট", "GB RAM": "গিগাবাইট র‍্যাম",
    "km": "কিলোমিটার", "kg": "কেজি", "cm": "সেন্টিমিটার", "mm": "মিলিমিটার", "ms": "মিলিসেকেন্ড",
    "Hz": "হার্টজ", "GHz": "গিগাহার্জ", "MHz": "মেগাহার্টজ", "W": "ওয়াট", "kW": "কিলোওয়াট",
}

NOTE = (
    "Bangla pronunciation dictionary: Latin / mixed strings respelled in Bangla script so the "
    "neural voice reads them consistently. Longest key first, case-insensitive for Latin keys. "
    "Extend per story with stories/<slug>/pronunciation.json (merged on top of this file)."
)


def build() -> dict:
    return {"version": 1, "note": NOTE, "entries": dict(sorted(ENTRIES.items()))}


def main(argv: list[str]) -> int:
    if "--check" in argv:
        if not os.path.exists(OUT):
            print(f"missing {OUT}")
            return 1
        data = json.load(open(OUT, encoding="utf8"))
        n = len(data.get("entries", {}))
        print(f"{OUT}: {n} entries")
        return 0 if n >= 200 else 1
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    data = build()
    with open(OUT, "w", encoding="utf8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"wrote {OUT}: {len(data['entries'])} entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
