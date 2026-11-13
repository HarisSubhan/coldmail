import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/components/AuthCard";
import { bootstrapSuperAdmin } from "@/lib/admin.functions";
const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "First-time setup \u2014 Origami99" },
      { name: "description", content: "Create the Super Admin account for Origami99." },
      { property: "og:title", content: "Setup \u2014 Origami99" },
      { property: "og:description", content: "Create the first administrator." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" }
    ]
  }),
  component: Setup
});
function Setup() {
  const nav = useNavigate();
  const [f, setF] = useState({ full_name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await bootstrapSuperAdmin({ data: f });
      await db.auth.signInWithPassword({ email: f.email, password: f.password });
      toast.success("Super Admin created");
      nav({ to: "/app/admin" });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  return <AuthCard title="Create Super Admin" subtitle="This works only once, while no administrator exists.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Full name</Label>
          <Input required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Password (min 8)</Label>
          <PasswordInput minLength={8} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
        <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
          Create admin
        </Button>
      </form>
    </AuthCard>;
}
export {
  Route
};
