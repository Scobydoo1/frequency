/* Postgres connection (Neon). DATABASE_URL carries ?sslmode=require, which
 * node-postgres honors automatically from the connection string. */
import pg from "pg";

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error("DATABASE_URL not set");
  return p.query(text, params);
}
