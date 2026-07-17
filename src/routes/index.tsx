import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Battery,
  Bike,
  Bot,
  Building2,
  ChevronDown,
  FileCheck2,
  HardHat,
  Landmark,
  LifeBuoy,
  MapPin,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  { icon: BadgeCheck, title: "Digital Worker Identity", body: "A verified, portable profile that follows workers across platforms." },
  { icon: Sparkles, title: "GigScore Reputation", body: "AI-powered reputation score built from verified work activity." },
  { icon: BarChart3, title: "Income Analytics", body: "Understand earnings across gigs with weekly and monthly trends." },
  { icon: Landmark, title: "Government Schemes", body: "Discover schemes and welfare benefits matched to your work profile." },
  { icon: Wallet, title: "Loan Eligibility", body: "Fair credit signals for lenders — based on real work history." },
  { icon: FileCheck2, title: "Document Verification", body: "Upload once. Verify Aadhaar, PAN and licenses securely." },
  { icon: MapPin, title: "Live Location", body: "Share status and location for on-duty work and safety." },
  { icon: Battery, title: "EV Charging Support", body: "Find nearby fast and standard chargers as you work." },
  { icon: LifeBuoy, title: "Emergency SOS", body: "One-tap SOS with location sharing to trusted contacts." },
];

const audience = [
  { icon: Bike, label: "Delivery Partners" },
  { icon: Truck, label: "Drivers" },
  { icon: HardHat, label: "Construction Workers" },
  { icon: Bot, label: "Freelancers" },
  { icon: Building2, label: "Daily Wage Workers" },
];

