import { neon } from "@neondatabase/serverless";
import fs from "node:fs";

const url = process.argv[2];
if (!url) {
  console.error("Uso: node scripts/setup-db.mjs 'postgresql://TU_CADENA_DE_CONEXION'");
  process.exit(1);
}

const sql = neon(url);
const schema = fs.readFileSync("db/schema.sql", "utf8");

const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("--"));

try {
  for (const stmt of statements) {
    await sql(stmt);
    console.log("OK ->", stmt.split("\n")[0]);
  }
  console.log("TABLAS CREADAS OK");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
