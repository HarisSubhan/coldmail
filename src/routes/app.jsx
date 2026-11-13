import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CreditCard,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Server,
  Sparkles,
  User,
  Users,
  Settings,
  Layers,
  MapPin,
  KanbanSquare
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { db } from "@/lib/db-client";
const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Workspace \u2014 Origami99" },
      { name: "description", content: "Your AI email outreach workspace." },
      { property: "og:title", content: "Workspace \u2014 Origami99" },
      { property: "og:description", content: "Your AI email outreach workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" }
    ]
  }),
  component: AppLayout
});
const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/campaigns", label: "Email Campaigns", icon: History, exact: true },
  { to: "/app/campaigns/new", label: "New Campaign", icon: PlusCircle },
  { to: "/app/generator", label: "AI Email Writer", icon: Sparkles },
  { to: "/app/lead-finder", label: "Lead Finder", icon: MapPin },
  { to: "/app/crm", label: "CRM", icon: KanbanSquare },
  { to: "/app/leads", label: "Email Recipients", icon: Users },
  { to: "/app/replies", label: "Replies", icon: Inbox, reply: true },
  { to: "/app/smtp", label: "Email Settings", icon: Server },
  { to: "/app/profile", label: "My Profile", icon: User },
  { to: "/app/subscription", label: "My Subscription", icon: CreditCard }
];
const adminNav = [
  { tab: "monitoring", label: "Monitoring & Logs", icon: History },
  { tab: "overview", label: "Dashboard", icon: LayoutDashboard },
  { tab: "users", label: "Subscription Users", icon: Users },
  { tab: "plans", label: "Plans & Pricing", icon: Layers },
  { tab: "settings", label: "Platform Settings", icon: Settings }
];
function AppLayout() {
  const { session, loading, isAdmin, status, onHold, expiresAt, signOut } = useAuth();
  const search = useRouterState({ select: (s) => s.location.search });
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [replyOn, setReplyOn] = useState(false);
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);
  useEffect(() => {
    if (!session) return;
    db.from("app_settings").select("reply_module_enabled").maybeSingle().then(({ data }) => setReplyOn(!!data?.reply_module_enabled));
  }, [session]);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!loading && isAdmin && !path.startsWith("/app/admin") && path !== "/app/profile") navigate({ to: "/app/admin" });
  }, [loading, isAdmin, path, navigate]);
  if (loading || !session) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (status === "suspended") {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">Account suspended</h1>
        <p className="text-muted-foreground">Please contact your administrator to restore access.</p>
        <Button variant="glass" onClick={signOut}>Sign out</Button>
      </div>;
  }
  if (onHold) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">Account on hold</h1>
        <p className="max-w-md text-muted-foreground">
          Your subscription ended on {new Date(expiresAt).toLocaleDateString()}. Your data is safe — please contact the Super Admin to renew and restore access.
        </p>
        <Button variant="glass" onClick={signOut}>Sign out</Button>
      </div>;
  }
  const items = nav.filter((n) => !("reply" in n) || replyOn);
  const isActive = (to, exact) => exact ? path === to : path.startsWith(to);
  const sidebar = <aside className="flex h-full w-64 flex-col gap-1 border-r bg-sidebar/80 p-4 backdrop-blur-xl">
      <div className="mb-6 flex items-center justify-between px-2">
        <Logo />
        <ThemeToggle />
      </div>
      {isAdmin ? <>
          <div className="mb-2 px-3 text-xs uppercase tracking-widest text-aqua">Super Admin</div>
          {adminNav.map((n) => {
    const active = path.startsWith("/app/admin") && (search.tab ?? "overview") === n.tab;
    return <Link
      key={n.tab}
      to="/app/admin"
      search={{ tab: n.tab }}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${active ? "bg-gradient-primary font-semibold text-primary-foreground shadow-glow" : "text-sidebar-foreground/80 hover:bg-sidebar-accent"}`}
    >
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>;
  })}
          <Link
    to="/app/profile"
    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${path === "/app/profile" ? "bg-gradient-primary font-semibold text-primary-foreground shadow-glow" : "text-sidebar-foreground/80 hover:bg-sidebar-accent"}`}
  >
            <User className="h-4 w-4" /> Account Settings
          </Link>
        </> : items.map((n) => <Link
    key={n.to}
    to={n.to}
    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${isActive(n.to, "exact" in n ? n.exact : false) ? "bg-gradient-primary font-semibold text-primary-foreground shadow-glow" : "text-sidebar-foreground/80 hover:bg-sidebar-accent"}`}
  >
            <n.icon className="h-4 w-4" /> {n.label}
          </Link>)}
      <div className="mt-auto">
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>;
  return <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen lg:block">{sidebar}</div>
      {open && <div className="fixed inset-0 z-50 flex lg:hidden" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}>{sidebar}</div>
          <div className="flex-1 bg-background/60" />
        </div>}
      <main className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b px-4 py-3 lg:hidden">
          <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <Logo />
        </div>
        <div className="mx-auto max-w-7xl p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>;
}
export {
  Route
};
