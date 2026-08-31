import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { updatePassword } = useAuth();
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
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div>
        <label className="wb-label">New password</label>
        <input type="password" className="wb-input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label className="wb-label">Confirm new password</label>
        <input type="password" className="wb-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="text-[12px] text-coral-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="submit" className="wb-btn-primary" disabled={submitting}>{submitting ? "Saving" : "Update password"}</button>
      </div>
    </form>
  );
}
