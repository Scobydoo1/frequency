/* Runs migrations/*.sql against DATABASE_URL, in filename order.
 * Usage: node migrate.js (called from `npm run migrate` and on Render deploy). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const pool = getPool();
  if (!pool) {
    // No database configured yet — the API still runs in degraded (seeds-only,
    // no accounts) mode, so this isn't fatal. Add DATABASE_URL and redeploy.
    console.log("DATABASE_URL not set — skipping migrations, API will run in degraded mode.");
    return;
  }
  const dir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    console.log("running migration:", f);
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    await pool.query(sql);
  }
  console.log("migrations complete.");
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
