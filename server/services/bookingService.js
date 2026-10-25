// bookingService.js: the rules for demo bookings. (Nothing is sent to any PG, and no payment is taken.)
const bookingModel = require("../models/bookingModel");
const roomTypeModel = require("../models/roomTypeModel");
const pgModel = require("../models/pgModel");

// The price text saved with a booking is worked out HERE from the room, never taken from the browser.
// (If we trusted the browser, someone could send a fake price.)
function priceLabel(room) {
  const fmt = function (n) { return "₹" + Number(n).toLocaleString("en-IN"); };
  if (room.priceKind === "range") return fmt(room.monthlyRent) + "–" + fmt(room.rentMax);
  if (room.priceKind === "from") return "From " + fmt(room.monthlyRent);
  return fmt(room.monthlyRent);
}

// Check the details. Returns a list of the fields that are wrong (empty list = all good).
// This runs on the SERVER even though the website also checks: never trust only the browser.
function findProblems(b) {
  const problems = [];
  if (!b.fullName || String(b.fullName).trim().length < 2) problems.push("name");
  if (!/^[6-9]\d{9}$/.test(b.phone || "")) problems.push("phone");
  if (!/^\S+@\S+\.\S+$/.test(b.email || "")) problems.push("email");
  if (!b.moveInDate) problems.push("moveInDate");
  if (!b.requestId) problems.push("requestId");
  return problems;
}

// Create a booking. Returns { status, body } so the controller only has to send it.
async function createBooking(b) {
  // 1. The room must exist, belong to that PG, and have a known price.
  const room = await roomTypeModel.findForPg(Number(b.roomTypeId), Number(b.pgId));
  if (!room) return { status: 409, body: { error: "This room option is no longer available.", code: "ROOM_GONE" } };
  if (room.monthlyRent == null) return { status: 409, body: { error: "The price for this room is still being verified.", code: "ROOM_GONE" } };

  // 2. Duplicate-submission protection: the same requestId always gives back the same booking.
  const existing = await bookingModel.findByRequestId(b.requestId);
  if (existing) return { status: 200, body: existing };

  // 3. Save it. The price and deposit are stored as a SNAPSHOT, so a later change cannot alter this booking.
  const pg = (await pgModel.listAll()).find(function (p) { return p.id === room.pgId; });
  const id = "HML-" + (100001 + await bookingModel.count());
  await bookingModel.insert({
    id: id, requestId: String(b.requestId), pgId: pg.id, roomTypeId: room.id, pgName: pg.name, roomLabel: room.label,
    fullName: String(b.fullName).trim(), phone: b.phone, email: b.email, moveInDate: b.moveInDate,
    expectedDuration: b.expectedDuration || "", note: b.note || "", priceSnapshot: priceLabel(room),
    depositSnapshot: String(pg.deposit), status: "confirmed", createdAt: new Date().toISOString()
  });
  return { status: 201, body: await bookingModel.findById(id) };
}

async function getBooking(id) { return bookingModel.findById(id); }

module.exports = { priceLabel: priceLabel, findProblems: findProblems, createBooking: createBooking, getBooking: getBooking };
