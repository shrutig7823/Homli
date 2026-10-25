// roomTypeModel.js: the room options of PGs.
const db = require("../db/connection");

function toRoom(r) {
  return {
    id: Number(r.id), pgId: Number(r.pg_id), occupancyType: r.occupancy_type, label: r.label,
    monthlyRent: r.monthly_rent == null ? null : Number(r.monthly_rent),
    rentMax: r.rent_max == null ? null : Number(r.rent_max),
    priceKind: r.price_kind, inclusions: JSON.parse(r.inclusions)
  };
}

async function listAll() {
  return (await db.all("SELECT * FROM rooms ORDER BY id")).map(toRoom);
}

// One room, but only if it belongs to that PG. Returns undefined if not found.
async function findForPg(roomId, pgId) {
  const row = await db.get("SELECT * FROM rooms WHERE id = ? AND pg_id = ?", [roomId, pgId]);
  return row ? toRoom(row) : undefined;
}

module.exports = { listAll: listAll, findForPg: findForPg };
