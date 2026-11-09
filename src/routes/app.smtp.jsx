import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, PlugZap, XCircle } from "lucide-react";
import { db } from "@/lib/db-client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SignatureDesigner } from "@/components/SignatureDesigner";
import { saveSmtpSettings, testSmtpConnection } from "@/lib/sending.functions";
import { useAuth } from "@/lib/auth";
const Route = createFileRoute("/app/smtp")({
  head: () => ({
    meta: [
      { title: "Email Settings \u2014 Origami99" },
      { name: "description", content: "Connect your own SMTP mailbox." },
      { property: "og:title", content: "Email Settings \u2014 Origami99" },
      { property: "og:description", content: "Connect your own SMTP mailbox." }
    ]
  }),
  component: Smtp
});
const empty = { sender_name: "", sender_email: "", host: "", port: 587, username: "", password: "", encryption: "tls", reply_to: "", signature: "" };
function Smtp() {
  const { user } = useAuth();
  const [f, setF] = useState(empty);
  const [hasPassword, setHasPassword] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    if (!user) return;
    db.from("smtp_settings").select("sender_name,sender_email,host,port,username,encryption,reply_to,signature,verified").maybeSingle().then(({ data }) => {
      if (!data) return;
      setF({ ...empty, ...data, reply_to: data.reply_to ?? "", signature: data.signature ?? "", encryption: data.encryption, password: "" });
      setVerified(data.verified);
      setHasPassword(true);
    });
  }, [user]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    setBusy("save");
    try {
      await saveSmtpSettings({ data: { ...f, port: Number(f.port), password: f.password || void 0 } });
      setHasPassword(hasPassword || !!f.password);
      setVerified(false);
      setF({ ...f, password: "" });
      toast.success("Saved. Now test the connection.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }
  async function test() {
    setBusy("test");
    const r = await testSmtpConnection();
    setBusy(null);
    setVerified(r.ok);
    if (r.ok) toast.success("Connection verified");
    else toast.error(r.error);
  }
  return <>
      <PageHeader
    title="Email Settings"
    subtitle="Your campaigns are sent only through this mailbox. Password is encrypted on the server."
    action={<span className={`flex items-center gap-2 text-sm ${verified ? "text-success" : "text-muted-foreground"}`}>
            {verified ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {verified ? "Verified" : "Not verified"}
          </span>}
  />
      <form onSubmit={save} className="glass grid gap-5 rounded-2xl p-6 md:grid-cols-2">
        <div className="space-y-2"><Label>Sender name</Label><Input required value={f.sender_name} onChange={set("sender_name")} /></div>
        <div className="space-y-2"><Label>Sender email</Label><Input type="email" required value={f.sender_email} onChange={set("sender_email")} /></div>
        <div className="space-y-2"><Label>SMTP host</Label><Input required placeholder="smtp.gmail.com" value={f.host} onChange={set("host")} /></div>
        <div className="space-y-2"><Label>SMTP port</Label><Input type="number" required value={f.port} onChange={set("port")} /></div>
        <div className="space-y-2"><Label>SMTP username</Label><Input value={f.username} onChange={set("username")} /></div>
        <div className="space-y-2">
          <Label>SMTP password</Label>
          <PasswordInput placeholder={hasPassword ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (leave blank to keep)" : ""} required={!hasPassword} value={f.password} onChange={set("password")} />
        </div>
        <div className="space-y-2">
          <Label>Encryption</Label>
          <Select value={f.encryption} onValueChange={(v) => setF({ ...f, encryption: v, port: v === "ssl" ? 465 : f.port === 465 ? 587 : f.port })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tls">STARTTLS (587)</SelectItem>
              <SelectItem value="ssl">SSL/TLS (465)</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Reply-To email</Label><Input type="email" value={f.reply_to} onChange={set("reply_to")} /></div>
        <div className="flex gap-3 md:col-span-2">
          <Button type="submit" variant="hero" disabled={!!busy}>{busy === "save" ? "Saving\u2026" : "Save settings"}</Button>
          <Button type="button" variant="glass" onClick={test} disabled={!!busy || !hasPassword}>
            <PlugZap /> {busy === "test" ? "Testing\u2026" : "Test connection"}
          </Button>
        </div>
      </form>
      <SignatureDesigner />
    </>;
}
export {
  Route
};
