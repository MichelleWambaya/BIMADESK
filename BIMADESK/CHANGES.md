# Changes in this pass

This covers every change since the last delivered zip. Organized by
feature, each with what changed, which files, and how to pick it up or
extend it further.

Before anything else: run `supabase/migrations/0002_team_invites.sql`
against your database. It depends on 0001 already being applied.

---

## 1. Mobile performance (the "draggy, glitchy, slow" fix)

**Root cause:** two things compounded. The aurora background animated the
CSS `background-position` property on a large gradient, which forces the
browser to repaint the whole layer every frame. That was layered under
`backdrop-blur` glass panels, and blur is one of the most expensive things
a phone GPU can be asked to do continuously. Together, scrolling or
tapping anywhere near those elements felt exactly like what you
described.

**What changed:**
- `src/index.css` — `.wb-aurora-bg` now animates `transform` on an
  absolutely positioned `::before` layer instead of `background-position`.
  Transform animations are compositor-only work; the browser does not
  repaint pixels for them, so this should feel smooth even on mid-range
  Android hardware.
- `.wb-glass` / `.wb-glass-dark` blur radius drops to 10px on small
  screens and only goes to the full 18px at the `sm:` breakpoint and up.
- `src/components/shared/Modal.tsx` — background page scroll is now
  locked (`document.body.style.overflow = "hidden"`) while any modal is
  open. Previously the page behind a modal could still scroll on touch,
  which produces the double-scroll feeling that reads as "glitchy."
  Backdrop dismissal switched from `onMouseDown` to a checked `onClick`,
  which is more reliable on touch than mouse-only events.
- `.wb-btn-ghost` got a `min-h-[36px]` floor so icon-only buttons meet a
  reasonable touch target size.

**If it's still slow after this:** the next most likely cause is
`src/data/appStore.tsx` loading every client, policy, task, and
communication for the organization on every login with no pagination.
That's fine at small scale and will start to matter past a few thousand
rows. See item 10 below.

---

## 2. Dark mode

**Approach:** rather than adding `dark:` variants to every component
individually (which would mean touching dozens of files and getting it
wrong somewhere), the neutral color tokens themselves became CSS
variables that flip under `[data-theme="dark"]`.

**Files:**
- `src/index.css` — defines `--color-paper`, `--color-paper-raised`,
  `--color-paper-sunk`, `--color-ink`, `--color-ink-soft`,
  `--color-ink-faint`, `--color-line` as RGB triplets, with light values
  in `:root` and dark values under `[data-theme="dark"]`.
- `tailwind.config.js` — `paper`, `ink`, and `line` now resolve to
  `rgb(var(--color-x) / <alpha-value>)` instead of hardcoded hex. This is
  why every existing `bg-paper`, `text-ink`, `border-line` usage across
  the whole app got dark mode for free.
- `src/contexts/ThemeContext.tsx` — light / dark / system preference,
  persisted to `localStorage`, applies `data-theme` to `<html>`, and
  listens for OS theme changes when set to "system."
- Toggle lives in `src/components/settings/AppearanceSection.tsx`.

**To extend:** the violet/amber/emerald/coral brand colors were left
static (they were already picked to read reasonably on both light and
dark backgrounds). If a color looks wrong in dark mode somewhere, it's
almost certainly a component using a raw hex value instead of the
`paper`/`ink`/`line` tokens, grep for hex codes in that file.

---

## 3. Accessibility: text size and reduced motion

**Files:**
- `src/contexts/AccessibilityContext.tsx` — `fontScale`
  (`default`/`large`/`larger`) and `reduceMotion`, both persisted.
- `src/index.css` — text size uses the CSS `zoom` property on `<html>`,
  driven by the `--a11y-scale` variable. Reduced motion sets
  `[data-reduce-motion="true"]` on `<html>`, which zeroes out animation
  and transition durations globally.
- Toggle lives in `src/components/settings/AppearanceSection.tsx`.

**Known limitation, and why:** almost the entire app sets text size with
Tailwind's arbitrary-value syntax (`text-[13px]`), which is a literal
pixel value, not `rem`. That means changing the root font-size does
nothing on its own. `zoom` was the pragmatic fix, since it's the one CSS
property that reflows layout (unlike `transform: scale`, which clips
instead of reflowing) without needing to rewrite every font-size class
in the codebase. It works in current Chrome, Edge, and Safari, and
Firefox from version 126. Older Firefox silently stays at 100% rather
than breaking. If you want true independence from browser support, the
real fix is converting `text-[Npx]` usage to `rem` throughout, which is a
mechanical but large find-and-replace across most component files.

