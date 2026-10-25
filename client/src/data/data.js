// data.js: the seed data for Homli.
// These 15 PGs come from Homli_Launch_Seed_Dataset_Updated.xlsx. Rows 1-5 are firsthand information,
// the rest come from public or official pages (the source link is kept on every row).
// RULE: never invent a value. If the source does not say, the value is "?" (unknown) and the page
// shows "Details being verified" or "Check availability".
// In V2 this data moves into a database, and the fake API (api.js) is replaced by a real backend.

// Areas the search understands. "aliases" are other names people type for the same area.
// There are no coordinates: the PGs are matched to an area by name.
const AREAS = [
  { name: "Bellandur", aliases: ["green glen", "green glen layout"] },
  { name: "HSR Layout", aliases: ["hsr", "hsr sector"] },
  { name: "Sarjapur", aliases: ["sarjapur road", "kasavanahalli", "wipro"] }
];

// Amenities, in a fixed order. Each PG stores one status per amenity: "y" (yes), "n" (no) or "?" (unknown).
const AMENITIES = ["Food", "Electricity", "Water", "Wi-Fi", "Housekeeping", "Laundry", "Indoor games", "AC"];
const MUST_HAVE_FILTERS = ["Food", "Wi-Fi", "Housekeeping", "Laundry", "AC"];

// Where the information came from (the trust label shown on cards).
const SOURCE_LABELS = {
  firsthand: "Firsthand info",
  official: "Official website",
  public: "Public listing"
};

// Reviews come from Google Maps. Until the photo/review backend is connected, no reviews are shown.
const REVIEW_SOURCE = "Google Maps";

// The room types a user can filter by: [value in the URL, label, occupancyType in the data]
const ROOM_FILTERS = [
  ["any", "Any", null],
  ["private", "Single room", "Private"],
  ["sharing", "Sharing", "Sharing"]
];

// Budget presets: [label, min, max]. An empty string means "no limit".
const BUDGET_PRESETS = [
  ["Under ₹10K", "", 10000],
  ["₹10K–15K", 10000, 15000],
  ["₹15K–20K", 15000, 20000],
  ["₹20K–25K", 20000, 25000],
  ["₹25K+", 25000, ""]
];

// ---------- Places for the distance slider ----------
// APPROXIMATE centre points (latitude, longitude). They are not exact addresses.
// A PG is placed at the centre of its locality, so distances are rough straight-line estimates.
// Exact distances need real PG addresses plus a geocoding service (V2).
const LOCALITIES = {
  greenglen: { lat: 12.9262, lng: 77.6775, label: "Green Glen Layout" },
  bellandur: { lat: 12.9304, lng: 77.6784, label: "Bellandur" },
  hsr:       { lat: 12.9116, lng: 77.6389, label: "HSR Layout" },
  sarjapur:  { lat: 12.9060, lng: 77.6790, label: "Sarjapur Road (Kasavanahalli)" }
};
function localityOf(areaText) {
  const t = String(areaText || "").toLowerCase();
  if (t.indexOf("green glen") >= 0) return LOCALITIES.greenglen;
  if (t.indexOf("bellandur") >= 0) return LOCALITIES.bellandur;
  if (t.indexOf("hsr") >= 0) return LOCALITIES.hsr;
  return LOCALITIES.sarjapur;
}
// The places a user can measure from: [name, lat, lng]
const NEAR_PLACES = [
  ["RMZ Ecospace (Bellandur)", 12.9262, 77.6800],
  ["Embassy Tech Village", 12.9366, 77.6945],
  ["Bellandur", 12.9304, 77.6784],
  ["Green Glen Layout", 12.9262, 77.6775],
  ["HSR Layout", 12.9116, 77.6389],
  ["Silk Board Junction", 12.9174, 77.6229],
  ["Koramangala", 12.9352, 77.6245],
  ["BTM Layout", 12.9166, 77.6101],
  ["Sarjapur Road (Kasavanahalli)", 12.9060, 77.6790],
  ["Marathahalli", 12.9569, 77.7011],
  ["Indiranagar", 12.9784, 77.6408],
  ["Whitefield", 12.9698, 77.7500],
  ["Electronic City", 12.8452, 77.6602]
];

// ---------- PGs ----------
// pg(id, name, area (as written in the source), areaKey, gender, deposit, sourceType, sourceUrl, notes, [8 amenity statuses])
// The 8 statuses follow AMENITIES: Food, Electricity, Water, Wi-Fi, Housekeeping, Laundry, Indoor games, AC.
// Who the PG is for, as a simple key for filtering. If the source does not say, it is "unknown" (never guessed).
function genderKeyOf(text) {
  const t = String(text || "").toLowerCase();
  if (/women|ladies|girls|female/.test(t)) return "women";
  if (/men|gents|boys|male/.test(t)) return "men";
  if (/unisex|everyone|mixed|co-?ed/.test(t)) return "coed";
  return "unknown";
}
const GENDER_FILTERS = [["any", "Anyone"], ["coed", "Co-ed"], ["women", "Women only"], ["men", "Men only"]];
// Lock-in period per PG (how long you must stay). Not in the source data yet, so it shows "Details being verified".
// To add one later, write the PG id and the text, for example: 206: "3 months".
const LOCK_IN = {};

