import "dotenv/config";
import { createUser, setPassword } from "../server/admin-client.js";
import { pool } from "../server/db.js";
const [email, password, name = "Super Admin"] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- email "password(8+ chars)" "Full Name"');
  process.exit(1);
}
const [rows] = await pool.query("SELECT id FROM users WHERE email=?", [email.toLowerCase()]);
const id = rows[0]?.id ?? await createUser(email, password, name);
if (rows[0]) await setPassword(id, password);
await pool.query("INSERT IGNORE INTO user_roles (id,user_id,role) VALUES (?,?, 'super_admin')", [crypto.randomUUID(), id]);
console.log(`Super Admin ready: ${email}`);
await pool.end();
