import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db-client";
import { PageHeader, StatusBadge } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
const Route = createFileRoute("/app/campaigns/")({
  head: () => ({
    meta: [
      { title: "Campaign History \u2014 Origami99" },
      { name: "description", content: "All your outreach campaigns." },
      { property: "og:title", content: "Campaign History \u2014 Origami99" },
      { property: "og:description", content: "All your outreach campaigns." }
    ]
  }),
  component: Campaigns
});
function Campaigns() {
  const { data } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => (await db.from("campaigns").select("*, campaign_emails(status)").order("created_at", { ascending: false })).data ?? []
  });
  return <>
      <PageHeader
    title="Campaign History"
    action={<Button asChild variant="hero">
            <Link to="/app/campaigns/new">New campaign</Link>
          </Button>}
  />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((c) => {
    const emails = c.campaign_emails ?? [];
    const sent = emails.filter((e) => e.status === "sent").length;
    const pct = emails.length ? Math.round(sent / emails.length * 100) : 0;
    return <Link key={c.id} to="/app/campaigns/$id" params={{ id: c.id }} className="card-3d block rounded-2xl p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{c.name}</h3>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.niche || "\u2014"} · {c.language} · {c.tone}
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {sent} / {emails.length} sent
              </p>
            </Link>;
  })}
        {data && !data.length && <p className="text-muted-foreground">No campaigns yet.</p>}
      </div>
    </>;
}
export {
  Route
};
