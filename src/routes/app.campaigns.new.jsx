import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, LENGTHS, TONES } from "@/lib/options";
const Route = createFileRoute("/app/campaigns/new")({
  head: () => ({
    meta: [
      { title: "New Campaign \u2014 Origami99" },
      { name: "description", content: "Set up a new AI outreach campaign." },
      { property: "og:title", content: "New Campaign \u2014 Origami99" },
      { property: "og:description", content: "Set up a new AI outreach campaign." }
    ]
  }),
  component: NewCampaign
});
function Pick({ label, value, onChange, options }) {
  return <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>;
}
function NewCampaign() {
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", niche: "", audience: "", offer: "", selling_points: "", purpose: "", keywords: "", language: "English", tone: "Professional", length: "Medium" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await db.from("campaigns").insert({ ...f, keywords: f.keywords.split(",").map((k) => k.trim()).filter(Boolean) }).select("id").single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Campaign created");
    nav({ to: "/app/campaigns/$id", params: { id: data.id } });
  }
  return <>
      <PageHeader title="New Campaign" subtitle="Tell the AI who you're reaching and what you offer." />
      <form onSubmit={submit} className="glass grid gap-5 rounded-2xl p-6 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>Campaign name</Label>
          <Input required maxLength={120} value={f.name} onChange={(e) => set("name")(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Target niche</Label>
          <Input placeholder="e.g. Dental clinics" value={f.niche} onChange={(e) => set("niche")(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Target audience</Label>
          <Input placeholder="e.g. Clinic owners in Dubai" value={f.audience} onChange={(e) => set("audience")(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Service / product to pitch</Label>
          <Textarea required rows={3} value={f.offer} onChange={(e) => set("offer")(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Main selling points</Label>
          <Textarea rows={2} placeholder="e.g. Free first-month audit, 24/7 support, proven ROI" value={f.selling_points} onChange={(e) => set("selling_points")(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Purpose of the email</Label>
          <Textarea rows={2} placeholder="e.g. Introduce our services and book a 15-minute call" value={f.purpose} onChange={(e) => set("purpose")(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Keywords (comma separated)</Label>
          <Input placeholder="SEO, local search, Google Maps" value={f.keywords} onChange={(e) => set("keywords")(e.target.value)} />
        </div>
        <Pick label="Language" value={f.language} onChange={set("language")} options={LANGUAGES} />
        <Pick label="Tone" value={f.tone} onChange={set("tone")} options={TONES} />
        <Pick label="Email length" value={f.length} onChange={set("length")} options={LENGTHS} />
        <div className="flex items-end">
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>Create campaign</Button>
        </div>
      </form>
    </>;
}
export {
  Route
};
