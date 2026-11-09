import mysql from "mysql2/promise";
import { Query } from "../src/lib/query.js";
const pool = mysql.createPool({
  uri: process.env["DATABASE_URL"],
  connectionLimit: 10,
  timezone: "Z",
  supportBigNumbers: true,
  charset: "utf8mb4"
});
const s = "s", b = "b", j = "j", d = "d", n = "n", i = "i";
const META = {
  profiles: { cols: { id: s, email: s, full_name: s, company: s, phone: s, status: s, created_at: d, updated_at: d } },
  user_roles: { uuid: true, cols: { id: s, user_id: s, role: s } },
  plans: { uuid: true, cols: { id: s, name: s, description: s, price_monthly_pkr: n, price_yearly_pkr: n, features: j, active: b, sort_order: i, created_at: d }, defaults: { description: "", features: [] } },
  subscriptions: { uuid: true, cols: { id: s, user_id: s, plan_name: s, price_pkr: n, billing_cycle: s, starts_at: d, expires_at: d, created_at: d, plan_id: s } },
  app_settings: { cols: { id: i, reply_module_enabled: b, whatsapp_number: s, whatsapp_message: s, ai_model: s, updated_at: d } },
  leads: { uuid: true, tenant: "user_id", cols: { id: s, user_id: s, name: s, business_name: s, email: s, website: s, custom_fields: j, created_at: d }, defaults: { custom_fields: {} } },
  campaigns: { uuid: true, tenant: "user_id", cols: { id: s, user_id: s, name: s, niche: s, audience: s, offer: s, selling_points: s, purpose: s, keywords: j, language: s, tone: s, length: s, status: s, created_at: d, updated_at: d }, defaults: { keywords: [] } },
  campaign_emails: { uuid: true, tenant: "user_id", cols: { id: s, user_id: s, campaign_id: s, lead_id: s, subject: s, body: s, status: s, attempts: i, error: s, sent_at: d, is_followup: b, followup_of: s, created_at: d, updated_at: d }, defaults: { subject: "", body: "" } },
  smtp_settings: { tenant: "user_id", cols: { user_id: s, sender_name: s, sender_email: s, host: s, port: i, username: s, password_encrypted: s, encryption: s, reply_to: s, signature: s, signature_template: s, signature_data: j, verified: b, updated_at: d }, defaults: { signature_data: {} } },
  email_logs: { uuid: true, tenant: "user_id", cols: { id: s, user_id: s, campaign_id: s, email_id: s, level: s, message: s, created_at: d } },
  replies: { uuid: true, tenant: "user_id", cols: { id: s, user_id: s, campaign_id: s, lead_id: s, from_email: s, subject: s, body: s, classification: s, suggested_response: s, responded: b, received_at: d } }
};
const REL = {
  campaign_emails: {
    leads: { table: "leads", local: "lead_id", foreign: "id", many: false },
    campaigns: { table: "campaigns", local: "campaign_id", foreign: "id", many: false }
  },
  replies: {
    leads: { table: "leads", local: "lead_id", foreign: "id", many: false },
    campaigns: { table: "campaigns", local: "campaign_id", foreign: "id", many: false }
  },
  campaigns: { campaign_emails: { table: "campaign_emails", local: "id", foreign: "campaign_id", many: true } }
};
const q = (c) => "`" + c + "`";
const toDb = (k, v) => {
  if (v === void 0) return void 0;
  if (v === null) return null;
  if (k === "j") return JSON.stringify(v);
  if (k === "b") return v ? 1 : 0;
  if (k === "d") return new Date(v);
  return v;
};
const fromDb = (k, v) => {
  if (v === null || v === void 0) return v ?? null;
  if (k === "j") return typeof v === "string" ? JSON.parse(v) : v;
  if (k === "b") return !!Number(v);
  if (k === "d") return v instanceof Date ? v.toISOString() : (/* @__PURE__ */ new Date(String(v) + "Z")).toISOString();
  if (k === "n" || k === "i") return Number(v);
  return v;
};
function splitTop(str) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
class DbError extends Error {
}
function browserRules(spec, scope) {
  const t = spec.table;
  const read = spec.op === "select";
  const forced = [];
  if (META[t]?.tenant) forced.push(["user_id", scope.userId]);
  else if (t === "profiles") {
    if (!read && spec.op !== "update") throw new DbError("Not allowed");
    if (!scope.isAdmin || !read) forced.push(["id", scope.userId]);
  } else if (t === "user_roles" || t === "subscriptions") {
    if (!read) throw new DbError("Not allowed");
    if (!scope.isAdmin) forced.push(["user_id", scope.userId]);
  } else if (t === "plans") {
    if (!read) throw new DbError("Not allowed");
  } else if (t === "app_settings") {
    if (!read && !(spec.op === "update" && scope.isAdmin)) throw new DbError("Not allowed");
  } else throw new DbError("Unknown table");
  if (t === "smtp_settings" && !read) throw new DbError("Use the SMTP settings form");
  if (t === "email_logs" && !(read || spec.op === "insert")) throw new DbError("Not allowed");
  return forced;
}
const PROFILE_EDITABLE = /* @__PURE__ */ new Set(["full_name", "company", "phone"]);
async function isActive(userId) {
  const [rows] = await pool.query(
    `SELECT p.status,
            EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=p.id AND r.role='super_admin') AS is_admin,
            EXISTS(SELECT 1 FROM subscriptions s WHERE s.user_id=p.id AND s.expires_at IS NOT NULL AND s.expires_at < UTC_TIMESTAMP()) AS expired
       FROM profiles p WHERE p.id=?`,
    [userId]
  );
  const r = rows[0];
  if (!r || r.status !== "active") return false;
  return !!Number(r.is_admin) || !Number(r.expired);
}
async function execute(spec, scope) {
  try {
    return await run(spec, scope);
  } catch (e) {
    return { data: null, error: { message: e?.sqlMessage ?? e?.message ?? "Database error" }, count: null };
  }
}
async function run(spec, scope) {
  const meta = META[spec.table];
  if (!meta) throw new DbError("Unknown table");
  const cols = meta.cols;
  const check = (c) => {
    if (!(c in cols)) throw new DbError(`Unknown column ${spec.table}.${c}`);
    return c;
  };
  let forced = [];
  if (!scope.admin) {
    forced = scope.fromBrowser ? browserRules(spec, scope) : META[spec.table]?.tenant ? [["user_id", scope.userId]] : [];
    if (!scope.fromBrowser && spec.table === "profiles" && spec.op !== "select") forced = [["id", scope.userId]];
    if (meta.tenant && !await isActive(scope.userId)) throw new DbError("Your account is paused or on hold. Please contact the Super Admin.");
  }
  const where = [];
  const params = [];
  for (const [c, v] of forced) {
    where.push(`${q(c)}=?`);
    params.push(v);
  }
  for (const [c, op, v] of spec.filters) {
    if (op === "or") {
      const parts = String(v).split(",").map((p) => {
        const [col = "", o, ...rest] = p.split(".");
        const val = rest.join(".");
        check(col);
        if (o === "ilike" || o === "like") {
          params.push(val.replace(/\*/g, "%"));
          return `${q(col)} LIKE ?`;
        }
        if (o === "eq") {
          params.push(val);
          return `${q(col)}=?`;
        }
        throw new DbError("Unsupported or() filter");
      });
      where.push(`(${parts.join(" OR ")})`);
      continue;
    }
    check(c);
    const k = cols[c];
    if (op === "in") {
      const arr = v ?? [];
      if (!arr.length) {
        where.push("1=0");
        continue;
      }
      where.push(`${q(c)} IN (${arr.map(() => "?").join(",")})`);
      params.push(...arr.map((x) => toDb(k, x)));
      continue;
    }
    if (v === null && op === "eq") {
      where.push(`${q(c)} IS NULL`);
      continue;
    }
    const sym = { eq: "=", neq: "<>", lt: "<", gt: ">", lte: "<=", gte: ">=" }[op];
    where.push(`${q(c)}${sym}?`);
    params.push(toDb(k, v));
  }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const prepRow = (row, isInsert) => {
    const r = { ...row };
    if (!scope.admin) {
      if (meta.tenant) r["user_id"] = scope.userId;
      if (spec.table === "profiles" && scope.fromBrowser) {
        for (const k of Object.keys(r)) if (!PROFILE_EDITABLE.has(k)) delete r[k];
      }
    }
    if (isInsert) {
      if (meta.uuid && !r["id"]) r["id"] = crypto.randomUUID();
      for (const [k, v] of Object.entries(meta.defaults ?? {})) if (r[k] === void 0) r[k] = v;
    }
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      check(k);
      if (v !== void 0) out[k] = toDb(cols[k], v);
    }
    return out;
  };
  if (spec.op === "select") return select(spec, scope, whereSql, params);
  if (spec.op === "delete") {
    const [res] = await pool.query(`DELETE FROM ${q(spec.table)}${whereSql}`, params);
    return { data: null, error: null, count: res.affectedRows };
  }
  if (spec.op === "update") {
    const row = prepRow(spec.values, false);
    if (scope.admin === false) delete row["user_id"];
    const keys2 = Object.keys(row);
    if (!keys2.length) return { data: null, error: null, count: 0 };
    if ("updated_at" in cols && !keys2.includes("updated_at")) {
      keys2.push("updated_at");
      row["updated_at"] = /* @__PURE__ */ new Date();
    }
    const [res] = await pool.query(
      `UPDATE ${q(spec.table)} SET ${keys2.map((k) => `${q(k)}=?`).join(",")}${whereSql}`,
      [...keys2.map((k) => row[k]), ...params]
    );
    return { data: null, error: null, count: res.affectedRows };
  }
  const list = Array.isArray(spec.values) ? spec.values : [spec.values];
  if (!list.length) return { data: [], error: null, count: 0 };
  const rows = list.map((r) => prepRow(r, true));
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const vals = rows.map((r) => keys.map((k) => k in r ? r[k] : null));
  let sql = `INSERT INTO ${q(spec.table)} (${keys.map(q).join(",")}) VALUES ${vals.map((v) => `(${v.map(() => "?").join(",")})`).join(",")}`;
  if (spec.op === "upsert") {
    const conflict = new Set((spec.onConflict ?? "id").split(",").map((x) => x.trim()));
    const upd = keys.filter((k) => !conflict.has(k) && k !== "id" && k !== "created_at");
    sql += ` ON DUPLICATE KEY UPDATE ${upd.length ? upd.map((k) => `${q(k)}=VALUES(${q(k)})`).join(",") : `${q(keys[0])}=${q(keys[0])}`}`;
  }
  await pool.query(sql, vals.flat());
  const data = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, fromDb(cols[k], v)])));
  return { data: Array.isArray(spec.values) ? data : data[0], error: null, count: data.length };
}
async function select(spec, scope, whereSql, params) {
  const meta = META[spec.table];
  const parts = splitTop(spec.columns ?? "*");
  const base = [];
  const embeds = [];
  for (const p of parts) {
    const m = p.match(/^(\w+)\((.*)\)$/);
    if (m) embeds.push({ name: m[1], cols: m[2] });
    else if (p === "*") base.push(...Object.keys(meta.cols));
    else base.push(p);
  }
  const hidden = !scope.admin && scope.fromBrowser && spec.table === "smtp_settings" ? ["password_encrypted"] : [];
  const fields = [...new Set(base)].filter((c) => !hidden.includes(c));
  for (const c of fields) if (!(c in meta.cols)) throw new DbError(`Unknown column ${spec.table}.${c}`);
  for (const e of embeds) {
    const r = REL[spec.table]?.[e.name];
    if (r && !fields.includes(r.local)) fields.push(r.local);
  }
  let count = null;
  if (spec.count) {
    const [c] = await pool.query(`SELECT COUNT(*) AS n FROM ${q(spec.table)}${whereSql}`, params);
    count = Number(c[0].n);
    if (spec.head) return { data: null, error: null, count };
  }
  let sql = `SELECT ${fields.map(q).join(",")} FROM ${q(spec.table)}${whereSql}`;
  if (spec.order.length) {
    for (const [c] of spec.order) if (!(c in meta.cols)) throw new DbError("Bad order column");
    sql += ` ORDER BY ${spec.order.map(([c, asc]) => `${q(c)} ${asc ? "ASC" : "DESC"}`).join(",")}`;
  }
  if (spec.limit) sql += ` LIMIT ${Math.max(1, Math.floor(spec.limit))}`;
  if (spec.single && !spec.limit) sql += " LIMIT 2";
  const [raw] = await pool.query(sql, params);
  const rows = raw.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, fromDb(meta.cols[k], v)])));
  for (const e of embeds) {
    const rel = REL[spec.table]?.[e.name];
    if (!rel) throw new DbError(`Unknown relation ${e.name}`);
    const ids = [...new Set(rows.map((r) => r[rel.local]).filter(Boolean))];
    const relCols = e.cols === "*" ? "*" : [.../* @__PURE__ */ new Set([...splitTop(e.cols), rel.foreign])].join(",");
    const sub = ids.length ? await run({ table: rel.table, op: "select", columns: relCols, filters: [[rel.foreign, "in", ids]], order: [] }, scope) : { data: [] };
    const subRows = sub.data ?? [];
    for (const r of rows)
      r[e.name] = rel.many ? subRows.filter((x) => x[rel.foreign] === r[rel.local]) : subRows.find((x) => x[rel.foreign] === r[rel.local]) ?? null;
  }
  if (spec.single) {
    if (rows.length > 1) throw new DbError("Multiple rows returned");
    if (!rows.length && spec.single === "single") throw new DbError("Row not found");
    return { data: rows[0] ?? null, error: null, count };
  }
  return { data: rows, error: null, count };
}
function dbClient(scope) {
  return {
    from: (table) => new Query((sp) => execute(sp, scope), table),
    rpc: async (name, args) => {
      if (name !== "has_role") return { data: null, error: { message: "Unknown rpc" } };
      const [rows] = await pool.query("SELECT 1 FROM user_roles WHERE user_id=? AND role=?", [args["_user_id"], args["_role"]]);
      return { data: rows.length > 0, error: null };
    }
  };
}
export {
  META,
  dbClient,
  execute,
  pool
};
