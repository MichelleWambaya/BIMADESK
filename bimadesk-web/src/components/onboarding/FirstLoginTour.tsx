import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, Users, RefreshCw, Settings, X } from "lucide-react";
import { Link } from "react-router-dom";

const STEPS = [
  {
    icon: LayoutGrid,
    title: "Your dashboard",
    body: "Everything you need to do today lands here first: follow ups, renewals coming due, and your pipeline.",
  },
  {
    icon: Users,
    title: "Clients hold everything",
    body: "Open a client to see their policies, quotes, calls, and notes together, instead of hunting across tabs.",
  },
  {
    icon: RefreshCw,
    title: "Renewals chase themselves",
    body: "As a policy approaches its expiry date, BimaDesk surfaces it here and can create a follow up task automatically.",
  },
  {
    icon: Settings,
    title: "Make it yours",
    body: "Update your profile, add insurance types specific to what you sell, and manage your plan any time from Settings.",
  },
];

export function FirstLoginTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (sessionStorage.getItem("bimadesk_show_tour") === "1") {
      setVisible(true);
      sessionStorage.removeItem("bimadesk_show_tour");
    }
  }, []);

  if (!visible) return null;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="wb-glass max-w-sm w-full p-6 relative"
        >
          <button className="absolute top-3 right-3 text-ink-faint hover:text-ink" onClick={() => setVisible(false)} aria-label="Close tour">
            <X size={16} />
          </button>
          <div className="w-11 h-11 rounded-[12px] bg-violet-500 flex items-center justify-center text-white mb-4">
            <current.icon size={20} />
          </div>
          <p className="text-[15px] font-semibold">{current.title}</p>
          <p className="text-[13px] text-ink-soft mt-1.5">{current.body}</p>

          <div className="flex items-center justify-between mt-6">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? "bg-violet-500" : "bg-line"}`} />
              ))}
            </div>
            {isLast ? (
              <Link to="/settings" onClick={() => setVisible(false)} className="wb-btn-primary">Customize profile</Link>
            ) : (
              <button className="wb-btn-primary" onClick={() => setStep((s) => s + 1)}>Next</button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
