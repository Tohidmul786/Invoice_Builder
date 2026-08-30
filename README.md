# Invoice Builder

A React + Firebase + Supabase invoice generator with Google sign-in, dynamic line items, PDF export, and real email sending — secured end-to-end through a Supabase Edge Function.

## Architecture

```
Browser (React)
   │  Firebase ID token attached to every request
   ▼
Supabase Edge Function "api"        ← verifies token, enforces ownership
   │  uses SERVICE ROLE KEY (server-side only)
   ▼
Postgres (Supabase)

Browser (React)
   │  Firebase ID token
   ▼
Supabase Edge Function "send-invoice" ← verifies token, calls Resend
   │  uses RESEND_API_KEY (server-side only)
   ▼
Resend → customer's inbox
```

The frontend never holds the Supabase service role key or the Resend API key. It only ever sends a Firebase ID token, which both Edge Functions verify independently before doing anything.

## Setup

### 1. Firebase
- Create a Firebase project → Authentication → Sign-in method → enable **Google**.
- Copy the web app config into `.env` (see `.env.example`).

### 2. Supabase database
- Create a Supabase project.
- Run `supabase-schema.sql` in the SQL editor. This creates the tables and locks down the anon key with `using (false)` RLS policies — the anon key can no longer read or write anything, by design.

### 3. Supabase Edge Functions
Install the Supabase CLI, then from the project root:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Secrets the functions need (none of these are ever sent to the browser):
supabase secrets set FIREBASE_PROJECT_ID=your-firebase-project-id
supabase secrets set SB_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set FROM_EMAIL="Invoice Builder <invoices@yourdomain.com>"

supabase functions deploy api
supabase functions deploy send-invoice
```

`FROM_EMAIL` must use a domain you've verified in Resend, or sending will fail.

### 4. Frontend
- Copy `.env.example` to `.env`.
- Set `VITE_SUPABASE_FUNCTIONS_URL` to `https://YOUR_PROJECT_REF.supabase.co/functions/v1`.
- `npm install`
- `npm run dev`

## What this actually secures (and how)

**Authentication** — Google OAuth via Firebase. No passwords stored anywhere in this app.

**Authorization** — Every Edge Function call carries a Firebase ID token. The function verifies its signature against Google's public keys, checks `aud`/`iss`/`exp` claims itself (no Admin SDK needed, since Deno's edge runtime doesn't support it), and only then extracts the UID. That UID — never anything the client sends — is what gets used as `user_id` on writes and as the filter on reads. A user cannot view or modify another user's invoices even if they tamper with request payloads, because `user_id` is set server-side, not trusted from the client.

**Database access** — The anon key (the only Supabase credential the browser could theoretically obtain) is locked out entirely via RLS policies that evaluate to `false`. Only the service role key, used exclusively inside the Edge Function, can reach the data — and that key only ever lives in Supabase's encrypted function secrets, never in any file shipped to the browser.

**Email** — The Resend API key lives only in the `send-invoice` function's secrets. The browser generates the PDF (from the same on-screen preview) and sends the bytes, recipient, and invoice metadata to the function; the function does the actual authenticated call to Resend.

## Known limitations to be upfront about

- Token verification re-implements JWT/RSA verification by hand since Firebase's Admin SDK isn't Deno-compatible. It follows Firebase's documented verification steps, but if you want extra assurance, consider periodically diffing this against Firebase's official verification guide in case their signing setup changes.
- Rate limiting isn't implemented — Supabase Edge Functions support this via additional configuration if you want to add it later.
- `FROM_EMAIL` requires domain verification in Resend before sending works; until then, `send-invoice` will return an error rather than silently failing.

## Project structure

```
src/
  lib/
    firebase.js  → Google sign-in
    api.js       → all calls to the Edge Functions (replaces direct DB access)
    pdf.js       → renders the invoice preview to PDF (download + base64 for email)
  context/       → AuthContext (global user state)
  pages/         → Login, Dashboard, InvoiceEditor, InvoiceView
  components/    → InvoicePreview (the Excel-style invoice rendering)

supabase/
  functions/
    api/             → invoice CRUD, token verification, ownership checks
    send-invoice/    → Resend email sending
supabase-schema.sql  → tables + locked-down RLS policies
```
