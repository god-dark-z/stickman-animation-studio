// Every id the story JSON may use. The zod schema is built from these lists,
// so a typo in a story file fails validation with the list of valid options.

export const BACKGROUNDS = [
  "office", // desks, windows with city view
  "bedroom", // cozy home interior, window, bed
  "livingroom", // couch, tv, lamp
  "kitchen", // counters, cabinets, fridge
  "classroom", // chalkboard, desks
  "lab", // science lab, shelves of flasks
  "store", // shop shelves and counter
  "prison", // cell block corridor
  "cell", // single small cell with barred window
  "hospital", // clean ward, bed, curtain
  "courtroom", // judge bench, wood panels
  "factory", // conveyor belts, pipes
  "bar", // saloon / bar interior
  "street", // town street with buildings
  "city", // downtown skyline, big buildings
  "suburb", // houses, lawns
  "field", // open grass hills
  "farm", // barn, fence, field
  "forest", // trees
  "desert", // dunes, cactus
  "western", // wild-west main street
  "mountain", // snowy peaks
  "beach", // sand, sea
  "sea", // open ocean, horizon
  "shipdeck", // on a wooden ship deck
  "space", // stars and a planet
  "moon", // lunar surface, earth in sky
  "cave", // dark rocky cave
  "stage", // spotlight stage / studio void for explanations
  "void", // plain gradient for graphics inserts
  // Nishi episode (2D painted, locked night palette)
  "village_night", // moon, tin roofs, layered fog, one lit window
  "village_dawn", // grey first light, lifting mist
  "room_night", // Rafi's room: bed, door, window with fog outside
  "room_warm", // grandmother's flashback: lantern warm interior
  "pond_bank", // the pond at dawn
  // Kuchisake-onna episode (Japan, dusk -> night, locked horror palette)
  "jp_street", // Japanese town street at dusk: school far off, bare cherry trees, sodium lamps
  "jp_genkan", // the entryway (genkan) of Yuto's house, night
  "jp_bedroom", // Yuto's bedroom, lights out
] as const;

export const TIMES = ["day", "sunset", "night", "dawn"] as const;

export const POSES = [
  "stand", // relaxed, arms down
  "talk", // one hand gesturing
  "point", // arm extended toward facing direction
  "wave",
  "armsUp", // celebrating / panic
  "shrug",
  "think", // hand on chin
  "crossed", // arms crossed
  "hips", // hands on hips
  "hold", // both hands in front holding something
  "holdUp", // one hand raised holding something up
  "facepalm",
  "sit",
  "walk",
  "run",
  "fall", // flailing, tilted
  "lie", // lying on the ground
  "cower", // crouched, hands up defensively
  "push", // both arms forward
  "reach", // one arm reaching up
  "hammer", // swinging a tool overhead
  "type", // hands forward low (keyboard)
  "phone", // hand at ear
] as const;

export const EXPRESSIONS = [
  "neutral",
  "smug",
  "happy",
  "laugh",
  "grin", // big toothy grin
  "surprised", // round eyes, small o mouth
  "shocked", // round eyes, gritted teeth
  "angry",
  "furious", // red face
  "sad",
  "worried", // sweat drop
  "scared",
  "suspicious", // squint
  "determined",
  "sleepy",
  "crazy", // spiral/wide eyes, huge grin
  "wink",
  "bored",
  "dead", // x eyes
  "love",
] as const;

export const HAIR = ["none", "short", "parted", "spiky", "curly", "bob", "long", "ponytail", "bun", "mohawk", "messy", "old"] as const;

export const HATS = [
  "none", "cap", "police", "chef", "bowler", "cowboy", "hardhat", "tophat", "beanie",
  "straw", "captain", "pirate", "crown", "helmet", "beret", "headphones", "graduation", "nurse", "astronaut", "bandana",
] as const;

export const OUTFITS = [
  "shirt", "suit", "overalls", "apron", "uniform", "dress", "labcoat", "prisoner",
  "tshirt", "hoodie", "vest", "sweater", "spacesuit", "robe", "jersey",
  "panjabi", // long kurta over pajama (Rafi, village Bangladesh)
  "sari", // white sari with red border (mother / grandmother / the Nishi)
  "gakuran", // Japanese school uniform: navy stand-collar jacket, white shirt, gold buttons
  "longcoat", // long white coat down to the knees (Kuchisake-onna) — drawn over the body, not clipped to it
  "samurai", // Heian warlord: dark hitatare robe, white crossed lapels, obi sash (Masakado)
] as const;

export const BUILDS = ["normal", "big", "skinny", "kid", "tall"] as const;

