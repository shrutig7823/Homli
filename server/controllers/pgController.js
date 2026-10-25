// pgController.js: receives a request about PGs, calls the service, sends the answer. Controllers stay thin.
const pgService = require("../services/pgService");
const pgModel = require("../models/pgModel");
const db = require("../db/connection");

// GET /api/health: is the server alive, and can it reach the database?
async function health(req, res) {
  res.json({ ok: true, database: db.engine, pgs: await pgModel.count() });
}

// GET /api/pgs  or  GET /api/pgs?ids=201,204
async function list(req, res) {
  res.json(await pgService.listPgs(req.query.ids));
}

// GET /api/pgs/:id   (404 when there is no such PG)
async function getOne(req, res) {
  const result = await pgService.getPg(req.params.id);
  if (!result) return res.status(404).json({ error: "PG not found" });
  res.json(result);
}

// GET /api/search?q=...&minRent=&maxRent=&roomType=&gender=&amenities=&sort=
async function search(req, res) {
  res.json(await pgService.searchPgs(req.query));
}

module.exports = { health: health, list: list, getOne: getOne, search: search };
