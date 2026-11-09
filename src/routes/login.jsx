import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/components/AuthCard";
import { useAuth } from "@/lib/auth";
import { getSetupStatus } from "@/lib/admin.functions";
const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in \u2014 Origami99" },
      { name: "description", content: "Sign in to your Origami99 outreach dashboard." },
      { property: "og:title", content: "Sign in \u2014 Origami99" },
      { property: "og:description", content: "Access your AI email outreach dashboard." }
    ]
  }),
  component: Login
});
function Login() {
  const nav = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  useEffect(() => {
    if (session) nav({ to: "/app" });
  }, [session, nav]);
  useEffect(() => {
    getSetupStatus().then((r) => setNeedsSetup(r.needsSetup)).catch(() => {
    });
  }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await db.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    nav({ to: "/app" });
  }
  return <AuthCard title="Welcome back" subtitle="Sign in with the account your administrator created.">
      {needsSetup && <div className="mb-5 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
          No administrator exists yet.{" "}
          <Link to="/setup" className="font-semibold text-primary underline">
            Create the Super Admin
          </Link>
        </div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="pw">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="pw" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
          {busy ? "Signing in\u2026" : "Sign in"}
        </Button>
      </form>
    </AuthCard>;
}
export {
  Route
};
