import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff } from "lucide-react";

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    setSubmitting(true);
    setError(null);
    const { error, hasSession } = await signUp({ email, password });
    setSubmitting(false);
    if (error) return setError(friendlySignUpError(error));
    if (hasSession) {
      navigate("/onboarding", { replace: true });
    } else {
      setCheckEmail(true);
    }
  }

  function friendlySignUpError(rawError: string): string {
    if (/rate limit/i.test(rawError)) {
      return "Too many accounts have been created from here in a short time, this is a limit Supabase puts on its shared email sending, not something wrong with your account. Wait a few minutes and try again, or use a different email.";
    }
    return rawError;
  }

  return (
    <div className="min-h-screen wb-aurora-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex w-11 h-11 rounded-glass bg-white/15 border border-white/25 items-center justify-center mb-3">
            <span className="font-display text-white text-lg">B</span>
          </div>
          <h1 className="font-display text-white text-xl">Create your BimaDesk account</h1>
          <p className="text-white/70 text-[13px] mt-1">Set up your book of business in a couple of minutes.</p>
        </div>

        {checkEmail ? (
          <div className="wb-glass-dark p-6 text-center space-y-2">
            <p className="text-white text-[14px] font-medium">Check your email</p>
            <p className="text-white/70 text-[13px]">
              We sent a confirmation link to {email}. Open it, then come back here and sign in to finish setting up your account.
            </p>
            <Link to="/login" className="inline-block wb-btn-accent mt-2">Go to sign in</Link>
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
            <div>
              <label className="block text-[12px] font-medium text-white/80 mb-1">Password</label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  className="w-full bg-white/10 border border-white/25 rounded-[10px] px-3 py-2 pr-9 text-[13px] text-white placeholder:text-white/40"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                <button type="button" className="absolute right-2.5 top-2.5 text-white/60" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && <p className="text-[12.5px] text-coral-300">{error}</p>}

            <button type="submit" disabled={submitting} className="w-full wb-btn-accent justify-center py-2.5">
              {submitting ? "Creating your account" : "Create account"}
            </button>
          </form>
        )}

        <p className="text-center text-white/70 text-[13px] mt-4">
          Already have an account? <Link to="/login" className="text-white font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
