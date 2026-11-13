import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { db } from "@/lib/db-client";
import { PageHeader, StatusBadge } from "@/components/PageHeader";
const Route = createFileRoute("/app/generator")({
  head: () => ({
    meta: [
      { title: "AI Email Generator \u2014 Origami99" },
      { name: "description", content: "Generate personalized emails for your campaigns." },
      { property: "og:title", content: "AI Email Generator \u2014 Origami99" },
      { property: "og:description", content: "Generate personalized emails for your campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" }
    ]
  }),
  component: Generator
});
function Generator() {
  const { data } = useQuery({
    queryKey: ["campaigns-gen"],
    queryFn: async () => (await db.from("campaigns").select("id,name,status,language,tone").order("created_at", { ascending: false })).data ?? []
  });
  return <>
      <PageHeader title="AI Email Generator" subtitle="Pick a campaign to generate, review and approve emails for its leads." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((c) => <Link key={c.id} to="/app/campaigns/$id" params={{ id: c.id }} className="card-3d flex items-center gap-4 rounded-2xl p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{c.name}</div>
              <div className="text-sm text-muted-foreground">{c.language} · {c.tone}</div>
            </div>
            <StatusBadge status={c.status} />
          </Link>)}
        {data && !data.length && <p className="text-muted-foreground">
            Create a campaign first. <Link to="/app/campaigns/new" className="text-primary underline">New campaign</Link>
          </p>}
      </div>
    </>;
}
export {
  Route
};
