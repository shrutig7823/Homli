// errorHandler.js: one place that turns problems into clean JSON answers.

// Express 4 does not catch errors thrown inside async routes. This wrapper does and passes them on.
function wrap(handler) {
  return function (req, res, next) { Promise.resolve(handler(req, res, next)).catch(next); };
}

// Anything that matched no route.
function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

// Any error thrown in a route lands here. We log the details for the developer and show the visitor nothing sensitive.
function errorHandler(err, req, res, next) {
  console.error("Server error on", req.method, req.originalUrl, "-", err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Something went wrong on our side.", code: "SERVER" });
}

module.exports = { wrap: wrap, notFound: notFound, errorHandler: errorHandler };
