// reseed.js: wipe the PG tables and fill them again from seed.json.
// It refuses to run if bookings exist (they point at PGs and rooms), so use a fresh database in that case.
const fs = require("fs");
const path = require("path");
const envFile = path.join(__dirname, "..", "..", ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const db = require("../db/connection");
const seed = require("../db/seed");

(async function () {
  await db.createTables();
  const b = await db.get("SELECT COUNT(*) AS n FROM bookings");
  if (Number(b.n) > 0) { console.error("There are bookings in this database, so the PG tables cannot be wiped. Use a fresh database."); process.exit(1); }
  for (const table of ["photos", "amenities", "rooms", "pgs"]) await db.run("DELETE FROM " + table);
  await seed.seedIfEmpty();
  console.log("Reseeded from seed.json (" + db.engine + ")");
  process.exit(0);
})().catch(function (e) { console.error(e.message); process.exit(1); });