export const PROPS = [
  // furniture / room
  "desk", "table", "chair", "stool", "bed", "couch", "shelf", "lamp", "floorlamp", "door", "window", "plant", "trashcan",
  // objects
  "box", "crate", "barrel", "bag", "moneybag", "money", "coins", "coin", "gem", "trophy", "key", "lock", "book", "paper",
  "letter", "card", "ticket", "phone", "laptop", "computer", "tv", "clock", "stopwatch", "calendar", "button", "lever",
  "lightbulb", "bottle", "potion", "cup", "mug", "plate", "food", "pizza", "cake", "bucket", "paintcan", "hammer", "wrench",
  "pencil", "magnifier", "mirror", "camera", "microphone", "megaphone", "flag", "sign", "arrowsign", "board", "chart",
  "map", "globe", "rocket", "car", "truck", "bike", "train", "ship", "boat", "plane", "balloon", "bomb", "dynamite",
  "fire", "tree", "pinetree", "palm", "wheat", "cactus", "rock", "house", "building", "tower", "fence", "ladder", "rope", "chain",
  "cage", "bars", "glasscase", "pedestal", "statue", "gun", "machinegun", "sword", "shield", "skull", "heart", "star", "dice", "cards",
  "syringe", "pill", "scalpel", "capsule", "flask", "atom", "magnet", "battery", "satellite", "ufo", "moonrock", "piggybank", "safe", "vault",
  "wheel", "gear", "pipe", "rail", "bench", "mat", "rug", "tent", "campfire", "anchor", "steeringwheel", "cannon",
  "horse", "dog", "cat", "bird", "fish", "cow", "pig", "rat",
  "monalisa", "broom", "trunk",
  // Nishi episode (village horror)
  "lantern", "footprints", "sari_cloth", "nishi", "pond", "tinroof_hut",
  // Kuchisake-onna episode (Japan)
  "scissors", // long silver surgical scissors — held in her right hand, and left on the shoe rack
  "randoseru", // red Japanese school satchel, standing on a chair
  "vending_machine", // drinks machine glowing blue-white
  "shoe_rack", // genkan shoe rack
  "folded_mask", // white surgical mask, folded neatly
  "candy", // hard candy in a clear plastic wrapper
  "sketch_portrait", // pencil sketch of a masked woman on a sheet of paper
  "street_lamp", // sodium street lamp on a pole — brightness comes from the `lit` prop field
  "jp_sliding_door", // Japanese sliding bedroom door — slides open a crack (uses the `open` prop field)
  // Masakado episode (the grave of Taira no Masakado)
  "grave_mound", // the kubizuka: earthen mound, carved stone stele, rope, wooden saisen box
  "bouquet", // flower offering in a glass bottle (Japanese style)
  "frog", // small golden frog figurine — the kaeru offering for a safe return
  "bulldozer", // yellow bulldozer with a front blade (the GHQ parking-lot beat)
] as const;

export const FX = [
  "sparkle", // twinkling stars around focus
  "glow", // bloom pulse on focus
  "rain",
  "snow",
  "dust", // floating dust motes in light
  "confetti",
  "debris", // flying shards
  "smoke",
  "fire",
  "speedlines",
  "flash", // white flash
  "shake", // camera shake
  "cracks", // cracks spread on screen
  "rage", // red veins + red tint
  "hearts",
  "money", // falling bills
  "zzz",
  "question", // ? marks over head
  "exclaim", // ! over head
  "sweat",
  "lightning",
  "explosion",
  "ripples",
  "stars", // dizzy stars
  "redtint",
  "bluetint",
  "darken",
  "spotlight",
  "godrays",
  // Nishi episode
  "fog", // drifting fog layers over the scene
  "flicker", // lantern flame flicker light
] as const;

export const SFX = [
  "whoosh", "swoosh", "pop", "click", "ding", "sparkle", "chime", "impact", "thud", "boom", "crash", "glass",
  "cash", "coins", "tick", "clock", "heartbeat", "rumble", "splash", "water", "wind", "rain", "thunder", "slide",
  "boing", "scratch", "type", "alarm", "buzz", "beep", "bell", "gasp", "laugh", "crowd", "footsteps", "door",
  "knock", "paper", "stamp", "riser", "drop", "suspense", "magic", "fail", "success", "punch", "zap", "fire",
  "engine", "horn", "gunshot", "metal", "creak", "squeak",
  // Nishi episode ambience / horror cues
  "whisper", "crickets", "breath", "drone", "flute_dawn", "dog_bark", "ripple",
  // Kuchisake-onna episode ambience / horror cues
  "vending_hum", "lamp_click", "scissors_snip", "piano_note",
] as const;

export const CAMERA_MOVES = ["pushIn", "pullOut", "panLeft", "panRight", "panUp", "panDown", "drift", "static", "crashZoom", "orbit"] as const;
export const FRAMINGS = ["wide", "full", "medium", "close", "extreme"] as const;
export const TRANSITIONS = ["dissolve", "cut", "iris", "whip", "flash", "zoom"] as const;
export const MUSIC = ["curious", "tense", "warm", "mystery", "upbeat", "sad", "none"] as const;
export const INSERTS = ["none", "document", "phone", "chart", "map", "counter", "bigtext", "versus", "timeline", "list"] as const;
