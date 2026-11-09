import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
const Route = createFileRoute("/app/profile")({
  head: () => ({
    meta: [
      { title: "My Profile \u2014 Origami99" },
      { name: "description", content: "Manage your profile and password." },
      { property: "og:title", content: "My Profile \u2014 Origami99" },
      { property: "og:description", content: "Manage your profile and password." }
    ]
  }),
  component: Profile
});
function Profile() {
  const { user, status } = useAuth();
  const [p, setP] = useState({ full_name: "", company: "", phone: "" });
  const [pw, setPw] = useState({ current: "", next: "" });
  useEffect(() => {
    if (!user) return;
    db.from("profiles").select("full_name,company,phone").eq("id", user.id).single().then(({ data }) => {
      if (data) setP({ full_name: data.full_name ?? "", company: data.company ?? "", phone: data.phone ?? "" });
    });
  }, [user]);
  async function saveProfile(e) {
    e.preventDefault();
    const { error } = await db.from("profiles").update(p).eq("id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  }
  async function changePw(e) {
    e.preventDefault();
    const { error } = await db.auth.updateUser({ password: pw.next, current_password: pw.current });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPw({ current: "", next: "" });
    toast.success("Password changed");
  }
  return <>
      <PageHeader title="My Profile" />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="glass space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Details</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-muted-foreground">User ID</div><div className="truncate font-mono text-xs">{user?.id}</div></div>
            <div><div className="text-muted-foreground">Account status</div><div className="capitalize text-success">{status}</div></div>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input disabled value={user?.email ?? ""} /></div>
          <div className="space-y-2"><Label>Full name</Label><Input value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Company</Label><Input value={p.company} onChange={(e) => setP({ ...p, company: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></div>
          <Button type="submit" variant="hero">Save profile</Button>
        </form>
        <form onSubmit={changePw} className="glass space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Change password</h2>
          <div className="space-y-2"><Label>Current password</Label><PasswordInput required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div className="space-y-2"><Label>New password</Label><PasswordInput minLength={8} required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
          <Button type="submit" variant="hero">Update password</Button>
        </form>
      </div>
    </>;
}
export {
  Route
};
