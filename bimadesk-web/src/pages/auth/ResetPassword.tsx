import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setSubmitting(true);
    setError(null);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) return setError(error);
    navigate("/app", { replace: true });
  }

  return (
    <div className="min-h-screen wb-aurora-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex w-11 h-11 rounded-glass bg-white/15 border border-white/25 items-center justify-center mb-3">
            <span className="font-display text-white text-lg">B</span>
          </div>
          <h1 className="font-display text-white text-xl">Choose a new password</h1>
        </div>

        <form onSubmit={submit} className="wb-glass-dark p-6 space-y-3.5">
          <div>
            <label className="block text-[12px] font-medium text-white/80 mb-1">New password</label>
            <input
              required
              type="password"
              className="w-full bg-white/10 border border-white/25 rounded-[10px] px-3 py-2 text-[13px] text-white placeholder:text-white/40"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-white/80 mb-1">Confirm password</label>
            <input
              required
              type="password"
              className="w-full bg-white/10 border border-white/25 rounded-[10px] px-3 py-2 text-[13px] text-white placeholder:text-white/40"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="text-[12.5px] text-coral-300">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full wb-btn-accent justify-center py-2.5">
            {submitting ? "Saving" : "Save new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
