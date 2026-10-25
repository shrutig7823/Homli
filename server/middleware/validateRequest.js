// validateRequest.js: checks a request before the controller runs. Bad requests stop here with a 400.
const bookingService = require("../services/bookingService");

// POST /api/bookings: the details must be valid (name, phone, email, move-in date, request id).
function validateBooking(req, res, next) {
  const problems = bookingService.findProblems(req.body || {});
  if (problems.length) {
    return res.status(400).json({ error: "Invalid details: " + problems.join(", "), code: "VALIDATION" });
  }
  next();
}

module.exports = { validateBooking: validateBooking };
