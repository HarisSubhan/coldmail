import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Plus, Trash2, UserPlus } from "lucide-react";
import { db } from "@/lib/db-client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminCreatePlan,
  adminCreateUser,
  adminDeletePlan,
  adminDeleteUser,
  adminListPlans,
  adminListUsers,
  adminStats,
  adminUpdatePlan,
  adminUpdateSettings,
  adminUpdateUser
} from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";
const Route = createFileRoute("/app/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin \u2014 Origami99" },
      { name: "description", content: "Manage accounts, plans and modules." },
      { property: "og:title", content: "Super Admin \u2014 Origami99" },
      { property: "og:description", content: "Manage accounts, plans and modules." }
    ]
  }),
  validateSearch: (s) => {
    const t = s["tab"];
    return t === "users" || t === "plans" || t === "settings" || t === "overview" ? { tab: t } : {};
  },
  component: Admin
});
const defaultSub = { plan_name: "Starter", price_pkr: 5e3, billing_cycle: "monthly", starts_at: null, expires_at: null, plan_id: null };
const emptyPlan = { name: "", description: "", price_monthly_pkr: 0, price_yearly_pkr: 0, features: "", active: true, sort_order: 0 };
const pkr = (n) => `PKR ${Number(n).toLocaleString("en-PK")}`;
function SubFields({ v, onChange, plans }) {
  return <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1">
        <Label>Plan</Label>
        <Select
    value={v.plan_id ?? "custom"}
    onValueChange={(pid) => {
      if (pid === "custom") return onChange({ ...v, plan_id: null });
      const p = plans.find((x) => x.id === pid);
      if (p) onChange({ ...v, plan_id: pid, plan_name: p.name, price_pkr: v.billing_cycle === "yearly" ? Number(p.price_yearly_pkr) : Number(p.price_monthly_pkr) });
    }}
  >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            <SelectItem value="custom">Custom…</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!v.plan_id && <div className="space-y-1"><Label>Plan name</Label><Input value={v.plan_name} onChange={(e) => onChange({ ...v, plan_name: e.target.value })} /></div>}
      <div className="space-y-1"><Label>Price (PKR)</Label><Input type="number" min={0} value={v.price_pkr} onChange={(e) => onChange({ ...v, price_pkr: Number(e.target.value) })} /></div>
      <div className="space-y-1">
        <Label>Billing cycle</Label>
        <Select value={v.billing_cycle} onValueChange={(b) => onChange({ ...v, billing_cycle: b })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Start date</Label>
        <Input type="date" required value={v.starts_at?.slice(0, 10) ?? ""} onChange={(e) => onChange({ ...v, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
      </div>
      <div className="space-y-1">
        <Label>Ends (account goes on hold after)</Label>
        <Input type="date" required value={v.expires_at?.slice(0, 10) ?? ""} onChange={(e) => onChange({ ...v, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
      </div>
    </div>;
}
function Overview() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => adminStats() });
  const s = stats.data;
  if (!s) return <p className="text-muted-foreground">Loading stats…</p>;
  const cards = [
    { label: "Total users", value: s.totalUsers },
    { label: "Active users", value: s.activeUsers },
    { label: "Suspended users", value: s.suspendedUsers },
    { label: "Expired subscriptions", value: s.expiredSubs },
    { label: "Total campaigns", value: s.totalCampaigns },
    { label: "Emails sent", value: s.emailsSent },
    { label: "Active plans", value: s.activePlans },
    { label: "Monthly revenue", value: pkr(s.monthlyRevenue) },
    { label: "Yearly revenue", value: pkr(s.yearlyRevenue) }
  ];
  return <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => <div key={c.label} className="card-3d rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
            <div className="mt-2 font-display text-2xl font-extrabold">{c.value}</div>
          </div>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-3 font-semibold">Recent registrations</h3>
          <div className="space-y-2 text-sm">
            {s.recentUsers.map((u) => <div key={u.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0"><div className="truncate font-medium">{u.full_name || "\u2014"}</div><div className="truncate text-xs text-muted-foreground">{u.email}</div></div>
                <span className={`text-xs ${u.status === "active" ? "text-success" : "text-destructive"}`}>{u.status}</span>
              </div>)}
            {!s.recentUsers.length && <p className="text-muted-foreground">No users yet.</p>}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-3 font-semibold">Subscription activity</h3>
          <div className="space-y-2 text-sm">
            {s.recentSubs.map((x) => <div key={x.id} className="flex items-center justify-between gap-2">
                <span className="font-medium">{x.plan_name}</span>
                <span className="text-xs text-muted-foreground">{pkr(Number(x.price_pkr))} / {x.billing_cycle}</span>
              </div>)}
            {!s.recentSubs.length && <p className="text-muted-foreground">No subscriptions yet.</p>}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-3 font-semibold">Campaign activity</h3>
          <div className="space-y-2 text-sm">
            {s.recentCampaigns.map((c) => <div key={c.id} className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{c.name}</span>
                <span className="text-xs capitalize text-muted-foreground">{c.status}</span>
              </div>)}
            {!s.recentCampaigns.length && <p className="text-muted-foreground">No campaigns yet.</p>}
          </div>
        </div>
      </div>
    </div>;
}
function UsersTab({ plans }) {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => adminListUsers() });
  const [open, setOpen] = useState(false);
  const [nu, setNu] = useState({ full_name: "", email: "", password: "", company: "" });
  const [sub, setSub] = useState(defaultSub);
  const [editing, setEditing] = useState(null);
  const [pwFor, setPwFor] = useState(null);
  const [newPw, setNewPw] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });
  async function create(e) {
    e.preventDefault();
    if (!sub.starts_at || !sub.expires_at) {
      toast.error("Start and end dates are required");
      return;
    }
    if (sub.expires_at <= sub.starts_at) {
      toast.error("End date must be after the start date");
      return;
    }
    try {
      await adminCreateUser({ data: { ...nu, subscription: sub } });
      toast.success("User created");
      setOpen(false);
      setNu({ full_name: "", email: "", password: "", company: "" });
      setSub(defaultSub);
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }
  async function remove(id, email) {
    if (!confirm(`Delete ${email}? This removes their account and all their data.`)) return;
    try {
      await adminDeleteUser({ data: { userId: id } });
      toast.success("User deleted");
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }
  async function resetPw(e) {
    e.preventDefault();
    if (!pwFor) return;
    try {
      await adminUpdateUser({ data: { userId: pwFor.id, password: newPw } });
      toast.success(`Password updated for ${pwFor.name}`);
      setPwFor(null);
      setNewPw("");
    } catch (err) {
      toast.error(err.message);
    }
  }
  return <>
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="hero"><UserPlus /> Create user</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <Input required placeholder="Full name" value={nu.full_name} onChange={(e) => setNu({ ...nu, full_name: e.target.value })} />
              <Input placeholder="Company" value={nu.company} onChange={(e) => setNu({ ...nu, company: e.target.value })} />
              <Input required type="email" placeholder="Email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
              <PasswordInput required minLength={8} placeholder="Temporary password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
              <SubFields v={sub} onChange={setSub} plans={plans} />
              <Button type="submit" variant="hero" className="w-full">Create account</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b"><th className="p-3">User</th><th className="p-3">Plan</th><th className="p-3">Expires</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {users.data?.filter((u) => !u.isAdmin).map((u) => {
    const expired = !!u.subscription?.expires_at && new Date(u.subscription.expires_at) < /* @__PURE__ */ new Date();
    return <tr key={u.id} className="border-b last:border-0">
                <td className="p-3">
                  <div className="font-medium">{u.full_name || "\u2014"} {u.isAdmin && <span className="text-xs text-aqua">admin</span>}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="p-3">
                  {u.subscription ? `${u.subscription.plan_name} \xB7 ${pkr(Number(u.subscription.price_pkr))} / ${u.subscription.billing_cycle}` : "\u2014"}
                </td>
                <td className="p-3">{u.subscription?.expires_at ? new Date(u.subscription.expires_at).toLocaleDateString() : "\u2014"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Switch
      checked={u.status === "active"}
      aria-label="Active / paused"
      onCheckedChange={async (v) => {
        await adminUpdateUser({ data: { userId: u.id, status: v ? "active" : "suspended" } });
        refresh();
      }}
    />
                    <span className={`rounded-full px-2 py-0.5 text-xs ${u.status !== "active" ? "bg-destructive/15 text-destructive" : expired ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
                      {u.status !== "active" ? "Paused" : expired ? "On hold (expired)" : "Active"}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="glass" onClick={() => setEditing({ id: u.id, sub: u.subscription ? { plan_name: u.subscription.plan_name, price_pkr: Number(u.subscription.price_pkr), billing_cycle: u.subscription.billing_cycle, starts_at: u.subscription.starts_at, expires_at: u.subscription.expires_at, plan_id: u.subscription.plan_id ?? null } : defaultSub })}>
                      {expired ? "Renew" : "Edit plan"}
                    </Button>
                    <Button size="sm" variant="glass" onClick={() => setPwFor({ id: u.id, name: u.full_name || u.email || "user" })}>
                      <KeyRound className="h-4 w-4" /> Password
                    </Button>
                    {!u.isAdmin && <Button size="sm" variant="ghost" onClick={() => remove(u.id, u.email ?? "")} aria-label="Delete user">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>}
                  </div>
                </td>
              </tr>;
  })}
            {users.data && !users.data.some((u) => !u.isAdmin) && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No subscription users yet. Click “Create user”.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit subscription</DialogTitle></DialogHeader>
          {editing && <div className="space-y-4">
              <SubFields v={editing.sub} onChange={(s) => setEditing({ ...editing, sub: s })} plans={plans} />
              <Button variant="hero" className="w-full" onClick={async () => {
    if (!editing.sub.starts_at || !editing.sub.expires_at) {
      toast.error("Start and end dates are required");
      return;
    }
    await adminUpdateUser({ data: { userId: editing.id, subscription: editing.sub } });
    toast.success("Plan updated");
    setEditing(null);
    refresh();
  }}>Save</Button>
            </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwFor} onOpenChange={(o) => !o && setPwFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password — {pwFor?.name}</DialogTitle></DialogHeader>
          <form onSubmit={resetPw} className="space-y-3">
            <div className="space-y-1">
              <Label>New password</Label>
              <PasswordInput required minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <Button type="submit" variant="hero" className="w-full">Set new password</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>;
}
function PlansTab({ onChange }) {
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => adminListPlans() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(emptyPlan);
  const toPayload = (x) => ({
    name: x.name,
    description: x.description,
    price_monthly_pkr: x.price_monthly_pkr,
    price_yearly_pkr: x.price_yearly_pkr,
    features: x.features.split("\n").map((s) => s.trim()).filter(Boolean),
    active: x.active,
    sort_order: x.sort_order
  });
  function PlanFormFields({ v, onChange: onChange2 }) {
    return <div className="space-y-3">
        <Input required placeholder="Plan name" value={v.name} onChange={(e) => onChange2({ ...v, name: e.target.value })} />
        <Textarea rows={2} placeholder="Description" value={v.description} onChange={(e) => onChange2({ ...v, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Monthly price (PKR)</Label><Input type="number" min={0} value={v.price_monthly_pkr} onChange={(e) => onChange2({ ...v, price_monthly_pkr: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label>Yearly price (PKR)</Label><Input type="number" min={0} value={v.price_yearly_pkr} onChange={(e) => onChange2({ ...v, price_yearly_pkr: Number(e.target.value) })} /></div>
        </div>
        <div className="space-y-1"><Label>Features (one per line)</Label><Textarea rows={4} value={v.features} onChange={(e) => onChange2({ ...v, features: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Sort order</Label><Input type="number" min={0} value={v.sort_order} onChange={(e) => onChange2({ ...v, sort_order: Number(e.target.value) })} /></div>
          <div className="flex items-end gap-2 pb-1"><Switch checked={v.active} onCheckedChange={(a) => onChange2({ ...v, active: a })} /><Label>Active</Label></div>
        </div>
      </div>;
  }
  return <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Active plans appear on the homepage pricing section, ordered by sort order. Switch a plan off to hide it.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="hero"><Plus /> New plan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create plan</DialogTitle></DialogHeader>
            <PlanFormFields v={f} onChange={setF} />
            <Button variant="hero" className="mt-3 w-full" onClick={async () => {
    try {
      await adminCreatePlan({ data: toPayload(f) });
      toast.success("Plan created");
      setOpen(false);
      setF(emptyPlan);
      onChange();
    } catch (err) {
      toast.error(err.message);
    }
  }}>Create plan</Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.data?.map((p) => <div key={p.id} className="card-3d rounded-2xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-lg font-bold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.description}</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${p.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{p.active ? "Active" : "Inactive"}</span>
            </div>
            <div className="mt-3 text-sm">{pkr(Number(p.price_monthly_pkr))}/mo · {pkr(Number(p.price_yearly_pkr))}/yr</div>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {(p.features ?? []).map((x, i) => <li key={i}>• {x}</li>)}
            </ul>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="glass" onClick={() => setEditing({ id: p.id, f: { name: p.name, description: p.description, price_monthly_pkr: Number(p.price_monthly_pkr), price_yearly_pkr: Number(p.price_yearly_pkr), features: (p.features ?? []).join("\n"), active: p.active, sort_order: p.sort_order } })}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={async () => {
    if (!confirm(`Delete plan "${p.name}"?`)) return;
    await adminDeletePlan({ data: { id: p.id } });
    onChange();
  }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>)}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit plan</DialogTitle></DialogHeader>
          {editing && <>
              <PlanFormFields v={editing.f} onChange={(x) => setEditing({ ...editing, f: x })} />
              <Button variant="hero" className="mt-3 w-full" onClick={async () => {
    try {
      await adminUpdatePlan({ data: { id: editing.id, plan: toPayload(editing.f) } });
      toast.success("Plan updated");
      setEditing(null);
      onChange();
    } catch (err) {
      toast.error(err.message);
    }
  }}>Save plan</Button>
            </>}
        </DialogContent>
      </Dialog>
    </>;
}
function SettingsTab() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await db.from("app_settings").select("*").eq("id", 1).maybeSingle()).data
  });
  const [f, setF] = useState({ whatsapp_number: "", whatsapp_message: "", ai_model: "" });
  const [loaded, setLoaded] = useState(false);
  if (settings.data && !loaded) {
    setF({
      whatsapp_number: settings.data.whatsapp_number,
      whatsapp_message: settings.data.whatsapp_message,
      ai_model: settings.data.ai_model
    });
    setLoaded(true);
  }
  const s = settings.data;
  return <div className="space-y-6">
      <div className="glass flex items-center justify-between rounded-2xl p-5">
        <div>
          <div className="font-semibold">Reply tracking module</div>
          <div className="text-sm text-muted-foreground">Show the Replies inbox to all users.</div>
        </div>
        <Switch
    checked={!!s?.reply_module_enabled}
    onCheckedChange={async (v) => {
      await db.from("app_settings").update({ reply_module_enabled: v, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", 1);
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    }}
  />
      </div>

      <div className="glass space-y-4 rounded-2xl p-5">
        <h3 className="font-semibold">WhatsApp subscription enquiries</h3>
        <div className="space-y-1">
          <Label>WhatsApp number (international format, digits only)</Label>
          <Input value={f.whatsapp_number} onChange={(e) => setF({ ...f, whatsapp_number: e.target.value })} placeholder="923377771527" />
        </div>
        <div className="space-y-1">
          <Label>Prefilled message — tokens: {"{plan} {cycle} {price} {name} {email}"}</Label>
          <Textarea rows={3} value={f.whatsapp_message} onChange={(e) => setF({ ...f, whatsapp_message: e.target.value })} />
        </div>
      </div>

      <div className="glass space-y-4 rounded-2xl p-5">
        <h3 className="font-semibold">AI configuration</h3>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Emails, follow-ups and reply suggestions are written by the built-in Origami99 writer on your server. No OpenAI or API key needed.</p>
        </div>
      </div>

      <Button variant="hero" onClick={async () => {
    try {
      await adminUpdateSettings({ data: f });
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    } catch (err) {
      toast.error(err.message);
    }
  }}>Save settings</Button>
    </div>;
}
function Admin() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => adminListPlans(), enabled: isAdmin });
  const { tab = "overview" } = Route.useSearch();
  const navigate = Route.useNavigate();
  if (!isAdmin) return <p className="text-muted-foreground">Admins only.</p>;
  const refreshPlans = () => qc.invalidateQueries({ queryKey: ["admin-plans"] });
  return <>
      <PageHeader title="Super Admin" subtitle="Platform overview, subscription users, homepage plans and settings." />
      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v } })}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Subscription Users</TabsTrigger>
          <TabsTrigger value="plans">Plans & Pricing</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><Overview /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab plans={plans.data ?? []} /></TabsContent>
        <TabsContent value="plans" className="mt-4"><PlansTab onChange={refreshPlans} /></TabsContent>
        <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
      </Tabs>
    </>;
}
export {
  Route
};
