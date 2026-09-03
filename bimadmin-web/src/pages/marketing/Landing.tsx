import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Smartphone, Users, RefreshCw, MessageSquare, ArrowRight, Check,
  ShieldCheck, Clock, Download, Lock, HelpCircle,
} from "lucide-react";
import { TestimonialsSection } from "@/components/marketing/TestimonialsSection";
import { PricingSection } from "@/components/marketing/PricingSection";

// ---------------------------------------------------------------------------
// PRODUCT SCREENSHOTS
// Drop real screenshots into /public and set these paths. Until a path is
// set, a labelled placeholder frame shows instead, so the layout is
// already correct and nothing looks broken while you gather images.
// Recommended: 1600x1000 or similar 16:10, PNG, showing real (not empty)
// data. A dashboard with actual clients in it sells far better than a
// blank state.
// ---------------------------------------------------------------------------
const SCREENSHOTS = {
  dashboard: null as string | null, // e.g. "/screenshots/dashboard.png"
  clientProfile: null as string | null,
  renewals: null as string | null,
};

// ---------------------------------------------------------------------------
// SOCIAL LINKS
// Placeholders for now. Replace the href values once the profiles exist;
// any entry left as null is simply not rendered, so no dead links ship.
// ---------------------------------------------------------------------------
const SOCIAL_LINKS: { label: string; href: string | null }[] = [
  { label: "WhatsApp", href: null }, // e.g. "https://wa.me/2547XXXXXXXX"
  { label: "X", href: null },
  { label: "LinkedIn", href: null },
  { label: "Instagram", href: null },
  { label: "Facebook", href: null },
];

const FEATURES = [
  { icon: RefreshCw, title: "Renewals chase themselves", desc: "Every night we check your whole book and tell you which policies are coming due, so none of them quietly lapse." },
  { icon: Users, title: "One place for every client", desc: "Policies, quotes, calls, and notes on a single record, instead of three spreadsheets and a WhatsApp thread." },
  { icon: MessageSquare, title: "Every conversation logged", desc: "Calls, WhatsApp, SMS, and email land on the client's timeline, so you always know what they last heard from you." },
  { icon: Smartphone, title: "Built for how Kenya pays", desc: "Subscribe with M-Pesa in a few taps. Card works too, and renews automatically if you'd rather not think about it." },
];

// Addresses the objections that actually stop a cautious intermediary
// from signing up: is my data safe, how long will this take, and am I
// locked in.
const OBJECTIONS = [
  {
    icon: Lock,
    title: "Your client data stays yours",
    desc: "Every record is scoped to your business at the database level, not just hidden in the interface. Nobody else using BimAdmin can see your clients.",
  },
  {
    icon: Clock,
    title: "Set up in an afternoon",
    desc: "Import your existing list from Excel, CSV, PDF, or Word. Map your columns once, check the preview, and your renewal reminders start the same day.",
  },
  {
    icon: Download,
    title: "No lock in",
    desc: "Export your full client list to CSV whenever you like. If BimAdmin stops being useful, you leave with your data.",
  },
];


/** Shows a real screenshot when one is configured, otherwise a labelled
 * frame so the page layout is honest about what will go there. */
function ScreenshotFrame({ src, caption }: { src: string | null; caption: string }) {
  // Renders nothing without a real image. A frame saying "placeholder"
  // tells visitors the product is unfinished, which is worse than simply
  // not having the section yet.
  if (!src) return null;
  return (
    <figure className="wb-card overflow-hidden">
      <img src={src} alt={caption} className="w-full block" loading="lazy" />
      <figcaption className="px-4 py-2.5 border-t border-line text-[12px] text-ink-soft">{caption}</figcaption>
    </figure>
  );
}

/** True when at least one screenshot is configured. */
const HAS_SCREENSHOTS = Object.values(SCREENSHOTS).some(Boolean);

