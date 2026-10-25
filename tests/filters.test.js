// filters.test.js: tests for search and filtering rules (no database or network needed).
// Run all tests with:  npm test
process.env.USE_PGLITE = "1";   // so nothing here creates a database file
const test = require("node:test");
const assert = require("node:assert");
const createSearch = require("../server/services/searchService");
const { roomFitsBudget } = require("../server/services/pgService");

const AREAS = [
  { name: "Bellandur", aliases: ["green glen", "green glen layout"] },
  { name: "HSR Layout", aliases: ["hsr", "hsr sector"] },
  { name: "Sarjapur", aliases: ["sarjapur road", "kasavanahalli", "wipro"] }
];
const AMENITIES = ["Food", "Electricity", "Water", "Wi-Fi", "Housekeeping", "Laundry", "Indoor games", "AC"];
const pgs = [
  { id: 1, name: "Stanza Living Shanghai House", area: "Green Glen Layout / Bellandur", areaKey: "Bellandur", gender: "Unisex", notes: "", sourceType: "official", amenities: { AC: "y", Food: "y" } },
  { id: 2, name: "Zolo Lakefront", area: "Bellandur", areaKey: "Bellandur", gender: "", notes: "", sourceType: "firsthand", amenities: { AC: "n", Food: "n" } }
];
const search = createSearch({ AREAS: AREAS, AMENITIES: AMENITIES, SOURCE_LABELS: {}, roomsOf: function () { return []; } });

test("reads area, budget and amenity from one sentence", function () {
  const p = search.parseQuery("AC under 20k in Bellandur");
  assert.strictEqual(p.area.name, "Bellandur");
  assert.strictEqual(p.maxRent, 20000);
  assert.deepStrictEqual(p.amenities, ["AC"]);
});

test("understands budget ranges and plain numbers", function () {
  const range = search.parseQuery("15k-20k");
  assert.strictEqual(range.minRent, 15000);
  assert.strictEqual(range.maxRent, 20000);
  assert.strictEqual(search.parseQuery("below 18,000").maxRent, 18000);
});

test("does not mistake '2-sharing' for money", function () {
  const p = search.parseQuery("2-sharing hsr");
  assert.strictEqual(p.maxRent, null);
  assert.strictEqual(p.roomType, "sharing");
  assert.strictEqual(p.area.name, "HSR Layout");
});

test("understands gender and room words", function () {
  assert.strictEqual(search.parseQuery("co-ed with food").gender, "coed");
  assert.strictEqual(search.parseQuery("women only").gender, "women");
  assert.strictEqual(search.parseQuery("single room").roomType, "private");
});

test("area aliases work", function () {
  assert.strictEqual(search.parseQuery("green glen").area.name, "Bellandur");
  assert.strictEqual(search.parseQuery("kasavanahalli").area.name, "Sarjapur");
});

test("finds a PG by name, even with a typo", function () {
  const exact = search.parseQuery("stanza").words;
  const typo = search.parseQuery("stansa").words;
  assert.ok(search.scorePg(pgs[0], exact) > 0);
  assert.ok(search.scorePg(pgs[0], typo) > 0);
  assert.strictEqual(search.scorePg(pgs[1], exact), 0);
});

test("a word that matches nothing scores zero", function () {
  assert.strictEqual(search.scorePg(pgs[0], search.parseQuery("xyzzy").words), 0);
});

test("budget rules: exact, range, from and unknown prices", function () {
  const exact = { monthlyRent: 15000, rentMax: null, priceKind: "exact" };
  const range = { monthlyRent: 26000, rentMax: 30000, priceKind: "range" };
  const from = { monthlyRent: 17800, rentMax: null, priceKind: "from" };
  const unknown = { monthlyRent: null, rentMax: null, priceKind: "unknown" };
  assert.ok(roomFitsBudget(exact, 0, 20000));
  assert.ok(!roomFitsBudget(exact, 16000, 20000));
  assert.ok(roomFitsBudget(range, 28000, 29000), "a range fits if any part of it fits");
  assert.ok(!roomFitsBudget(range, 0, 25000));
  assert.ok(roomFitsBudget(from, 30000, Infinity), "a 'from' price has no upper limit");
  assert.ok(!roomFitsBudget(unknown, 0, Infinity), "an unknown price never matches a budget");
});
