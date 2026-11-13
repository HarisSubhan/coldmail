import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CreditCard, Repeat } from "lucide-react";
import { db } from "@/lib/db-client";
import { PageHeader } from "@/components/PageHeader";
const Route = createFileRoute("/app/subscription")({
  head: () => ({
    meta: [
      { title: "My Subscription \u2014 Origami99" },
      { name: "description", content: "Your plan, price and expiry." },
      { property: "og:title", content: "My Subscription \u2014 Origami99" },
      { property: "og:description", content: "Your plan, price and expiry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" }
    ]
  }),
  component: Subscription
});
const formatPKR = (n) => `PKR ${Number(n).toLocaleString("en-PK")}`;
function Subscription() {
  const { data, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => (await db.from("subscriptions").select("*").maybeSingle()).data
  });
  if (isLoading) return null;
  if (!data)
    return <>
        <PageHeader title="My Subscription" />
        <p className="text-muted-foreground">No plan has been assigned yet. Contact your administrator.</p>
      </>;
  const expired = data.expires_at && new Date(data.expires_at) < /* @__PURE__ */ new Date();
  return <>
      <PageHeader title="My Subscription" subtitle="Plans are managed by your administrator." />
      <div className="card-3d relative overflow-hidden rounded-3xl p-8">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
        <div className="text-sm uppercase tracking-widest text-muted-foreground">Current plan</div>
        <div className="mt-2 font-display text-4xl font-extrabold text-gradient">{data.plan_name}</div>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <Item icon={CreditCard} label="Price" value={formatPKR(data.price_pkr)} />
          <Item icon={Repeat} label="Billing cycle" value={data.billing_cycle === "yearly" ? "Yearly" : "Monthly"} />
          <Item
    icon={CalendarClock}
    label={expired ? "Expired on" : "Expires on"}
    value={data.expires_at ? new Date(data.expires_at).toLocaleDateString() : "No expiry"}
    danger={!!expired}
  />
        </div>
      </div>
    </>;
}
function Item({ icon: Icon, label, value, danger }) {
  return <div className="glass rounded-2xl p-4">
      <Icon className="mb-2 h-5 w-5 text-aqua" />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${danger ? "text-destructive" : ""}`}>{value}</div>
    </div>;
}
export {
  Route
};
