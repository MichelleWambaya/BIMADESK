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
`organizationId` in the request body. Any logged-in BimAdmin user could
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

## 17. Real communications: email, SMS, WhatsApp, and click-to-call

Every channel was simulated logging until now. Each is now genuinely
wired to a provider, generically, so you can plug in real credentials
later without any further code changes. None of the four providers'
setup steps are optional shortcuts I could code around:

- **Email**, via Resend. Fastest to get real: create an account, verify
  a sending domain, done.
- **SMS**, via Africa's Talking, the standard gateway for Kenya. Beyond
  the API key, registering a sender ID with the telcos has its own
  approval lag that no code speeds up.
- **WhatsApp**, via Meta's Cloud API directly. Needs a verified Meta
  Business Account and an approved WhatsApp Business number first,
  commonly days to weeks. Even once configured, free-form text only
  works within 24 hours of the client messaging first; outside that
  window Meta requires a pre-approved template message, which this app
  does not yet support (see the limitation note below).
- **Calls**, via a real `tel:` link that opens the device's own dialer.
  This app still can't detect whether a call happened or how it went,
  which is true of click-to-call in general, not a gap an API
  integration would close without a much bigger VoIP project. The
  outcome logging step stays manual and self-reported.

Until you add real credentials for email/SMS/WhatsApp, each send
attempt returns a plain "isn't configured yet" message instead of
silently failing or pretending to succeed.

**A bug I found and fixed while building this, worth knowing about:**
`supabase.functions.invoke()` does not surface an Edge Function's JSON
error body when the function returns a non-2xx HTTP status; it only
exposes the generic string "Edge Function returned a non-2xx status
code." This affected every Edge Function built so far, not just the new
ones. Fixed by having every function the frontend calls via `invoke()`
always return HTTP 200, putting the real outcome in the JSON body's
`error` field instead, and reserving non-200 only for `mpesa-callback`
and `paystack-webhook`, which are called by Safaricom/Paystack directly
rather than through `invoke()`. See the note at the top of
`supabase/functions/_shared/auth.ts` for the full explanation.

**Files:**
- `supabase/migrations/0003_communication_delivery.sql` — adds
  `delivery_status`, `provider_message_id`, and `error_message` to
  `communications`.
- `supabase/functions/_shared/rateLimit.ts` — new. A per-organization
  cap (checked against the `communications` table itself) on real sends
  per hour, since real sends have cost and reputation risk that
  simulated logging never had, and any signed-in org member could
  otherwise turn a send function into a spam relay.
- `supabase/functions/send-email/index.ts`,
  `supabase/functions/send-sms/index.ts`,
  `supabase/functions/send-whatsapp/index.ts` — new. Each verifies org
  membership, verifies the client belongs to that organization, checks
  the rate limit, checks its provider is configured, sends, and is the
  sole writer of the resulting `communications` row.
- `supabase/functions/integration-status/index.ts` — new. Reports which
  providers are configured (booleans only, never secret values) so the
  UI can show real status.
- `supabase/functions/mpesa-stk-push/index.ts` and
  `supabase/functions/paystack-initialize/index.ts` — status codes fixed
  per the bug above; no behavior change otherwise.
- `src/types/index.ts` / `src/data/mappers.ts` — `Communication` gained
  `deliveryStatus`, `providerMessageId`, `errorMessage`.
- `src/data/appStore.tsx` — `logEmail` and `logMessage` now call the
  Edge Functions and return `{ error }` instead of writing directly to
  the table and always succeeding. `logCall` is unchanged; see the
  comment above it for why.
- `src/components/communications/EmailModal.tsx` and `MessageModal.tsx`
  — real send/error/success states, and a check for a missing
  email/phone on the client before attempting anything.
- `src/components/communications/CallModal.tsx` — the dialing screen is
  now a real `tel:` link plus a "just log the outcome" fallback for a
  call already made outside the app.
- `src/components/settings/IntegrationsSection.tsx` — new. Replaces the
  old static "Not connected" list with one that actually asks
  `integration-status`.

**What this doesn't cover, on purpose:** WhatsApp template message
support (needed for anything outside the 24-hour window) is a real
follow-up feature, not a quick addition. It needs template names mapped
per `CommunicationTemplate`, approved in Meta Business Manager, and sent
via a differently-shaped API call than free text. Also not covered:
inbound message handling for any channel (a client's reply doesn't show
up anywhere in the app), which would need a webhook per provider.

---

## 18. Real document storage: view and download now work

Documents were metadata-only before this (file name, category, size,
nothing else), which is exactly why nothing but delete responded to any
action -- there was never a file behind the record to open. Now there is.

**Files:**
- `supabase/migrations/0004_document_storage.sql` — creates a private
  Storage bucket (`documents`) and RLS policies on `storage.objects`
  scoped by the first folder segment of the object path matching the
  caller's organization, the same isolation pattern used everywhere else
  in this schema. The `documents` table already had an unused
  `storage_path` column from `0001_init.sql`, anticipating this.