---

## 4. Settings redesign (Gmail-style account management)

**Files, all new:**
- `src/components/settings/AccountSection.tsx` — identity card (avatar,
  name, email, role), editable profile fields, and a Security block with
  a "Change password" action.
- `src/components/settings/ChangePasswordForm.tsx` — the form inside that
  action's modal.
- `src/components/settings/TeamSection.tsx` — see item 5.
- `src/components/settings/AppearanceSection.tsx` — see items 2 and 3.
- `src/components/settings/DuplicateFinder.tsx` — see item 8.

`src/components/settings/SettingsPage.tsx` is now a shell: the sidebar
nav plus whichever section is active. The old single "Profile" tab is
gone; its content moved into `AccountSection`.

---

## 5. Team invites

Owners can now actually add teammates, which the plan model already
priced for (`max_team_members`) but had no UI to use.

**How it works:** no automated email is sent (no email service is wired
up). Instead, creating an invite generates a short random code stored in
`team_invites`, and the owner copies a link (`/invite/{code}`) to send
themselves over WhatsApp, SMS, or however they'd reach that person
anyway. Whoever opens it sees "You've been invited to join X," and either
signs up or logs in, then joins that organization instead of creating a
new one.

**Files:**
- `supabase/migrations/0002_team_invites.sql` — the `team_invites` table,
  its row level security (including a public-read policy so an invite
  can be looked up before the person has an account), and the
  `accept_team_invite` RPC.
- `src/types/index.ts` / `src/data/mappers.ts` — `TeamInvite` type and
  mapper.
- `src/contexts/AuthContext.tsx` — `acceptTeamInvite(code)`.
- `src/pages/onboarding/InviteAccept.tsx` — the public landing page at
  `/invite/:code`.
- `src/pages/onboarding/OnboardingFlow.tsx` — now checks
  `sessionStorage` for a pending invite code (set by the invite page
  before sending someone to sign up) and, if present, joins the existing
  organization instead of running the "create a new business" path, and
  skips the plan-selection step entirely.
- `src/components/settings/TeamSection.tsx` — member list, seat usage
  against the plan limit, invite creation, and copy-link.
- `src/App.tsx` — new public route `/invite/:code`.

**To extend:** real email delivery would replace the "copy this link"
step with an actual send. That needs an email provider (Resend, Postmark,
etc.) wired into a new edge function, following the same pattern as the
M-Pesa functions.

---

## 6. CSV import now respects plan limits

Previously the import wizard would happily add clients past a plan's
`maxClients` limit; only the single "Add client" form checked it.

**File:** `src/components/import/ImportWizard.tsx` — computes remaining
seats from `useSubscription().effectivePlan`, caps the import to that
many rows, warns before confirming, and reports how many rows were
skipped for being over the limit on the results screen.

---

## 7. Downgrade guard on Billing

**File:** `src/pages/billing/BillingPage.tsx` — before switching to a
plan whose `maxClients` is lower than the organization's current client
count, shows a warning ("you have more clients than this plan allows")
with an explicit "switch anyway" confirmation, rather than silently
letting it happen. Nothing is deleted either way; the person just can't
add new clients until they're back under the new limit.

---

## 8. Duplicate client merging

**Files:**
- `src/data/appStore.tsx` — `mergeClients(primaryId, duplicateId)`.
  Repoints every policy, task, quotation, communication, note, document,
  activity, and lead from the duplicate onto the primary client, then
  deletes the duplicate and refetches. This touches enough tables at once
  that it refetches everything afterward rather than patching local state
  piece by piece, simpler to get right.
- `src/components/settings/DuplicateFinder.tsx` — groups clients sharing
  a phone number, and lets you pick which record to keep before merging.
  Lives in Settings, then Data.
- `src/components/clients/ClientForm.tsx` — adding a client with a phone
  number that already exists now shows "View existing" instead of just a
  passive warning.

