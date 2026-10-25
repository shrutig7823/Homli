// catalogService.js: builds the "catalog" (PGs with their rooms and photos) from the models,
// and shapes each PG the way the website wants it.
const pgModel = require("../models/pgModel");
const roomTypeModel = require("../models/roomTypeModel");
const photoModel = require("../models/photoModel");

async function loadCatalog() {
  const [pgs, rooms, photos] = await Promise.all([pgModel.listAll(), roomTypeModel.listAll(), photoModel.listAll()]);
  pgs.forEach(function (pg) {
    pg.photos = photos.filter(function (p) { return p.pgId === pg.id; }).map(function (p) { return { file: p.file, credit: p.credit }; });
  });
  const roomsOf = function (pgId) { return rooms.filter(function (r) { return r.pgId === pgId; }); };
  return { pgs: pgs, rooms: rooms, roomsOf: roomsOf };
}

// A PG plus its rooms, plus the "starting" room: the cheapest one whose price we actually know.
function summarise(pg, rooms) {
  const priced = rooms.filter(function (r) { return r.monthlyRent != null; });
  const cheapest = priced.slice().sort(function (a, b) { return a.monthlyRent - b.monthlyRent; })[0] || null;
  return Object.assign({}, pg, { rooms: rooms, startingRoom: cheapest, rent: cheapest ? cheapest.monthlyRent : null });
}

module.exports = { loadCatalog: loadCatalog, summarise: summarise };