- `src/data/appStore.tsx` — `addDocument` replaced with `uploadDocument`,
  which actually uploads the file to Storage before writing the
  metadata row (and rolls back the upload if the database insert fails,
  so there's never an orphaned file with no record). `deleteDocument`
  now also removes the Storage object, not just the row.
  `getDocumentUrl(doc, forceDownload)` generates a short-lived signed URL
  (60 seconds), since the bucket is private.
- `src/components/clients/DocumentsPanel.tsx` — each document is now a
  real link (opens the file), plus explicit Open and Download buttons.
  A document uploaded before this migration has no `storagePath` and
  shows as un-openable with a message explaining why, rather than
  pretending it has a file.

---

## 19. Payments: receipts, idempotency fix, retry, and lifecycle automation

**Receipts.** After a successful M-Pesa or card payment, an email
receipt now goes out automatically, using the same Resend setup as real
email communications (`_shared/email.ts`, new). It goes to the
organization's `billing_email` if set, otherwise the owner's account
email. A missing or failing receipt never blocks the actual subscription
activation; it's wrapped to fail silently.

**A real idempotency bug fixed in `paystack-webhook`.** Unlike
`mpesa-callback`, this function never checked whether a payment was
already processed before activating a subscription. Paystack retries
webhooks on timeout or a non-2xx response; without this check, a retry
after successful activation would recompute `current_period_end` from
"now" again, silently extending the subscription by another free month
each time it retried. Fixed with the same `status === "pending"` guard
`mpesa-callback` already had.

**Failed payment retry.** `src/pages/billing/BillingPage.tsx` now shows a
persistent banner when the most recent payment failed, with a one-click
Retry that reopens the payment panel for that same plan. Every failed
row in payment history also gets its own Retry action.

**Subscription lifecycle automation**, `supabase/migrations/0005_subscription_lifecycle.sql`
— the closest thing to "recurring billing" that's honestly possible
here. Worth understanding what this is and isn't:

- M-Pesa's standard STK push has no mechanism to charge a customer again
  without them actively approving on their phone each time. There is no
  silent auto-renewal for M-Pesa in this app, and there structurally
  can't be without a different Safaricom product.
- Card payments via Paystack *could* support real recurring billing
  (charging a saved card authorization automatically), but that isn't
  wired up in this pass.
- What this migration does instead: reminds an organization a few days
  before a paid plan renews, marks it `past_due` with a notification if
  it lapses, and automatically downgrades to Free after a 3-day grace
  period if nobody paid. All three run as scheduled Postgres functions
  via `pg_cron`.

**This is the one part of this entire project that could not be tested
against a real database at all**, since no live Supabase project has
ever been available while building this. Specifically worth checking
after running the migration: confirm `pg_cron` is available on your
project (Database, then Extensions), and watch both scheduled jobs
(`notify-upcoming-renewals`, `expire-stale-subscriptions`) actually fire
once in the Cron Jobs dashboard before trusting this runs unattended.

---

## 20. Fixed: unclear error when card payments aren't configured

`paystack-initialize` never checked whether `PAYSTACK_SECRET_KEY` was
actually set, unlike the email/SMS/WhatsApp functions. Without it, a
card payment attempt would fail against Paystack's real API with a raw
rejection message instead of a clear "not configured" one. This is also
the answer to "why isn't my app asking for card info": it never does,
by design, since card details should only ever be typed into Paystack's
own hosted checkout page for PCI compliance, not into anything BimAdmin
renders itself. That redirect only happens after `paystack-initialize`
succeeds, which it can't without a real Paystack account behind it.

**File:** `supabase/functions/paystack-initialize/index.ts` — now checks
for the secret before calling Paystack at all.

---

## 21. Real recurring card billing

Card payments can now genuinely auto-renew, unlike M-Pesa, which
structurally cannot (Safaricom's STK push always requires the customer
to actively approve on their phone; there is no "charge them again
silently" capability to build toward there). Paystack supports reusing
a card's authorization code to charge it again without the customer
doing anything, when the issuing bank allows it.

**How it works end to end:** pay by card once, and if the card supports
it, Paystack marks the authorization reusable. `paystack-webhook` saves
that authorization code. A `pg_cron` job checks a few times a day for
subscriptions that are due, have auto-renew on, and have a reusable
saved card, and asks the new `charge-saved-card` function to actually
charge it — which does the charge, activates the subscription for
another month, and sends a receipt, all without the customer seeing
anything happen.

**Files:**
- `supabase/migrations/0006_recurring_card_billing.sql` — new
  `saved_payment_methods` table (RLS: any org member can view or delete
  their own saved card; only the service role can create or update one),
  `subscriptions.auto_renew` (defaults to true), a missing
  `payments.error_message` column this needed, and the `pg_cron` +
  `pg_net` job that triggers charges.
- `supabase/functions/charge-saved-card/index.ts` — new. Does the actual
  charge via Paystack's `charge_authorization` endpoint. Authenticated
  by a shared secret (`CHARGE_JOB_SECRET`) rather than a user JWT, since
  it's triggered by the database, not a signed-in person.
- `supabase/functions/paystack-webhook/index.ts` — now saves the
  authorization code when Paystack marks it reusable.
- `src/pages/billing/BillingPage.tsx` — shows the saved card (last 4
  digits, card type), an auto-renew toggle, and a way to remove the
  saved card entirely.
- `src/components/subscription/PaymentPanel.tsx` — discloses upfront
  that paying by card may save it for auto-renewal, rather than doing
  this silently without telling anyone.

**Setup is more involved than usual for this one**, since `pg_cron`
jobs can't know your Edge Function URL or secrets ahead of time: open
`0006_recurring_card_billing.sql` and replace the two placeholder values
(`CHARGE_FUNCTION_URL`, `CHARGE_JOB_SECRET`) with your real ones before
running it.

**This has never touched a real Paystack account or a live database.**
Beyond the general pg_cron caution already given for 0005, specifically
test `charge-saved-card` with one deliberate manual call (see the
comment at the top of that file for how) against a real reusable card
and confirm the charge actually appears in your Paystack dashboard
before trusting the automated schedule.

---

## 22. Delete a client or lead, safely

Neither existed before this. Both follow the same safeguard: nothing
deletes until you type the record's exact name into a confirmation
dialog that first shows you precisely what's about to disappear (real
counts, not a vague warning), so a stray click can't cause this.

**What actually gets deleted, and what doesn't:**
- **Client**: policies, quotations, communications, and activity history
  were already `ON DELETE CASCADE` in the schema and clean up
  automatically. Tasks, notes, and documents are not covered by a
  foreign key at all (notes/documents use a polymorphic owner_type/
  owner_id pattern), so those are now deleted explicitly, including the
  actual files in Storage, not just their database rows. A lead that
  originally converted into this client is not deleted, only unlinked
  (it survives as its own record, which the schema already did
  automatically).
- **Lead**: same treatment for its own tasks, notes, and documents. Any
  quotation that came from this lead is deliberately left alone; it
  belongs to a real client now and has its own life independent of the
  lead that led to it, only its back-reference to the lead is cleared.

**Files:**
- `src/components/shared/ConfirmDeleteDialog.tsx` — new, reusable.
  Type-to-confirm text, a bulleted summary of what's being removed, and
  the delete button stays disabled until the typed text matches exactly.
- `src/data/appStore.tsx` — `deleteClient` and `deleteLead`. Storage
  files are removed before their database rows, not after, so a failed
  delete can't leave an orphaned file with no record pointing at it.
- `src/components/clients/ClientProfile.tsx` — a delete action in the
  client header, showing real counts of policies, quotations, tasks,
  communications, notes, and documents before you can confirm.
- `src/components/leads/LeadsPage.tsx` — a delete action on each lead
  card in the pipeline.

---

## 23. Templates page: create, edit, delete, plus real default templates

Two real gaps closed here, found while explaining the templates feature
rather than from a bug report: the Templates page was read-only (no way
to add, edit, or delete a template through the UI at all), and new
organizations were never seeded with any templates in the first place,
so a fresh signup's Templates page, and the template dropdown inside the
Call/Message/Email tools, were both simply empty.

**Files:**
- `supabase/migrations/0007_default_templates.sql` — seeds 10 real
  starter templates (renewal reminder and quote follow up for WhatsApp
  and SMS; new quotation, renewal reminder, renewal confirmation,
  missing documents, payment reminder, and thank you for email) for
  every new signup going forward, and backfills any organization that
  already exists with zero templates.
- `src/data/appStore.tsx` — `addTemplate`, `updateTemplate`,
  `deleteTemplate`.
- `src/components/settings/TemplateForm.tsx` — new. Shared create/edit
  form with clickable placeholder chips (`{{client_name}}` and so on)
  that insert into the body, so you don't have to remember or type the
  exact placeholder syntax.
- `src/components/settings/TemplatesSection.tsx` — new. Replaces the old
  read-only list, grouped by channel with add/edit/delete per template.
- `src/components/settings/SettingsPage.tsx` — wired in.

Deleting a template uses a simple confirm, not the heavier type-to-
confirm dialog clients and leads use, since removing a template is low
stakes: nothing else gets deleted with it, and recreating one takes a
minute.

---

## 24. Fixed: reloading the browser at /app (or any nested route) broke

Not a bug in the app's code -- this is the standard "single page app on
static hosting" problem. `/` always worked because Vercel serves the
literal `index.html` file that exists there. Reloading at `/app` sends
a fresh request straight to Vercel asking for a file or folder named
`app`, which doesn't exist (it's a route React Router invents entirely
in the browser, not a real file), so Vercel 404s before React ever gets
a chance to run.

