// smoke.js: a quick health check of every API route.
// Run:  node scripts/smoke.js                       (tests http://localhost:3000)
//       node scripts/smoke.js https://your-api.onrender.com   (tests your deployed server)
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
let failures = 0;

async function call(method, url, body) {
  const res = await fetch(base + url, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch (e) { /* no body */ }
  return { status: res.status, data: data };
}
function check(name, ok, detail) {
  if (!ok) failures += 1;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}

(async function () {
  let r = await call("GET", "/api/health");
  check("health", r.status === 200 && r.data.ok, "database: " + (r.data && r.data.database) + ", PGs: " + (r.data && r.data.pgs));

  r = await call("GET", "/api/pgs");
  check("list all PGs", r.status === 200 && r.data.length > 0, r.data.length + " PGs");

  r = await call("GET", "/api/pgs/206");
  check("one PG with rooms", r.status === 200 && r.data.rooms.length > 0, r.data.pg && r.data.pg.name);
  check("rooms have numbers, not text", r.data.rooms.every(function (x) { return x.monthlyRent === null || typeof x.monthlyRent === "number"; }));

  r = await call("GET", "/api/pgs/999");
  check("unknown PG gives 404", r.status === 404);

  r = await call("GET", "/api/pgs?ids=201,204");
  check("PGs by ids", r.status === 200 && r.data.length === 2);

  r = await call("GET", "/api/search?q=" + encodeURIComponent("AC under 20k in Bellandur"));
  check("smart search", r.status === 200 && r.data.results.length === 2 && r.data.results.every(function (x) { return /Stanza/.test(x.name); }),
    r.data.results.map(function (x) { return x.name; }).join(", "));

  r = await call("GET", "/api/search?q=stansa");
  check("typo search", r.status === 200 && r.data.results.length === 2);

  r = await call("GET", "/api/search?q=");
  check("empty search is not understood", r.status === 200 && r.data.understood === false);

  const booking = { requestId: "smoke-" + Date.now(), pgId: 206, roomTypeId: 9, fullName: "Smoke Test", phone: "9876543210",
    email: "smoke@test.co", moveInDate: "2027-01-10", expectedDuration: "6 months", priceLabel: "₹22,599" };
  r = await call("POST", "/api/bookings", booking);
  const id = r.data && r.data.id;
  check("create booking", r.status === 201 && /^HML-/.test(id), id);

  r = await call("POST", "/api/bookings", booking);
  check("same request again returns the same booking", r.status === 200 && r.data.id === id);

  r = await call("GET", "/api/bookings/" + id);
  check("read booking back", r.status === 200 && r.data.pgName === "Stanza Living Shanghai House");

  r = await call("POST", "/api/bookings", { requestId: "bad", pgId: 206, roomTypeId: 9, fullName: "x", phone: "1", email: "nope", moveInDate: "" });
  check("bad details are refused", r.status === 400);

  r = await call("POST", "/api/bookings", Object.assign({}, booking, { requestId: "smoke-unknown-price-" + Date.now(), pgId: 213, roomTypeId: 25 }));
  check("room with unknown price is refused", r.status === 409);

  r = await call("GET", "/api/pgs/206/photos");
  check("photos endpoint answers", r.status === 200 && !!r.data.status, "status: " + (r.data && r.data.status));

  console.log(failures === 0 ? "\nAll checks passed." : "\n" + failures + " check(s) failed.");
  process.exit(failures === 0 ? 0 : 1);
})().catch(function (e) { console.error("Could not reach " + base + ": " + e.message); process.exit(1); });
