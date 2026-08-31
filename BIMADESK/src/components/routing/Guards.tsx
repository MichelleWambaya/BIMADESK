import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );
}

export function RequireAuth() {
  const { session, profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile || !profile.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export function RequireOnboarding() {
  const { session, profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.onboardingCompleted) return <Navigate to="/app" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { session, profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile?.isPlatformAdmin) return <Navigate to="/app" replace />;
  return <Outlet />;
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (session) return <Navigate to={profile?.onboardingCompleted ? "/app" : "/onboarding"} replace />;
  return <>{children}</>;
}