**File:** `vercel.json` — new. Tells Vercel to serve `index.html` for
any path it doesn't recognize as a real file, so React Router can take
over and resolve the route client-side, on first load and refresh alike.

---

## 25. Fixed: the renewal reminder automation never actually worked

This was the most consequential bug found in the whole project, because
it silently disabled the headline reason someone would pay for a plan.

**What was wrong:** the "Renewal follow-up 30 days before expiry" rule
was only evaluated at the exact moment a policy was *created*, asking
"is today exactly 30 days before this policy's end date?" That is almost
never true when you add a policy, since you normally add one at the
start of its term, not 30 days from the end. Nothing ever revisited
existing policies as time actually passed toward their renewal dates. So
for real policies, this automation did nothing at all.

Two related things were also broken:
- The `policy_pending_documents` rule was seeded from day one but had no
  implementation anywhere. Turning it on did nothing.
- `organizations.renewal_reminder_offsets` (Settings, then Reminder
  settings, default 90/60/30/14/7/3/1 days) was editable in the UI from
  an early version, but nothing ever read it. Changing those numbers had
  no effect on anything.

**The fix,** `supabase/migrations/0008_scheduled_policy_automations.sql`:
- `run_policy_automations()` evaluates every active policy against its
  organization's enabled rules once a day, creating tasks, activity
  entries, and notifications. De-duplicated via the existing
  `tasks.created_by_automation_id` column plus a new index, so running
  it more than once a day is harmless.
- Implements `policy_pending_documents` properly, nagging only every N
  days per the rule's own config rather than daily.
- `notify_policy_renewal_offsets()` finally honours each organization's
  configured reminder offsets, creating notifications (not tasks) at
  each one. The two systems now complement each other rather than
  overlapping: offsets give awareness, automation rules give assigned
  work.

Both run via `pg_cron`, the same pattern already used for the
subscription billing lifecycle in 0005. This has to live server side:
a daily check fundamentally cannot work in client-side code, which only
runs when someone happens to have the app open.

**Also changed:**
- `src/lib/automation.ts` — the broken `evaluatePolicyExpiryAutomations`
  function is removed rather than left as dead code, with a comment
  explaining where that logic actually lives now. Only genuinely
  event-driven triggers (quotation sent, lead created) remain in this
  file, which is the correct model for them.
- `src/data/appStore.tsx` — no longer calls the removed function on
  policy creation.
- `src/components/settings/SettingsPage.tsx` — each automation now says
  whether it's "Checked once a day automatically" or "Runs the moment
  it's triggered", so the difference is visible rather than something
  you'd have to guess at.
- `src/components/settings/ReminderOffsetsEditor.tsx` — copy updated now
  that these offsets genuinely do something.

