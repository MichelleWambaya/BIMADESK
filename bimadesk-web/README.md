# BimaDesk, web app

A real SaaS platform for Kenyan insurance intermediaries: client and policy
management, renewal automation, and subscription billing through M-Pesa or
card. This is the web app; a matching Flutter mobile app ships alongside it
and talks to the same Supabase backend.

## Running it

```bash
npm install
cp .env.example .env      # then fill in your Supabase project values
npm run dev
```

You need a Supabase project before this does anything useful:

1. Create a project at supabase.com.
2. Run `supabase/migrations/0001_init.sql` against it, either by pasting it
   into the SQL editor or with the Supabase CLI (`supabase db push`).
3. Copy your project URL and anon key into `.env` (see `.env.example`).
4. Deploy the four edge functions in `supabase/functions/` and set their
   secrets. Each function's file header explains exactly what it needs.
5. In Supabase Auth settings, decide whether email confirmation is
   required. Either way works; the onboarding flow accounts for both.

To make yourself a platform admin (able to test every subscription tier
without paying), run this once against your database after signing up:

```sql
update profiles set is_platform_admin = true where id = 'your-user-uuid';
```

## What was verified without a live install

This sandbox has no network access, so nothing here has been through a
real `npm install` or `npm run build`. What was checked by hand instead:

- Every import was cross-referenced against real exports in its target file
- Every `.ts`/`.tsx` file was individually parsed with esbuild; there are no
  syntax or JSX errors anywhere in the project
- Every lucide-react icon name used was checked against the real icon list

A real `npm install && npm run build` is the next step and the most likely
place to surface anything this pass could not catch, particularly Supabase
type inference (the client is typed as `any` at the row level; see
`src/data/mappers.ts`).

## Architecture

- **Auth**: `src/contexts/AuthContext.tsx` wraps Supabase Auth. Sign up only
  collects email and password; business name, phone, and profile details
  are collected during onboarding, which also creates the organization row
  (via the `create_organization_for_new_user` database function) the
  moment a real session exists, whether that is immediately after signup or
  after confirming an email and logging in for the first time.
- **Subscriptions**: `src/contexts/SubscriptionContext.tsx` holds the plan
  catalog and the organization's current subscription, and exposes
  `canUseAutomation`, `canBulkImport`, and `clientLimitReached()`. A
  platform admin (`profiles.is_platform_admin`) always passes every check,
  and additionally gets an "admin preview" toggle (see Billing) to see the
  app as any plan would, without touching real billing.
- **Data**: `src/data/appStore.tsx` is the only place components read or
  write domain data. It fetches everything for the signed-in organization
  on load and exposes typed actions (`addClient`, `logCall`, and so on)
  that write to Supabase and update local state, mirroring the shape a
  REST client would have.
- **Payments**: `src/lib/payments.ts` calls the `mpesa-stk-push` and
  `paystack-initialize` edge functions and polls for the result.
  `src/components/subscription/PaymentPanel.tsx` is the shared UI, used
  in both onboarding and Billing.
- **Routing**: `/` is the public marketing site. `/app/*` is the product,
  gated by `RequireAuth` (also enforces onboarding completion). `/admin/*`
  is a visually distinct panel gated by `RequireAdmin`. See
  `src/components/routing/Guards.tsx` and `src/App.tsx`.

## Design

Vivid glassmorphism over a violet, amber, emerald, and coral palette
(`tailwind.config.js`), with an animated aurora gradient (`.wb-aurora-bg`
in `src/index.css`) behind the marketing page, auth screens, and
onboarding. `src/components/shared/RenewalGauge.tsx` remains the one
recurring visual motif: a radial countdown that burns from calm to urgent
as a policy's renewal approaches.

## CSV import

Bulk import is CSV only by design. Excel files are heavy to parse in the
browser; the import wizard (`src/components/import/ImportWizard.tsx`)
rejects non-CSV files with guidance to export as CSV first, caps a single
import at 1000 rows, and warns on files over 3MB.

## Known gaps, by design

- Document uploads store file name, category, and size, not file bytes.
  Wire real storage (Supabase Storage is the natural fit) by editing
  `addDocument` in `appStore.tsx`.
- The multi-team-member side of paid plans (`max_team_members`) has schema
  support but no invite-a-teammate UI yet.
- AI features are intentionally out of scope for this pass.
