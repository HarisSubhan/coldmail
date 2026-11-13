import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Settings2, Trash2 } from "lucide-react";
import { db } from "@/lib/db-client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { emptyFilters, FilterBar, LeadSheet, LeadTable, useCrmLeads, useStages } from "@/components/LeadTable";
import { useQuery } from "@tanstack/react-query";
const Route = createFileRoute("/app/crm")({
  head: () => ({
    meta: [
      { title: "CRM \u2014 Origami99" },
      { name: "description", content: "Manage leads through your sales pipeline and send them into campaigns." },
      { property: "og:title", content: "CRM \u2014 Origami99" },
      { property: "og:description", content: "Manage leads through your sales pipeline and send them into campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" }
    ]
  }),
  component: Crm
});
function Crm() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState(emptyFilters);
  const [open, setOpen] = useState(null);
  const [manage, setManage] = useState(false);
  const [drag, setDrag] = useState(null);
  const stages = useStages();
  const leads = useCrmLeads(filters);
  const exts = useQuery({ queryKey: ["extraction-names"], queryFn: async () => (await db.from("lead_extractions").select("id,name").order("created_at", { ascending: false })).data ?? [] });
  const rows = leads.data ?? [];
  async function move(id, stage) {
    await db.from("crm_leads").update({ stage_id: stage, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["crm-leads"] });
  }
  async function addLead() {
    const name = prompt("Business name");
    if (!name) return;
    const { error } = await db.from("crm_leads").insert({ business_name: name, stage_id: stages.data?.[0]?.id ?? null, source: "manual" });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["crm-leads"] });
  }
  return <>
      <PageHeader
    title="CRM"
    subtitle="Every lead from Lead Finder lands here automatically. Move leads through your pipeline and email them in one click."
    action={<div className="flex gap-2"><Button variant="glass" onClick={() => setManage(true)}><Settings2 /> Manage stages</Button><Button variant="hero" onClick={addLead}><Plus /> Add lead</Button></div>}
  />
      <FilterBar f={filters} set={setFilters} stages={stages.data} extractions={exts.data ?? []} />
      <Tabs defaultValue="board">
        <TabsList className="mb-4"><TabsTrigger value="board">Pipeline board</TabsTrigger><TabsTrigger value="table">Table</TabsTrigger></TabsList>
        <TabsContent value="board">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {stages.data?.map((s) => {
    const items = rows.filter((r) => r.stage_id === s.id);
    return <div
      key={s.id}
      className="glass flex w-64 shrink-0 flex-col rounded-2xl p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => {
        if (drag) move(drag, s.id);
        setDrag(null);
      }}
    >
                  <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">{s.name}</span><span className="rounded-full bg-muted px-2 text-xs">{items.length}</span></div>
                  <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
                    {items.slice(0, 100).map((l) => <button
      key={l.id}
      draggable
      onDragStart={() => setDrag(l.id)}
      onClick={() => setOpen(l)}
      className="card-3d rounded-xl p-3 text-left text-xs"
    >
                        <div className="text-sm font-medium">{l.business_name}</div>
                        <div className="text-muted-foreground">{[l.category, l.city].filter(Boolean).join(" \xB7 ")}</div>
                        <div className={l.email ? "text-aqua" : "text-muted-foreground"}>{l.email ?? "no email"}</div>
                        {l.followup_date && <div className="text-warning">Follow up {l.followup_date}</div>}
                      </button>)}
                    {items.length > 100 && <p className="text-xs text-muted-foreground">+{items.length - 100} more — use the table view</p>}
                  </div>
                </div>;
  })}
          </div>
        </TabsContent>
        <TabsContent value="table"><LeadTable rows={rows} stages={stages.data} onOpen={setOpen} /></TabsContent>
      </Tabs>
      <LeadSheet lead={open} stages={stages.data ?? []} onClose={() => setOpen(null)} />
      <StageManager open={manage} onClose={() => setManage(false)} stages={stages.data ?? []} counts={rows} />
    </>;
}
function StageManager({ open, onClose, stages, counts }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [del, setDel] = useState(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["crm-stages"] });
    qc.invalidateQueries({ queryKey: ["crm-leads"] });
  };
  const upd = async (id, patch) => {
    await db.from("crm_stages").update(patch).eq("id", id);
    refresh();
  };
  async function swap(i, j) {
    const a = stages[i], b = stages[j];
    if (!a || !b) return;
    await db.from("crm_stages").update({ position: b.position }).eq("id", a.id);
    await db.from("crm_stages").update({ position: a.position }).eq("id", b.id);
    refresh();
  }
  async function remove(id, to) {
    const { count } = await db.from("crm_leads").select("id", { count: "exact", head: true }).eq("stage_id", id);
    if ((count ?? 0) > 0) {
      if (!to) {
        setDel({ id, to: stages.find((s) => s.id !== id)?.id ?? "" });
        return;
      }
      await db.from("crm_leads").update({ stage_id: to }).eq("stage_id", id);
    }
    const { error } = await db.from("crm_stages").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Stage deleted");
    setDel(null);
    refresh();
  }
  return <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Pipeline stages</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {stages.map((s, i) => <div key={s.id} className="rounded-xl border p-2">
              <div className="flex items-center gap-2">
                <Input defaultValue={s.name} onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && upd(s.id, { name: e.target.value.trim() })} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{counts.filter((c) => c.stage_id === s.id).length} leads</span>
                <Button size="icon" variant="ghost" disabled={!i} onClick={() => swap(i, i - 1)} aria-label="Move up"><ArrowUp /></Button>
                <Button size="icon" variant="ghost" disabled={i === stages.length - 1} onClick={() => swap(i, i + 1)} aria-label="Move down"><ArrowDown /></Button>
                <Button size="icon" variant="ghost" disabled={stages.length < 2} onClick={() => remove(s.id)} aria-label="Delete stage"><Trash2 /></Button>
              </div>
              <Input className="mt-1 text-xs" placeholder="Description (optional)" defaultValue={s.description ?? ""} onBlur={(e) => e.target.value !== (s.description ?? "") && upd(s.id, { description: e.target.value || null })} />
              {del?.id === s.id && <div className="mt-2 flex items-center gap-2 rounded-lg bg-warning/10 p-2 text-xs">
                  <span>This stage has leads. Move them to:</span>
                  <Select value={del.to} onValueChange={(v) => setDel({ ...del, to: v })}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{stages.filter((x) => x.id !== s.id).map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="hero" disabled={!del.to} onClick={() => remove(s.id, del.to)}>Move & delete</Button>
                </div>}
            </div>)}
        </div>
        <form className="flex gap-2" onSubmit={async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await db.from("crm_stages").insert({ name: name.trim(), position: (stages.at(-1)?.position ?? 0) + 1 });
    setName("");
    refresh();
  }}>
          <Input placeholder="New stage name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="hero"><Plus /> Add</Button>
        </form>
      </DialogContent>
    </Dialog>;
}
export {
  Route
};