**Same testing caveat as 0005 and 0006:** pg_cron has never been
verified against a live database from here. After running this
migration, check Database, then Cron Jobs, and confirm
`run-policy-automations` and `notify-policy-renewal-offsets` actually
fire. A quick way to test without waiting a day: create a policy whose
end date is exactly 30 days out, then run `select
run_policy_automations();` manually in the SQL editor and confirm a task
appears.

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

---

## 26. Admin dashboard redesign, favicon, idle timings, plan repositioning

**Idle timeout** now matches your spec: warning at 15 minutes, automatic
sign out at 20. `src/components/layout/IdleSessionGuard.tsx`.

**Admin dashboard** rebuilt (`src/pages/admin/AdminOverview.tsx`), taking
the structural cues from your reference screenshot minus the graphs: a
greeting header, stat cards carrying real month-over-month deltas
(organizations joined, revenue vs last month), a plan distribution bar,
and side-by-side "newest organizations" and "recent payments" tables.
Everything reads from real data; nothing is placeholder.

**Favicon** replaced (`public/favicon.svg`) with a hand-drawn vector: a
shield for protection, wrapped by the same burn-down arc as the
RenewalGauge used throughout the app, so the mark shares a visual
language with the product instead of being a generic letter tile.

**Plans repositioned** (`supabase/migrations/0009_plan_repositioning.sql`).
The old structure gated automation entirely behind paid tiers, which is
backwards: automation IS the product, so a free user never experienced
the thing they'd pay for and had no reason to convert. Now every tier
including Free has renewal automation, and tiers differentiate on scale
plus the channels that cost real money to deliver:

| Plan | Price | Clients | Team | Messages/mo |
|---|---|---|---|---|
| Free | KES 0 | 40 | 1 | 20 |
| Solo | KES 900 | 250 | 1 | 300 |
| Team | KES 2,900 | 1,200 | 5 | 1,500 |
| Agency | KES 6,900 | Unlimited | 25 | 6,000 |

Plan rows are updated in place by key, not deleted and reinserted, so
existing subscribers aren't orphaned. Two new database functions
(`messages_used_this_month`, `message_allowance_remaining`) are the single
source of truth for quota, consumed by the send functions so UI and
server can never disagree. All three send functions now enforce the
monthly allowance alongside the existing per-hour abuse guard.

Landing page, FAQ, and Billing plan cards all updated to match.

**Mobile app:** client deletion added with the same type-to-confirm
safeguard as web (`lib/widgets/confirm_delete_dialog.dart`,
`deleteClient`/`deleteLead` in the controller). Found and fixed a real
bug while doing it: `TaskRecord` had no `leadId` field, which the new
lead-deletion code needs, and which would have been a compile error.

---

## 27. Renamed to BimAdmin, multi-format import, user guide handbook

**Renamed** across the web app, marketing site, emails, and mobile app.
Deliberately left alone: the `bimadesk_*` browser storage keys, because
renaming those would silently reset every existing user's saved theme and
accessibility preferences for no visible benefit.

**Import now accepts CSV, Excel, PDF, and Word**
(`src/lib/importParsers.ts`, new). All four converge on the same
headers-plus-rows shape, so the mapping and preview steps treat them
identically. On the JSON question: that conversion was always happening,
the parser turns rows into JSON objects that Supabase writes as
structured records. That part didn't need changing.

Each format carries an honest confidence level, surfaced in the UI:
- **CSV and Excel** are `structured`, the format genuinely describes rows
  and columns. Excel also warns when a workbook has multiple sheets, since
  only the first is read.
- **Word** is `structured` when the list is in a real table (parsed from
  the table markup via mammoth), `inferred` otherwise.
- **PDF** is always `inferred`. PDFs carry no column information, so text
  fragments are grouped by vertical position into lines, then split on
  runs of whitespace. It works, and the preview step shows a prominent
  warning to check every row, because misaligned columns would otherwise
  import wrong client data silently. Nothing skips the preview.

The upload screen now explains which format to prefer and why, rather
than just accepting whatever and hoping.

Libraries added: `xlsx`, `pdfjs-dist`, `mammoth`, all dynamically
imported so they're only downloaded by someone actually importing a file
instead of being bundled into every page load.

**User guide handbook** (`src/data/guideContent.ts`,
`src/components/settings/UserGuideSection.tsx`). Six chapters covering
getting started, renewals and automation, clients and documents,
communication, team and billing, and account settings. Searchable,
collapsible, and available any time from Settings, then User guide.
Content lives in one data file shared with the first-run tour so the two
can't drift apart.

**On the AI video:** I can't generate video, and there's no network
access here to call a service that could. What exists instead is a
working player slot: set `GUIDE_VIDEO_URL` in `src/data/guideContent.ts`
and the video appears in both the handbook and the tour's final step.
Until it's set, both omit the section rather than showing a broken
player. A screen recording of real usage would likely serve Kenyan
intermediaries better than an AI avatar anyway.

**Bug found and fixed:** the first-run tour's final button linked to
`/settings`, which isn't a route (everything lives under `/app`), so it
404'd. Now points to `/app/settings`.

---

## 28. Google sign in, profile pictures

**Google sign in** on both the login and signup screens
(`src/components/auth/OAuthButtons.tsx`, `signInWithProvider` in
AuthContext). Worth knowing: this is mostly configuration, not code. It
does nothing until you enable Google under Authentication, then
Providers, in your Supabase dashboard and paste in a client ID and secret
from Google Cloud Console. Until then the button shows a plain "Google
sign in isn't switched on yet" message rather than a raw provider error.

The signup and login paths are intentionally identical for OAuth: on
return, the existing route guards send anyone without an organization to
onboarding, which is exactly what a first-time Google signup needs. No
separate OAuth signup flow was necessary.

