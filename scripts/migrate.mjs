// Creates all tables and seed data in the MySQL database from DATABASE_URL.
// Safe to run again on an existing install: it only adds what is missing.
import "dotenv/config";
import fs from "node:fs";
import mysql from "mysql2/promise";

const sql = fs.readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
await conn.query(sql);
const upgrade = fs.readFileSync(new URL("../database/upgrade-v5.sql", import.meta.url), "utf8");
for (const m of upgrade.matchAll(/ALTER TABLE (\w+) ADD COLUMN (\w+) ([^;]+);/g)) {
  const [, table, col, def] = m;
  const [rows] = await conn.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?", [table, col]);
  if (!rows.length) { await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`); console.log(`Added ${table}.${col}`); }
}
const [loginColumn] = await conn.query("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='last_sign_in_at'");
if (!loginColumn.length) await conn.query("ALTER TABLE users ADD COLUMN last_sign_in_at DATETIME(3) NULL");
await conn.query(fs.readFileSync(new URL("../database/upgrade-v6.sql", import.meta.url), "utf8"));
const v7 = fs.readFileSync(new URL("../database/upgrade-v7.sql", import.meta.url), "utf8");
for (const m of v7.matchAll(/ALTER TABLE (\w+) ADD COLUMN (\w+) ([^;]+);/g)) {
  const [, table, col, def] = m;
  const [rows] = await conn.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?", [table, col]);
  if (!rows.length) { await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`); console.log(`Added ${table}.${col}`); }
}
for (const m of v7.matchAll(/ALTER TABLE (\w+) MODIFY COLUMN ([^;]+);/g)) {
  await conn.query(`ALTER TABLE \`${m[1]}\` MODIFY COLUMN ${m[2]}`);
}
await conn.query(v7.match(/CREATE TABLE IF NOT EXISTS extraction_items[\s\S]*?ENGINE=[^;]+;/)?.[0] ?? "SELECT 1");
const triggerSql = fs.readFileSync(new URL("../database/audit-triggers.sql", import.meta.url), "utf8");
for (const statement of triggerSql.split(";").filter(s => s.trim())) {
 const name = statement.match(/CREATE TRIGGER (\w+)/)?.[1];
 const [exists] = await conn.query("SELECT 1 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME=?", [name]);
 if (!exists.length) await conn.query(statement);
}
await conn.end();
console.log("Database ready.");
