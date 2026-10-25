// photoController.js: GET /api/pgs/:id/photos -> Google photos, rating and reviews (with attribution).
const pgService = require("../services/pgService");
const googlePlaces = require("../services/googlePlacesService");

async function getPhotos(req, res) {
  const found = await pgService.getPg(req.params.id);
  if (!found) return res.status(404).json({ error: "PG not found" });
  res.json(await googlePlaces.getPgPhotos(found.pg));
}

module.exports = { getPhotos: getPhotos };