The Google mark is drawn as inline SVG because Google's brand guidelines
require their specific four-colour logo on sign-in buttons, and generic
icon libraries don't include it.

**Profile pictures** (`supabase/migrations/0010_profile_pictures.sql`,
`uploadAvatar`/`removeAvatar` in AuthContext). 2MB limit, images only.
Shown in the account card and the sidebar, with the existing coloured
initial as the fallback when someone has no picture. The colour picker
now hides itself when a photo is set, since it would have no effect.

Two deliberate choices: the `avatars` bucket is public, unlike the
private `documents` bucket, because an avatar renders constantly and
minting a signed URL per render would be wasteful. Write access is still
restricted to the owner's own folder by RLS. And the storage path is
fixed per user with upsert, rather than timestamped, so replacing a
picture doesn't accumulate orphaned files; a cache-busting query param on
the stored URL handles the browser caching that would otherwise cause.

---

## 29. Landing page rebuild, ratings and testimonials, mobile prompt

### Where the commented-out mobile app prompt lives

**File:** `src/pages/marketing/Landing.tsx`
**Location:** between the final call-to-action section and the `<footer>`,
in a `{/* ... */}` JSX comment block labelled
`MOBILE APP INSTALL PROMPT, COMMENTED OUT ON PURPOSE`.

To switch it on: delete the `{/*` and `*/}` wrapping the block, then
replace `PLAY_STORE_URL_HERE` and `APP_STORE_URL_HERE` with real store
links. It is commented out because the Flutter app is not published to
either store yet, so advertising it would send people to a dead link.

### Landing page: the five gaps I flagged, now fixed

1. **Hero rewritten** from the generic "Run your insurance book like a
   business" to "Never miss a policy renewal again", which names the
   actual pain rather than describing a category.
2. **Product screenshots added.** A `SCREENSHOTS` constant at the top of
   `Landing.tsx` takes three image paths. Until you set them, labelled
   placeholder frames render in the correct aspect ratio, so the layout
   is right and nothing looks broken while you gather images. Worth
   screenshotting a dashboard with real data in it; empty states sell
   badly.
3. **Objection handling section added,** covering the three things that
   actually stop a cautious intermediary: is my client data safe, how
   long will setup take, and am I locked in.
