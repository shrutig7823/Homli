// bookingController.js: POST and GET for demo bookings. (Validation already happened in the middleware.)
const bookingService = require("../services/bookingService");

// POST /api/bookings
async function create(req, res) {
  const result = await bookingService.createBooking(req.body);
  res.status(result.status).json(result.body);
}

// GET /api/bookings/:id
async function getOne(req, res) {
  const booking = await bookingService.getBooking(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  res.json(booking);
}

module.exports = { create: create, getOne: getOne };
