// api.test.js: starts the real server (on a real Postgres engine inside Node) and calls it over HTTP.
process.env.USE_PGLITE = "1";
process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert");
const { start } = require("../server/server");

let server;
let base;

test.before(async function () {
  server = await start(0);   // port 0 = any free port
  base = "http://localhost:" + server.address().port;
});
test.after(function () { server.close(); });

async function call(method, url, body, headers) {
  const res = await fetch(base + url, {
    method: method, headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch (e) { /* no body */ }
  return { status: res.status, data: data, headers: res.headers };
}

test("GET /api/health", async function () {
  const r = await call("GET", "/api/health");
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.ok, true);
  assert.strictEqual(r.data.pgs, 11);
});

test("GET /api/pgs returns every PG, with prices as numbers", async function () {
  const r = await call("GET", "/api/pgs");
  assert.strictEqual(r.data.length, 11);
  assert.ok(r.data.every(function (pg) { return pg.rooms.every(function (x) { return x.monthlyRent === null || typeof x.monthlyRent === "number"; }); }));
});

test("GET /api/pgs/:id returns the PG, its rooms and its photos", async function () {
  const r = await call("GET", "/api/pgs/206");
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.pg.name, "Stanza Living Shanghai House");
  assert.strictEqual(r.data.rooms.length, 3);
  assert.strictEqual(r.data.pg.photos.length, 3);
  assert.ok(r.data.pg.photos[0].credit);
});

test("GET /api/pgs/:id gives 404 for an unknown PG", async function () {
  assert.strictEqual((await call("GET", "/api/pgs/999")).status, 404);
});

test("GET /api/pgs?ids= returns only those PGs", async function () {
  const r = await call("GET", "/api/pgs?ids=201,204");
  assert.deepStrictEqual(r.data.map(function (p) { return p.id; }), [201, 204]);
});

test("GET /api/search understands a plain-language request", async function () {
  const r = await call("GET", "/api/search?q=" + encodeURIComponent("AC under 20k in Bellandur"));
  assert.deepStrictEqual(r.data.results.map(function (p) { return p.name; }),
    ["Stanza Living Shanghai House", "Stanza Living Bochum House"]);
});

test("GET /api/search with nothing typed says it did not understand", async function () {
  const r = await call("GET", "/api/search?q=");
  assert.strictEqual(r.data.understood, false);
  assert.strictEqual(r.data.results.length, 0);
});

test("POST /api/bookings: validation, creation, duplicate protection, read back", async function () {
  const bad = await call("POST", "/api/bookings", { requestId: "bad", pgId: 206, roomTypeId: 9, fullName: "x", phone: "1", email: "nope", moveInDate: "" });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual(bad.data.code, "VALIDATION");

  const body = { requestId: "api-1", pgId: 206, roomTypeId: 9, fullName: "Api Test", phone: "9876543210", email: "a@b.co", moveInDate: "2027-02-01", priceLabel: "₹22,599" };
  const made = await call("POST", "/api/bookings", body);
  assert.strictEqual(made.status, 201);
  const again = await call("POST", "/api/bookings", body);
  assert.strictEqual(again.status, 200);
  assert.strictEqual(again.data.id, made.data.id);

  const read = await call("GET", "/api/bookings/" + made.data.id);
  assert.strictEqual(read.data.fullName, "Api Test");
  assert.strictEqual((await call("GET", "/api/bookings/HML-000000")).status, 404);
});

test("GET /api/pgs/:id/photos says 'not_configured' when there is no Google key", async function () {
  delete process.env.GOOGLE_MAPS_API_KEY;
  const r = await call("GET", "/api/pgs/206/photos");
  assert.strictEqual(r.data.status, "not_configured");
  assert.deepStrictEqual(r.data.photos, []);
});

test("CORS: an allowed website gets permission, another website does not", async function () {
  const ok = await call("GET", "/api/health", null, { Origin: "http://localhost:8123" });
  assert.strictEqual(ok.headers.get("access-control-allow-origin"), "http://localhost:8123");
  const no = await call("GET", "/api/health", null, { Origin: "https://evil.example" });
  assert.strictEqual(no.headers.get("access-control-allow-origin"), null);
});

test("unknown addresses give a clean JSON 404", async function () {
  const r = await call("GET", "/api/nothing-here");
  assert.strictEqual(r.status, 404);
  assert.ok(r.data.error);
});
