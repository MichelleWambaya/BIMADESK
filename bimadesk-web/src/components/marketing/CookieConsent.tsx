import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { initAnalytics } from "@/lib/analytics";

const STORAGE_KEY = "bimadesk_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const analyticsConfigured = Boolean(import.meta.env.VITE_ANALYTICS_SRC);

  useEffect(() => {
    if (!analyticsConfigured) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "accepted") {
      initAnalytics();
    } else if (!stored) {
      setVisible(true);
    }
  }, [analyticsConfigured]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-sm z-50 wb-card p-4">
      <p className="text-[12.5px] text-ink-soft">
        We use privacy-friendly analytics to understand how BimaDesk is used, no personal data and no cross-site tracking.
        Read the <Link to="/privacy" className="text-violet-600 underline">privacy policy</Link>.
      </p>
      <div className="flex gap-2 mt-3">
        <button
          className="wb-btn-primary flex-1 justify-center !text-[12.5px] !py-1.5"
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "accepted");
            initAnalytics();
            setVisible(false);
          }}
        >
          Accept
        </button>
        <button
          className="wb-btn-secondary flex-1 justify-center !text-[12.5px] !py-1.5"
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "declined");
            setVisible(false);
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}
