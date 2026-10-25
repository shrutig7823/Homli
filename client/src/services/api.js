// api.js: the FAKE server.
// Each function is async (it returns a promise) and waits a moment, like a real network call.
// In V2 these same functions will call a real backend with fetch(), and the pages will not need to change.
//
// To test the error states, add &fail=1 to the address, for example #/search?location=HSR&fail=1

// ---------- helpers ----------
function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function randomDelay() { return 350 + Math.floor(Math.random() * 350); }

// Match what the user typed to one of our known areas. "hsr" finds "HSR Layout", "green glen" finds "Bellandur".
function findArea(text) {
  const t = String(text || "").trim().toLowerCase();
  if (t.length < 2) return null;
  return AREAS.find(function (a) {
    const names = [a.name.toLowerCase()].concat(a.aliases);
    return names.some(function (n) { return n.includes(t) || t.includes(n); });
  }) || null;
}

// The upper end of a room's price (Infinity for "from" prices, which have no upper limit).
function rentHigh(r) {
  if (r.priceKind === "from") return Infinity;
  return r.rentMax || r.monthlyRent;
}

// Does this room fit the budget? Unknown prices never match a budget, because we cannot confirm them.
function roomFitsBudget(r, min, max) {
  if (r.monthlyRent == null) return false;
  return r.monthlyRent <= max && rentHigh(r) >= min;
}

// Turn a PG plus the facts around it into the shape the pages want.
function summarise(pg, rooms) {
  // The "starting" room is the cheapest room whose price we know. If no price is known, it is null.
  const priced = rooms.filter(function (r) { return r.monthlyRent != null; });
  const cheapest = priced.slice().sort(function (a, b) { return a.monthlyRent - b.monthlyRent; })[0] || null;
  return {
    id: pg.id, name: pg.name, area: pg.area, areaKey: pg.areaKey, gender: pg.gender, genderKey: pg.genderKey, deposit: pg.deposit, lockIn: pg.lockIn,
    sourceType: pg.sourceType, sourceUrl: pg.sourceUrl, notes: pg.notes, amenities: pg.amenities,
    googlePlaceId: pg.googlePlaceId, loc: pg.loc,
    rooms: rooms,
    startingRoom: cheapest,
    rent: cheapest ? cheapest.monthlyRent : null
  };
}

function roomsOf(pgId) { return ROOM_TYPES.filter(function (r) { return r.pgId === pgId; }); }

// ---------- the "endpoints" ----------

// Like GET /api/pgs?q=...&minRent=...&maxRent=...&roomType=...&gender=...&amenities=...
// "q" is free text: an area, a PG name, or what the user needs ("AC under 20k in Bellandur").
// The text is parsed (see search.js) and combined with the filters chosen on the page.
async function fakeApiSearchPgs(filters) {
  await wait(randomDelay());
  if (filters.fail) throw new Error("Simulated server error");

  const parsed = parseQuery(filters.q);
  // Rules from the text and from the filter controls are combined. The controls win when both are set.
  const min = Number(filters.minRent) || parsed.minRent || 0;
  const max = Number(filters.maxRent) || parsed.maxRent || Infinity;
  const roomKey = (filters.roomType && filters.roomType !== "any") ? filters.roomType : parsed.roomType;
  const wanted = roomKey ? (ROOM_FILTERS.find(function (r) { return r[0] === roomKey; }) || [])[2] : null;
  const gender = (filters.gender && filters.gender !== "any") ? filters.gender : parsed.gender;
  const mustHave = (filters.amenities || []).concat(parsed.amenities.filter(function (x) { return (filters.amenities || []).indexOf(x) < 0; }));
  const budgetSet = min > 0 || max < Infinity;
  const hasText = parsed.words.length > 0;
  const nothingUnderstood = !parsed.area && !hasText && !gender && !wanted && !budgetSet && mustHave.length === 0 && !parsed.cheap;

  const results = [];
  if (!nothingUnderstood) {
    PGS.forEach(function (pg) {
      if (parsed.area && pg.areaKey !== parsed.area.name) return;
      if (gender && pg.genderKey !== gender) return;     // "unknown" never matches a specific choice
      const rooms = roomsOf(pg.id).filter(function (r) {
        return (!wanted || r.occupancyType === wanted) && (!budgetSet || roomFitsBudget(r, min, max));
      });
      if (rooms.length === 0) return;
      if (!mustHave.every(function (x) { return pg.amenities[x] === "y"; })) return;
      const score = scorePg(pg, parsed.words);
      if (hasText && score === 0) return;
      const item = summarise(pg, rooms);
      item.score = score;
      results.push(item);
    });
  }

  if (filters.sort === "rent" || parsed.cheap) {
    results.sort(function (a, b) { return (a.rent == null) - (b.rent == null) || a.rent - b.rent; });
  } else if (hasText) {
    results.sort(function (a, b) { return b.score - a.score; });
  }
  return { query: parsed, understood: !nothingUnderstood, results: results };
}

