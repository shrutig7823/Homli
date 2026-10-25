// cors.js: browsers block a website from calling another address unless that address says "this website is allowed".
// ALLOWED_ORIGINS (comma separated) is the allow-list. Anything else gets no permission header.
function cors() {
  const allowed = (process.env.ALLOWED_ORIGINS || "http://localhost:8123,https://shrutig7823.github.io")
    .split(",").map(function (s) { return s.trim(); });
  return function (req, res, next) {
    const origin = req.headers.origin;
    if (origin && allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);   // the browser's "may I?" pre-check
    next();
  };
}

module.exports = cors;
