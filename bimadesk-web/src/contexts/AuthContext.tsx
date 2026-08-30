import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { mapProfile, mapOrganization } from "@/data/mappers";
import { Profile, Organization } from "@/types";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  signUp: (input: { email: string; password: string }) => Promise<{ error: string | null; hasSession: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, "fullName" | "phone" | "avatarColor" | "onboardingCompleted">>) => Promise<void>;
  updateOrganization: (patch: Partial<Pick<Organization, "name" | "billingEmail" | "mpesaPhone" | "themeColor" | "renewalReminderOffsets">>) => Promise<void>;
  completeSignupSetup: (input: { businessName: string; fullName: string; phone: string }) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!error && data) {
      setProfile(mapProfile(data));
      if (data.organization_id) {
        const { data: orgData } = await supabase.from("organizations").select("*").eq("id", data.organization_id).maybeSingle();
        if (orgData) setOrganization(mapOrganization(orgData));
      } else {
        setOrganization(null);
      }
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  async function signUp({ email, password }: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, hasSession: false };
    if (!data.user) return { error: "Something went wrong creating your account. Please try again.", hasSession: false };
    return { error: null, hasSession: !!data.session };
  }

  /** Runs on the first onboarding step, whenever a signed-in person has no
   * organization yet. Deliberately separate from signUp itself, since
   * Supabase may require email confirmation before a session exists — this
   * way the organization gets created the moment a real session shows up,
   * whether that is immediately after signUp or after confirming an email
   * and logging in for the first time. */
  async function completeSignupSetup({ businessName, fullName, phone }: { businessName: string; fullName: string; phone: string }) {
    if (!session) return { error: "You need to be signed in first." };
    const { error } = await supabase.rpc("create_organization_for_new_user", {
      business_name: businessName,
      owner_full_name: fullName,
      owner_phone: phone,
    });
    if (error) return { error: error.message };
    await loadProfile(session.user.id);
    return { error: null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? error.message : null };
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? error.message : null };
  }

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id);
  }

  async function updateProfile(patch: Partial<Pick<Profile, "fullName" | "phone" | "avatarColor" | "onboardingCompleted">>) {
    if (!session) return;
    const row: Record<string, unknown> = {};
    if (patch.fullName !== undefined) row.full_name = patch.fullName;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.avatarColor !== undefined) row.avatar_color = patch.avatarColor;
    if (patch.onboardingCompleted !== undefined) row.onboarding_completed = patch.onboardingCompleted;
    await supabase.from("profiles").update(row).eq("id", session.user.id);
    await loadProfile(session.user.id);
  }

  async function updateOrganization(patch: Partial<Pick<Organization, "name" | "billingEmail" | "mpesaPhone" | "themeColor" | "renewalReminderOffsets">>) {
    if (!profile?.organizationId) return;
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.billingEmail !== undefined) row.billing_email = patch.billingEmail;
    if (patch.mpesaPhone !== undefined) row.mpesa_phone = patch.mpesaPhone;
    if (patch.themeColor !== undefined) row.theme_color = patch.themeColor;
    if (patch.renewalReminderOffsets !== undefined) row.renewal_reminder_offsets = patch.renewalReminderOffsets;
    const { data } = await supabase.from("organizations").update(row).eq("id", profile.organizationId).select().single();
    if (data) setOrganization(mapOrganization(data));
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, organization, loading, signUp, signIn, signOut, sendPasswordReset, updatePassword, refreshProfile, updateProfile, updateOrganization, completeSignupSetup }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
