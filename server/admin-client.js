import bcrypt from "bcryptjs";
import { dbClient, pool } from "./db.js";
async function createUser(email, password, fullName) {
  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(password, 12);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("INSERT INTO users (id,email,password_hash) VALUES (?,?,?)", [id, email.toLowerCase(), hash]);
    await conn.query("INSERT INTO profiles (id,email,full_name) VALUES (?,?,?)", [id, email.toLowerCase(), fullName]);
    await conn.query("INSERT INTO user_roles (id,user_id,role) VALUES (?,?, 'user')", [crypto.randomUUID(), id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    if (e?.code === "ER_DUP_ENTRY") throw new Error("A user with this email address has already been registered");
    throw e;
  } finally {
    conn.release();
  }
  return id;
}
async function setPassword(userId, password) {
  await pool.query("UPDATE users SET password_hash=? WHERE id=?", [await bcrypt.hash(password, 12), userId]);
}
const adminDb = {
  ...dbClient({ admin: true }),
  auth: {
    admin: {
      async createUser(o) {
        try {
          const id = await createUser(o.email, o.password, o.user_metadata?.full_name ?? "");
          return { data: { user: { id, email: o.email } }, error: null };
        } catch (e) {
          return { data: { user: null }, error: { message: e.message } };
        }
      },
      async getUserById(id) {
        const [rows] = await pool.query("SELECT id, last_sign_in_at FROM users WHERE id=?", [id]);
        return { data: {user: rows[0] || null}, error: null };
      },
      async deleteUser(id) {
        await pool.query("DELETE FROM users WHERE id=?", [id]);
        return { error: null };
      },
      async updateUserById(id, o) {
        if (o.password) await setPassword(id, o.password);
        return { error: null };
      }
    }
  }
};
export {
  adminDb,
  createUser,
  setPassword
};
