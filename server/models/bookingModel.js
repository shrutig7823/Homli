// bookingModel.js: saving and reading demo bookings.
const db = require("../db/connection");

function toBooking(r) {
  return {
    id: r.id, requestId: r.request_id, pgId: Number(r.pg_id), roomTypeId: Number(r.room_type_id), pgName: r.pg_name,
    roomLabel: r.room_label, fullName: r.full_name, phone: r.phone, email: r.email, moveInDate: r.move_in_date,
    expectedDuration: r.expected_duration, note: r.note, priceSnapshot: r.price_snapshot, depositSnapshot: r.deposit_snapshot,
    status: r.status, createdAt: r.created_at
  };
}

async function findById(id) {
  const row = await db.get("SELECT * FROM bookings WHERE id = ?", [String(id)]);
  return row ? toBooking(row) : undefined;
}

async function findByRequestId(requestId) {
  const row = await db.get("SELECT * FROM bookings WHERE request_id = ?", [String(requestId)]);
  return row ? toBooking(row) : undefined;
}

async function count() {
  return Number((await db.get("SELECT COUNT(*) AS n FROM bookings")).n);
}

async function insert(b) {
  await db.run(`INSERT INTO bookings
    (id, request_id, pg_id, room_type_id, pg_name, room_label, full_name, phone, email, move_in_date, expected_duration, note,
     price_snapshot, deposit_snapshot, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.id, b.requestId, b.pgId, b.roomTypeId, b.pgName, b.roomLabel, b.fullName, b.phone, b.email, b.moveInDate,
      b.expectedDuration, b.note, b.priceSnapshot, b.depositSnapshot, b.status, b.createdAt]);
}

module.exports = { findById: findById, findByRequestId: findByRequestId, count: count, insert: insert };