// Like GET /api/pgs (every PG): used for the "Stays for you" row on the home page.
async function fakeApiListPgs(query) {
  await wait(randomDelay());
  if (query && query.fail) throw new Error("Simulated server error");
  return PGS.map(function (pg) { return summarise(pg, roomsOf(pg.id)); });
}

// Like GET /api/pgs/:id. Returns null when there is no such PG (a "404").
async function fakeApiGetPg(id, query) {
  await wait(randomDelay());
  if (query && query.fail) throw new Error("Simulated server error");
  const pg = PGS.find(function (p) { return p.id === Number(id); });
  if (!pg) return null;
  const rooms = roomsOf(pg.id);
  return { pg: summarise(pg, rooms), rooms: rooms };
}

// Like GET /api/pgs?ids=201,204 (used by the shortlist and compare pages).
async function fakeApiGetPgsByIds(ids, query) {
  await wait(randomDelay());
  if (query && query.fail) throw new Error("Simulated server error");
  const items = [];
  ids.forEach(function (id) {
    const pg = PGS.find(function (p) { return p.id === id; });
    if (pg) items.push(summarise(pg, roomsOf(pg.id)));
  });
  return items;
}

// ---------- Google Places photos and reviews ----------
// Like GET /api/pgs/:id/photos on the backend (see pg-app-backend/). The backend holds the Google API key,
// finds the place, and returns photo links with the author credit, plus the Google rating and reviews.
// Set PHOTO_API_BASE in config.js to your backend address. While it is empty the page shows
// "Photos coming soon" and "Reviews from Google Maps are not connected yet".
// Possible status values: "found", "no_photos", "place_id_needs_review", "api_error", "not_configured".
const photoCache = {};
async function apiGetPgPhotos(pgId) {
  if (photoCache[pgId]) return photoCache[pgId];
  if (!PHOTO_API_BASE) return { status: "not_configured", photos: [], rating: null, reviewCount: 0, reviews: [] };
  try {
    const res = await fetch(PHOTO_API_BASE + "/api/pgs/" + pgId + "/photos");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    photoCache[pgId] = data;   // kept only in memory for this visit; photo links are never saved permanently
    return data;
  } catch (e) {
    return { status: "api_error", photos: [], rating: null, reviewCount: 0, reviews: [] };
  }
}

