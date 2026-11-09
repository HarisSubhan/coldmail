import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db-client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { AuthCard } from "@/components/AuthCard";
const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password \u2014 Origami99" },
      { name: "description", content: "Choose a new password for your account." },
      { property: "og:title", content: "Set new password \u2014 Origami99" },
      { property: "og:description", content: "Choose a new password." }
    ]
  }),
  component: Reset
});
function Reset() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  async function submit(e) {
    e.preventDefault();
    const { error } = await db.auth.updateUser({ password: pw });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    nav({ to: "/app" });
  }
  return <AuthCard title="Set a new password">
      <form onSubmit={submit} className="space-y-4">
        <PasswordInput minLength={8} required placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button type="submit" variant="hero" className="w-full">Update password</Button>
      </form>
    </AuthCard>;
}
export {
  Route
};
