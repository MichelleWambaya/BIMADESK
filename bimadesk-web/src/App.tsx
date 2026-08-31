import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { AppDataProvider } from "@/data/appStore";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth, RequireOnboarding, RequireAdmin, RedirectIfAuthed } from "@/components/routing/Guards";

import { LandingPage } from "@/pages/marketing/Landing";
import { PrivacyPage } from "@/pages/marketing/Privacy";
import { TermsPage } from "@/pages/marketing/Terms";
import { FaqPage } from "@/pages/marketing/Faq";
import { CookieConsent } from "@/components/marketing/CookieConsent";
import { LoginPage } from "@/pages/auth/Login";
import { SignUpPage } from "@/pages/auth/SignUp";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPassword";
import { ResetPasswordPage } from "@/pages/auth/ResetPassword";
import { OnboardingFlow } from "@/pages/onboarding/OnboardingFlow";
import { BillingPage } from "@/pages/billing/BillingPage";
import { NotFoundPage } from "@/pages/NotFound";

import { Dashboard } from "@/components/dashboard/Dashboard";
import { ClientsPage } from "@/components/clients/ClientsPage";
import { ClientProfile } from "@/components/clients/ClientProfile";
import { LeadsPage } from "@/components/leads/LeadsPage";
import { PoliciesPage } from "@/components/policies/PoliciesPage";
import { RenewalsPage } from "@/components/policies/RenewalsPage";
import { QuotationsPage } from "@/components/quotations/QuotationsPage";
import { TasksPage } from "@/components/tasks/TasksPage";
import { CalendarPage } from "@/components/calendar/CalendarPage";
import { CommunicationsPage } from "@/components/communications/CommunicationsPage";
import { ReportsPage } from "@/components/reports/ReportsPage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { ImportWizard } from "@/components/import/ImportWizard";

import { AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminOverview } from "@/pages/admin/AdminOverview";
import { AdminOrganizations } from "@/pages/admin/AdminOrganizations";
import { AdminPayments } from "@/pages/admin/AdminPayments";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
        <SubscriptionProvider>
          <AppDataProvider>
            <CookieConsent />
            <Routes>
              {/* Public marketing */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/faq" element={<FaqPage />} />

              {/* Auth, redirect away if already signed in */}
              <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
              <Route path="/signup" element={<RedirectIfAuthed><SignUpPage /></RedirectIfAuthed>} />
              <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPasswordPage /></RedirectIfAuthed>} />
              {/* No redirect guard here: the reset link itself creates a
                  transient session, and RedirectIfAuthed would bounce the
                  person to /app before they can set a new password. */}
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Onboarding, requires a session but not yet completed */}
              <Route element={<RequireOnboarding />}>
                <Route path="/onboarding" element={<OnboardingFlow />} />
              </Route>

              {/* The product itself */}
              <Route element={<RequireAuth />}>
                <Route path="/app" element={<AppShell />}>
                  <Route index element={<Dashboard />} />
                  <Route path="clients" element={<ClientsPage />} />
                  <Route path="clients/:id" element={<ClientProfile />} />
                  <Route path="leads" element={<LeadsPage />} />
                  <Route path="policies" element={<PoliciesPage />} />
                  <Route path="renewals" element={<RenewalsPage />} />
                  <Route path="quotations" element={<QuotationsPage />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="communications" element={<CommunicationsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="import" element={<ImportWizard />} />
                  <Route path="billing" element={<BillingPage />} />
                </Route>
              </Route>

              {/* Platform admin, separate visual shell */}
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminOverview />} />
                  <Route path="organizations" element={<AdminOrganizations />} />
                  <Route path="payments" element={<AdminPayments />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AppDataProvider>
        </SubscriptionProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
