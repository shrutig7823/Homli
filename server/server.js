// server.js: starts the Homli API. This file only wires things together; the work happens in the other folders.
//   request -> middleware (cors, log, read JSON) -> route -> [validate] -> controller -> service -> model -> database
//   run with:  npm start      (from the project root, or from this folder)
const fs = require("fs");
const path = require("path");
const express = require("express");

// Secrets live in a .env file (never committed), or in the host's environment variables when deployed.
const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const cors = require("./middleware/cors");
const requestLogger = require("./middleware/requestLogger");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const pgRoutes = require("./routes/pgRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const photoRoutes = require("./routes/photoRoutes");
const seed = require("./db/seed");
const db = require("./db/connection");

const app = express();
app.set("trust proxy", 1);                    // behind the host's proxy, so the real client address is used
app.use(cors());
app.use(requestLogger);
app.use(express.json({ limit: "20kb" }));     // read JSON bodies, refuse huge ones

app.use("/api", pgRoutes);
app.use("/api", bookingRoutes);
app.use("/api", photoRoutes);

app.use(notFound);
app.use(errorHandler);

// Create the tables (and fill them if empty), then listen for requests.
async function start(port) {
  const seeded = await seed.init();
  if (seeded) console.log("Database was empty: filled it from seed.json");
  return new Promise(function (resolve) {
    const server = app.listen(port, function () {
      console.log("Homli API running on port " + server.address().port + " (database: " + db.engine + ")");
      resolve(server);
    });
  });
}

if (require.main === module) {
  start(process.env.PORT || 3000).catch(function (e) { console.error("Could not start:", e.message); process.exit(1); });
}

module.exports = { app: app, start: start };