**Known limitation:** duplicate detection is phone-number-only. Matching
on name similarity or email would catch more cases but risks false
positives without a real dedup algorithm; phone match is deliberately
conservative.

---

## 9. Bulk task actions

**File:** `src/components/tasks/TasksPage.tsx` — checkboxes per row, a
"select all" for the current filtered view, and bulk Complete / Cancel
actions. Selection resets whenever you switch views or type filters, so
you can't accidentally bulk-act on a task you can no longer see.

---

## 10. Deferred, and why

These came up as suggestions but needed either real infrastructure this
sandbox can't provision, or enough scope to deserve their own pass rather
than being rushed:

- **Recurring billing.** A successful M-Pesa payment sets
  `current_period_end` one month out, but nothing re-charges
  automatically or warns when it lapses. Needs a scheduled job (Supabase
  supports `pg_cron` for this) that checks expiring subscriptions daily.
- **Failed payment retry UI.** Right now a failed STK push just shows an
  error; there's no "retry" affordance or persistent "payment failed"
  banner.
- **Payment receipts.** No confirmation is sent after a successful
  payment. Needs the same email provider as item 5.
- **Real document storage.** Still only stores file name, category, and
  size, not file bytes. Wiring Supabase Storage in is contained work
  whenever you're ready.
- **Mobile app parity.** The Flutter app still only has clients,
  renewals, tasks, and billing; leads, quotations, communications, and
  CSV import exist on web only.
- **Pagination.** `appStore.tsx` loads every row for the organization on
  login. Fine at small scale, will need cursor-based loading once an
  organization has thousands of records.

## 11. M-Pesa callback security hardening

The M-Pesa callback previously trusted whatever Safaricom's callback body
claimed. Safaricom doesn't sign callbacks the way Paystack signs webhooks
(which this app already verified via HMAC), so there was no cryptographic
way to confirm a callback genuinely came from Safaricom, or that its
claimed result was real. Two layers now address that:

**Layer 1, a shared secret on the callback URL.** `mpesa-stk-push`
appends `?secret=...` to the callback URL it registers with Safaricom.
`mpesa-callback` rejects, with a deliberately generic 404, any request
missing or mismatching that secret, using a constant-time string
comparison so response timing can't leak how close a guess was. This
alone blocks anyone who doesn't know the secret from reaching the
endpoint at all.

**Layer 2, independent verification.** Even with the secret gate,
`mpesa-callback` still doesn't trust the request body's claimed result.
Instead, it uses the `CheckoutRequestID` from the callback only as a
lookup key, then calls Safaricom's own STK Push Query API directly to ask
"did this transaction actually succeed?" A payment is only marked
successful if that independent query agrees. A forged callback claiming
success would need Safaricom's own systems to confirm a transaction that
never happened, which they won't.

Also added: idempotency (a payment already resolved by an earlier
callback is not reprocessed if Safaricom retries), and a "pending" state
is treated as "don't touch it yet" rather than guessed either way.

**Files:**
- `supabase/functions/_shared/mpesa.ts` — new. Shared Daraja API helpers
  (OAuth token, password construction, and the new
  `queryStkPushStatus`), used by both M-Pesa functions so this logic
  lives in one place.
- `supabase/functions/mpesa-stk-push/index.ts` — now appends the shared
  secret to the callback URL and imports the shared helpers instead of
  duplicating them.
- `supabase/functions/mpesa-callback/index.ts` — rewritten around the
  two-layer verification above.
- `.env.example` — documents the new `MPESA_CALLBACK_SECRET` secret.

**New secret to set before this works:**
```
supabase secrets set MPESA_CALLBACK_SECRET=$(openssl rand -hex 32)
```

**What this does not cover:** Paystack's webhook was already
signature-verified in the original build and needed no change. IP
allowlisting was considered and deliberately skipped in favor of the
stronger independent-verification approach; it would have been weaker
(Safaricom's published IP ranges aren't guaranteed stable) for less
security benefit than actually confirming the transaction.

## 12. Authorization gap in the payment functions (security fix)

`mpesa-stk-push` and `paystack-initialize` checked that the caller was
*signed in*, but never checked that they belonged to the
`organizationId` in the request body. Any logged-in BimaDesk user could
have passed a stranger's `organizationId` and phone number and triggered
a real M-Pesa prompt on someone else's phone. Not a way to steal money
(the victim still has to approve with their own PIN), but a real
harassment vector, and repeated unsolicited STK pushes are exactly what
gets a Paybill flagged by Safaricom.

