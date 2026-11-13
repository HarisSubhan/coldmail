import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, KeyRound, MapPin, RotateCcw, Search, Square, Trash2 } from "lucide-react";
import { db } from "@/lib/db-client";
import { PageHeader, StatusBadge } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { createExtensionToken } from "@/lib/crm.functions";
import { buildSearchQueries } from "@/lib/extraction-queries";
import { emptyFilters, FilterBar, LeadSheet, LeadTable, useCrmLeads, useStages } from "@/components/LeadTable";

const Route = createFileRoute("/app/lead-finder")({
  head: () => ({
    meta: [
      { title: "Lead Finder — Origami99" },
      { name: "description", content: "Collect business leads from Google Maps by keyword, city and area codes." },
      { property: "og:title", content: "Lead Finder — Origami99" },
      { property: "og:description", content: "Collect business leads from Google Maps by keyword, city and area codes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" }
    ]
  }),
  component: LeadFinder
});

function downloadExtension() {
  fetch("/origami99-maps-extractor.zip").then((r) => {
    if (!r.ok) throw new Error(`Download failed: ${r.status}`);
    return r.blob();
  }).then((b) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "origami99-maps-extractor.zip";
    a.click();
    URL.revokeObjectURL(a.href);
  }).catch((e) => toast.error(e.message));
}

