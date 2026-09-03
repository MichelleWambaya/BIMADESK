# M-Pesa setup, sandbox first

Work through this in order. Each step is a thing that silently breaks the
next one if skipped.

## The mistake almost everyone makes first

Daraja's simulator page shows two fields that look interchangeable:

- **Passkey** — 64 hexadecimal characters, never changes
- **Password** — long, base64, often ends in `=`, changes every second

You want the **Passkey**. The Password is a derived value: base64 of
`shortcode + passkey + timestamp`. It is only valid for the exact second
it was generated, so pasting it into `MPESA_PASSKEY` fails every request
forever. The code now detects this and says so, rather than failing
somewhere deeper.

## Sandbox values

Sandbox does not give you a per-app passkey. Every sandbox user shares
these, and they are published on Daraja's M-Pesa Express simulator page:

| Setting | Sandbox value |
|---|---|
| `MPESA_ENV` | `sandbox` |
| `MPESA_SHORTCODE` | `174379` |
| `MPESA_SHORTCODE_TYPE` | `paybill` |
| `MPESA_PASSKEY` | `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919` |
| `MPESA_CONSUMER_KEY` | from your Daraja app |
| `MPESA_CONSUMER_SECRET` | from your Daraja app |

Confirm the passkey against Daraja's own page rather than trusting this
table; if Safaricom rotates it, their page is right and this file is
stale.

Three things worth knowing about sandbox:

1. **Your own till number will not work.** Sandbox only accepts 174379.
   Your real till is for production only.
2. **Sandbox is paybill, not till**, even though you will use a till in
   production. So `MPESA_SHORTCODE_TYPE` must be `paybill` here and
   change to `till` later.
3. **Test with `254708374149`.** Safaricom's sandbox test number. Your
   own phone will not receive a sandbox prompt.

## Setting the secrets

This is probably your actual problem. **Running SQL does nothing for edge
functions.** They read from a separate secret store, so migrations
succeeding tells you nothing about whether the functions are configured.

```bash
supabase secrets set \
  MPESA_ENV=sandbox \
  MPESA_SHORTCODE=174379 \
  MPESA_SHORTCODE_TYPE=paybill \
  MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919 \
  MPESA_CONSUMER_KEY=your_key_here \
  MPESA_CONSUMER_SECRET=your_secret_here \
  MPESA_CALLBACK_SECRET=$(openssl rand -hex 32) \
  MPESA_CALLBACK_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/mpesa-callback \
  --project-ref YOUR_PROJECT_REF
```

Then confirm they are actually there:

```bash
supabase secrets list --project-ref YOUR_PROJECT_REF
```

If that list is empty or missing entries, nothing else will work.

## Did the migrations reach the right database?

You mentioned running the SQL in your terminal. There is a real
difference between:

- `supabase db reset` or `psql` against **localhost** — applies to a local
  Docker database, and your deployed app never sees it
- `supabase db push --project-ref YOUR_REF` — applies to your **hosted**
  project, which is what the deployed app reads

Check which one you hit:

```sql
-- Run this in the Supabase dashboard SQL editor, which is definitely
-- pointed at your hosted project.
select key, name, price_kes_monthly, included_sms_monthly
  from subscription_plans where is_active order by sort_order;
```

Four rows means the migrations landed. An error saying the column does not
exist means they went to your local database instead.

## Deploying the functions

Secrets and code are separate deploys. Both are needed.

```bash
supabase functions deploy mpesa-stk-push --project-ref YOUR_REF
supabase functions deploy mpesa-callback --no-verify-jwt --project-ref YOUR_REF
```

`--no-verify-jwt` on the callback is required. Safaricom's servers call it
and they have no Supabase token; without that flag every callback is
rejected before your code runs, so payments start but never complete.

## Reading the actual error

The functions now return a specific message instead of a generic failure.
To see it:

```bash
supabase functions logs mpesa-stk-push --project-ref YOUR_REF
```

Common messages and what they mean:

| Message | Cause |
|---|---|
| `MPESA_PASSKEY looks like a generated Password` | Copied the wrong field. See the top of this file. |
| `Safaricom rejected your consumer key or secret` | Keys from a different app, or trailing whitespace, or a production app used with `MPESA_ENV=sandbox`. |
| `You are in sandbox but MPESA_SHORTCODE is ...` | Using your real till in sandbox. Use 174379. |
| `MPESA_CALLBACK_URL must be a public https URL` | Pointing at localhost. Safaricom calls from their servers. |
| `... is not set` | Secret missing. Re-run `supabase secrets set`. |

## When you go to production

1. Apply for production credentials on Daraja. This is a separate app with
   its own key, secret, and a passkey issued **for your own shortcode**.
2. Set `MPESA_ENV=production`, your real shortcode, and
   `MPESA_SHORTCODE_TYPE=till` with `MPESA_STORE_NUMBER` set.
3. The unresolved issue stands: a till you do not own cannot be used.
   Safaricom issues the passkey to the shortcode owner, and funds settle
   to their account. You need your own shortcode, or an aggregator.
