import { Query } from "@/lib/query";
const TOKEN_KEY = "o99_token";
const USER_KEY = "o99_user";
const listeners = /* @__PURE__ */ new Set();
let last = "";
function getSessionSync() {
  if (typeof window === "undefined") return null;
  const t = localStorage.getItem(TOKEN_KEY);
  const u = localStorage.getItem(USER_KEY);
  return t && u ? { access_token: t, user: JSON.parse(u) } : null;
}
function setSession(s, event) {
  if (s) {
    localStorage.setItem(TOKEN_KEY, s.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(s.user));
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  listeners.forEach((l) => l(event, s));
}
async function api(url, body, init) {
  const s = getSessionSync();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...s ? { authorization: `Bearer ${s.access_token}` } : {} },
    body: body === void 0 ? void 0 : JSON.stringify(body),
    ...init
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && s) setSession(null, "SIGNED_OUT");
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}
const run = async (spec) => {
  try {
    return await api("/api/db", spec);
  } catch (e) {
    return { data: null, error: { message: e.message }, count: null };
  }
};
const wrap = async (p) => {
  try {
    return { data: await p, error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};
const db = {
  from: (table) => new Query(run, table),
  rpc: async (name, args = {}) => {
    try {
      return await api(`/api/rpc/${name}`, args);
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  },
  auth: {
    async getSession() {
      return { data: { session: getSessionSync() } };
    },
    onAuthStateChange(cb) {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    },
    async signInWithPassword(c) {
      const r = await wrap(api("/api/auth/login", c));
      if (r.data) setSession({ access_token: r.data.token, user: r.data.user }, "SIGNED_IN");
      return r;
    },
    async signOut() {
      setSession(null, "SIGNED_OUT");
      return { error: null };
    },
    async resetPasswordForEmail(email, _o) {
      return wrap(api("/api/auth/forgot", { email }));
    },
    /** Change password; on /reset-password?token=... it completes the email reset flow instead. */
    async updateUser(o) {
      const token = new URLSearchParams(window.location.search).get("token");
      if (token) {
        const r = await wrap(api("/api/auth/reset", { token, password: o.password }));
        if (r.data) setSession({ access_token: r.data.token, user: r.data.user }, "SIGNED_IN");
        return r;
      }
      return wrap(api("/api/auth/password", o));
    }
  },
  storage: {
    from: (_bucket) => {
      return {
        async upload(path, file, _o) {
          const s = getSessionSync();
          const ext = path.split(".").pop() ?? "png";
          const r = await wrap(
            fetch(`/api/storage/logos?ext=${encodeURIComponent(ext)}`, {
              method: "POST",
              headers: { "content-type": file.type || "application/octet-stream", authorization: `Bearer ${s?.access_token ?? ""}` },
              body: file
            }).then(async (res) => {
              const j = await res.json();
              if (!res.ok) throw new Error(j.error ?? "Upload failed");
              last = j.url;
              return j;
            })
          );
          return r;
        },
        async createSignedUrl(_path, _ttl) {
          return last ? { data: { signedUrl: last }, error: null } : { data: null, error: { message: "Upload first" } };
        }
      };
    }
  }
};
export {
  api,
  db
};
