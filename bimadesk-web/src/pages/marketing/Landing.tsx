import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Smartphone, Users, RefreshCw, MessageSquare, ArrowRight, Check } from "lucide-react";

const FEATURES = [
  { icon: Users, title: "One place for every client", desc: "Policies, quotes, calls, and notes live on a single client record instead of scattered spreadsheets." },
  { icon: RefreshCw, title: "Renewals that chase themselves", desc: "Automatic reminders as policies approach expiry, so nothing quietly lapses." },
  { icon: MessageSquare, title: "Calls, WhatsApp, and email logged", desc: "Every touch with a client lands on their timeline, so you always know what happened last." },
  { icon: Smartphone, title: "Built for how Kenya pays", desc: "Subscribe and pay with M-Pesa in a few taps. Card payments work too." },
];

const PLAN_SUMMARY = [
  { name: "Free", price: "KES 0", clients: "Up to 25 clients", automation: false },
  { name: "Starter", price: "KES 1,500", clients: "Up to 150 clients", automation: true },
  { name: "Growth", price: "KES 4,000", clients: "Up to 750 clients", automation: true },
  { name: "Business", price: "KES 9,000", clients: "Unlimited clients", automation: true },
];

export function LandingPage() {
  return (
    <div className="bg-paper">
      <header className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-tab bg-violet-500 flex items-center justify-center text-white font-display text-[14px]">B</div>
          <span className="font-display text-[15px]">BimaDesk</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-[13.5px] text-ink-soft hover:text-ink">Sign in</Link>
          <Link to="/signup" className="wb-btn-primary">Get started</Link>
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
            Run your insurance book like a business, not a filing cabinet
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-white/75 text-[16px] mt-5 max-w-2xl mx-auto"
          >
            BimaDesk replaces the spreadsheets, WhatsApp threads, and paper notes Kenyan intermediaries juggle today with one fast, focused workspace for clients, policies, quotes, and renewals.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 flex items-center justify-center gap-3"
          >
            <Link to="/signup" className="wb-btn-accent px-5 py-2.5 text-[14px]">
              Start free <ArrowRight size={15} />
            </Link>
            <span className="text-white/60 text-[13px]">No card needed to start</span>
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-20">
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

      <section className="max-w-5xl mx-auto px-5 py-20">
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl">Pricing that grows with your book</h2>
          <p className="text-ink-soft text-[14px] mt-2">Pay monthly with M-Pesa or a card. Automation is included from Starter upward.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLAN_SUMMARY.map((p) => (
            <div key={p.name} className="wb-card p-5">
              <p className="text-[14px] font-semibold">{p.name}</p>
              <p className="font-display text-2xl mt-1">{p.price}</p>
              <p className="text-[11.5px] text-ink-faint mb-3">per month</p>
              <ul className="text-[12.5px] text-ink-soft space-y-1.5">
                <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> {p.clients}</li>
                <li className="flex items-center gap-1.5"><Check size={12} className={p.automation ? "text-emerald-500" : "text-ink-faint"} /> {p.automation ? "Automation included" : "No automation"}</li>
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="wb-aurora-bg">
        <div className="max-w-3xl mx-auto px-5 py-16 text-center">
          <h2 className="font-display text-white text-2xl">Bring your existing client list in minutes</h2>
          <p className="text-white/70 text-[14px] mt-3">Import from a CSV export of your current spreadsheet. Your first renewal reminders will be ready the same day.</p>
          <Link to="/signup" className="inline-flex wb-btn-accent px-5 py-2.5 text-[14px] mt-6">
            Create your workspace <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-5 py-8 flex items-center justify-between text-[12px] text-ink-faint">
        <span>BimaDesk, built for the Kenyan market</span>
        <div className="flex gap-4">
          <Link to="/faq" className="hover:text-ink">FAQ</Link>
          <Link to="/privacy" className="hover:text-ink">Privacy</Link>
          <Link to="/terms" className="hover:text-ink">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