**Files:**
- `supabase/functions/_shared/auth.ts` — new. `requireOrgMember(req,
  organizationId)` extracts the caller's JWT, confirms it belongs to a
  profile in that organization, and returns an error otherwise. Uses the
  caller's own scoped Supabase client (not the service role), so it's
  bound by the same row level security every other read is.
- `supabase/functions/mpesa-stk-push/index.ts` and
  `supabase/functions/paystack-initialize/index.ts` — both now call this
  before doing anything else, and reject with 403 if it fails.

No new secrets needed; `SUPABASE_ANON_KEY` is provided automatically by
the platform to every Edge Function.

---

## 13. Sign out was completely missing from the UI

`signOut()` existed in `AuthContext` from the very first version of this
rewrite but was never called from anywhere. There was no way to actually
sign out of the app.

**File:** `src/components/settings/AccountSection.tsx` — added a "Sign
out" row under Security that calls it and redirects to `/login`.

---

## 14. Delete account

There was no way to delete an account or its data at all, which matters
both for user trust and for compliance with Kenya's Data Protection Act
(the right to erasure).

**How it works:** if the person deleting their account is an
organization owner, the whole organization is deleted, which cascades
(via the `ON DELETE CASCADE` foreign keys already in `0001_init.sql`) to
every client, policy, task, and teammate's profile in it. If they're a
teammate rather than the owner, only their own profile is removed and
the organization is untouched. Either way, their `auth.users` row is
deleted last, which requires Supabase's admin API and is exactly why
this needed a new Edge Function rather than something the browser could
do with the anon key.

**Files:**
- `supabase/functions/delete-account/index.ts` — new. Deployed WITH JWT
  verification (the default); only ever acts on the account behind the
  caller's own token.
- `src/contexts/AuthContext.tsx` — `deleteAccount()`.
- `src/components/settings/AccountSection.tsx` — a "Danger zone" card and
  a confirmation dialog that requires typing the business name (owners)
  or the word DELETE (teammates) before the button becomes clickable.

Deploy this one too: `supabase functions deploy delete-account`.

---

## 15. No session timeout

Supabase's own session persists indefinitely across browser restarts
until an explicit sign out (or a refresh token is revoked), which is
normal for most apps but arguably too loose for one holding client
personal data on what might be a shared or borrowed device.

**File:** `src/components/layout/IdleSessionGuard.tsx` — new. Tracks
mouse, keyboard, touch, and scroll activity; after 30 minutes of none,
shows a "Still there?" warning, then signs out automatically 60 seconds
later if there's no response. Both numbers are constants at the top of
the file if you want a different balance of security versus
convenience. Wired into `AppShell.tsx`, so it's only active on
authenticated app routes, not the public marketing pages.

Worth knowing while testing this: the first implementation had a stale
closure bug where the idle timer would keep silently resetting even
while the warning was showing, because the event listener captured
`showWarning`'s value at mount time and never saw updates. Fixed by
reading a ref inside the activity handler instead of the state variable
directly.

---

## 16. Friendlier message for Supabase's email rate limit

This isn't a bug in the app, it's Supabase Auth's own abuse prevention:
their shared email sending service enforces a low limit on how many
confirmation emails can go out in a short window, meant to stop someone
from mass-creating accounts. Signing up several test accounts in a row
will hit it. The fix for real usage is configuring your own SMTP
provider (Resend, Postmark, SendGrid, etc.) in Supabase's Auth settings,
which removes their shared limit entirely.

**File:** `src/pages/auth/SignUp.tsx` — the raw Supabase error is now
translated into a plain explanation of what's happening and why, instead
of Supabase's generic wording.

---

## Verification performed

Everything in this pass was checked the same two ways as previous
deliveries, since there's no real `npm install` available here: a
script cross-referencing every import against real exports in its target
file, and every `.ts`/`.tsx` file individually parsed with esbuild. Both
came back clean. Neither of those catches Supabase type mismatches or
runtime logic errors, so a real `npm run build` and a manual pass through
the new flows (team invite end to end, theme toggle, merge) is still the
next real test.