// Like POST /api/bookings. Validates, checks the room, and saves the booking.
async function fakeApiCreateBooking(payload, query) {
  await wait(900);
  if (query && query.fail) throw new Error("Simulated server error");

  // 1. Validate again on the "server" (never trust only the browser).
  const problems = [];
  if (!payload.fullName || payload.fullName.trim().length < 2) problems.push("name");
  if (!/^[6-9]\d{9}$/.test(payload.phone || "")) problems.push("phone");
  if (!/^\S+@\S+\.\S+$/.test(payload.email || "")) problems.push("email");
  if (!payload.moveInDate) problems.push("moveInDate");
  if (problems.length) {
    const err = new Error("Invalid details: " + problems.join(", "));
    err.code = "VALIDATION";
    throw err;
  }

  // 2. Make sure the PG and room exist and the room can be booked.
  const roomType = ROOM_TYPES.find(function (r) { return r.id === payload.roomTypeId && r.pgId === payload.pgId; });
  if (!roomType) { const e = new Error("This room option is no longer available."); e.code = "ROOM_GONE"; throw e; }
  if (roomType.monthlyRent == null) { const e = new Error("The price for this room is still being verified."); e.code = "ROOM_GONE"; throw e; }

  // 3. Protect against double submission: the same requestId gives back the same booking.
  const bookings = Store.getBookings();
  const existing = bookings.find(function (b) { return b.requestId === payload.requestId; });
  if (existing) return existing;

  // 4. Create the booking. We save a SNAPSHOT of the price, so a later price change cannot alter it.
  const booking = {
    id: "HML-" + (100000 + bookings.length + 1),
    requestId: payload.requestId,
    pgId: payload.pgId,
    roomTypeId: payload.roomTypeId,
    pgName: payload.pgName,
    roomLabel: payload.roomLabel,
    fullName: payload.fullName.trim(),
    phone: payload.phone,
    email: payload.email,
    moveInDate: payload.moveInDate,
    expectedDuration: payload.expectedDuration,
    note: payload.note || "",
    priceSnapshot: payload.priceLabel,
    depositSnapshot: payload.deposit,
    status: "confirmed",
    createdAt: new Date().toISOString()
  };
  bookings.push(booking);
  Store.saveBookings(bookings);
  return booking;
}

// Like GET /api/bookings/:id
async function fakeApiGetBooking(id) {
  await wait(randomDelay());
  return Store.getBookings().find(function (b) { return b.id === id; }) || null;
}


// ======================================================================
// REAL API (calls the backend in pg-app-backend/ when API_BASE is set)
// ======================================================================
// One helper for every request. It turns HTTP errors into JavaScript errors the pages already understand.
async function http(path, options) {
  let res;
  // A free host "goes to sleep" when nobody uses it, and takes up to a minute to wake up. We wait for that, but not forever.
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 70000);
  try {
    res = await fetch(API_BASE + path, Object.assign({}, options, { signal: controller.signal }));
  } catch (e) {
    throw new Error("Could not reach the server");   // the backend is off, asleep for too long, or the address is wrong
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* no JSON body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || "Request failed");
    err.code = data && data.code; err.status = res.status;
    throw err;
  }
  return data;
}
function simulatedFail(query) { if (query && query.fail) throw new Error("Simulated server error"); }

// ======================================================================
// The functions the pages call. Each one picks the real backend or the fake one.
// ======================================================================
async function apiSearchPgs(filters) {
  if (!API_BASE) return fakeApiSearchPgs(filters);
  simulatedFail(filters);
  const q = new URLSearchParams();
  if (filters.q) q.set("q", filters.q);
  if (filters.minRent) q.set("minRent", filters.minRent);
  if (filters.maxRent) q.set("maxRent", filters.maxRent);
  if (filters.roomType && filters.roomType !== "any") q.set("roomType", filters.roomType);
  if (filters.gender && filters.gender !== "any") q.set("gender", filters.gender);
  if (filters.amenities && filters.amenities.length) q.set("amenities", filters.amenities.join(","));
  if (filters.sort) q.set("sort", filters.sort);
  return http("/api/search?" + q.toString());
}
async function apiListPgs(query) {
  if (!API_BASE) return fakeApiListPgs(query);
  simulatedFail(query);
  return http("/api/pgs");
}
async function apiGetPg(id, query) {
  if (!API_BASE) return fakeApiGetPg(id, query);
  simulatedFail(query);
  try { return await http("/api/pgs/" + encodeURIComponent(id)); }
  catch (e) { if (e.status === 404) return null; throw e; }   // 404 means "no such PG", not a crash
}
async function apiGetPgsByIds(ids, query) {
  if (!API_BASE) return fakeApiGetPgsByIds(ids, query);
  simulatedFail(query);
  if (!ids.length) return [];
  return http("/api/pgs?ids=" + ids.join(","));
}
async function apiCreateBooking(payload, query) {
  if (!API_BASE) return fakeApiCreateBooking(payload, query);
  simulatedFail(query);
  return http("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
async function apiGetBooking(id) {
  if (!API_BASE) return fakeApiGetBooking(id);
  try { return await http("/api/bookings/" + encodeURIComponent(id)); }
  catch (e) { if (e.status === 404) return null; throw e; }
}