function LeadFinder() {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", keyword: "", city: "", areas: "", max_results: "", find_emails: true });
  const [token, setToken] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [open, setOpen] = useState(null);
  const stages = useStages();
  const exts = useQuery({
    queryKey: ["extractions"],
    refetchInterval: (q) => q.state.data?.some((e) => e.status === "running" || e.status === "pending") ? 3e3 : false,
    queryFn: async () => (await db.from("lead_extractions").select("*").order("created_at", { ascending: false }).limit(50)).data ?? []
  });
  const running = exts.data?.some((e) => e.status === "running");
  const ids = (exts.data ?? []).map((e) => e.id);
  const counts = useQuery({
    queryKey: ["extraction-counts", ids],
    enabled: ids.length > 0,
    refetchInterval: running ? 3e3 : false,
    queryFn: async () => {
      const { data } = await db.rpc("extraction_counts", { _ids: ids });
      const out = {};
      for (const r of data ?? []) {
        const c = (out[r.extraction_id] ??= { total: 0, pending: 0, processing: 0, completed: 0, partial: 0, failed: 0, phones: 0, emails: 0, websites: 0 });
        const n = Number(r.total);
        c.total += n;
        c[r.status] = n;
        c.phones += Number(r.phones);
        c.emails += Number(r.emails);
        c.websites += Number(r.websites);
      }
      return out;
    }
  });
  const areaList = f.areas.split(/[\s,;\n]+/).map((a) => a.trim()).filter(Boolean).slice(0, 50);
  const queries = buildSearchQueries(f.keyword, areaList);
  const leads = useCrmLeads({ ...filters });
  const leadRows = (leads.data ?? []).filter((l) => l.source === "lead_finder");
  if (running && !leads.isFetching) setTimeout(() => qc.invalidateQueries({ queryKey: ["crm-leads"] }), 4e3);

  async function start(e) {
    e.preventDefault();
    const max = f.max_results.trim() ? Math.max(1, Math.floor(Number(f.max_results))) : null;
    const { error } = await db.from("lead_extractions").insert({
      name: f.name.trim() || f.keyword.trim(),
      keyword: f.keyword.trim(),
      city: f.city.trim() || null,
      area_codes: areaList,
      max_results: max && Number.isFinite(max) ? max : null,
      find_emails: f.find_emails
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Search queued — the extension will start it within 30 seconds");
    qc.invalidateQueries({ queryKey: ["extractions"] });
  }
  async function connect() {
    try {
      const t = (await createExtensionToken()).token;
      setToken("O99-" + btoa(JSON.stringify({ u: window.location.origin, t })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    } catch (e) {
      toast.error(e.message);
    }
  }

  return <>
      <PageHeader
    title="Lead Finder"
    subtitle="Search Google Maps exactly as you type it. Every business in the results is queued and opened one by one. Results go straight into your CRM."
    action={<div className="flex flex-wrap gap-2"><Button variant="glass" onClick={downloadExtension}><Download /> Download extension</Button><Button variant="hero" onClick={connect}><KeyRound /> Get connect code</Button></div>}
  />

      {token && <div className="glass mb-6 rounded-2xl p-5 text-sm">
          <p className="mb-2 font-semibold">Your connect code (shown once — any old code stops working):</p>
          <div className="flex gap-2"><Input readOnly value={token} className="font-mono" /><Button variant="glass" onClick={() => {
    navigator.clipboard.writeText(token);
    toast.success("Copied");
  }}><Copy /></Button></div>
          <p className="mt-2 text-muted-foreground">Paste this code in the extension and click Connect. Nothing else is needed.</p>
        </div>}

      <details className="glass mb-6 rounded-2xl p-5 text-sm">
        <summary className="cursor-pointer font-semibold">How to install the extension (one time)</summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Click <b>Download extension</b> and unzip the file.</li>
          <li>Open <span className="font-mono">chrome://extensions</span> in Chrome or Edge and turn on <b>Developer mode</b>.</li>
          <li>Click <b>Load unpacked</b> and choose the unzipped folder.</li>
          <li>Click <b>Get connect code</b> here, open the extension and paste the code.</li>
          <li>Keep Chrome open. Searches open in their own Chrome window — leave it visible (not minimised) so Google Maps keeps loading results.</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">Automatically reading Google Maps may break Google's terms of use. The extension goes slowly to avoid being blocked; use it responsibly.</p>
      </details>

      <form onSubmit={start} className="glass mb-8 grid gap-4 rounded-2xl p-6 md:grid-cols-3">
        <div className="space-y-2 md:col-span-2"><Label>Google Maps search (used exactly as typed) *</Label><Input required placeholder="e.g. saloons in Islamabad" value={f.keyword} onChange={(e) => setF({ ...f, keyword: e.target.value })} /></div>
        <div className="space-y-2"><Label>City label for saved leads (optional)</Label><Input placeholder="e.g. Islamabad" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
        <div className="space-y-2 md:col-span-2"><Label>Extra area / postal codes (optional — one extra search each)</Label><Input placeholder="Leave empty to search only the keyword" value={f.areas} onChange={(e) => setF({ ...f, areas: e.target.value })} /></div>
        <div className="space-y-2"><Label>Search name</Label><Input placeholder="Defaults to the search text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Maximum businesses (optional)</Label><Input type="number" min={1} placeholder="Empty = every available result" value={f.max_results} onChange={(e) => setF({ ...f, max_results: e.target.value })} /></div>
        <label className="flex items-center gap-3 self-end pb-2 text-sm md:col-span-2"><Switch checked={f.find_emails} onCheckedChange={(v) => setF({ ...f, find_emails: v })} /> Look for emails on business websites</label>
        {queries.length > 0 && <div className="rounded-xl bg-muted/40 p-3 text-sm md:col-span-3">
            <span className="text-muted-foreground">Google Maps will search exactly:</span>{" "}
            {queries.map((q) => <span key={q} className="mr-2 inline-block rounded-md bg-background px-2 py-0.5 font-mono text-xs">{q}</span>)}
          </div>}
        <div className="md:col-span-3"><Button type="submit" variant="hero" size="lg"><Search /> Start extraction</Button></div>
      </form>

      <h2 className="mb-3 text-lg font-semibold">Extractions</h2>
      <div className="mb-8 grid gap-3 md:grid-cols-2">
        {exts.data?.map((x) => <ExtractionCard key={x.id} x={x} c={counts.data?.[x.id]} onShow={() => setFilters({ ...emptyFilters, extraction: x.id })} refresh={() => {
    qc.invalidateQueries({ queryKey: ["extractions"] });
    qc.invalidateQueries({ queryKey: ["extraction-counts"] });
  }} />)}
        {exts.data && !exts.data.length && <p className="text-muted-foreground">No extractions yet.</p>}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Extracted businesses</h2>
      <FilterBar f={filters} set={setFilters} extractions={exts.data?.map((e) => ({ id: e.id, name: e.name }))} show={{ stage: false }} />
      <LeadTable rows={leadRows} stages={stages.data} onOpen={setOpen} />
      <LeadSheet lead={open} stages={stages.data ?? []} onClose={() => setOpen(null)} />
    </>;
}

function ExtractionCard({ x, c, onShow, refresh }) {
  const active = x.status === "running" || x.status === "pending";
  const done = c ? c.completed + c.partial + c.failed : 0;
  const queries = buildSearchQueries(x.keyword, x.area_codes);
  const stage = x.status === "pending" ? "Waiting for the extension…" : !x.discovery_done ? `Stage 1 · scrolling the results${x.current_query ? ` for “${x.current_query}”` : ""}` : "Stage 2 · opening each business";
  async function retry() {
    const { error } = await db.from("extraction_items").update({ status: "pending", error: null }).eq("extraction_id", x.id).in("status", ["failed", "partial"]);
    if (error) {
      toast.error(error.message);
      return;
    }
    await db.from("lead_extractions").update({ status: "running", completed_at: null }).eq("id", x.id);
    toast.success("Queued again — the extension will retry these businesses");
    refresh();
  }
  const stat = (label, v, tone = "") => <div className="rounded-lg bg-muted/40 px-2 py-1"><div className={`text-base font-semibold ${tone}`}>{v ?? 0}</div><div className="text-[11px] text-muted-foreground">{label}</div></div>;
  return <div className="glass rounded-2xl p-4 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <button className="font-semibold hover:text-primary" onClick={onShow}>{x.name}</button>
        <StatusBadge status={x.status} />
      </div>
      <div className="text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />Search: {queries.map((q) => `“${q}”`).join(", ")}{x.city ? ` · saved as ${x.city}` : ""}</div>
      <div className="text-xs text-muted-foreground">{new Date(x.created_at).toLocaleString()}{x.max_results ? ` · limit ${x.max_results}` : ""}</div>
      {active && <div className="mt-2 space-y-1">
          <Progress value={c?.total && x.discovery_done ? done / c.total * 100 : 0} />
          <div className="text-xs">{stage}{c?.total ? ` · ${done} of ${c.total} processed` : ""}</div>
        </div>}
      {c ? <div className="mt-3 grid grid-cols-5 gap-1.5 text-center">
          {stat("Discovered", x.found)}{stat("Queued", c.total)}{stat("Completed", c.completed, "text-aqua")}{stat("Processing", c.processing)}{stat("Pending", c.pending)}
          {stat("Partial", c.partial)}{stat("Failed", c.failed, c.failed ? "text-destructive" : "")}{stat("Phones", c.phones)}{stat("Emails", c.emails)}{stat("Websites", c.websites)}
        </div> : <div className="mt-2 flex flex-wrap gap-3 text-xs"><span>Found {x.found}</span><span>Saved {x.saved}</span><span>Failed {x.failed}</span></div>}
      {x.discovery_done && <p className="mt-2 text-xs text-muted-foreground">
          {x.end_reached ? "Google Maps showed the end of the results list — every listed business was queued." : "Google Maps stopped loading more results before showing its end-of-list message; coverage may be incomplete."}
          {x.coverage_note ? ` ${x.coverage_note}` : ""}
        </p>}
      {x.error && <p className="mt-1 text-xs text-destructive">{x.error}</p>}
      <div className="mt-2 flex gap-2">
        {active && <Button size="sm" variant="glass" onClick={async () => {
    await db.from("lead_extractions").update({ status: "stopped" }).eq("id", x.id);
    refresh();
  }}><Square /> Stop</Button>}
        {!active && c && c.failed + c.partial > 0 && <Button size="sm" variant="glass" onClick={retry}><RotateCcw /> Retry {c.failed + c.partial} incomplete</Button>}
        <Button size="sm" variant="ghost" onClick={async () => {
    if (!confirm("Delete this extraction record? Its leads stay in your CRM.")) return;
    await db.from("lead_extractions").delete().eq("id", x.id);
    refresh();
  }}><Trash2 /></Button>
      </div>
    </div>;
}

export {
  Route
};
