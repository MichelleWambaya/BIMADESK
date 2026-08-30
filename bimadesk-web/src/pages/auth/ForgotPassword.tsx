import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await sendPasswordReset(email);
    setSubmitting(false);
    if (error) return setError(error);
    setSent(true);
  }

  return (
    <div className="min-h-screen wb-aurora-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex w-11 h-11 rounded-glass bg-white/15 border border-white/25 items-center justify-center mb-3">
            <span className="font-display text-white text-lg">B</span>
          </div>
          <h1 className="font-display text-white text-xl">Reset your password</h1>
          <p className="text-white/70 text-[13px] mt-1">We will email you a link to choose a new one.</p>
        </div>

        {sent ? (
          <div className="wb-glass-dark p-6 text-center space-y-2">
            <p className="text-white text-[14px] font-medium">Check your email</p>
            <p className="text-white/70 text-[13px]">We sent a reset link to {email}.</p>
            <Link to="/login" className="inline-block wb-btn-accent mt-2">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="wb-glass-dark p-6 space-y-3.5">
            <div>
              <label className="block text-[12px] font-medium text-white/80 mb-1">Email</label>
              <input
                required
                type="email"
                className="w-full bg-white/10 border border-white/25 rounded-[10px] px-3 py-2 text-[13px] text-white placeholder:text-white/40"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {error && <p className="text-[12.5px] text-coral-300">{error}</p>}
            <button type="submit" disabled={submitting} className="w-full wb-btn-accent justify-center py-2.5">
              {submitting ? "Sending" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-center text-white/70 text-[13px] mt-4">
          <Link to="/login" className="text-white font-medium">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
