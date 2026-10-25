// photoRoutes.js: the web address for Google photos and reviews.
const express = require("express");
const { wrap } = require("../middleware/errorHandler");
const photo = require("../controllers/photoController");

const router = express.Router();
router.get("/pgs/:id/photos", wrap(photo.getPhotos));

module.exports = router;
