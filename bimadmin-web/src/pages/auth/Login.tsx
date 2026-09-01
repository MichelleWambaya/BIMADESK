import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signIn(email, password);
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
          <h1 className="font-display text-white text-xl">Welcome back</h1>
          <p className="text-white/70 text-[13px] mt-1">Sign in to your BimAdmin workspace.</p>
        </div>

        <div className="wb-glass-dark p-6 space-y-4">
          <OAuthButtons mode="signin" />
          <form onSubmit={submit} className="space-y-3.5">
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[12px] font-medium text-white/80">Password</label>
              <Link to="/forgot-password" className="text-[11.5px] text-white/60 hover:text-white">Forgot password</Link>
            </div>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                className="w-full bg-white/10 border border-white/25 rounded-[10px] px-3 py-2 pr-9 text-[13px] text-white placeholder:text-white/40"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="absolute right-2.5 top-2.5 text-white/60" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password visibility">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && <p className="text-[12.5px] text-coral-300">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full wb-btn-accent justify-center py-2.5">
            {submitting ? "Signing in" : "Sign in"}
          </button>
          </form>
        </div>

        <p className="text-center text-white/70 text-[13px] mt-4">
          New to BimAdmin? <Link to="/signup" className="text-white font-medium">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
