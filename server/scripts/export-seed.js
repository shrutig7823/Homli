// export-seed.js: turns the website's data file into seed.json, the starting data for the database.
// Run:  npm run export-seed      (run it again whenever you edit client/src/data/data.js)
// data.js is plain browser JavaScript, so we run it inside a sandbox ("vm") and pick out the values we need.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.join(__dirname, "..", "..", "client", "src", "data", "data.js"), "utf8");
const data = vm.runInNewContext(
  code + "\n;({ AREAS, AMENITIES, PGS, ROOM_TYPES, NEAR_PLACES, SOURCE_LABELS, LOCAL_PHOTOS })"
);

const seed = {
  areas: data.AREAS,
  amenities: data.AMENITIES,
  sourceLabels: data.SOURCE_LABELS,
  nearPlaces: data.NEAR_PLACES,
  pgs: data.PGS.map(function (p) {
    return {
      id: p.id, name: p.name, area: p.area, areaKey: p.areaKey, gender: p.gender, genderKey: p.genderKey,
      deposit: p.deposit, lockIn: p.lockIn, sourceType: p.sourceType, sourceUrl: p.sourceUrl, notes: p.notes,
      amenities: p.amenities, lat: p.loc.lat, lng: p.loc.lng
    };
  }),
  rooms: data.ROOM_TYPES,
  photos: data.LOCAL_PHOTOS
};
fs.writeFileSync(path.join(__dirname, "..", "db", "seed.json"), JSON.stringify(seed, null, 2));
console.log("seed.json written:", seed.pgs.length, "PGs,", seed.rooms.length, "rooms,", Object.keys(seed.photos).length, "PGs with photos");
