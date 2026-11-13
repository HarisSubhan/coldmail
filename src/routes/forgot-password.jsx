import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/AuthCard";
const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password \u2014 Origami99" },
      { name: "description", content: "Request a password reset link." },
      { property: "og:title", content: "Reset password \u2014 Origami99" },
      { property: "og:description", content: "Request a password reset link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" }
    ]
  }),
  component: Forgot
});
function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }
  return <AuthCard title="Forgot password" subtitle="We'll email you a link to set a new one.">
      {sent ? <p className="text-sm text-muted-foreground">If that email has an account, a reset link is on its way.</p> : <form onSubmit={submit} className="space-y-4">
          <Input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" variant="hero" className="w-full">Send reset link</Button>
        </form>}
    </AuthCard>;
}
export {
  Route
};
