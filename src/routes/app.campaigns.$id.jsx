import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, MailPlus, Pause, Play, RefreshCw, RotateCcw, Sparkles, Square, Trash2 } from "lucide-react";
import { db } from "@/lib/db-client";
import { PageHeader, StatusBadge } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateCampaignEmails, generateFollowups, regenerateEmail } from "@/lib/ai.functions";
import { getFollowupStats, processCampaignBatch } from "@/lib/sending.functions";
const Route = createFileRoute("/app/campaigns/$id")({
  head: () => ({
    meta: [
      { title: "Campaign \u2014 Origami99" },
      { name: "description", content: "Generate, approve and send campaign emails." },
      { property: "og:title", content: "Campaign \u2014 Origami99" },
      { property: "og:description", content: "Generate, approve and send campaign emails." }
    ]
  }),
  component: CampaignPage
});
function CampaignPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const campaign = useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => (await db.from("campaigns").select("*").eq("id", id).single()).data
  });
  const emails = useQuery({
    queryKey: ["campaign-emails", id],
    queryFn: async () => (await db.from("campaign_emails").select("id,subject,body,status,error,lead_id,is_followup,leads(name,email,business_name)").eq("campaign_id", id).order("created_at")).data ?? []
  });
  const leads = useQuery({
    queryKey: ["leads-all"],
    queryFn: async () => (await db.from("leads").select("id,name,email,business_name").order("created_at", { ascending: false }).limit(1e3)).data ?? []
  });
  const logs = useQuery({
    queryKey: ["logs", id],
    queryFn: async () => (await db.from("email_logs").select("*").eq("campaign_id", id).order("created_at", { ascending: false }).limit(100)).data ?? []
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["campaign", id] });
    qc.invalidateQueries({ queryKey: ["campaign-emails", id] });
    qc.invalidateQueries({ queryKey: ["logs", id] });
  };
  const [selected, setSelected] = useState(/* @__PURE__ */ new Set());
  const [genProgress, setGenProgress] = useState(null);
  const existing = new Set(emails.data?.map((e) => e.lead_id));
  const available = leads.data?.filter((l) => !existing.has(l.id)) ?? [];
  async function generate() {
    const ids = [...selected];
    if (!ids.length) {
      toast.error("Select at least one lead");
      return;
    }
    setGenProgress({ done: 0, total: ids.length });
    let failures = 0;
    for (let i = 0; i < ids.length; i += 5) {
      try {
        const r = await generateCampaignEmails({ data: { campaignId: id, leadIds: ids.slice(i, i + 5) } });
        failures += r.failures.length;
      } catch (e) {
        toast.error(e.message);
        break;
      }
      setGenProgress({ done: Math.min(i + 5, ids.length), total: ids.length });
      refresh();
    }
    setGenProgress(null);
    setSelected(/* @__PURE__ */ new Set());
    if (failures) toast.warning(`${failures} emails could not be generated`);
    else toast.success("Emails generated \u2014 review and approve them");
  }
  async function setStatus(status) {
    await db.from("campaigns").update({ status, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
    refresh();
  }
  async function retryFailed() {
    await db.from("campaign_emails").update({ status: "approved", error: null }).eq("campaign_id", id).eq("status", "failed");
    toast.success("Failed emails re-queued");
    refresh();
  }
  async function approveAll() {
    await db.from("campaign_emails").update({ status: "approved" }).eq("campaign_id", id).eq("status", "draft");
    refresh();
  }
  const running = campaign.data?.status === "running";
  const loopRef = useRef(false);
  useEffect(() => {
    if (!running || loopRef.current) return;
    loopRef.current = true;
    (async () => {
      try {
        while (true) {
          const r = await processCampaignBatch({ data: { campaignId: id } });
          refresh();
          if (r.status !== "running" || r.remaining === 0) break;
          await new Promise((res) => setTimeout(res, 1500));
        }
      } catch (e) {
        toast.error(e.message);
        await setStatus("paused");
      } finally {
        loopRef.current = false;
        refresh();
      }
    })();
  }, [running, id]);
  const c = campaign.data;
  if (!c) return <p className="text-muted-foreground">Loading…</p>;
  const list = emails.data ?? [];
  const counts = (s) => list.filter((e) => e.status === s).length;
  const sent = counts("sent");
  const total = list.length;
  return <>
      <PageHeader
    title={c.name}
    subtitle={`${c.niche || "\u2014"} \xB7 ${c.audience || "\u2014"} \xB7 ${c.language} \xB7 ${c.tone} \xB7 ${c.length}`}
    action={<StatusBadge status={c.status} />}
  />

      <div className="glass mb-6 rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-2">
          {(c.status === "draft" || c.status === "stopped" || c.status === "completed") && <Button variant="hero" onClick={() => setStatus("running")} disabled={!counts("approved")}>
              <Play /> Start campaign
            </Button>}
          {c.status === "running" && <Button variant="secondary" onClick={() => setStatus("paused")}><Pause /> Pause</Button>}
          {c.status === "paused" && <Button variant="hero" onClick={() => setStatus("running")}><Play /> Resume</Button>}
          {(c.status === "running" || c.status === "paused") && <Button variant="destructive" onClick={() => setStatus("stopped")}><Square /> Stop</Button>}
          <Button variant="glass" onClick={retryFailed} disabled={!counts("failed")}><RotateCcw /> Retry failed ({counts("failed")})</Button>
          <Button variant="glass" onClick={approveAll} disabled={!counts("draft")}><Check /> Approve all drafts</Button>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-gradient-primary transition-all" style={{ width: `${total ? sent / total * 100 : 0}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Draft {counts("draft")}</span><span>Approved {counts("approved")}</span>
          <span>Sent {sent}</span><span>Failed {counts("failed")}</span><span>Total {total}</span>
        </div>
        {running && <p className="mt-2 text-xs text-warning">Sending… keep this page open while the campaign runs.</p>}
      </div>

      <Tabs defaultValue="emails">
        <TabsList>
          <TabsTrigger value="emails">Emails ({total})</TabsTrigger>
          <TabsTrigger value="generate">Generate ({available.length} leads)</TabsTrigger>
          <TabsTrigger value="followup">Follow-up</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="glass mt-4 rounded-2xl p-5">
          {available.length === 0 ? <p className="text-sm text-muted-foreground">
              All leads have emails. <Link to="/app/leads" className="text-primary underline">Import more leads</Link>
            </p> : <>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <Button variant="glass" size="sm" onClick={() => setSelected(new Set(available.map((l) => l.id)))}>Select all</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(/* @__PURE__ */ new Set())}>Clear</Button>
                <Button variant="hero" onClick={generate} disabled={!!genProgress || !selected.size}>
                  <Sparkles /> {genProgress ? `Generating ${genProgress.done}/${genProgress.total}\u2026` : `Generate for ${selected.size} leads`}
                </Button>
              </div>
              <div className="max-h-96 divide-y overflow-auto">
                {available.map((l) => <label key={l.id} className="flex cursor-pointer items-center gap-3 py-2 text-sm">
                    <Checkbox
    checked={selected.has(l.id)}
    onCheckedChange={(v) => {
      const n = new Set(selected);
      if (v) n.add(l.id);
      else n.delete(l.id);
      setSelected(n);
    }}
  />
                    <span className="font-medium">{l.name || l.business_name || "\u2014"}</span>
                    <span className="text-muted-foreground">{l.email}</span>
                  </label>)}
              </div>
            </>}
        </TabsContent>

        <TabsContent value="emails" className="mt-4 space-y-4">
          {list.length === 0 && <p className="text-sm text-muted-foreground">No emails yet — use the Generate tab.</p>}
          {list.map((e) => <EmailCard key={e.id} email={e} onChange={refresh} />)}
        </TabsContent>

        <TabsContent value="followup" className="mt-4">
          <FollowupTab campaignId={id} onGenerated={refresh} />
        </TabsContent>

        <TabsContent value="logs" className="glass mt-4 rounded-2xl p-5">
          <div className="space-y-1 font-mono text-xs">
            {logs.data?.map((l) => <div key={l.id} className={l.level === "error" ? "text-destructive" : "text-muted-foreground"}>
                {new Date(l.created_at).toLocaleString()} — {l.message}
              </div>)}
            {!logs.data?.length && <p className="text-muted-foreground">No sending activity yet.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </>;
}
function FollowupTab({ campaignId, onGenerated }) {
  const stats = useQuery({
    queryKey: ["followup-stats", campaignId],
    queryFn: () => getFollowupStats({ data: { campaignId } })
  });
  const [delay, setDelay] = useState("1");
  const [picked, setPicked] = useState(/* @__PURE__ */ new Set());
  const [busy, setBusy] = useState(false);
  const s = stats.data;
  if (!s) return <p className="text-sm text-muted-foreground">Loading follow-up stats…</p>;
  const statCards = [
    { label: "Emails sent", value: s.sent },
    { label: "Replies received", value: s.replied },
    { label: "No reply", value: s.noReply },
    { label: "Failed", value: s.failed },
    { label: "Follow-ups sent", value: s.followupsSent },
    { label: "Eligible for follow-up", value: s.eligible.length }
  ];
  async function generate() {
    const ids = [...picked];
    if (!ids.length) {
      toast.error("Select at least one recipient");
      return;
    }
    setBusy(true);
    let failures = 0;
    for (let i = 0; i < ids.length; i += 5) {
      try {
        const r = await generateFollowups({ data: { campaignId, emailIds: ids.slice(i, i + 5), delayDays: Number(delay) } });
        failures += r.failures.length;
      } catch (e) {
        toast.error(e.message);
        break;
      }
    }
    setBusy(false);
    setPicked(/* @__PURE__ */ new Set());
    stats.refetch();
    onGenerated();
    if (failures) toast.warning(`${failures} follow-ups could not be generated`);
    else toast.success("Follow-up drafts created \u2014 review and approve them in the Emails tab");
  }
  return <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map((c) => <div key={c.label} className="glass rounded-2xl p-4">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 font-display text-xl font-bold">{c.value}</div>
          </div>)}
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Follow up after</span>
          <Select value={delay} onValueChange={setDelay}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 day</SelectItem>
              <SelectItem value="3">3 days</SelectItem>
              <SelectItem value="5">5 days</SelectItem>
              <SelectItem value="7">7 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="glass" size="sm" onClick={() => setPicked(new Set(s.eligible.map((e) => e.email_id)))}>Select all</Button>
          <Button variant="ghost" size="sm" onClick={() => setPicked(/* @__PURE__ */ new Set())}>Clear</Button>
          <Button variant="hero" onClick={generate} disabled={busy || !picked.size}>
            <MailPlus /> {busy ? "Generating\u2026" : `Generate follow-ups (${picked.size})`}
          </Button>
        </div>
        {s.eligible.length === 0 ? <p className="text-sm text-muted-foreground">
            No eligible recipients. Recipients who replied, bounced, or already have a follow-up are excluded automatically.
          </p> : <div className="max-h-96 divide-y overflow-auto">
            {s.eligible.map((e) => <label key={e.email_id} className="flex cursor-pointer items-center gap-3 py-2 text-sm">
                <Checkbox
    checked={picked.has(e.email_id)}
    onCheckedChange={(v) => {
      const n = new Set(picked);
      if (v) n.add(e.email_id);
      else n.delete(e.email_id);
      setPicked(n);
    }}
  />
                <span className="font-medium">{e.name || e.business_name || "\u2014"}</span>
                <span className="text-muted-foreground">{e.email}</span>
              </label>)}
          </div>}
        <p className="mt-3 text-xs text-muted-foreground">
          Follow-ups are created as drafts. Preview, edit and approve them in the Emails tab, then start the campaign to send.
        </p>
      </div>
    </div>;
}
function EmailCard({ email, onChange }) {
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSubject(email.subject);
    setBody(email.body);
  }, [email.subject, email.body]);
  const locked = email.status === "sent";
  const dirty = subject !== email.subject || body !== email.body;
  async function save(status) {
    await db.from("campaign_emails").update({ subject, body, ...status ? { status } : {}, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", email.id);
    onChange();
  }
  async function regen() {
    setBusy(true);
    try {
      await regenerateEmail({ data: { emailId: email.id } });
      onChange();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">{email.leads?.name || email.leads?.business_name || "\u2014"}</span>{" "}
          <span className="text-muted-foreground">{email.leads?.email}</span>
          {email.is_followup && <span className="ml-2 rounded-full bg-aqua/15 px-2 py-0.5 text-xs text-aqua">follow-up</span>}
        </div>
        <StatusBadge status={email.status} />
      </div>
      <Input value={subject} disabled={locked} onChange={(e) => setSubject(e.target.value)} className="mb-2 font-semibold" />
      <Textarea value={body} disabled={locked} rows={7} onChange={(e) => setBody(e.target.value)} />
      {email.error && <p className="mt-2 text-xs text-destructive">{email.error}</p>}
      {!locked && <div className="mt-3 flex flex-wrap gap-2">
          {dirty && <Button size="sm" variant="secondary" onClick={() => save()}>Save edits</Button>}
          {email.status !== "approved" && <Button size="sm" variant="hero" onClick={() => save("approved")}><Check /> Approve</Button>}
          {email.status === "approved" && <Button size="sm" variant="glass" onClick={() => save("draft")}>Unapprove</Button>}
          <Button size="sm" variant="glass" onClick={regen} disabled={busy}><RefreshCw className={busy ? "animate-spin" : ""} /> Regenerate</Button>
          <Button size="sm" variant="ghost" onClick={async () => {
    await db.from("campaign_emails").delete().eq("id", email.id);
    onChange();
  }}>
            <Trash2 />
          </Button>
        </div>}
    </div>;
}
export {
  Route
};
