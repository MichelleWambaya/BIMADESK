# BimaDesk: launch checklist and how to change database/hosting

## Part 1: Before real users touch this

Grouped by how blocking each item actually is. "Blocking for beta" means
even a handful of invited testers shouldn't happen without it. "Blocking
for public launch" means fine for beta, but must happen before you open
signups to strangers.

### Blocking for beta (do these first, in this order)

1. **Run a real build.** `npm install && npm run build` inside
   `bimadesk-web/`. This has never actually happened; everything so far
   was verified by static checks only (import/export cross-referencing
   and syntax parsing), not a real compiler or bundler. If this fails,
   nothing else on this list matters yet.
2. **Create your production Supabase project and run the migrations.**
   See Part 2 below.
3. **Deploy all five Edge Functions** and set their secrets:
   `mpesa-stk-push`, `mpesa-callback`, `paystack-initialize`,
   `paystack-webhook`, `delete-account`. Commands and required secrets
   are documented at the top of each function's `index.ts`.
4. **Test row level security with two throwaway accounts.** Sign up
   twice, as two separate organizations, add a client under each, and
   confirm neither account can see the other's clients, policies, or
   anything else. This is the one bug category that would actually hurt
   a real beta user (seeing someone else's data), and it has never been
   tested against a live database.
5. **Make yourself a platform admin** so you can test paid-tier features
   without paying:
   ```sql
   update profiles set is_platform_admin = true where id = 'your-user-uuid';
   ```
6. **Tell beta users plainly that it's beta.** Not a legal requirement,
   just fair: rough edges are expected, and they shouldn't treat it as
   their only copy of anything critical yet.

### Blocking for public launch (fine to defer for an invite-only beta)

7. **M-Pesa Paybill approval.** A Paybill number requires registering
   with Safaricom, which involves business registration documents and
   their own approval timeline (commonly a few weeks). You cannot take
   real M-Pesa payments without this regardless of anything in the code.
   Until it's approved, use the Daraja sandbox for testing.
8. **Paystack live keys.** Paystack requires business verification
   (KYC) before issuing live secret keys; test keys work for development
   but won't move real money.
9. **Legal review of the privacy policy and terms.** The versions
   shipped in the code are a starting template I wrote, not legal
   advice. Given this handles national ID numbers and phone numbers for
   real people, Kenya's Data Protection Act 2019 applies, and you may
   need to register as a data controller with the ODPC before public
   launch. Have an actual lawyer look at both documents.
10. **Basic monitoring.** At minimum, error tracking (Sentry or similar)
    so you find out about a broken flow from a dashboard, not from a
    customer's complaint. Tolerable to skip for a beta small enough that
    you're personally checking in with every user.
11. **Confirm backups are actually happening.** Depends on your Supabase
    plan tier; check explicitly in the dashboard rather than assuming.
12. **Rate limiting on auth endpoints.** Supabase Auth has some built-in
    protection, but worth explicitly reviewing brute-force protection on
    login before opening public signups.
13. **A real support channel.** Even a monitored email address or
    WhatsApp number listed somewhere, so a stuck user has somewhere to
    go.

### Not blocking, but should happen soon after launch

14. **Recurring billing.** A successful M-Pesa or card payment currently
    sets the subscription's period end one month out, but nothing
    re-charges automatically or warns when it lapses. Needs a scheduled
    job (Supabase supports `pg_cron`) checking for expiring
    subscriptions daily.
15. **Failed payment retry UI and payment receipts.** Both documented as
    deferred in `CHANGES.md`.
16. **Real document storage.** Currently stores file name, category, and
    size only, not file contents. Wiring in Supabase Storage is
    contained work.
17. **Pagination.** The app loads every client, policy, and task for an
    organization on login with no limit. Fine at beta scale, will need
    cursor-based loading once an organization has thousands of records.
18. **Mobile app parity.** The Flutter app is missing leads, quotations,
    communications, and CSV import, and has never been run through the
    actual Flutter toolchain. Treat it as further behind than the web
    app, not launch-ready on its own timeline.

---

## Part 2: Setting up your real database (Supabase)

Nothing is configured yet; the app currently has no database to talk to
at all. This is likely the more urgent of your two questions.

1. Go to supabase.com and create a new project. Pick a region close to
   your users (`eu-west` or a Kenya-adjacent region if offered; Supabase
   doesn't currently have an Africa region, so pick whichever is
   lowest-latency for Nairobi in practice).
2. In the SQL editor, run `supabase/migrations/0001_init.sql`, then
   `supabase/migrations/0002_team_invites.sql`, in that order.
3. Under Project Settings, then API, copy your **Project URL** and
   **anon public key**. Put them in `bimadesk-web/.env`:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   The anon key is meant to be public; row level security is what
   actually restricts access, not secrecy of this key.
4. Install the Supabase CLI (`npm install -g supabase`), log in
   (`supabase login`), and link it to your project
   (`supabase link --project-ref your-project-ref`).
5. Deploy the Edge Functions:
   ```
   supabase functions deploy mpesa-stk-push
   supabase functions deploy mpesa-callback --no-verify-jwt
   supabase functions deploy paystack-initialize
   supabase functions deploy paystack-webhook --no-verify-jwt
   supabase functions deploy delete-account
   ```
6. Set their secrets (each function's file header lists exactly which
   ones it needs):
   ```
   supabase secrets set MPESA_CONSUMER_KEY=...
   supabase secrets set MPESA_CONSUMER_SECRET=...
   supabase secrets set MPESA_SHORTCODE=...
   supabase secrets set MPESA_PASSKEY=...
   supabase secrets set MPESA_CALLBACK_URL=https://your-project-ref.functions.supabase.co/mpesa-callback
   supabase secrets set MPESA_CALLBACK_SECRET=$(openssl rand -hex 32)
   supabase secrets set MPESA_ENV=sandbox
   supabase secrets set PAYSTACK_SECRET_KEY=...
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
   are provided automatically by the platform; you don't set those
   yourself.
7. In Authentication, then Providers, then Email, decide whether email
   confirmation is required. Either setting works with this app's
   onboarding flow, but if you leave Supabase's own shared email sender
   in place, you'll keep hitting the same rate limit you already ran
   into. Fix that under Authentication, then Settings, then SMTP
   Settings, by adding your own provider (Resend, Postmark, SendGrid all
   work), which removes Supabase's shared limit entirely.

**If you later want to move to a different database entirely** (a
self-hosted Postgres instance, a different provider, etc.): this is a
significantly bigger undertaking than swapping a connection string,
because the app leans on three Supabase-specific things beyond "it's
Postgres":
- **Row level security policies** written as Postgres policies tied to
  Supabase's `auth.uid()`. A different provider without an equivalent
  auth-to-database identity bridge means either replicating that (most
  managed Postgres providers support plain RLS, but you'd need your own
  auth system feeding it the same way) or moving that access control
  into the application layer instead.
- **Edge Functions** are Deno-based and specific to Supabase's runtime.
  Moving off Supabase means rewriting all five as a Node/Express API, AWS
  Lambda, Cloudflare Workers, or similar, and updating
  `src/lib/supabaseClient.ts` and every `supabase.functions.invoke(...)`
  call site to point at wherever those now live.
- **Auth** (`@supabase/supabase-js`'s `auth` methods) would need
  replacing with whatever the new provider offers, or a separate auth
  service (Auth0, Clerk, etc.) wired in.

None of that is a reason to avoid Supabase; it's the standard tradeoff of
using a backend-as-a-service. Worth knowing this before it feels like a
surprise later. If you do need to migrate for a real reason (cost at
scale, a compliance requirement Supabase doesn't meet, etc.), plan it as
its own project rather than a quick swap.

---

## Part 3: Hosting the web app itself

Supabase does not host the frontend, it's a backend service. The
`bimadesk-web` app is a static Vite build that needs its own host. Given
this is already a Vite + React app with no server-side rendering, the
simplest options are static hosts built for exactly this:

### Recommended: Vercel

1. Push `bimadesk-web` to a GitHub repository (or use the `BIMADESK`
   repo already set up locally, if you've pushed it).
2. At vercel.com, import that repository.
3. Framework preset: Vite. Build command: `npm run build`. Output
   directory: `dist`.
4. Under Environment Variables, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` with your real values, since those get baked
   into the build at build time, not read at runtime.
5. Deploy. Vercel gives you a free `*.vercel.app` URL immediately; add
   your own domain under Project Settings, then Domains, once you have
   one.

### Alternatives, same general steps

- **Netlify** — build command `npm run build`, publish directory `dist`,
  same environment variable setup.
- **Cloudflare Pages** — same again; Cloudflare's network has good
  coverage in Africa, worth considering specifically for latency to
  Kenyan users.

### One thing this needs regardless of host: client-side routing

The app uses React Router, so every path (`/app/clients/123`, and so on)
needs to actually serve `index.html` and let the app's router take over,
rather than the host returning a 404 for paths it doesn't recognize as
files. Vercel and Netlify handle this automatically for Vite projects
in most cases; if you see 404s on refresh at a nested route after
deploying, add a rewrite rule sending all paths to `/index.html`
(Netlify: a `_redirects` file with `/* /index.html 200`; Vercel: a
`vercel.json` with a matching rewrite).

### Domain and SSL

Whichever host you pick, adding a custom domain and getting a free SSL
certificate is a built-in, few-minutes process on all three, no separate
certificate purchase needed.