function Landing() {
  return (
    <div className="min-h-dvh bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-transparent bg-background/70 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="min-w-0">
            <Logo size={34} withWordmark />
          </Link>
          <nav className="hidden shrink-0 items-center gap-1 md:flex">
            <a href="#mission" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Mission</a>
            <a href="#features" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Features</a>
            <a href="#how" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">How it works</a>
            <a href="#faq" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">FAQ</a>
            <Button asChild variant="ghost" size="sm" className="rounded-full ml-2">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full gradient-primary text-white shadow-soft">
              <Link to="/auth" search={{ mode: "signup" as const }}>
                Get Started <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </nav>
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <Button asChild size="sm" className="rounded-full gradient-primary text-white">
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-0 top-32 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
          <div className="absolute left-1/3 bottom-0 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        </div>
        <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="min-w-0"
          >
            <span className="inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Built for India's Gig Workforce
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Turning every gig into a{" "}
              <span className="text-gradient">better future</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              ShramSethu is a digital identity and financial empowerment platform for
              delivery partners, drivers, construction workers, freelancers and daily wage
              workers — building portable reputation, income visibility and access to
              formal finance.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-full gradient-primary text-white shadow-soft">
                <Link to="/auth" search={{ mode: "signup" as const }}>
                  Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full">
                <a href="#features">Learn More</a>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-2">
              {audience.map((a) => (
                <span key={a.label} className="inline-flex items-center gap-1.5 rounded-full border bg-white/60 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                  <a.icon className="h-3.5 w-3.5 text-primary" /> {a.label}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="relative rounded-3xl border bg-white p-5 shadow-elevated">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full gradient-primary text-sm font-semibold text-white">SS</div>
                  <div>
                    <div className="text-sm font-semibold">Your Worker Card</div>
                    <div className="text-xs text-muted-foreground">Verified digital identity</div>
                  </div>
                </div>
                <BadgeCheck className="h-6 w-6 text-primary" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl gradient-soft p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">GigScore</div>
                  <div className="mt-1 text-2xl font-bold text-foreground">—</div>
                  <div className="text-[11px] text-muted-foreground">Pending verified activity</div>
                </div>
                <div className="rounded-2xl gradient-soft p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Verification</div>
                  <div className="mt-1 text-2xl font-bold text-foreground">0%</div>
                  <div className="text-[11px] text-muted-foreground">Upload docs to begin</div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Income (30d)</div>
                  <div className="mt-1 text-lg font-semibold">No data</div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Schemes</div>
                  <div className="mt-1 text-lg font-semibold">Explore</div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between rounded-2xl border bg-muted/40 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" /> End-to-end encrypted profile
                </div>
                <span className="text-[11px] font-medium text-primary">Live</span>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-4 -left-4 -z-10 h-40 w-40 rounded-3xl bg-primary/15 blur-2xl" />
          </motion.div>
        </div>
      </section>

      {/* Mission */}
      <section id="mission" className="border-y bg-muted/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Our Mission</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              A bridge from informal work to formal opportunity.
            </h2>
          </div>
          <p className="text-base text-muted-foreground lg:col-span-2 lg:pt-10">
            India's gig and informal workforce powers cities and commerce, yet stays
            invisible to systems that unlock credit, benefits and mobility. ShramSethu
            turns every gig into verifiable identity, reputation and financial access —
            so workers can build a better future, one shift at a time.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Platform</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything a modern gig worker needs.
          </h2>
          <p className="mt-3 text-muted-foreground">
            One profile. Portable across platforms. Designed for real workflows.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-white shadow-soft">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">How it works</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Onboard in minutes. Grow for a lifetime.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { n: "01", t: "Create your profile", d: "Add your work category, skills and languages. Verify Aadhaar and PAN." },
              { n: "02", t: "Add verified activity", d: "Log gigs, upload proofs, connect income sources over time." },
              { n: "03", t: "Unlock benefits", d: "See your GigScore, discover schemes and preview loan eligibility." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="text-4xl font-bold text-gradient">{s.n}</div>
                <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Benefits</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Built for workers. Trusted by ecosystems.</h2>
            <p className="mt-3 text-muted-foreground">
              A single verified identity that follows the worker across platforms and
              opens doors that were previously closed.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              "Portable, verifiable identity",
              "Fairer access to credit",
              "Discover matched welfare schemes",
              "Own your work reputation",
              "Consent-based data sharing",
              "Secure emergency assistance",
            ].map((b) => (
              <li key={b} className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm">
                <div className="mt-0.5 grid h-6 w-6 place-items-center rounded-full gradient-primary text-white">
                  <BadgeCheck className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t bg-muted/40">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
          <div className="text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">FAQ</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h2>
          </div>
          <Accordion type="single" collapsible className="mt-10 rounded-2xl border bg-card">
            {[
              { q: "Who is ShramSethu for?", a: "Delivery partners, drivers, construction workers, freelancers, daily wage workers and other gig workers who want a verified digital identity and financial visibility." },
              { q: "Is my data secure?", a: "Yes. Your data is stored securely and shared only with your consent. Documents are encrypted at rest." },
              { q: "Do I need documents to start?", a: "You can create a profile immediately. Verification unlocks GigScore, scheme matches and loan eligibility over time." },
              { q: "Is this a bank or lender?", a: "No. ShramSethu is a digital identity platform that helps lenders, employers and ecosystems make fairer decisions using verified worker data." },
              { q: "Which languages are supported?", a: "English at launch, with Hindi, Kannada, Telugu, Tamil, Malayalam, Marathi and Bengali coming next." },
            ].map((f, i) => (
              <AccordionItem key={f.q} value={`i-${i}`} className="border-b last:border-b-0 px-5">
                <AccordionTrigger className="text-left text-base font-medium">
                  <span className="flex items-center gap-2"><ChevronDown className="hidden" />{f.q}</span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="overflow-hidden rounded-3xl gradient-hero p-10 text-white shadow-elevated sm:p-14">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <h3 className="text-2xl font-bold sm:text-3xl">Ready to build your digital work identity?</h3>
              <p className="mt-2 text-sm text-white/80 sm:text-base">Join ShramSethu as one of our first verified workers.</p>
            </div>
            <Button asChild size="lg" className="shrink-0 rounded-full bg-white text-primary hover:bg-white/90">
              <Link to="/auth" search={{ mode: "signup" as const }}>
                Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-8 sm:px-6">
          <div className="min-w-0">
            <Logo size={28} withWordmark />
            <p className="mt-2 text-xs text-muted-foreground">© {new Date().getFullYear()} ShramSethu. Turning every gig into a better future.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <a href="#mission" className="hover:text-foreground">Mission</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