export function LandingPage() {
  const visibleSocials = SOCIAL_LINKS.filter((s) => s.href);

  return (
    <div className="bg-paper">
      <header className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8  bg-blue-800 flex items-center justify-center text-white font-display text-[14px]">B<span style={{ color: '#C68A2E' }}>A</span></div>
          <span className="font-display text-[15px]">BimAdmin</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/faq" className="hidden sm:block text-[13.5px] text-ink-soft hover:text-ink">FAQ</Link>
          <Link to="/login" className="text-[13.5px] text-ink-soft hover:text-ink">Sign in</Link>
          <Link to="/signup" className="wb-btn-primary">Get started free</Link>
        </div>
      </header>

      <section className="wb-aurora-bg relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-5 py-24 text-center relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-white text-4xl sm:text-5xl leading-tight"
          >
            Never miss a policy renewal again
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-white/75 text-[16px] mt-5 max-w-2xl mx-auto"
          >
            BimAdmin watches every policy in your book and tells you who to call today. Built for Kenyan insurance
            intermediaries still running everything on spreadsheets and WhatsApp.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link to="/signup" className="wb-btn-accent px-5 py-2.5 text-[14px]">
              Start free <ArrowRight size={15} />
            </Link>
            <span className="text-white/60 text-[13px]">40 clients free. No card needed.</span>
          </motion.div>
        </div>
      </section>

      {/* See what it looks like, before signing up. Hidden entirely until
          real screenshots exist. */}
      {HAS_SCREENSHOTS && (
      <section className="max-w-5xl mx-auto px-5 py-20">
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl">See it before you sign up</h2>
          <p className="text-ink-soft text-[14px] mt-2">This is the whole product, not a marketing mock up.</p>
        </div>
        <div className="space-y-4">
          <ScreenshotFrame src={SCREENSHOTS.dashboard} caption="Your dashboard: what needs attention today" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ScreenshotFrame src={SCREENSHOTS.clientProfile} caption="A client record, everything in one place" />
            <ScreenshotFrame src={SCREENSHOTS.renewals} caption="Renewals, grouped by when they're due" />
          </div>
        </div>
      </section>
      )}

      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="wb-card p-5"
            >
              <div className="w-9 h-9 rounded-[10px] bg-violet-50 flex items-center justify-center text-violet-600 mb-3">
                <f.icon size={17} />
              </div>
              <p className="text-[14px] font-semibold">{f.title}</p>
              <p className="text-[12.5px] text-ink-soft mt-1.5">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Real testimonials from real users. Renders nothing at all until
          approved ones exist, rather than showing an empty section. */}
      <TestimonialsSection />

      <section className="bg-paper-sunk">
        <div className="max-w-5xl mx-auto px-5 py-20">
          <div className="text-center mb-10">
            <h2 className="font-display text-2xl">The questions we always get</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {OBJECTIONS.map((o) => (
              <div key={o.title}>
                <div className="w-9 h-9 rounded-[10px] bg-paper-raised border border-line flex items-center justify-center text-violet-600 mb-3">
                  <o.icon size={17} />
                </div>
                <p className="text-[14px] font-semibold">{o.title}</p>
                <p className="text-[12.5px] text-ink-soft mt-1.5">{o.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/faq" className="inline-flex items-center gap-1.5 text-[13.5px] text-violet-600 hover:underline">
              <HelpCircle size={15} /> More questions answered
            </Link>
          </div>
        </div>
      </section>

      <PricingSection />

      <section className="wb-aurora-bg">
        <div className="max-w-3xl mx-auto px-5 py-16 text-center">
          <h2 className="font-display text-white text-2xl">Bring your client list in this afternoon</h2>
          <p className="text-white/70 text-[14px] mt-3">
            Import from Excel, CSV, PDF, or Word. Your first renewal reminders will be ready the same day.
          </p>
          <Link to="/signup" className="inline-flex wb-btn-accent px-5 py-2.5 text-[14px] mt-6">
            Create your workspace <ArrowRight size={15} />
          </Link>
          <p className="text-white/50 text-[12px] mt-4 flex items-center justify-center gap-1.5">
            <ShieldCheck size={13} /> Free plan, no card required
          </p>
        </div>
      </section>

      {/*
        MOBILE APP INSTALL PROMPT, COMMENTED OUT ON PURPOSE.
        The Flutter app is not published to the Play Store or App Store
        yet, so advertising it would send people to a dead link. Uncomment
        this block and fill in the two store URLs once the app is live.
        Documented in CHANGES.md, section 29.

      <section className="max-w-5xl mx-auto px-5 py-16">
        <div className="wb-card p-6 flex flex-col sm:flex-row items-center gap-5">
          <div className="w-12 h-12 rounded-[12px] bg-violet-50 flex items-center justify-center text-violet-600 shrink-0">
            <Smartphone size={22} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[15px] font-semibold">Take BimAdmin with you</p>
            <p className="text-[13px] text-ink-soft mt-1">
              Check renewals, log a call, and add a client from your phone, wherever you are.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <a href="PLAY_STORE_URL_HERE" className="wb-btn-secondary">Google Play</a>
            <a href="APP_STORE_URL_HERE" className="wb-btn-secondary">App Store</a>
          </div>
        </div>
      </section>
      */}

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[12px] text-ink-faint">BimAdmin, built for the Kenyan market</span>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[12px] text-ink-faint">
            {visibleSocials.map((s) => (
              <a key={s.label} href={s.href as string} target="_blank" rel="noreferrer" className="hover:text-ink">
                {s.label}
              </a>
            ))}
            <Link to="/faq" className="hover:text-ink">FAQ</Link>
            <Link to="/privacy" className="hover:text-ink">Privacy</Link>
            <Link to="/refunds" className="hover:text-ink">Refunds</Link>
            <Link to="/terms" className="hover:text-ink">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
