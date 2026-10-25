// seed.js: fills the empty database from seed.json (PGs, amenities, rooms, photos).
// seed.json is generated from the website's data file by:  npm run export-seed
const fs = require("fs");
const path = require("path");
const db = require("./connection");

const SEED_PATH = path.join(__dirname, "seed.json");

function readSeed() {
  if (!fs.existsSync(SEED_PATH)) throw new Error("seed.json is missing. Run: npm run export-seed");
  return JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
}

// Fill the tables, but only when they are empty. Returns true if it seeded.
async function seedIfEmpty() {
  const count = Number((await db.get("SELECT COUNT(*) AS n FROM pgs")).n);
  if (count > 0) return false;
  const seed = readSeed();

  await db.tx(async function (t) {   // one transaction: either everything is saved, or nothing
    for (const p of seed.pgs) {
      await t.run(`INSERT INTO pgs (id, name, area, area_key, gender, gender_key, deposit, lock_in, source_type, source_url, notes, lat, lng)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.name, p.area, p.areaKey, p.gender, p.genderKey, p.deposit, p.lockIn, p.sourceType, p.sourceUrl, p.notes, p.lat, p.lng]);
      for (const name of Object.keys(p.amenities)) {
        await t.run("INSERT INTO amenities (pg_id, name, status) VALUES (?, ?, ?)", [p.id, name, p.amenities[name]]);
      }
    }
    for (const r of seed.rooms) {
      await t.run(`INSERT INTO rooms (id, pg_id, occupancy_type, label, monthly_rent, rent_max, price_kind, inclusions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.pgId, r.occupancyType, r.label, r.monthlyRent, r.rentMax, r.priceKind, JSON.stringify(r.inclusions || [])]);
    }
    let photoId = 0;
    for (const pgId of Object.keys(seed.photos || {})) {
      let position = 0;
      for (const ph of seed.photos[pgId]) {
        photoId += 1;
        await t.run("INSERT INTO photos (id, pg_id, file, credit, position) VALUES (?, ?, ?, ?, ?)", [photoId, Number(pgId), ph.file, ph.credit, position]);
        position += 1;
      }
    }
  });
  return true;
}

// Create the tables, then seed them if empty. Called once when the server starts.
async function init() {
  await db.createTables();
  return seedIfEmpty();
}

module.exports = { init: init, seedIfEmpty: seedIfEmpty, readSeed: readSeed };
