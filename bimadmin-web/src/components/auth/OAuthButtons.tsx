import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

/** Google's mark, drawn inline rather than pulled from an icon library,
 * because Google's brand guidelines require their specific four-colour
 * logo on sign-in buttons and generic icon sets don't provide it. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}

export function OAuthButtons({ mode }: { mode: "signin" | "signup" }) {
  const { signInWithProvider } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(provider: "google") {
    setBusy(true);
    setError(null);
    const { error } = await signInWithProvider(provider);
    // On success the browser redirects away, so reaching here with no
    // error is rare; it mostly means the provider isn't configured.
    if (error) {
      setBusy(false);
      setError(
        /provider is not enabled/i.test(error)
          ? "Google sign in isn't switched on yet for this workspace."
          : error
      );
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => start("google")}
        disabled={busy}
        style={{ color: "#17131F" }}
        className="w-full flex items-center justify-center gap-2.5 bg-white text-[13.5px] font-medium py-2.5 rounded-[10px] hover:bg-white/90 transition-colors disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? "Opening Google" : mode === "signup" ? "Sign up with Google" : "Continue with Google"}
      </button>

      {error && <p className="text-[12px] text-coral-300">{error}</p>}

      <div className="flex items-center gap-3">
        <span className="flex-1 h-px bg-white/20" />
        <span className="text-[11px] text-white/50">or use your email</span>
        <span className="flex-1 h-px bg-white/20" />
      </div>
    </div>
  );
}
