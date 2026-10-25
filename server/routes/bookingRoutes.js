// bookingRoutes.js: the web addresses for demo bookings.
const express = require("express");
const { wrap } = require("../middleware/errorHandler");
const { validateBooking } = require("../middleware/validateRequest");
const booking = require("../controllers/bookingController");

const router = express.Router();
router.post("/bookings", validateBooking, wrap(booking.create));   // validate first, then create
router.get("/bookings/:id", wrap(booking.getOne));

module.exports = router;