function pg(id, name, area, areaKey, gender, deposit, sourceType, sourceUrl, notes, a) {
  const amenities = {};
  AMENITIES.forEach(function (name, i) { amenities[name] = a[i]; });
  return { id, name, area, areaKey, gender, genderKey: genderKeyOf(gender), loc: localityOf(area), deposit, lockIn: LOCK_IN[id] || "Details being verified", sourceType, sourceUrl, notes, amenities, googlePlaceId: null };
}
const PGS = [
  pg(201, "Ollie Coliving", "Green Glen Layout / Bellandur", "Bellandur", "", "Details being verified", "firsthand", "",
    "Single room price and listed inclusions shared firsthand.", ["y", "y", "y", "?", "y", "y", "y", "n"]),
  pg(202, "Feb 30 Orchid", "Green Glen Layout / Bellandur", "Bellandur", "", "Details being verified", "firsthand", "",
    "All-inclusive amenities. Several single-room variants.", ["y", "y", "y", "y", "y", "y", "y", "n"]),
  pg(203, "Feb 30 Wisteria", "Green Glen Layout / Bellandur", "Bellandur", "", "Details being verified", "firsthand", "",
    "Amenities are similar to Feb 30 Orchid.", ["y", "y", "y", "y", "y", "y", "y", "n"]),
  pg(204, "Sloka Living", "Green Glen Layout / Bellandur", "Bellandur", "Co-ed", "Details being verified", "firsthand", "",
    "Price and inclusions shared firsthand. Co-ed. Some online listings call it ladies-only, which is not correct.", ["y", "y", "y", "y", "y", "y", "y", "?"]),
  pg(205, "Zolo Lakefront", "Bellandur", "Bellandur", "", "Details being verified", "firsthand", "",
    "Food is not included and there are no indoor games. Other common inclusions are included.", ["n", "y", "y", "y", "y", "y", "n", "n"]),
  pg(206, "Stanza Living Shanghai House", "Green Glen Layout / Bellandur", "Bellandur", "Unisex", "Details being verified", "official",
    "https://www.stanzaliving.com/bengaluru/pg-hostel-in-bellandur/co_ed/shanghai-house",
    "Attached balcony and washroom, spacious cupboard. Washing machine not separately verified; laundry service listed.", ["y", "y", "y", "y", "y", "y", "?", "y"]),
  pg(207, "Stanza Living Bochum House", "Bellandur", "Bellandur", "Unisex", "Details being verified", "official",
    "https://www.stanzaliving.com/bengaluru/pg-hostel-in-bellandur/co_ed/bochum-house",
    "Attached washroom, spacious cupboard. Meals, Wi-Fi, laundry, housekeeping, security and water purifier listed.", ["y", "y", "y", "y", "y", "y", "?", "y"]),
  pg(208, "FF21 SJR", "Sarjapur", "Sarjapur", "Co-living (mixed)", "Zero-deposit option, or 2 months' rent", "official",
    "https://www.ff21.in/luxury-pg-in-bangalore",
    "A Sarjapur property with a starting price. The exact single-room rate is not shown.", ["y", "y", "y", "y", "y", "y", "y", "?"]),
  pg(212, "HelloWorld 1stMain", "HSR Layout, Sector 6", "HSR Layout", "", "1 month's rent", "official",
    "https://thehelloworld.com/coliving-in-bangalore/hsr/helloworld-1stmain",
    "Club sharing, Classic sharing and private variants.", ["?", "?", "y", "y", "y", "y", "?", "?"]),
  pg(213, "Local Colive & Work Sarjapur", "Kasavanahalli / Sarjapur", "Sarjapur", "Co-living", "1 month's rent (room-specific deposits listed)", "public",
    "https://www.gopgo.in/bengaluru/kasavanahalli-village-varthur-hobli-bengaluru/pg/18358-local-colive-work-sarjapur/pgo-properties",
    "Food is not bundled (about ₹3,000 a month if you add it) and electricity is charged extra. Non-AC rooms.", ["n", "n", "y", "y", "y", "y", "y", "n"]),
  pg(214, "Zolo Estonia C", "Sarjapur", "Sarjapur", "Co-living", "Details being verified", "official",
    "https://zolostays.com/pg-hostel-near-sarjapura-in-bangalore-zolo_estonia_c-zoestc",
    "Meals are included. Other details are being verified.", ["y", "?", "?", "?", "?", "?", "?", "?"])
];

