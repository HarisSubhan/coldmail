import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Upload } from "lucide-react";
import { db } from "@/lib/db-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptySignature, renderSignature, SIGNATURE_TEMPLATES } from "@/lib/signatures";
import { saveSignature } from "@/lib/sending.functions";
import { useAuth } from "@/lib/auth";
function SignatureDesigner() {
  const { user } = useAuth();
  const [template, setTemplate] = useState("modern-minimal");
  const [d, setD] = useState(emptySignature);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (!user) return;
    db.from("smtp_settings").select("signature_template,signature_data,sender_name,sender_email").maybeSingle().then(({ data }) => {
      if (!data) return;
      if (data.signature_template) setTemplate(data.signature_template);
      const sd = data.signature_data ?? {};
      setD({ ...emptySignature, ...sd, full_name: sd.full_name || data.sender_name || "", email: sd.email || data.sender_email || "" });
    });
  }, [user]);
  const html = useMemo(() => renderSignature(template, d), [template, d]);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  async function uploadLogo(e) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error } = await db.storage.from("logos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: signed, error: sErr } = await db.storage.from("logos").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed) throw sErr ?? new Error("Could not sign logo URL");
      setD((prev) => ({ ...prev, logo_url: signed.signedUrl }));
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      await saveSignature({ data: { template, data: d, html } });
      toast.success("Signature saved \u2014 it will be appended to every email you send");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  const fields = [
    { key: "full_name", label: "Full name" },
    { key: "job_title", label: "Job title" },
    { key: "company", label: "Company name" },
    { key: "email", label: "Email address" },
    { key: "phone", label: "Phone" },
    { key: "website", label: "Website", placeholder: "example.com" },
    { key: "address", label: "Company address (optional)" },
    { key: "linkedin", label: "LinkedIn (optional)" },
    { key: "twitter", label: "X / Twitter (optional)" },
    { key: "instagram", label: "Instagram (optional)" },
    { key: "facebook", label: "Facebook (optional)" }
  ];
  return <div className="glass mt-8 rounded-2xl p-6">
      <h2 className="text-lg font-semibold">Email signature designer</h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Pick a design, fill in your details — the signature is appended to every campaign and follow-up email automatically.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {SIGNATURE_TEMPLATES.map((t) => <button
    key={t.id}
    type="button"
    onClick={() => setTemplate(t.id)}
    className={`rounded-xl border-2 p-3 text-left transition-all ${template === t.id ? "border-primary shadow-glow" : "border-border hover:border-primary/50"}`}
  >
            <div className="mb-2 overflow-hidden rounded-lg bg-white p-2" style={{ minHeight: 72 }}>
              <div
    className="pointer-events-none origin-top-left scale-[0.55]"
    style={{ width: "180%" }}
    dangerouslySetInnerHTML={{ __html: renderSignature(t.id, { ...d, full_name: d.full_name || "Your Name" }) }}
  />
            </div>
            <div className="flex items-center justify-between text-xs font-medium">
              {t.name}
              {template === t.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </div>
          </button>)}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input value={d[f.key]} placeholder={f.placeholder} onChange={set(f.key)} />
            </div>)}
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Custom signature text (optional)</Label>
            <Textarea rows={2} value={d.custom_text} onChange={set("custom_text")} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Company logo</Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="glass" size="sm" disabled={uploading} asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4" /> {uploading ? "Uploading\u2026" : "Upload logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
                </label>
              </Button>
              {d.logo_url && <img src={d.logo_url} alt="Logo" className="h-10 w-auto rounded" />}
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs">Live preview</Label>
          <div className="mt-1 rounded-xl bg-white p-5 shadow-inner">
            <div className="mb-4 border-b border-gray-200 pb-3 text-sm text-gray-500">
              <p>Hi Sarah,</p>
              <p className="mt-2">This is how your email will look, with the signature appended at the bottom…</p>
            </div>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          <Button variant="hero" className="mt-4 w-full" onClick={save} disabled={busy}>
            {busy ? "Saving\u2026" : "Save signature"}
          </Button>
        </div>
      </div>
    </div>;
}
export {
  SignatureDesigner
};
