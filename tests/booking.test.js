// booking.test.js: tests for the booking rules, on a real Postgres engine running inside Node (PGlite).
process.env.USE_PGLITE = "1";
const test = require("node:test");
const assert = require("node:assert");
const seed = require("../server/db/seed");
const bookingService = require("../server/services/bookingService");

const valid = {
  requestId: "t-1", pgId: 206, roomTypeId: 9, fullName: "Test User", phone: "9876543210",
  email: "test@example.com", moveInDate: "2027-01-10", expectedDuration: "6 months", priceLabel: "₹22,599"
};

test.before(async function () { await seed.init(); });

test("valid details have no problems", function () {
  assert.deepStrictEqual(bookingService.findProblems(valid), []);
});

test("each wrong field is reported", function () {
  const problems = bookingService.findProblems({ fullName: "x", phone: "12345", email: "nope", moveInDate: "" });
  assert.deepStrictEqual(problems.sort(), ["email", "moveInDate", "name", "phone", "requestId"].sort());
});

test("phone must be a 10-digit Indian mobile number", function () {
  assert.ok(bookingService.findProblems(Object.assign({}, valid, { phone: "5876543210" })).includes("phone"));
  assert.ok(!bookingService.findProblems(valid).includes("phone"));
});

test("creates a booking and freezes the deposit as a snapshot", async function () {
  const r = await bookingService.createBooking(valid);
  assert.strictEqual(r.status, 201);
  assert.match(r.body.id, /^HML-\d+$/);
  assert.strictEqual(r.body.pgName, "Stanza Living Shanghai House");
  assert.strictEqual(r.body.depositSnapshot, "Details being verified");
});

test("the saved price is worked out by the server, not taken from the browser", async function () {
  const r = await bookingService.createBooking(Object.assign({}, valid, { requestId: "price-1", priceLabel: "₹1" }));
  assert.strictEqual(r.body.priceSnapshot, "₹22,599");
});

test("price labels follow the price kind", function () {
  assert.strictEqual(bookingService.priceLabel({ priceKind: "exact", monthlyRent: 24000 }), "₹24,000");
  assert.strictEqual(bookingService.priceLabel({ priceKind: "range", monthlyRent: 26000, rentMax: 30000 }), "₹26,000–₹30,000");
  assert.strictEqual(bookingService.priceLabel({ priceKind: "from", monthlyRent: 17800 }), "From ₹17,800");
});

test("sending the same request twice gives back the same booking (duplicate protection)", async function () {
  const first = await bookingService.createBooking(Object.assign({}, valid, { requestId: "dup-1" }));
  const second = await bookingService.createBooking(Object.assign({}, valid, { requestId: "dup-1" }));
  assert.strictEqual(second.status, 200);
  assert.strictEqual(second.body.id, first.body.id);
});

test("a room whose price is unknown cannot be booked", async function () {
  const r = await bookingService.createBooking(Object.assign({}, valid, { requestId: "unk-1", pgId: 213, roomTypeId: 25 }));
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.body.code, "ROOM_GONE");
});

test("a room that does not belong to that PG is refused", async function () {
  const r = await bookingService.createBooking(Object.assign({}, valid, { requestId: "wrong-1", pgId: 201, roomTypeId: 9 }));
  assert.strictEqual(r.status, 409);
});

test("a booking can be read back, and an unknown id gives nothing", async function () {
  const made = await bookingService.createBooking(Object.assign({}, valid, { requestId: "read-1" }));
  const found = await bookingService.getBooking(made.body.id);
  assert.strictEqual(found.fullName, "Test User");
  assert.strictEqual(await bookingService.getBooking("HML-000000"), undefined);
});
