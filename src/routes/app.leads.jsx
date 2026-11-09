import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { db } from "@/lib/db-client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prepareLeads } from "@/lib/leads-import";
const Route = createFileRoute("/app/leads")({
  head: () => ({
    meta: [
      { title: "Leads \u2014 Origami99" },
      { name: "description", content: "Import and manage your leads." },
      { property: "og:title", content: "Leads \u2014 Origami99" },
      { property: "og:description", content: "Import and manage your leads." }
    ]
  }),
  component: Leads
});
async function readFile(file) {
  if (file.name.toLowerCase().endsWith(".csv")) {
    const Papa = (await import("papaparse")).default;
    return new Promise(
      (resolve, reject) => Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => resolve(r.data), error: reject })
    );
  }
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer());
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0] ?? ""]);
}
function Leads() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["leads", search],
    queryFn: async () => {
      let q = db.from("leads").select("*").order("created_at", { ascending: false }).limit(500);
      if (search) q = q.or(`email.ilike.%${search}%,name.ilike.%${search}%,business_name.ilike.%${search}%`);
      return (await q).data ?? [];
    }
  });

  const [manual, setManual] = useState({ Name: "", "Business Name": "", Email: "", Website: "" });
  function downloadTemplate() {
    const csv = "Name,Business Name,Email,Website,City\nAli Khan,Khan Grill,ali@khangrill.pk,https://khangrill.pk,Karachi\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "origami99-leads-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function addManual(e) {
    e.preventDefault();
    const { data: existing } = await db.from("leads").select("email");
    const { leads, invalid, duplicates } = prepareLeads([manual], existing?.map((l) => l.email) ?? []);
    if (invalid) return toast.error("Please enter a valid email address");
    if (duplicates) return toast.error("This email is already in your leads");
    const { error } = await db.from("leads").insert(leads);
    if (error) return toast.error(error.message);
    toast.success("Lead added");
    setManual({ Name: "", "Business Name": "", Email: "", Website: "" });
    qc.invalidateQueries({ queryKey: ["leads"] });
  }
  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const rows = await readFile(file);
      const { data: existing } = await db.from("leads").select("email");
      const { leads, invalid, duplicates } = prepareLeads(rows, existing?.map((l) => l.email) ?? []);
      for (let i = 0; i < leads.length; i += 500) {
        const { error } = await db.from("leads").insert(leads.slice(i, i + 500));
        if (error) throw error;
      }
      toast.success(`Imported ${leads.length} leads \xB7 ${invalid} invalid \xB7 ${duplicates} duplicates skipped`);
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  return <>
      <PageHeader
    title="Lead Management"
    subtitle="Upload CSV or Excel with Name, Business Name, Email, Website and any extra columns."
    action={<div className="flex flex-wrap gap-2"><Button variant="glass" onClick={downloadTemplate}><Download /> Download template</Button><Button asChild variant="hero" disabled={busy}>
            <label className="cursor-pointer">
              <Upload /> {busy ? "Importing\u2026" : "Import CSV / Excel"}
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFile} />
            </label>
          </Button></div>}
  />
      <form onSubmit={addManual} className="glass mb-4 grid gap-2 rounded-2xl p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <Input placeholder="Name" value={manual.Name} onChange={(e) => setManual({ ...manual, Name: e.target.value })} />
        <Input placeholder="Business name" value={manual["Business Name"]} onChange={(e) => setManual({ ...manual, "Business Name": e.target.value })} />
        <Input type="email" required placeholder="Email *" value={manual.Email} onChange={(e) => setManual({ ...manual, Email: e.target.value })} />
        <Input placeholder="Website" value={manual.Website} onChange={(e) => setManual({ ...manual, Website: e.target.value })} />
        <Button type="submit" variant="hero"><Plus /> Add lead</Button>
      </form>
      <Input placeholder="Search leads…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-sm" />
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="p-3">Name</th><th className="p-3">Business</th><th className="p-3">Email</th>
              <th className="p-3">Website</th><th className="p-3">Custom</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {data?.map((l) => <tr key={l.id} className="border-b last:border-0">
                <td className="p-3">{l.name}</td>
                <td className="p-3">{l.business_name}</td>
                <td className="p-3">{l.email}</td>
                <td className="p-3 text-muted-foreground">{l.website}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {Object.entries(l.custom_fields ?? {}).map(([k, v]) => `${k}: ${v}`).join(" \xB7 ")}
                </td>
                <td className="p-3">
                  <Button
    size="icon"
    variant="ghost"
    aria-label="Delete lead"
    onClick={async () => {
      await db.from("leads").delete().eq("id", l.id);
      qc.invalidateQueries({ queryKey: ["leads"] });
    }}
  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>)}
          </tbody>
        </table>
        {data && !data.length && <p className="p-6 text-center text-muted-foreground">No leads yet.</p>}
      </div>
    </>;
}
export {
  Route
};