4. **Pricing now leads with who each plan is for** ("One intermediary,
   full time") rather than only listing limits.
5. **Social proof**, see the ratings system below.

**Social links** are a `SOCIAL_LINKS` array at the top of `Landing.tsx`,
all set to `null` as placeholders. Any entry left null is not rendered at
all, so no dead links ship. Replace the `href` values as profiles go
live.

### Ratings and testimonials

`supabase/migrations/0011_ratings_testimonials.sql` plus three new
components. How it works end to end:

- Nothing appears until the platform has **100 organizations**. That
  threshold lives in the `platform_settings` table (key
  `testimonial_min_orgs`), checked server side, so you can change it with
  one SQL update and no redeploy.
- Past that point, `src/components/feedback/RatingPrompt.tsx` asks each
  user once for a star rating and an optional comment. One rating per
  person, editable, not stackable.
- A comment is **only stored if the person ticks a consent box** saying it
  may be shown publicly with their name and business. Without consent the
  stars are kept and the text is discarded, since holding a quote you can
  never use is just unnecessary data.
- Nothing publishes automatically. You approve each one from
  `/admin/ratings` (`src/pages/admin/AdminRatings.tsx`), which also shows
  the average, how many have usable comments, and progress toward the
  threshold.
- Approved ones render as cards on the landing page
  (`src/components/marketing/TestimonialsSection.tsx`) with the author's
  profile picture, name, title, business, and star rating, plus an
  aggregate "4.8 out of 5 from 120 people" line.

Two deliberate choices worth knowing:

**The testimonials section renders nothing at all when empty**, rather
than showing a heading with no content. An empty "what our customers say"
section reads worse than no section, and I did not add placeholder quotes
because fake testimonials on a live site are a lie to visitors, not a
design placeholder.

**Public testimonial data comes from a database function, not a table
policy.** `public_testimonials()` returns only the display fields of
approved rows. That way approving a testimonial exposes a name, title,
and comment, and can never accidentally expose anything else on the
ratings row.

---

## 30. Mobile app: Google sign in, dark mode, text sizing

Closing the highest-value gaps between mobile and web, chosen for being
self-contained enough to be worth doing before the app has ever compiled.

**Google sign in** (`lib/widgets/google_sign_in_button.dart`,
`signInWithGoogle` in the controller). Opens an external browser rather
than a webview, which is what Google requires for OAuth on mobile.
Google's four-colour mark is drawn with a `CustomPainter` rather than
shipped as an image asset, so it stays crisp at any size without adding a
binary to the repo.

Needs three things outside the code, all documented in the mobile README:
the provider enabled in Supabase, the redirect URL allow-listed, and the
deep link registered in the native Android and iOS files that `flutter
create` generates. Without that last step the browser authenticates but
cannot return to the app.

**Light and dark themes** (`lib/core/services/settings_controller.dart`).
`buildAppTheme` now takes a brightness and builds either variant from one
definition, so the two can't drift apart structurally, only in colour.
Dark values match the web app's `[data-theme="dark"]` exactly so both
read as the same product. Preference is stored on the device, matching
web behaviour, since someone may reasonably want dark on their phone and
light on a laptop.

**Text sizing** with three steps, applied by layering our scale on top of
whatever the OS already requests rather than replacing it, so someone who
has already enlarged text system wide still gets our setting composed
correctly.

Both controls live in the mobile Settings screen under Appearance.

### Mobile is still behind, deliberately

Still missing on mobile: profile pictures, ratings and testimonials, the
user guide, real email/SMS/WhatsApp sending, documents, file import,
templates, the leads and quotations screens, the communications log, team
invites, idle timeout, and duplicate merging.

That gap is a reasonable place to stop for now. The mobile app has still
never been through `flutter pub get` or a compile, and needs `flutter
create` run inside it to generate the platform folders. Getting the web
app deployed and in front of beta users is worth more than feature
matching a second app that cannot build yet; once web is validated,
catching mobile up becomes a focused project rather than a moving target.

---

## 31. Mobile app brought close to parity

Six new screens plus supporting controller work. Mobile now covers most
of what web does.

**New screens**
- **Leads pipeline** (`features/leads/leads_screen.dart`), grouped by
  stage with arrows to advance or move a lead back. Now a bottom-nav tab.
- **Quotations** (`features/quotations/`), grouped by status with a
  one-tap advance to the next status.
- **Communications log** (`features/communications/communications_screen.dart`),
  filterable by channel, showing real delivery status and failure reasons.
- **Call, message, and email sheets** (`communication_sheets.dart`).
  Calls open the dialer then ask you to log the outcome, since the app
  cannot detect when a call ends. Messages and email use saved templates
  with the same placeholder names as web, so a template written on either
  platform behaves identically. All sends go through the same Edge
  Functions the web app uses, so there is one implementation, one rate
  limit, and one message allowance.
- **Documents panel** on client detail: view, open via signed URL, and
  delete.
- **User guide** (`features/guide/`), mirroring the web handbook.

**Also added**
- **Idle session guard**, 15 minute warning and 20 minute sign out,
  matching web. Backgrounding the app counts as inactivity, which is the
  mobile-specific case web does not have: a phone left on a table with
  the app open is exactly the risk.
- Four new models (Quotation, Communication, Template, Document) and
  `avatarUrl` on Profile.
- Dashboard quick links to Renewals, Quotes, and Messages, since the
  bottom bar caps out at five tabs before labels get cramped.

**Bugs found and fixed during this work**
- Two places where an earlier edit of mine had collapsed two Dart
  statements onto one line (in `signIn` and `completeTask`). Both would
  have failed to compile.
- A dead `url_launcher` import left in `client_detail_screen.dart` after
  the call button moved into a sheet.
- Missing `const` constructors on the new settings picker widgets, which
  Flutter's linter flags.

**Upload is still deliberately not wired.** `uploadDocument` and
`uploadAvatar` are written and take raw bytes, but no native picker is
attached. Pickers need the platform folders `flutter create` generates
plus per-platform permission entries; adding a button without that
plumbing would ship something that throws the moment it is tapped. This
is noted in a comment in `documents_panel.dart` and in the mobile README.

Still web only: file import, template management, team invites, duplicate
merging, and the ratings system.

**Verification remains static only.** 31 Dart files pass brace balance
and import resolution, and every controller method the UI calls has been
confirmed to exist. That catches structural errors, not type errors or
package API drift. The app has still never run `flutter pub get` or
compiled, and needs `flutter create` run inside it first. Expect to fix
things on the first real compile.

---

## 32. Three tiers, trials, plan testing, and UI fixes

### Run these migrations

`0010`, `0011`, and `0012`, in that order. The "bucket not found" error on
profile pictures was simply 0010 not having been run: it is the migration
that creates the `avatars` bucket. No frontend change could have fixed it.

### Two contrast bugs, both real

**The admin panel used `bg-ink`.** `ink` is the theme's *text* colour, so
in dark mode it inverts to near-white, turning the whole admin shell white
while every label inside stayed `text-white`. White on white. The shell
colour is now pinned (`ADMIN_SHELL_BG`), since the admin panel is
deliberately always dark and should not follow the theme.

**The Google button used `text-ink` on a hardcoded white background.**
Same inversion, same result. The text colour is now pinned dark, because
Google's brand guidelines require the button itself stay white.

### Admin plan testing actually works now

It existed before but was cosmetic: `isAdmin` short-circuited every limit
check, so selecting "Free" changed a label and nothing else. There was no
way to verify gating without creating throwaway organizations.

Now `bypassLimits` is true only for an admin who is *not* previewing. The
moment a plan is selected, that plan's caps apply in full. New page at
`/admin/plan-tester`, plus a persistent amber banner so a forgotten
preview does not look like a broken app. The same bypass bug was present
in `ImportWizard` and is fixed there too; `bypassLimits` is exposed from
the context so callers stop re-deriving it and getting the preview case
wrong.

### The package mismatch

The landing page kept prices in a hardcoded `PLAN_SUMMARY` array while
billing read from the database. Two sources of truth, guaranteed to
drift. Both now read `public_plans()`.

### Plans: four tiers to three

| | Free | Growth | Agency |
|---|---|---|---|
| Price | KES 0 | KES 1,500 | KES 4,900 |
| Clients | 40 | 400 | Unlimited |
| Policies | 25 | Unlimited | Unlimited |
| Seats | 1 | 3 | 15 |
| Messages | 20 | 600 | 2,500 |
| Badge | bronze, no crown | silver crown | gold crown |

Four options is where choice paralysis starts, and the old Solo to Team
jump (KES 900 to 2,900, one seat to five) left a growing solo
intermediary nothing sensible to move to. Three also matches the badge
design.

**Free is capped, not time limited.** A one year timer means someone who
never intended to pay loses their client book on a date they did not
choose, which produces angry ex-users rather than customers. The 25
policy cap does the converting instead, and it bites exactly when the
person is getting real value and has something to lose.

**Expiry lands on read-only, not a hard lock.** An intermediary who cannot
open their own client records may be unable to meet record keeping duties
they are legally on the hook for, and withholding a controller's own
records invites a Data Protection Act 2019 complaint. It is also the most
reliable way to turn a late payer into someone who warns other
intermediaries off. Read-only keeps the commercial pressure, since they
cannot actually work, without holding data hostage. To make it a hard
lock instead, change the `canceled` branch of
`organization_access_state()` to return `blocked` immediately.

The policy cap is enforced by a database trigger, not just the interface.
A limit that only exists in the frontend is not a limit. `PolicyForm`
checks before rendering, so nobody fills in eight fields to be refused at
the end, and translates the trigger's `POLICY_LIMIT_REACHED` in case a
teammate takes the last slot while the form is open. That needed a
`lastError` on the app store, since `addPolicy` was swallowing its error
and returning a bare null.

### Profile, badges, and layout

Profile block moved to the far top right with an account menu, following
the reference layout. `TierAvatar` gives a tier-coloured ring plus a
crown for paid plans. The ring is a real gradient border rather than a
box-shadow glow, so it stays crisp on both themes instead of bleeding into
neighbours in a dense top bar. Free gets a muted bronze ring and no
crown, so the crown means something rather than being decoration
everyone has.

`UpgradeCard` on the dashboard shows usage meters that turn amber at 80%
and coral at the cap. The meters are the actual argument: seeing yourself
approach a wall converts better than a generic upgrade pitch. It renders
nothing for paying customers.

### Aurora and dark theme

Base is now a near-black `#0B0716` with one dominant violet light, one
small warm accent, and a vignette to keep text on the darkest part. The
previous version stacked three strong radials over a mid purple, which is
what made it look washed out: a darker floor makes a small amount of
light read as luminous, and two lights read as intentional where three
turn grey wherever they overlap.

### Developer text removed from user-facing pages

The public landing page was rendering the literal words "Screenshot
placeholder" to visitors, which advertises an unfinished product. That
section now hides entirely until real images are set. The mobile user
guide had a chapter listing features the app does not have yet; removed,
along with empty states that told users to go use the web app instead.

---

## 33. Policy members: beneficiaries and dependants

`supabase/migrations/0013_policy_members.sql` plus
`src/components/policies/PolicyMembersPanel.tsx`, shown from the Policies
tab on a client.

### The two shapes

Retail, where the client is an individual:

    Michael John (client)
      Policy MED-001
        Michael John      principal
          Grace John      spouse
          Brian John      child

Corporate, where the client is a company:

    Safaricom Sacco (client)
      Policy MED-042
        Employee A        principal
          spouse, children
        Employee B        principal
          spouse, children

### Corporate employees are deliberately not client records

This is the decision that matters most and the one that is expensive to
reverse. Making each employee a client is tempting, since they behave
like members, but it breaks three things at once: a 400 employee scheme
would eat 400 of the organization's client allowance under the plan caps
added in 0012, the client list would fill with people the intermediary
has no direct relationship with, and renewal reminders would chase
employees instead of the Sacco that actually holds and pays for the
policy.

The client is who you sell to and invoice. The member is who is covered.
For retail those happen to be the same person, so `policy_members.client_id`
links them and existing retail policies get their principal backfilled by
the migration.

### Rules enforced in the database, not the interface

- A dependant hangs off a principal, never off another dependant. Medical
  schemes are two levels deep and the trigger caps it there.
- A policy for an individual client gets exactly one principal; a policy
  for a company gets many. The client type decides, so the interface
  cannot get it wrong.
- Removals are effective dated, never deletions. Someone who left mid
  term was still covered for part of it, which matters for claims history
  and pro rata premium.
- Removing a principal cascades to their dependants, because a
  dependant's cover exists only through their principal.

`member_movements` logs every addition, removal, suspension and
amendment with an effective date and optional premium delta. It is
separate from the member row because the questions differ: the member row
answers who is covered now, the log answers what changed and when.
Insurers bill on movements and disputes are always about the second
question.

### Child age limits warn rather than block

Most Kenyan medical schemes drop children at 18, or 25 in full time
education, but the exact rule is per insurer. The panel flags a dependant
marked as a child who is 18 or over instead of refusing the entry, since
hardcoding one insurer's rule would be wrong for the others.

---

## 33. M-Pesa till support, and a paybill/till bug

### Your setup needs Buy Goods, not Paybill

`mpesa-stk-push` hardcoded `CustomerPayBillOnline`. A till plus store
number is a **Buy Goods** merchant, which uses different fields:

| | Paybill | Till |
|---|---|---|
| TransactionType | CustomerPayBillOnline | CustomerBuyGoodsOnline |
| BusinessShortCode | the paybill | the **store** number |
| PartyB | the paybill | the **till** number |

A paybill puts one number in both fields; a till puts two different
numbers in two fields. Sending paybill fields for a till is rejected by
Safaricom.

Now driven by `MPESA_SHORTCODE_TYPE` (`paybill` or `till`) plus
`MPESA_STORE_NUMBER`. It fails with a clear message if configured for a
till without a store number, rather than sending a malformed request.

Also fixed while doing this: the STK password is a base64 of
shortcode + passkey + timestamp, and the shortcode inside it must match
the `BusinessShortCode` field. It was being built from `MPESA_SHORTCODE`
before the paybill/till branch was resolved, so a till would have sent a
password derived from the wrong number and failed authentication. The
resolution now happens before the password is computed.

### STK push cannot be done without Daraja

Worth recording plainly, because it shapes the options. Daraja is
Safaricom's API; STK push (the PIN prompt on the customer's phone) is a
Daraja endpoint. There is no alternative route to that prompt.

