// googlePlacesService.js: photos, rating and reviews from Google Places (API New).
//
// The flow for one PG:
//   1. Place ID lookup   Text Search with "PG name + area + Bengaluru" -> a Google place id (stored; Google allows ids)
//   2. Place Details     one request, asking only for the fields we need (a "field mask" keeps cost and data small)
//   3. Photo metadata    each photo has a name and the author's attribution
//   4. Photo URI fetch   /media returns a temporary link. These links are NEVER stored.
//   5. Fallbacks         no match -> "no_photos"; name mismatch -> "place_id_needs_review"; any failure -> "api_error"
// The API key comes from the environment (GOOGLE_MAPS_API_KEY). It never leaves the server.
const pgModel = require("../models/pgModel");

const PLACES = "https://places.googleapis.com/v1";
const CACHE_MS = 10 * 60 * 1000;
const cache = {};

function key() { return process.env.GOOGLE_MAPS_API_KEY; }
function isConfigured() { return !!key(); }

async function google(url, options) {
  const r = await fetch(url, options);
  if (!r.ok) throw new Error("Google responded " + r.status);
  return r.json();
}

// 1. Place ID lookup.
async function findPlaceId(pg) {
  if (pg.googlePlaceId) return pg.googlePlaceId;
  const data = await google(PLACES + "/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key(), "X-Goog-FieldMask": "places.id,places.displayName" },
    body: JSON.stringify({ textQuery: pg.name + " " + pg.area + " Bengaluru", maxResultCount: 1 })
  });
  const place = data.places && data.places[0];
  if (!place) return null;
  // Safety check: the first word of our name must appear in Google's name, otherwise a human should review the match.
  const gName = ((place.displayName && place.displayName.text) || "").toLowerCase();
  if (!gName.includes(pg.name.toLowerCase().split(/\s+/)[0])) return "NEEDS_REVIEW";
  await pgModel.setGooglePlaceId(pg.id, place.id);
  return place.id;
}

async function fetchFromGoogle(pg) {
  const empty = { photos: [], rating: null, reviewCount: 0, reviews: [] };
  const placeId = await findPlaceId(pg);
  if (!placeId) return Object.assign({ status: "no_photos" }, empty);
  if (placeId === "NEEDS_REVIEW") return Object.assign({ status: "place_id_needs_review" }, empty);

  // 2. Place Details.
  const d = await google(PLACES + "/places/" + placeId, {
    headers: { "X-Goog-Api-Key": key(), "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,reviews,photos" }
  });
  const reviews = (d.reviews || []).slice(0, 5).map(function (r) {
    return {
      author: r.authorAttribution ? r.authorAttribution.displayName : "A Google user", rating: r.rating,
      when: r.relativePublishTimeDescription || "", text: r.text ? r.text.text : ""
    };
  });
  // 3 and 4. Photo metadata, then a temporary link for up to 3 photos (card size and large size).
  const photos = [];
  for (const p of (d.photos || []).slice(0, 3)) {
    const base = PLACES + "/" + p.name + "/media?key=" + key() + "&skipHttpRedirect=true&maxWidthPx=";
    const small = await google(base + "800");
    const large = await google(base + "1600");
    const a = (p.authorAttributions && p.authorAttributions[0]) || {};
    photos.push({ url: small.photoUri, largeUrl: large.photoUri, author: a.displayName || "", authorUri: a.uri || "" });
  }
  return {
    status: photos.length ? "found" : "no_photos", photos: photos, rating: d.rating == null ? null : d.rating,
    reviewCount: d.userRatingCount || 0, reviews: reviews
  };
}

// The function the controller calls. Never throws: failures become status "api_error".
async function getPgPhotos(pg) {
  const empty = { photos: [], rating: null, reviewCount: 0, reviews: [] };
  if (!isConfigured()) return Object.assign({ status: "not_configured" }, empty);
  const cached = cache[pg.id];
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  try {
    const data = await fetchFromGoogle(pg);
    cache[pg.id] = { at: Date.now(), data: data };
    return data;
  } catch (e) {
    console.error("Google photo fetch failed for PG", pg.id, e.message);   // never print the key
    return Object.assign({ status: "api_error" }, empty);
  }
}

module.exports = { getPgPhotos: getPgPhotos, isConfigured: isConfigured };
