import { createContext, useContext, useEffect, useState } from "react";
import { db } from "@/lib/db-client";
const AuthContext = createContext(null);
function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState(null);
  useEffect(() => {
    const { data: sub } = db.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) {
        setIsAdmin(false);
        setStatus(null);
        setLoading(false);
      }
    });
    db.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const [{ data: roles }, { data: profile }, { data: sub }] = await Promise.all([
        db.from("user_roles").select("role").eq("user_id", uid),
        db.from("profiles").select("status").eq("id", uid).maybeSingle(),
        db.from("subscriptions").select("expires_at").eq("user_id", uid).maybeSingle()
      ]);
      if (cancelled) return;
      const admin = !!roles?.some((r) => r.role === "super_admin");
      setIsAdmin(admin);
      setExpiresAt(sub?.expires_at ?? null);
      setStatus(profile?.status ?? "active");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);
  return <AuthContext.Provider
    value={{
      session,
      user: session?.user ?? null,
      isAdmin,
      status,
      expiresAt,
      onHold: !isAdmin && !!expiresAt && new Date(expiresAt) < /* @__PURE__ */ new Date(),
      loading,
      signOut: async () => {
        await db.auth.signOut();
      }
    }}
  >
      {children}
    </AuthContext.Provider>;
}
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
export {
  AuthProvider,
  useAuth
};