STK push needs four things: consumer key, consumer secret, the shortcode,
and a **passkey**. The passkey is issued by Safaricom to the shortcode
owner. Your own consumer key and secret authenticate you to the API but
grant no rights over a shortcode you do not own, and a passkey cannot be
derived. So a till belonging to someone else cannot be used, and even
with their passkey the funds would settle to their account.

The practical alternative is an aggregator (Paystack, which is already
integrated here, or IntaSend, Pesapal, Flutterwave, Kopo Kopo). They hold
the M-Pesa relationship, raise the prompt, and settle to your bank, which
removes the need for your own shortcode, passkey, or Daraja account.

---

## 34. Four tiers: Free, Starter 499, Growth 1500, Agency 4900

`supabase/migrations/0014_four_tier_plans.sql`.

| | Free | Starter | Growth | Agency |
|---|---|---|---|---|
| Price | KES 0 | KES 499 | KES 1,500 | KES 4,900 |
| Clients | 40 | 150 | 1,000 | Unlimited |
| Policies | 25 | 150 | Unlimited | Unlimited |
| Users | 1 | 1 | 10 | Unlimited |
| Messages | 20 | 500 | Unlimited | Unlimited |
| Ring | bronze | bronze | silver | gold |
| Crown | no | yes | yes | yes |

