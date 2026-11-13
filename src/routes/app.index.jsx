import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarDays, Mail, MailX, MapPin, Send, Target, Trophy, Users, XCircle } from "lucide-react";
import { db } from "@/lib/db-client";
import { PageHeader, StatusBadge } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard \u2014 Origami99" },
      { name: "description", content: "Your outreach at a glance." },
      { property: "og:title", content: "Dashboard \u2014 Origami99" },
      { property: "og:description", content: "Your outreach at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" }
    ]
  }),
  component: Overview
});
async function count(table, f) {
  let q = db.from(table).select("id", { count: "exact", head: true });
  if (f) q = f(q);
  const { count: count2 } = await q;
  return count2 ?? 0;
}
function Overview() {
  const { data } = useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const now = /* @__PURE__ */ new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const month = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const todayDate = today.slice(0, 10);
      const [crm, recipients, extractions, crmToday, crmMonth, withEmail, campaigns, generated, sent, failed, followups, stages, crmStages, recent] = await Promise.all([
        count("crm_leads"),
        count("leads"),
        count("lead_extractions"),
        count("crm_leads", (q) => q.gte("extracted_at", today)),
        count("crm_leads", (q) => q.gte("extracted_at", month)),
        count("crm_leads", (q) => q.not("email", "is", null)),
        count("campaigns"),
        count("campaign_emails"),
        count("campaign_emails", (q) => q.eq("status", "sent")),
        count("campaign_emails", (q) => q.eq("status", "failed")),
        count("crm_leads", (q) => q.lte("followup_date", todayDate)),
        db.from("crm_stages").select("id,name").order("position"),
        db.from("crm_leads").select("stage_id").limit(2e4),
        db.from("campaigns").select("id,name,status,language,created_at").order("created_at", { ascending: false }).limit(5)
      ]);
      const perStage = /* @__PURE__ */ new Map();
      crmStages.data?.forEach((r) => perStage.set(r.stage_id ?? "", (perStage.get(r.stage_id ?? "") ?? 0) + 1));
      const pipeline = (stages.data ?? []).map((s) => ({ name: s.name, n: perStage.get(s.id) ?? 0 }));
      const converted = pipeline.find((p) => /convert/i.test(p.name))?.n ?? 0;
      return { crm, recipients, extractions, crmToday, crmMonth, withEmail, campaigns, generated, sent, failed, followups, pipeline, converted, recent: recent.data ?? [] };
    }
  });
  const delivery = data && data.sent + data.failed ? Math.round(data.sent / (data.sent + data.failed) * 100) : null;
  const stats = [
    { label: "Total CRM leads", value: data?.crm, icon: Users, tone: "bg-gradient-aqua" },
    { label: "Extraction searches", value: data?.extractions, icon: MapPin, tone: "bg-gradient-primary" },
    { label: "Leads today", value: data?.crmToday, icon: CalendarDays, tone: "bg-gradient-aqua" },
    { label: "Leads this month", value: data?.crmMonth, icon: CalendarDays, tone: "bg-gradient-primary" },
    { label: "With email", value: data?.withEmail, icon: Mail, tone: "bg-gradient-aqua" },
    { label: "Without email", value: data ? data.crm - data.withEmail : void 0, icon: MailX, tone: "bg-muted" },
    { label: "Email recipients", value: data?.recipients, icon: Users, tone: "bg-gradient-primary" },
    { label: "Campaigns", value: data?.campaigns, icon: Target, tone: "bg-gradient-aqua" },
    { label: "Emails generated", value: data?.generated, icon: Mail, tone: "bg-gradient-primary" },
    { label: "Sent", value: data?.sent, icon: Send, tone: "bg-gradient-aqua" },
    { label: "Failed", value: data?.failed, icon: XCircle, tone: "bg-destructive" },
    { label: "Delivery rate", value: delivery === null ? "\u2013" : `${delivery}%`, icon: Send, tone: "bg-gradient-primary" },
    { label: "Converted", value: data?.converted, icon: Trophy, tone: "bg-gradient-aqua" },
    { label: "Follow-ups due", value: data?.followups, icon: Bell, tone: "bg-warning" }
  ];
  const max = Math.max(1, ...data?.pipeline.map((p) => p.n) ?? [1]);
  return <>
      <PageHeader
    title="Dashboard"
    subtitle="Your outreach at a glance."
    action={<Button asChild variant="hero">
            <Link to="/app/campaigns/new">New campaign</Link>
          </Button>}
  />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {stats.map((s) => <div key={s.label} className="card-3d rounded-2xl p-5">
            <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.tone} text-primary-foreground`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className="font-display text-3xl font-bold">{s.value ?? "\u2013"}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </div>)}
      </div>
      <div className="glass mt-8 rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">CRM pipeline</h2><Link to="/app/crm" className="text-sm text-primary">Open CRM</Link></div>
        <div className="space-y-2">
          {data?.pipeline.map((p) => <div key={p.name} className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0 truncate">{p.name}</span>
              <div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-gradient-primary" style={{ width: `${p.n / max * 100}%` }} /></div>
              <span className="w-10 text-right">{p.n}</span>
            </div>)}
        </div>
      </div>
      <div className="glass mt-8 rounded-2xl p-6">
        <h2 className="mb-4 text-lg font-semibold">Recent campaigns</h2>
        {data?.recent.length ? <div className="divide-y">
            {data.recent.map((c) => <Link key={c.id} to="/app/campaigns/$id" params={{ id: c.id }} className="flex items-center justify-between py-3 hover:text-primary">
                <span className="font-medium">{c.name}</span>
                <span className="flex items-center gap-3 text-sm text-muted-foreground">
                  {c.language} <StatusBadge status={c.status} />
                </span>
              </Link>)}
          </div> : <p className="text-sm text-muted-foreground">No campaigns yet. Import leads, then create your first campaign.</p>}
      </div>
    </>;
}
export {
  Route
};
