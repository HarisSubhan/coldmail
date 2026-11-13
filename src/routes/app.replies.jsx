import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send, Sparkles } from "lucide-react";
import { db } from "@/lib/db-client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { suggestReplyResponse } from "@/lib/ai.functions";
import { sendReply } from "@/lib/sending.functions";
const Route = createFileRoute("/app/replies")({
  head: () => ({
    meta: [
      { title: "Replies \u2014 Origami99" },
      { name: "description", content: "Track replies and respond with AI help." },
      { property: "og:title", content: "Replies \u2014 Origami99" },
      { property: "og:description", content: "Track replies and respond with AI help." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" }
    ]
  }),
  component: Replies
});
function Replies() {
  const qc = useQueryClient();
  const { data: enabled } = useQuery({
    queryKey: ["reply-module"],
    queryFn: async () => (await db.from("app_settings").select("reply_module_enabled").maybeSingle()).data?.reply_module_enabled ?? false
  });
  const { data: replies } = useQuery({
    queryKey: ["replies"],
    queryFn: async () => (await db.from("replies").select("*, leads(name,business_name,website), campaigns(name)").order("received_at", { ascending: false })).data ?? []
  });
  const [activeId, setActiveId] = useState(null);
  const active = replies?.find((r) => r.id === activeId) ?? replies?.[0];
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState({ from_email: "", subject: "", body: "" });
  useEffect(() => setDraft(active?.suggested_response ?? ""), [active?.id, active?.suggested_response]);
  if (enabled === false)
    return <>
        <PageHeader title="Reply Tracking" />
        <p className="text-muted-foreground">The reply module is turned off. Your administrator can enable it.</p>
      </>;
  const refresh = () => qc.invalidateQueries({ queryKey: ["replies"] });
  async function addManual(e) {
    e.preventDefault();
    const { data: lead } = await db.from("leads").select("id").eq("email", manual.from_email.toLowerCase()).maybeSingle();
    const { error } = await db.from("replies").insert({ ...manual, lead_id: lead?.id ?? null });
    if (error) {
      toast.error(error.message);
      return;
    }
    setManual({ from_email: "", subject: "", body: "" });
    refresh();
  }
  return <>
      <PageHeader title="Reply Inbox" subtitle="AI suggests responses — nothing is sent until you approve it." />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <div className="glass max-h-[60vh] divide-y overflow-auto rounded-2xl">
            {replies?.map((r) => <button key={r.id} onClick={() => setActiveId(r.id)} className={`block w-full p-4 text-left text-sm ${active?.id === r.id ? "bg-secondary" : "hover:bg-secondary/50"}`}>
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">{r.from_email}</span>
                  {r.classification && <span className="text-xs capitalize text-aqua">{r.classification.replace("_", " ")}</span>}
                </div>
                <div className="truncate text-muted-foreground">{r.subject}</div>
              </button>)}
            {!replies?.length && <p className="p-4 text-sm text-muted-foreground">No replies yet.</p>}
          </div>
          <form onSubmit={addManual} className="glass space-y-2 rounded-2xl p-4">
            <div className="text-sm font-semibold">Log a reply manually</div>
            <Input type="email" required placeholder="From email" value={manual.from_email} onChange={(e) => setManual({ ...manual, from_email: e.target.value })} />
            <Input placeholder="Subject" value={manual.subject} onChange={(e) => setManual({ ...manual, subject: e.target.value })} />
            <Textarea required rows={3} placeholder="Message" value={manual.body} onChange={(e) => setManual({ ...manual, body: e.target.value })} />
            <Button size="sm" type="submit" variant="glass">Add</Button>
          </form>
        </div>
        {active && <div className="glass rounded-2xl p-6">
            <div className="text-sm text-muted-foreground">
              {active.from_email} · {active.campaigns?.name ?? "No campaign"} ·{" "}
              {new Date(active.received_at).toLocaleString()}
            </div>
            {active.leads && <div className="mt-1 text-xs text-muted-foreground">
                Lead: {active.leads.name} · {active.leads.business_name}
              </div>}
            <h2 className="mt-3 text-xl font-semibold">{active.subject}</h2>
            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-secondary/50 p-4 text-sm">{active.body}</p>
            <div className="mt-6 flex items-center justify-between">
              <h3 className="font-semibold">Your response</h3>
              <Button size="sm" variant="glass" disabled={busy} onClick={async () => {
    setBusy(true);
    try {
      const r = await suggestReplyResponse({ data: { replyId: active.id } });
      setDraft(r.response);
      refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }}>
                <Sparkles /> AI suggest
              </Button>
            </div>
            <Textarea className="mt-2" rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button className="mt-3" variant="hero" disabled={busy || !draft || active.responded} onClick={async () => {
    setBusy(true);
    try {
      await sendReply({ data: { replyId: active.id, body: draft } });
      toast.success("Reply sent");
      refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }}>
              <Send /> {active.responded ? "Responded" : "Approve & send"}
            </Button>
          </div>}
      </div>
    </>;
}
export {
  Route
};