**Crown now means "pays", not "tier colour".** Four tiers against three
metals meant Free and Starter share bronze, so the crown is what
separates them. `TierAvatar` takes a `crowned` prop driven by
`priceKesMonthly > 0` rather than inferring from the ring, and the context
exposes `isPaidPlan` so no caller has to re-derive it.

**Unspecified caps, filled in.** You gave prices, seats, and messages.
Clients and policies for Starter and Growth were open, so: Starter 150
clients and 150 policies, Growth 1,000 clients and unlimited policies.
The policy ladder tightens deliberately (25, 150, unlimited, unlimited)
because it is the main conversion lever; making Starter unlimited on
policies would remove the reason to reach Growth.

**Agency seats read as unlimited.** "Unlimited everything" and "25 plus
users" conflict, so 25+ is treated as marketing copy and the cap is null.
If a hard 25 was meant, change one value in 0014.

### Three bugs this surfaced

**Unlimited seats would have become one seat.** `TeamSection` did
`currentPlan?.maxTeamMembers ?? 1`, and `max_team_members` is now null for
Agency, so `?? 1` would cap an Agency customer at a single seat. Null now
becomes `Infinity` for comparisons, with a separate label for display.

**Unlimited messaging would have displayed as "0 messages a month."**
`monthlyMessageAllowance` mapped `max_messages_monthly ?? ... ?? 0`, so
null collapsed to zero. That field is now deleted rather than fixed: it
silently turned "unlimited" into "none", which is the kind of default that
produces a confident wrong number somewhere else later. Callers use
`maxMessagesMonthly` and handle null explicitly.

**A migration ordering bug of mine.** 0014 inserted null into
`max_team_members` before dropping the NOT NULL that 0001 put there, so
the whole statement would have failed. The ALTERs now run first.

Also: `max_team_members` is nullable in the type and mapper, the billing
page gained the policy line it was missing, the pricing grid is four
across on large screens, and the upgrade card now points at Starter with
its real price instead of a hardcoded Growth reference.

---

## 35. Wallet, own SMS gateway, promise to pay, spotlight tour

`supabase/migrations/0015_wallet_gateway_promises.sql`.

### Messaging unbundled

Included allowance is now small and covers **SMS and email only**.
WhatsApp always draws on the wallet, because Meta bills per conversation
at roughly eight times an SMS and that single line item was what made
every tier unprofitable.

`charge_for_message()` is called BEFORE dispatch, not after, so a message
is never sent that cannot be paid for. Balance is held in cents to avoid
float drift, and every movement is a ledger row rather than an update to
a running total; a bare balance column leaves you unable to answer "where
did my credit go", which is the first thing a customer asks.

### Bring your own gateway

Growth and Agency can connect their own Africa's Talking account.
`sms_gateways` has **no select policy** for normal users, deliberately:
nothing in the app needs to read the key back, so `my_sms_gateway()`
returns a `has_api_key` boolean instead and the secret never reaches a
browser. Verification runs in an edge function because the key must not
leave our server.

The setup panel walks through registration as five numbered steps rather
than a link. The sender ID step is called out specifically, because it
needs Safaricom approval and takes days, and it is the step people miss.

### Promise to pay

From your AR point: a debtor who names a date is far likelier to pay than
one chased on a generic schedule. `payment_promises` captures the amount,
the date they gave, and their words verbatim. A reminder goes out the day
before; anything still open the day after is marked broken and raises a
high-priority task. `client_promise_record()` gives a kept/broken count
for the client profile, so whoever picks up the phone next knows who they
are dealing with.

A promise that quietly expires is worse than none, because the client
learns the date was never real.

### Spotlight tour replaces the old one

`SpotlightTour.tsx` cuts a hole in a dim overlay around a real element
and walks through the app. The dim layer is **four rectangles around the
target rather than one div with a box-shadow hole**, so clicks reach the
highlighted element and the person can actually use the thing being
explained.

Anchoring is by `data-tour` attribute, so a step survives markup changes.
Sidebar anchors are derived from the route, which keeps them in sync with
the nav automatically. Handled: target not mounted yet (navigate, then
poll), below the fold (scroll, then re-measure after the scroll settles),
never appears (skip the step rather than dead-end), layout shifts
(reposition on scroll and resize), and tooltip overflow (flip and clamp).

Removed a `nav-team` step that pointed at a route which does not exist,
since Team is a Settings section. It would have been silently skipped.

### Bugs found in my own work here

- `my_wallet()` referenced `sms_gateways` before that table was created.
  A language-sql body is validated at creation, so the migration would
  have failed outright. Moved below the table.
- The allowance ledger insert used `union all ... limit 1`, which has no
  guaranteed row order and could have logged the wrong balance. Replaced
  with a scalar subquery.
- The gateway disconnect used `.neq()` to match every row and relied on
  RLS alone to scope the delete. Now scoped explicitly by organization: a
  query whose literal meaning is "delete every row" is one policy mistake
  away from doing exactly that.
