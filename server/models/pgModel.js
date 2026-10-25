// pgModel.js: everything the app asks the database about PGs. Models are the only files that write SQL.
const db = require("../db/connection");

// Every PG, with its amenities, as plain objects.
async function listAll() {
  const amenityRows = await db.all("SELECT pg_id, name, status FROM amenities");
  const pgRows = await db.all("SELECT * FROM pgs ORDER BY id");
  return pgRows.map(function (p) {
    const amenities = {};
    amenityRows.filter(function (a) { return Number(a.pg_id) === Number(p.id); }).forEach(function (a) { amenities[a.name] = a.status; });
    return {
      id: Number(p.id), name: p.name, area: p.area, areaKey: p.area_key, gender: p.gender, genderKey: p.gender_key,
      deposit: p.deposit, lockIn: p.lock_in, sourceType: p.source_type, sourceUrl: p.source_url, notes: p.notes,
      amenities: amenities, googlePlaceId: p.google_place_id, loc: { lat: Number(p.lat), lng: Number(p.lng) }
    };
  });
}

async function count() {
  return Number((await db.get("SELECT COUNT(*) AS n FROM pgs")).n);
}

// Remember the Google place id (Google allows storing place ids, but not photos).
async function setGooglePlaceId(pgId, placeId) {
  await db.run("UPDATE pgs SET google_place_id = ? WHERE id = ?", [placeId, pgId]);
}

module.exports = { listAll: listAll, count: count, setGooglePlaceId: setGooglePlaceId };
