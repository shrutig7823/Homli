// requestLogger.js: prints one line per request, so you can watch what the website asks for.
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", function () {
    if (process.env.NODE_ENV === "test") return;
    console.log(req.method, req.originalUrl, res.statusCode, (Date.now() - start) + "ms");
  });
  next();
}

module.exports = requestLogger;
