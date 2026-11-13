import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUpDown, Download, Mail, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dateRange, isEmailable } from "@/lib/crm-sync";
import { syncCrmToRecipients } from "@/lib/crm.functions";
const emptyFilters = { q: "", keyword: "", city: "", area: "", stage: "all", email: "any", date: "all", from: "", to: "", extraction: "all", campaign: "any" };
function useStages() {
  return useQuery({
    queryKey: ["crm-stages"],
    queryFn: async () => {
      await db.rpc("ensure_crm_stages");
      return (await db.from("crm_stages").select("*").order("position")).data ?? [];
    }
  });
}
function useCrmLeads(f) {
  return useQuery({
    queryKey: ["crm-leads", f],
    queryFn: async () => {
      let q = db.from("crm_leads").select("*").order("extracted_at", { ascending: false }).limit(2e3);
      const r = dateRange(f.date, /* @__PURE__ */ new Date(), f.from, f.to);
      if (r.gte) q = q.gte("extracted_at", r.gte);
      if (r.lt) q = q.lt("extracted_at", r.lt);
      if (f.keyword) q = q.ilike("keyword", `%${f.keyword}%`);
      if (f.city) q = q.ilike("city", `%${f.city}%`);
      if (f.area) q = q.ilike("area_code", `%${f.area}%`);
      if (f.stage !== "all") q = q.eq("stage_id", f.stage);
      if (f.extraction !== "all") q = q.eq("extraction_id", f.extraction);
      if (f.email === "yes") q = q.not("email", "is", null);
      if (f.email === "no") q = q.is("email", null);
      if (f.q) q = q.or(`business_name.ilike.%${f.q}%,email.ilike.%${f.q}%,phone.ilike.%${f.q}%,category.ilike.%${f.q}%`);
      let rows = (await q).data ?? [];
      if (f.campaign !== "any") {
        const ids = rows.map((r2) => r2.lead_id).filter(Boolean);
        const inCamp = /* @__PURE__ */ new Set();
        for (let i = 0; i < ids.length; i += 300) {
          const { data } = await db.from("campaign_emails").select("lead_id").in("lead_id", ids.slice(i, i + 300));
          data?.forEach((d) => inCamp.add(d.lead_id));
        }
        rows = rows.filter((r2) => f.campaign === "in" === (!!r2.lead_id && inCamp.has(r2.lead_id)));
      }
      return rows;
    }
  });
}
function FilterBar({ f, set, stages, extractions, show = {} }) {
  const u = (k) => (v) => set({ ...f, [k]: v });
  return <div className="glass mb-4 grid gap-2 rounded-2xl p-3 sm:grid-cols-2 lg:grid-cols-6">
      <Input placeholder="Search name, email, phone…" value={f.q} onChange={(e) => u("q")(e.target.value)} className="lg:col-span-2" />
      <Input placeholder="Keyword e.g. Dental Clinics" value={f.keyword} onChange={(e) => u("keyword")(e.target.value)} />
      <Input placeholder="City" value={f.city} onChange={(e) => u("city")(e.target.value)} />
      <Input placeholder="Area code" value={f.area} onChange={(e) => u("area")(e.target.value)} />
      <Select value={f.email} onValueChange={u("email")}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="any">Email: any</SelectItem><SelectItem value="yes">Has email</SelectItem><SelectItem value="no">No email</SelectItem></SelectContent>
      </Select>
      <Select value={f.date} onValueChange={u("date")}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any extraction date</SelectItem><SelectItem value="today">Today</SelectItem><SelectItem value="yesterday">Yesterday</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem><SelectItem value="30d">Last 30 days</SelectItem><SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>
      {f.date === "custom" && <>
        <Input type="date" value={f.from} onChange={(e) => u("from")(e.target.value)} aria-label="From date" />
        <Input type="date" value={f.to} onChange={(e) => u("to")(e.target.value)} aria-label="To date" />
      </>}
      {show.stage !== false && stages && <Select value={f.stage} onValueChange={u("stage")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All stages</SelectItem>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>}
      {extractions && <Select value={f.extraction} onValueChange={u("extraction")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All extractions</SelectItem>{extractions.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
        </Select>}
      <Select value={f.campaign} onValueChange={u("campaign")}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="any">Campaign: any</SelectItem><SelectItem value="in">In a campaign</SelectItem><SelectItem value="none">Not in a campaign</SelectItem></SelectContent>
      </Select>
      <Button variant="ghost" onClick={() => set(emptyFilters)}>Clear filters</Button>
    </div>;
}
const COLS = [
  { k: "business_name", label: "Business" },
  { k: "category", label: "Category" },
  { k: "address", label: "Location" },
  { k: "phone", label: "Phone" },
  { k: "email", label: "Email" },
  { k: "website", label: "Website" },
  { k: "area_code", label: "Area" },
  { k: "extracted_at", label: "Extracted" },
  { k: "keyword", label: "Keyword" }
];
async function exportLeads(rows, type, stages = []) {
  const sn = new Map(stages.map((s) => [s.id, s.name]));
  const data = rows.map((r) => ({
    "Business Name": r.business_name,
    Category: r.category ?? "",
    Location: r.address ?? "",
    City: r.city ?? "",
    "Area Code": r.area_code ?? "",
    Phone: r.phone ?? "",
    Email: r.email ?? "",
    Website: r.website ?? "",
    "Google Maps URL": r.maps_url ?? "",
    "Google Place ID": r.place_id ?? "",
    Rating: r.rating ?? "",
    Reviews: r.reviews_count ?? "",
    "Open Status": r.open_status ?? "",
    "Opening Hours": r.opening_hours ?? "",
    Latitude: r.latitude ?? "",
    Longitude: r.longitude ?? "",
    Keyword: r.keyword ?? "",
    Stage: sn.get(r.stage_id ?? "") ?? "",
    "Extraction Date": new Date(r.extracted_at).toLocaleDateString(),
    "Extraction Time": new Date(r.extracted_at).toLocaleTimeString()
  }));
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(data);
  if (type === "csv") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: "text/csv" }));
    a.download = "origami99-leads.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, "origami99-leads.xlsx");
  }
}
function useCampaignActions() {
  const nav = useNavigate();
  const sync = syncCrmToRecipients;
  return async (ids, campaignId) => {
    const r = await sync({ data: { crmIds: ids } });
    if (!r.leadIds.length) {
      toast.error("None of the selected leads has a valid email address");
      return;
    }
    let cid = campaignId;
    if (cid === "new") {
      const { data, error } = await db.from("campaigns").insert({ name: `CRM selection ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`, offer: "", language: "English", tone: "Professional", length: "Medium" }).select("id").single();
      if (error || !data) {
        toast.error(error?.message ?? "Could not create campaign");
        return;
      }
      cid = data.id;
    }
    sessionStorage.setItem(`o99-preselect-${cid}`, JSON.stringify(r.leadIds));
    toast.success(`${r.leadIds.length} recipients ready${r.skipped ? ` \xB7 ${r.skipped} skipped (no email, unsubscribed or duplicate)` : ""}`);
    nav({ to: "/app/campaigns/$id", params: { id: cid } });
  };
}
function LeadTable({ rows, stages = [], onOpen }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState(/* @__PURE__ */ new Set());
  const [sort, setSort] = useState({ k: "extracted_at", asc: false });
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState("");
  const per = 50;
  useEffect(() => setPage(0), [rows.length]);
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const x = String(a[sort.k] ?? ""), y = String(b[sort.k] ?? "");
    return (sort.asc ? 1 : -1) * x.localeCompare(y);
  }), [rows, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / per));
  const view = sorted.slice(page * per, page * per + per);
  const sn = new Map(stages.map((s) => [s.id, s.name]));
  const campaigns = useQuery({ queryKey: ["campaign-names"], queryFn: async () => (await db.from("campaigns").select("id,name").order("created_at", { ascending: false })).data ?? [] });
  const toCampaign = useCampaignActions();
  const ids = [...sel];
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-leads"] });
  return <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{rows.length} leads · {rows.filter(isEmailable).length} with email · {sel.size} selected</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="glass" onClick={() => setSel(new Set(rows.map((r) => r.id)))}>Select all {rows.length}</Button>
          <Button size="sm" variant="glass" onClick={() => setSel(new Set(rows.filter(isEmailable).map((r) => r.id)))}><Mail /> Select with email</Button>
          {sel.size > 0 && <Button size="sm" variant="ghost" onClick={() => setSel(/* @__PURE__ */ new Set())}>Clear</Button>}
          <Button size="sm" variant="glass" onClick={() => exportLeads(sel.size ? rows.filter((r) => sel.has(r.id)) : rows, "csv", stages)}><Download /> CSV</Button>
          <Button size="sm" variant="glass" onClick={() => exportLeads(sel.size ? rows.filter((r) => sel.has(r.id)) : rows, "xlsx", stages)}><Download /> Excel</Button>
        </div>
      </div>
      {sel.size > 0 && <div className="glass mb-3 flex flex-wrap items-center gap-2 rounded-2xl p-3 text-sm">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Add to campaign…" /></SelectTrigger>
            <SelectContent>{campaigns.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="hero" disabled={!target} onClick={() => toCampaign(ids, target)}>Add to campaign</Button>
          <Button size="sm" variant="glass" onClick={() => toCampaign(ids, "new")}><Plus /> New campaign</Button>
          {stages.length > 0 && <Select onValueChange={async (s) => {
    await db.from("crm_leads").update({ stage_id: s, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).in("id", ids);
    refresh();
    toast.success("Stage updated");
  }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Move to stage…" /></SelectTrigger>
              <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>}
          <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
    if (!confirm(`Delete ${ids.length} leads?`)) return;
    for (let i = 0; i < ids.length; i += 300) await db.from("crm_leads").delete().in("id", ids.slice(i, i + 300));
    setSel(/* @__PURE__ */ new Set());
    refresh();
    toast.success("Deleted");
  }}><Trash2 /> Delete</Button>
        </div>}
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="p-3 w-8" />
              {COLS.map((c) => <th key={c.k} className="p-3 whitespace-nowrap">
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort({ k: c.k, asc: sort.k === c.k ? !sort.asc : true })}>
                    {c.label} <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>)}
              {stages.length > 0 && <th className="p-3">Stage</th>}
            </tr>
          </thead>
          <tbody>
            {view.map((l) => <tr key={l.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="p-3"><Checkbox checked={sel.has(l.id)} onCheckedChange={(v) => {
    const n = new Set(sel);
    v ? n.add(l.id) : n.delete(l.id);
    setSel(n);
  }} aria-label="Select lead" /></td>
                <td className="p-3 font-medium"><button className="text-left hover:text-primary" onClick={() => onOpen?.(l)}>{l.business_name}</button>{l.unsubscribed && <span className="ml-1 text-xs text-destructive">unsubscribed</span>}</td>
                <td className="p-3 text-muted-foreground">{l.category}</td>
                <td className="p-3 text-muted-foreground max-w-56 truncate" title={l.address ?? ""}>{l.address}</td>
                <td className="p-3 whitespace-nowrap">{l.phone}</td>
                <td className="p-3">{l.email ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="p-3 max-w-40 truncate">{l.website && <a href={l.website} target="_blank" rel="noreferrer" className="text-aqua hover:underline">{l.website.replace(/^https?:\/\/(www\.)?/, "")}</a>}</td>
                <td className="p-3">{l.area_code}</td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">{new Date(l.extracted_at).toLocaleDateString()}</td>
                <td className="p-3 text-muted-foreground">{l.keyword}</td>
                {stages.length > 0 && <td className="p-3 whitespace-nowrap">{sn.get(l.stage_id ?? "")}</td>}
              </tr>)}
          </tbody>
        </table>
        {!rows.length && <p className="p-6 text-center text-muted-foreground">No leads match these filters.</p>}
      </div>
      {pages > 1 && <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="glass" disabled={!page} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page + 1} of {pages}</span>
          <Button size="sm" variant="glass" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>}
    </>;
}
function LeadSheet({ lead, stages, onClose }) {
  const qc = useQueryClient();
  const [f, setF] = useState(lead);
  useEffect(() => setF(lead), [lead]);
  const history = useQuery({
    enabled: !!lead?.lead_id,
    queryKey: ["lead-history", lead?.lead_id],
    queryFn: async () => (await db.from("campaign_emails").select("id,subject,status,sent_at,is_followup,campaigns(name)").eq("lead_id", lead.lead_id).order("created_at", { ascending: false })).data ?? []
  });
  if (!f) return null;
  const field = (k, label, type = "text") => <div className="space-y-1"><Label className="text-xs">{label}</Label>
      <Input type={type} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value || null })} /></div>;
  async function save() {
    const { id, extracted_at, source, extraction_id, lead_id, last_contacted_at, ...rest } = f;
    const { error } = await db.from("crm_leads").update({ ...rest, email: rest.email?.trim().toLowerCase() || null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (lead_id) await db.from("leads").update({ unsubscribed: rest.unsubscribed }).eq("id", lead_id);
    await syncCrmToRecipients({ data: { crmIds: [id] } });
    toast.success("Lead saved");
    qc.invalidateQueries({ queryKey: ["crm-leads"] });
    onClose();
  }
  return <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>{f.business_name}</SheetTitle></SheetHeader>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {field("business_name", "Business name")}{field("category", "Category")}
          {field("contact_person", "Contact person")}{field("email", "Email", "email")}
          {field("phone", "Phone")}{field("website", "Website")}
          <div className="sm:col-span-2">{field("address", "Full location")}</div>
          {field("city", "City")}{field("area_code", "Area code")}
          <div className="space-y-1"><Label className="text-xs">Stage</Label>
            <Select value={f.stage_id ?? ""} onValueChange={(v) => setF({ ...f, stage_id: v })}>
              <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select></div>
          {field("followup_date", "Follow-up date", "date")}
          <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Notes</Label>
            <Textarea rows={4} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={f.unsubscribed} onCheckedChange={(v) => setF({ ...f, unsubscribed: !!v })} /> Unsubscribed — never email this lead
          </label>
        </div>
        <div className="mt-4 space-y-1 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          <div>Keyword: {f.keyword ?? "\u2014"} · Source: {f.source}</div>
          {(f.rating != null || f.open_status) && <div>Rating: {f.rating ?? "\u2014"}{f.reviews_count != null ? ` (${f.reviews_count} reviews)` : ""} · {f.open_status ?? "Hours unknown"}</div>}
          {f.opening_hours && <div>Hours: {f.opening_hours}</div>}
          {f.latitude != null && f.longitude != null && <div>Location: {f.latitude}, {f.longitude}</div>}
          <div>Extracted: {new Date(f.extracted_at).toLocaleString()}</div>
          <div>Last contacted: {f.last_contacted_at ? new Date(f.last_contacted_at).toLocaleString() : "never"}</div>
          {f.maps_url && <a className="text-aqua hover:underline" href={f.maps_url} target="_blank" rel="noreferrer">Open on Google Maps</a>}
        </div>
        <h3 className="mt-4 mb-2 text-sm font-semibold">Email campaign history</h3>
        {history.data?.length ? <ul className="space-y-1 text-sm">{history.data.map((h) => <li key={h.id} className="flex justify-between gap-2"><span className="truncate">{h.campaigns?.name} — {h.subject}{h.is_followup ? " (follow-up)" : ""}</span><span className="capitalize text-muted-foreground">{h.status}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">No emails yet.</p>}
        <Button variant="hero" className="mt-5 w-full" onClick={save}>Save lead</Button>
      </SheetContent>
    </Sheet>;
}
export {
  FilterBar,
  LeadSheet,
  LeadTable,
  emptyFilters,
  exportLeads,
  useCampaignActions,
  useCrmLeads,
  useStages
};
