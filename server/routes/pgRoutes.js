// pgRoutes.js: the web addresses for finding PGs. Each line: method + address -> controller function.
const express = require("express");
const { wrap } = require("../middleware/errorHandler");
const pg = require("../controllers/pgController");

const router = express.Router();
router.get("/health", wrap(pg.health));
router.get("/pgs", wrap(pg.list));
router.get("/pgs/:id", wrap(pg.getOne));
router.get("/search", wrap(pg.search));

module.exports = router;
