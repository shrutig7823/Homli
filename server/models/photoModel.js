// photoModel.js: photos used with the PG's permission (file name plus credit).
const db = require("../db/connection");

async function listAll() {
  const rows = await db.all("SELECT pg_id, file, credit FROM photos ORDER BY pg_id, position");
  return rows.map(function (r) { return { pgId: Number(r.pg_id), file: r.file, credit: r.credit }; });
}

module.exports = { listAll: listAll };
