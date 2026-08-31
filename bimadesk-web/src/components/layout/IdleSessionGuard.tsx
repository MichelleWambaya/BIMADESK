import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Tune these to match your risk tolerance. 30 minutes idle, with a
// 60 second warning before signing out, is a common baseline for a
// business app that holds client personal data.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

export function IdleSessionGuard() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const showWarningRef = useRef(false);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  const clearTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
  }, []);

  const scheduleTimers = useCallback(() => {
    clearTimers();
    warningTimer.current = setTimeout(() => setShowWarning(true), IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
    logoutTimer.current = setTimeout(async () => {
      await signOut();
      navigate("/login", { replace: true });
    }, IDLE_TIMEOUT_MS);
  }, [clearTimers, signOut, navigate]);

  const handleActivity = useCallback(() => {
    // Read the ref, not the state, so this stays accurate even though
    // the listener itself is only attached once (see the effect below) --
    // otherwise incidental mouse movement while the warning is showing
    // would silently reset the timer and defeat the point of asking.
    if (showWarningRef.current) return;
    scheduleTimers();
  }, [scheduleTimers]);

  useEffect(() => {
    if (!session) {
      clearTimers();
      return;
    }
    scheduleTimers();
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, handleActivity, { passive: true });
    return () => {
      clearTimers();
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, handleActivity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function staySignedIn() {
    setShowWarning(false);
    scheduleTimers();
  }

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-ink/40 flex items-center justify-center p-4">
      <div className="wb-card max-w-sm w-full p-6 text-center">
        <div className="w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
          <ShieldAlert size={20} className="text-amber-600" />
        </div>
        <p className="text-[14px] font-semibold">Still there?</p>
        <p className="text-[12.5px] text-ink-soft mt-1.5">
          You've been inactive for a while. For your clients' security, you'll be signed out in about a minute.
        </p>
        <button className="wb-btn-primary w-full justify-center mt-4" onClick={staySignedIn}>
          Stay signed in
        </button>
      </div>
    </div>
  );
}
