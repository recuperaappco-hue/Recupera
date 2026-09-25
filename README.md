# Recupera — pilot app

Recupera connects to a user's Gmail (read-only), uses AI to find money they may be owed, and helps them claim it.

It finds:
- refunds that were promised but never arrived
- duplicate card charges (from bank alert emails)
- cancelled flights without a refund
- orders that were not delivered
- upcoming price increases and free trials about to turn into charges
- warranties from Colombian e-invoices (DIAN XML inside the ZIP attachment)

## How it works

1. The user signs in with Google (Supabase Auth).
2. The user gives separate, explicit consent. Then they grant `gmail.readonly` through our own OAuth flow. The refresh token is stored encrypted (AES-256-GCM).
3. `/api/scan` runs narrow Gmail searches (purchases, invoices, bank alerts, refunds, price notices, trials, airlines). It skips any email already processed.
4. Claude Haiku reads each candidate email and returns structured facts through a forced tool call. Email bodies are never stored, only the facts plus subject, sender and a short snippet used as evidence.
5. `src/lib/rules.ts` turns the facts into findings with plain code: deadlines, Colombian business days and holidays, and matching refunds to promises. The rules are covered by `npm test`.
6. The user reviews a claim letter built from fixed templates, approves it, and sends it from their own email. They then track the case to closure.

## Project layout

```
public/landing.html        marketing page, served at /
supabase/schema.sql        database schema and row-level security
src/lib/gmail.ts           Google OAuth, Gmail search, message and invoice parsing
src/lib/extract.ts         Claude extraction (tool use, validated output)
src/lib/rules.ts           deterministic finding rules (unit tested)
src/lib/dates.ts           Colombian holidays and business days (unit tested)
src/lib/letters.ts         versioned claim templates
src/lib/scan.ts            scan pipeline
src/app/app/...            the app screens
src/app/admin              pilot metrics (ADMIN_EMAILS only)
src/app/privacidad         privacy policy DRAFT (needs lawyer review)
```

## Setup

1. **Supabase:** in the SQL Editor, run `supabase/schema.sql`. Then under Authentication → URL Configuration, set the Site URL to the production URL and add `https://YOUR-DOMAIN/auth/callback` to the Redirect URLs.
2. **Google Cloud (OAuth client):**
   - Authorized JavaScript origins: `https://YOUR-DOMAIN`
   - Authorized redirect URIs:
     - `https://vvididwsduodyvhdyzvs.supabase.co/auth/v1/callback`
     - `https://YOUR-DOMAIN/api/gmail/callback`
3. **Vercel:** import the GitHub repo. Add every variable from `.env.example` with real values, and set `NEXT_PUBLIC_SITE_URL` to the production URL. Then deploy.

Local development: copy `.env.example` to `.env.local`, then run `npm install` and `npm run dev`.

## Checks

- `npm test` runs the unit tests for holidays, business days, rules and DIAN XML parsing.
- `npm run typecheck` checks types.
- `npm run build` builds for production.

## Known limits of this pilot version

- While the Google app is in **Testing**, only listed test users (max 100) can sign in. Refresh tokens expire after 7 days, and the app asks the user to reconnect when that happens.
- Reminders are saved, but no notification sender exists yet (email or WhatsApp is the next step).
- Letters are sent by the user from their own mailbox. There is no per-case inbound address yet.
- Before public launch:
  - Google verification of the restricted scope, plus the yearly CASA security assessment.
  - Lawyer review of the privacy policy, the consent text and the pricing model.
- The AI extraction has not yet been tested against a real mailbox. Expect to tune the prompts and searches during the first week of the pilot.
