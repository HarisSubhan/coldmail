import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Languages, Mail, MessageCircle, ShieldCheck, Sparkles, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WhatsAppButton, useWhatsApp } from "@/components/WhatsAppButton";
import { listPublicPlans } from "@/lib/plans.functions";
import hero from "@/assets/hero-crane.jpg";
const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Origami99 \u2014 AI Cold Email Outreach in Any Language" },
      { name: "description", content: "Generate personalized multilingual outreach emails with AI and send them from your own SMTP." },
      { property: "og:title", content: "Origami99 \u2014 AI Cold Email Outreach" },
      { property: "og:description", content: "Personalized multilingual outreach, sent from your own mailbox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" }
    ]
  }),
  component: Landing
});
const features = [
  { icon: Sparkles, title: "AI-written emails", text: "A unique subject and body for every lead, tuned to your niche, tone and length." },
  { icon: Languages, title: "Any language", text: "Write campaigns in English, Urdu, Arabic, Spanish, French and many more." },
  { icon: Upload, title: "CSV & Excel leads", text: "Import thousands of leads with validation and duplicate detection built in." },
  { icon: Mail, title: "Your own SMTP", text: "Every email goes out from your mailbox \u2014 encrypted credentials, your reputation." },
  { icon: Zap, title: "Full send control", text: "Start, pause, resume, stop and retry, with live progress and logs." },
  { icon: ShieldCheck, title: "Private by design", text: "Every account is fully isolated. Nobody sees your leads or emails but you." }
];
function Landing() {
  const wa = useWhatsApp();
  return <div className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="glass">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-10 lg:grid-cols-2">
        <div>
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-aqua">
            <Sparkles className="h-3.5 w-3.5" /> AI outreach that sounds human
          </span>
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] md:text-7xl">
            Fold every lead into a <span className="text-gradient">conversation.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Origami99 writes personalized cold emails in any language and sends them from your own mailbox — one
            recipient at a time.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="xl">
              <Link to="/login">Open dashboard</Link>
            </Button>
            <Button asChild variant="glass" size="xl">
              <a href="#features">See features</a>
            </Button>
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
          <img
    src={hero}
    alt="Glass origami crane surrounded by floating envelopes"
    width={1280}
    height={1024}
    className="float-slow rounded-3xl shadow-glow"
  />
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 pb-28">
        <h2 className="text-center text-3xl font-bold md:text-4xl">Everything outreach needs. Nothing it doesn't.</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => <div key={f.title} className="card-3d rounded-2xl p-6">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>)}
        </div>
      </section>

      <Pricing />

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {(/* @__PURE__ */ new Date()).getFullYear()} Origami99. Accounts are issued after payment confirmation.
        <div className="mt-2">
          Subscribe via WhatsApp:{" "}
          <a href={wa.urlFor()} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">{wa.display}</a>
        </div>
      </footer>
      <WhatsAppButton />
    </div>;
}
function Pricing() {
  const wa = useWhatsApp();
  const plans = useQuery({ queryKey: ["public-plans"], queryFn: () => listPublicPlans(), staleTime: 6e4 });
  if (!plans.data?.length) return null;
  return <section id="pricing" className="mx-auto max-w-7xl px-6 pb-28">
      <h2 className="text-center text-3xl font-bold md:text-4xl">Simple plans, priced in PKR.</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
        Pay over WhatsApp — your account is created manually after payment confirmation.
      </p>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {plans.data.map((p) => <div key={p.id} className="card-3d flex flex-col rounded-3xl p-7">
            <h3 className="font-display text-xl font-bold">{p.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            <div className="mt-5">
              <span className="font-display text-3xl font-extrabold text-gradient">PKR {Number(p.price_monthly_pkr).toLocaleString("en-PK")}</span>
              <span className="text-sm text-muted-foreground"> / month</span>
              <div className="text-xs text-muted-foreground">or PKR {Number(p.price_yearly_pkr).toLocaleString("en-PK")} / year</div>
            </div>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {(p.features ?? []).map((f, i) => <li key={i} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-aqua" /> {f}
                </li>)}
            </ul>
            <div className="mt-6 grid gap-2">
              <Button asChild variant="hero">
                <a href={wa.urlFor({ plan: p.name, cycle: "monthly", price: Number(p.price_monthly_pkr).toLocaleString("en-PK") })} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" /> Subscribe monthly
                </a>
              </Button>
              <Button asChild variant="glass">
                <a href={wa.urlFor({ plan: p.name, cycle: "yearly", price: Number(p.price_yearly_pkr).toLocaleString("en-PK") })} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" /> Subscribe yearly
                </a>
              </Button>
            </div>
          </div>)}
      </div>
    </section>;
}
export {
  Route
};
