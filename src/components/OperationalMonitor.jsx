import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { getOperationalMonitoring } from "@/lib/monitoring.functions";
import { adminListUsers } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/PageHeader";
function OperationalMonitor() {
  const [userId, setUserId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [module, setModule] = useState("all");
  const [search, setSearch] = useState("");
  const fetchMonitor = getOperationalMonitoring;
  const fetchUsers = adminListUsers;
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });
  const monitor = useQuery({ queryKey: ["operational-monitor", userId, from, to, module, search], queryFn: () => fetchMonitor({ data: { userId: userId === "all" ? void 0 : userId, from: from ? (/* @__PURE__ */ new Date(from + "T00:00:00")).toISOString() : void 0, to: to ? new Date((/* @__PURE__ */ new Date(to + "T00:00:00")).getTime() + 864e5).toISOString() : void 0, module: module === "all" ? void 0 : module, search: search || void 0 } }), refetchInterval: 15e3 });
  const data = monitor.data;
  const owner = users.data?.find((u) => u.id === userId);
  const names = new Map((users.data ?? []).map((u) => [u.id, u.full_name || u.email || u.id]));
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Select value={userId} onValueChange={setUserId}><SelectTrigger aria-label="Monitored user"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All users</SelectItem>{users.data?.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}</SelectContent></Select>
      <Input aria-label="Activity from date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      <Input aria-label="Activity to date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      <Button variant="glass" onClick={() => monitor.refetch()}><RefreshCw /> Refresh</Button>
    </div>
    {owner && <section className="border-y py-4"><h2 className="font-semibold">{owner.full_name || owner.email}</h2><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div><dt className="text-muted-foreground">Registered</dt><dd>{new Date(owner.created_at).toLocaleString()}</dd></div>
      <div><dt className="text-muted-foreground">Account</dt><dd>{owner.status}</dd></div>
      <div><dt className="text-muted-foreground">Subscription</dt><dd>{owner.subscription?.plan_name ?? "Not assigned"}</dd></div>
      <div><dt className="text-muted-foreground">Expires</dt><dd>{owner.subscription?.expires_at ? new Date(owner.subscription.expires_at).toLocaleString() : "No expiry"}</dd></div>
      <div><dt className="text-muted-foreground">Last sign-in</dt><dd>{data?.lastLogin ? new Date(data.lastLogin).toLocaleString() : "Unavailable"}</dd></div>
    </dl></section>}
    {monitor.error && <p role="alert" className="text-destructive">{monitor.error.message}</p>}
    {!data && !monitor.error && <p className="text-muted-foreground">Loading activity…</p>}
    {data && <>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{Object.entries({ "CRM leads": data.counts.crm, "Extraction searches": data.counts.searches, "Failed searches": data.counts.failedSearches, Campaigns: data.counts.campaigns, "Emails sent": data.counts.sent, "Failed emails": data.counts.failed, "Phone numbers": data.counts.phones, "Email addresses": data.counts.emails, Websites: data.counts.websites }).map(([label, value]) => <div key={label} className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-bold">{value}</div></div>)}</div>
      <section className="border-y py-4"><h2 className="font-semibold">CRM pipeline</h2><div className="mt-3 flex flex-wrap gap-6 text-sm">{Object.entries(data.pipeline).map(([stage, count]) => <span key={stage}>{stage}: <b>{count}</b></span>)}{!Object.keys(data.pipeline).length && <span className="text-muted-foreground">No CRM leads</span>}</div>{data.pipelineTruncated && <p className="text-warning">Pipeline count limited to the first 5,000 records.</p>}</section>
      <section><h2 className="mb-3 font-semibold">Extraction records</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Search / user</th><th className="p-2">Areas</th><th className="p-2">Status</th><th className="p-2">Found / saved / failed</th><th className="p-2">Duration</th><th className="p-2">Error</th></tr></thead><tbody>{data.extractions.map((x) => <tr key={x.id} className="border-b"><td className="p-2">{x.name}<div className="text-xs text-muted-foreground">{names.get(x.user_id)} · {x.keyword} · {x.city}</div></td><td className="max-w-48 break-words p-2">{x.area_codes.join(", ")}</td><td className="p-2"><StatusBadge status={x.status} /></td><td className="p-2">{x.found} / {x.saved} / {x.failed}</td><td className="p-2">{x.started_at ? Math.max(0, Math.round((new Date(x.completed_at ?? data.measuredAt).getTime() - new Date(x.started_at).getTime()) / 1e3)) + "s" : "Not started"}</td><td className="max-w-64 break-words p-2 text-destructive">{x.error ?? "\u2014"}</td></tr>)}</tbody></table></div></section>
      <section><h2 className="mb-3 font-semibold">Campaign records</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{data.campaigns.map((x) => <tr key={x.id} className="border-b"><td className="p-2">{x.name}</td><td className="p-2">{names.get(x.user_id)}</td><td className="p-2"><StatusBadge status={x.status} /></td><td className="p-2">{new Date(x.created_at).toLocaleString()}</td></tr>)}</tbody></table></div></section>
      <section><h2 className="mb-3 font-semibold">Activity logs</h2><div className="mb-3 grid gap-3 sm:grid-cols-2"><Input aria-label="Search activity logs" placeholder="Search activity" value={search} onChange={(e) => setSearch(e.target.value)} /><Select value={module} onValueChange={setModule}><SelectTrigger aria-label="Activity module"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All modules</SelectItem>{["lead_extractions", "crm_leads", "crm_stages", "campaigns", "campaign_emails", "smtp_settings", "profiles", "subscriptions", "leads"].map((m) => <SelectItem key={m} value={m}>{m.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Time</th><th className="p-2">User</th><th className="p-2">Actor</th><th className="p-2">Activity</th><th className="p-2">Status</th></tr></thead><tbody>{data.logs.map((x) => <tr key={x.id} className="border-b"><td className="whitespace-nowrap p-2">{new Date(x.created_at).toLocaleString()}</td><td className="p-2">{names.get(x.user_id) ?? x.user_id}</td><td className="p-2">{x.actor_id ? names.get(x.actor_id) ?? x.actor_id : "Server action"}</td><td className="p-2">{x.description}<div className="text-xs text-muted-foreground">{x.module.replaceAll("_", " ")} · {x.related_record_id}</div></td><td className="p-2">{x.status}</td></tr>)}</tbody></table></div>{!data.logs.length && <p className="py-4 text-muted-foreground">No recorded activities in this period.</p>}</section>
      <section className="border-t pt-4 text-sm"><h2 className="mb-2 font-semibold">Monitoring availability</h2><p>Database reads: successful · {data.databaseLatencyMs}ms</p><p className="mt-2 text-muted-foreground">Login totals, confirmed deliveries, bounces, generation usage, storage, API usage, server health and queue telemetry: not yet instrumented.</p><p className="mt-2 text-xs text-muted-foreground">Latest 200 audit events, 100 searches and 100 campaigns. New audit events are recorded from this upgrade onward.</p></section>
    </>}
  </div>;
}
export {
  OperationalMonitor
};