// ---------- Room types ----------
// room(id, pgId, occupancyType, label, rent, rentMax, priceKind, inclusions)
//   occupancyType: "Private", "Sharing" or "Unspecified" (the source does not say)
//   priceKind: "exact" (one price), "range" (rent to rentMax, shown as a range, never averaged),
//              "from" (a verified starting price only), "unknown" (shown as "Check availability")
function room(id, pgId, occupancyType, label, rent, rentMax, priceKind, inclusions) {
  return { id, pgId, occupancyType, label, monthlyRent: rent, rentMax: rentMax, priceKind, inclusions: inclusions || [] };
}
const ROOM_TYPES = [
  room(1, 201, "Private", "Single room", 24000, null, "exact"),
  room(2, 202, "Private", "Single, inner balcony", 25000, null, "exact"),
  room(3, 202, "Private", "Single, standard", 27000, null, "exact"),
  room(4, 202, "Private", "Single, large + outside balcony", 30000, null, "exact"),
  room(5, 202, "Sharing", "Sharing", 19000, null, "exact"),
  room(6, 203, "Private", "Single room", 26000, 30000, "range"),
  room(7, 204, "Private", "Single room", 26000, null, "exact"),
  room(8, 205, "Private", "Single room", 24000, null, "exact"),
  room(9, 206, "Private", "Single room", 22599, null, "exact", ["Attached balcony and washroom"]),
  room(10, 206, "Sharing", "Double sharing", 13499, null, "exact"),
  room(11, 206, "Sharing", "Triple sharing", 13699, null, "exact"),
  room(12, 207, "Private", "Single room", 19699, null, "exact", ["Attached washroom"]),
  room(13, 207, "Sharing", "Double sharing", 10299, null, "exact"),
  room(14, 208, "Unspecified", "Starting price (room type not specified)", 17800, null, "from"),
  room(22, 212, "Private", "Private variants", 27999, 29999, "range"),
  room(23, 212, "Sharing", "Club sharing", 15999, null, "exact"),
  room(24, 212, "Sharing", "Classic sharing", 16999, null, "exact"),
  room(25, 213, "Private", "Private room", null, null, "unknown"),
  room(26, 213, "Sharing", "Twin Superior", 14500, null, "exact"),
  room(27, 213, "Sharing", "Twin Standard", 13500, null, "exact"),
  room(28, 214, "Private", "Private room, starting price", 12960, null, "from"),
  room(29, 214, "Sharing", "Two-sharing, starting price", 6885, null, "from")
];

// ---------- Local photos (used with the PG's permission) ----------
// LOCAL_PHOTOS maps a PG id to its picture files in the photos/ folder, with the credit shown under them.
// Cards and detail pages use these first; Google photos (through the backend) are the fallback.
const LOCAL_PHOTOS = {
  201: [{ file: "photos/201-1.jpg", credit: "Ollie (shared with Homli)" }],
  202: [{ file: "photos/202-1.jpg", credit: "Feb 30 (shared with Homli)" }, { file: "photos/202-2.jpg", credit: "Feb 30 (shared with Homli)" }, { file: "photos/202-3.jpg", credit: "Feb 30 (shared with Homli)" }],
  203: [{ file: "photos/203-1.jpg", credit: "Feb 30 (shared with Homli)" }, { file: "photos/203-2.jpg", credit: "Feb 30 (shared with Homli)" }, { file: "photos/203-3.jpg", credit: "Feb 30 (shared with Homli)" }],
  204: [{ file: "photos/204-1.jpg", credit: "Sloka Living (shared with Homli)" }],
  205: [{ file: "photos/205-1.jpg", credit: "Zolo (shared with Homli)" }],
  206: [{ file: "photos/206-1.jpg", credit: "Stanza Living" }, { file: "photos/206-2.jpg", credit: "Stanza Living" }, { file: "photos/206-3.jpg", credit: "Stanza Living" }],
  207: [{ file: "photos/207-1.jpg", credit: "Stanza Living" }, { file: "photos/207-2.jpg", credit: "Stanza Living" }, { file: "photos/207-3.jpg", credit: "Stanza Living" }],
  208: [{ file: "photos/208-1.jpg", credit: "FF21 (video shared with Homli)" }, { file: "photos/208-2.jpg", credit: "FF21 (video shared with Homli)" }, { file: "photos/208-3.jpg", credit: "FF21 (video shared with Homli)" }],
  212: [{ file: "photos/212-1.jpg", credit: "HelloWorld" }, { file: "photos/212-2.jpg", credit: "HelloWorld" }, { file: "photos/212-3.jpg", credit: "HelloWorld" }],
  213: [{ file: "photos/213-1.jpg", credit: "Local Colive (via GoPGo listing)" }, { file: "photos/213-2.jpg", credit: "Local Colive (via GoPGo listing)" }, { file: "photos/213-3.jpg", credit: "Local Colive (via GoPGo listing)" }],
  214: [{ file: "photos/214-1.jpg", credit: "Zolo Stays" }],
};
