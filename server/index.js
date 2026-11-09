import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool, execute, dbClient } from "./db.js";
import { setPassword } from "./admin-client.js";
import * as adminFns from "./functions/admin.js";
import * as aiFns from "./functions/ai.js";
import * as sendingFns from "./functions/sending.js";
import * as planFns from "./functions/plans.js";
const PORT = Number(process.env["PORT"] || 3e3);
const JWT_SECRET = process.env["JWT_SECRET"] || "";
const PUBLIC_URL = (process.env["PUBLIC_URL"] || `http://localhost:${PORT}`).replace(/\/$/, "");
const ROOT = process.cwd();
const UPLOADS = path.join(ROOT, "uploads");
if (JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be set (32+ characters)");
if (!process.env["SMTP_ENCRYPTION_KEY"]) throw new Error("SMTP_ENCRYPTION_KEY must be set");
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "5mb" }));
const sign = (u) => jwt.sign({ sub: u.id, email: u.email }, JWT_SECRET, { expiresIn: "7d" });
async function auth(req, res, next) {
  const h = req.headers.authorization ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  try {
    const p = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.query("SELECT id FROM users WHERE id=?", [p.sub]);
    if (!rows.length) throw new Error();
    req.userId = p.sub;
    const [r] = await pool.query("SELECT 1 FROM user_roles WHERE user_id=? AND role='super_admin'", [p.sub]);
    req.isAdmin = r.length > 0;
    next();
  } catch {
    res.status(401).json({ error: "Not signed in" });
  }
}
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(400).json({ error: e.message }));
const attempts = /* @__PURE__ */ new Map();
app.post("/api/auth/login", wrap(async (req, res) => {
  const ip = req.ip ?? "x";
  const a = attempts.get(ip) ?? { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 6e4) {
    a.n = 0;
    a.t = Date.now();
  }
  if (a.n >= 10) return res.status(429).json({ error: "Too many attempts, try again in 15 minutes" });
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const [rows] = await pool.query("SELECT id,email,password_hash FROM users WHERE email=?", [email]);
  const u = rows[0];
  if (!u || !await bcrypt.compare(String(req.body?.password ?? ""), u.password_hash)) {
    a.n++;
    attempts.set(ip, a);
    return res.status(400).json({ error: "Invalid login credentials" });
  }
  attempts.delete(ip);
  res.json({ token: sign(u), user: { id: u.id, email: u.email } });
}));
app.get("/api/auth/me", auth, wrap(async (req, res) => {
  const [rows] = await pool.query("SELECT id,email FROM users WHERE id=?", [req.userId]);
  res.json({ user: rows[0] });
}));
app.post("/api/auth/password", auth, wrap(async (req, res) => {
  const { password, current_password } = req.body ?? {};
  if (typeof password !== "string" || password.length < 8) throw new Error("Password must be at least 8 characters");
  const [rows] = await pool.query("SELECT password_hash FROM users WHERE id=?", [req.userId]);
  if (!await bcrypt.compare(String(current_password ?? ""), rows[0].password_hash)) throw new Error("Current password is incorrect");
  await setPassword(req.userId, password);
  res.json({ ok: true });
}));
app.post("/api/auth/forgot", wrap(async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const [rows] = await pool.query("SELECT id FROM users WHERE email=?", [email]);
  if (rows[0] && process.env["SYSTEM_SMTP_HOST"]) {
    const token = randomBytes(32).toString("hex");
    await pool.query("INSERT INTO password_resets (token_hash,user_id,expires_at) VALUES (?,?,?)", [
      createHash("sha256").update(token).digest("hex"),
      rows[0].id,
      new Date(Date.now() + 60 * 6e4)
    ]);
    const { sendMail } = await import("./smtp.js");
    const link = `${PUBLIC_URL}/reset-password?token=${token}`;
    await sendMail(
      {
        host: process.env["SYSTEM_SMTP_HOST"],
        port: Number(process.env["SYSTEM_SMTP_PORT"] || 587),
        username: process.env["SYSTEM_SMTP_USER"] || "",
        password: process.env["SYSTEM_SMTP_PASS"] || "",
        encryption: process.env["SYSTEM_SMTP_ENCRYPTION"] || "tls"
      },
      {
        fromName: "Origami99",
        fromEmail: process.env["SYSTEM_SMTP_FROM"] || process.env["SYSTEM_SMTP_USER"] || "",
        to: email,
        subject: "Reset your Origami99 password",
        text: `Use this link to set a new password (valid for 1 hour):

${link}

If you didn't ask for this, ignore this email.`
      }
    );
  }
  res.json({ ok: true });
}));
app.post("/api/auth/reset", wrap(async (req, res) => {
  const { token, password } = req.body ?? {};
  if (typeof password !== "string" || password.length < 8) throw new Error("Password must be at least 8 characters");
  const h = createHash("sha256").update(String(token ?? "")).digest("hex");
  const [rows] = await pool.query(
    "SELECT r.user_id, u.email FROM password_resets r JOIN users u ON u.id=r.user_id WHERE r.token_hash=? AND r.used=0 AND r.expires_at>?",
    [h, /* @__PURE__ */ new Date()]
  );
  if (!rows[0]) throw new Error("This reset link is invalid or has expired");
  await setPassword(rows[0].user_id, password);
  await pool.query("UPDATE password_resets SET used=1 WHERE token_hash=?", [h]);
  const user = { id: rows[0].user_id, email: rows[0].email };
  res.json({ token: sign(user), user });
}));
app.post("/api/db", auth, wrap(async (req, res) => {
  const r = await execute(req.body, { admin: false, userId: req.userId, isAdmin: !!req.isAdmin, fromBrowser: true });
  res.json(r);
}));
const FNS = {};
for (const mod of [adminFns, aiFns, sendingFns, planFns])
  for (const [k, v] of Object.entries(mod)) if (v?.__serverFn) FNS[k] = v;
app.post("/api/fn/:name", async (req, res, next) => {
  const fn = FNS[req.params["name"] ?? ""];
  if (!fn) return res.status(404).json({ error: "Unknown function" });
  if (fn.auth) return auth(req, res, next);
  next();
}, wrap(async (req, res) => {
  const fn = FNS[req.params["name"] ?? ""];
  const data = fn.validate(req.body?.data);
  const context = req.userId ? { userId: req.userId, db: dbClient({ admin: false, userId: req.userId, isAdmin: !!req.isAdmin, fromBrowser: false }) } : {};
  res.json({ result: await fn.fn({ data, context }) ?? null });
}));
app.post("/api/storage/logos", auth, express.raw({ type: "*/*", limit: "2mb" }), wrap(async (req, res) => {
  const ext = String(req.query["ext"] ?? "png").toLowerCase().replace(/[^a-z]/g, "");
  if (!["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) throw new Error("Upload a PNG, JPG, GIF or WebP image");
  const dir = path.join(UPLOADS, "logos", req.userId);
  fs.mkdirSync(dir, { recursive: true });
  const name = `logo-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(dir, name), req.body);
  res.json({ url: `${PUBLIC_URL}/uploads/logos/${req.userId}/${name}` });
}));
app.use("/uploads", express.static(UPLOADS, { maxAge: "30d", dotfiles: "deny" }));
const DIST = path.join(ROOT, "dist");
app.use(express.static(DIST, { index: false, maxAge: "1h" }));
app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
app.listen(PORT, () => console.log(`Origami99 running on port ${PORT}`));
