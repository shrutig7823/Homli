// connection.js: connects to the database and gives the rest of the app four simple functions.
// Three possible engines underneath (the rest of the app never needs to know which):
//   1. Hosted Postgres  -> when DATABASE_URL is set (what runs when deployed)
//   2. SQLite file      -> the default on your laptop (no setup, one file: server/homli.db)
//   3. PGlite           -> a Postgres engine inside Node, used only by the tests (USE_PGLITE=1)
//
//   all(sql, params)  every matching row      get(sql, params)  the first row, or undefined
//   run(sql, params)  INSERT / UPDATE / DELETE   tx(fn)        a transaction: all or nothing
const fs = require("fs");
const path = require("path");

let engine;
let client;
if (process.env.DATABASE_URL) {
  const { Pool } = require("pg");
  engine = "postgres";
  // Hosted databases (Neon, Supabase) require an encrypted connection.
  client = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "off" ? false : { rejectUnauthorized: false },
    max: 5
  });
} else if (process.env.USE_PGLITE) {
  const { PGlite } = require("@electric-sql/pglite");
  engine = "pglite";
  client = new PGlite();
} else {
  const { DatabaseSync } = require("node:sqlite");   // loaded only here, so a Postgres deploy does not need it
  engine = "sqlite";
  client = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, "..", "homli.db"));
}

// SQL is written once with "?" placeholders. Postgres wants $1, $2, ... so we convert for it.
// Text inside single quotes (like the '?' in a table rule) is left alone.
function toPg(sql) {
  let i = 0;
  return sql.split(/('(?:[^']|'')*')/).map(function (part, index) {
    return index % 2 === 1 ? part : part.replace(/\?/g, function () { i += 1; return "$" + i; });
  }).join("");
}

function makeRunner(exec) {
  async function all(sql, params) { return exec(sql, params || []); }
  async function get(sql, params) { return (await all(sql, params))[0]; }
  async function run(sql, params) { await exec(sql, params || []); }
  return { all: all, get: get, run: run };
}

const baseExec = engine === "sqlite"
  ? async function (sql, params) { return client.prepare(sql).all(...params); }
  : async function (sql, params) { return (await client.query(toPg(sql), params)).rows; };
const base = makeRunner(baseExec);

async function tx(fn) {
  if (engine === "sqlite") {
    client.exec("BEGIN");
    try { const out = await fn(base); client.exec("COMMIT"); return out; }
    catch (e) { client.exec("ROLLBACK"); throw e; }
  }
  if (engine === "pglite") {
    return client.transaction(async function (t) {
      return fn(makeRunner(async function (sql, params) { return (await t.query(toPg(sql), params)).rows; }));
    });
  }
  const c = await client.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(makeRunner(async function (sql, params) { return (await c.query(toPg(sql), params)).rows; }));
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

// Create the tables from schema.sql (safe to run every start: "IF NOT EXISTS").
async function createTables() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const statements = sql.replace(/^--.*$/gm, "").split(/;\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  for (const statement of statements) await base.run(statement);
}

module.exports = { engine: engine, all: base.all, get: base.get, run: base.run, tx: tx, createTables: createTables };
