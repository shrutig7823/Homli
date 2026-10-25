// pgService.js: the business rules for finding PGs: list, get one, and search.
const { readSeed } = require("../db/seed");
const { loadCatalog, summarise } = require("./catalogService");
const createSearch = require("./searchService");

const MAX_LIST = 50;
const ROOM_FILTERS = { private: "Private", sharing: "Sharing" };

// Reference lists (areas, amenity names) come from the seed file.
const seed = readSeed();

// Budget rules. A "range" price overlaps the budget if any part of it fits. A "from" price has no upper limit.
function rentHigh(r) { return r.priceKind === "from" ? Infinity : (r.rentMax || r.monthlyRent); }
function roomFitsBudget(r, min, max) { return r.monthlyRent != null && r.monthlyRent <= max && rentHigh(r) >= min; }

// All PGs, or only the ones with these ids (used by the shortlist and compare pages).
async function listPgs(idsText) {
  const catalog = await loadCatalog();
  let list = catalog.pgs;
  if (idsText) {
    const ids = String(idsText).split(",").map(Number).filter(Number.isInteger).slice(0, MAX_LIST);
    list = ids.map(function (id) { return catalog.pgs.find(function (p) { return p.id === id; }); }).filter(Boolean);
  }
  return list.map(function (pg) { return summarise(pg, catalog.roomsOf(pg.id)); });
}

// One PG with its rooms, or null when there is no such PG.
async function getPg(id) {
  const catalog = await loadCatalog();
  const pg = catalog.pgs.find(function (p) { return p.id === Number(id); });
  if (!pg) return null;
  const rooms = catalog.roomsOf(pg.id);
  return { pg: summarise(pg, rooms), rooms: rooms };
}

// Smart search. "q" is free text (an area, a PG name, or what the user needs). The text is parsed into rules
// and combined with the filters chosen on the page. Every rule must pass for a PG to appear.
async function searchPgs(f) {
  const catalog = await loadCatalog();
  const s = createSearch({ AREAS: seed.areas, AMENITIES: seed.amenities, SOURCE_LABELS: seed.sourceLabels, roomsOf: catalog.roomsOf });
  const parsed = s.parseQuery(f.q);

  const min = Number(f.minRent) || parsed.minRent || 0;
  const max = Number(f.maxRent) || parsed.maxRent || Infinity;
  const roomKey = (f.roomType && f.roomType !== "any") ? f.roomType : parsed.roomType;
  const wanted = roomKey ? ROOM_FILTERS[roomKey] : null;
  const gender = (f.gender && f.gender !== "any") ? f.gender : parsed.gender;
  const chosen = f.amenities ? String(f.amenities).split(",").filter(Boolean) : [];
  const mustHave = chosen.concat(parsed.amenities.filter(function (x) { return chosen.indexOf(x) < 0; }));
  const budgetSet = min > 0 || max < Infinity;
  const hasText = parsed.words.length > 0;
  const nothingUnderstood = !parsed.area && !hasText && !gender && !wanted && !budgetSet && mustHave.length === 0 && !parsed.cheap;

  const results = [];
  if (!nothingUnderstood) {
    catalog.pgs.forEach(function (pg) {
      if (parsed.area && pg.areaKey !== parsed.area.name) return;
      if (gender && pg.genderKey !== gender) return;                  // "unknown" never matches a specific choice
      const rooms = catalog.roomsOf(pg.id).filter(function (r) {
        return (!wanted || r.occupancyType === wanted) && (!budgetSet || roomFitsBudget(r, min, max));
      });
      if (rooms.length === 0) return;
      if (!mustHave.every(function (a) { return pg.amenities[a] === "y"; })) return;   // unknown does not count as yes
      const score = s.scorePg(pg, parsed.words);
      if (hasText && score === 0) return;
      const item = summarise(pg, rooms);
      item.score = score;
      results.push(item);
    });
  }
  if (f.sort === "rent" || parsed.cheap) {
    results.sort(function (a, b) { return (a.rent == null) - (b.rent == null) || a.rent - b.rent; });
  } else if (hasText) {
    results.sort(function (a, b) { return b.score - a.score; });
  }
  return { query: parsed, understood: !nothingUnderstood, results: results };
}

module.exports = { listPgs: listPgs, getPg: getPg, searchPgs: searchPgs, roomFitsBudget: roomFitsBudget };
