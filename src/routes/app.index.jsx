import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, Send, Target, Users, XCircle } from "lucide-react";
import { db } from "@/lib/db-client";
import { PageHeader, StatusBadge } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Overview \u2014 Origami99" },
      { name: "description", content: "Your outreach at a glance." },
      { property: "og:title", content: "Overview \u2014 Origami99" },
      { property: "og:description", content: "Your outreach at a glance." }
    ]
  }),
  component: Overview
});
async function count(table, status) {
  let q = db.from(table).select("id", { count: "exact", head: true });
  if (status) q = q.eq("status", status);
  const { count: count2 } = await q;
  return count2 ?? 0;
}
function Overview() {
  const { data } = useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const [leads, campaigns, generated, sent, failed, recent] = await Promise.all([
        count("leads"),
        count("campaigns"),
        count("campaign_emails"),
        count("campaign_emails", "sent"),
        count("campaign_emails", "failed"),
        db.from("campaigns").select("id,name,status,language,created_at").order("created_at", { ascending: false }).limit(5)
      ]);
      return { leads, campaigns, generated, sent, failed, recent: recent.data ?? [] };
    }
  });
  const stats = [
    { label: "Leads", value: data?.leads, icon: Users, tone: "bg-gradient-aqua" },
    { label: "Campaigns", value: data?.campaigns, icon: Target, tone: "bg-gradient-primary" },
    { label: "Emails generated", value: data?.generated, icon: Mail, tone: "bg-gradient-aqua" },
    { label: "Sent", value: data?.sent, icon: Send, tone: "bg-gradient-primary" },
    { label: "Failed", value: data?.failed, icon: XCircle, tone: "bg-destructive" }
  ];
  return <>
      <PageHeader
    title="Overview"
    subtitle="Your outreach at a glance."
    action={<Button asChild variant="hero">
            <Link to="/app/campaigns/new">New campaign</Link>
          </Button>}
  />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => <div key={s.label} className="card-3d rounded-2xl p-5">
            <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.tone} text-primary-foreground`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className="font-display text-3xl font-bold">{s.value ?? "\u2013"}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </div>)}
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
