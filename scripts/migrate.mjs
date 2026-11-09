// Creates all tables and seed data in the MySQL database from DATABASE_URL.
import "dotenv/config";
import fs from "node:fs";
import mysql from "mysql2/promise";

const sql = fs.readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
await conn.query(sql);
await conn.end();
console.log("Database ready.");
