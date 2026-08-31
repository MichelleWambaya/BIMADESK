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
own hosted checkout page for PCI compliance, not into anything BimaDesk
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

## Verification performed

Everything in this pass was checked the same two ways as previous
deliveries, since there's no real `npm install` available here: a
script cross-referencing every import against real exports in its target
file, and every `.ts`/`.tsx` file individually parsed with esbuild. Both
came back clean. Neither of those catches Supabase type mismatches or
runtime logic errors, so a real `npm run build` and a manual pass through
the new flows (team invite end to end, theme toggle, merge) is still the
next real test.
