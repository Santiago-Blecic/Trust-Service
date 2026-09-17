# Proofly

A privacy-preserving local-services marketplace. Its guarantee is deliberately narrow: a **Verified Service** review is backed by a confirmed booking, a validated XRP Ledger payment, and confirmation from both participants. Private data never leaves Supabase.

## Run locally

1. Install Node.js 20.9+ and the Supabase CLI.
2. Copy `.env.example` to `.env.local`, then add the values from your Supabase project's **Connect** dialog. Never put `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable.
3. Run `npm install` and `npm run dev`.
4. Create/link your Supabase project and apply the schema: `supabase db push`. The included migration creates the profile trigger, data model, indexes, least-privilege grants, RLS policies, and guarded state-transition functions.
5. In Supabase Auth, configure the site URL and redirect URL: `http://localhost:3000/auth/callback` (plus the deployed equivalent).

## Production launch checklist

- Configure an email provider and enforce email confirmation in Supabase Auth.
- Add a server-side identity-verification vendor before setting `human_verified_at`; do not treat a user-editable profile flag as identity proof.
- Give every provider and customer a real XRPL address before enabling payment. The verifier confirms the sending and destination wallets as well as the exact amount. Keep all wallet signing outside browser code; customer wallets sign payments themselves.
- Set `XRPL_WSS_URL` to a managed/mainnet endpoint only after end-to-end testing and legal/compliance review. The default is XRPL Testnet.
- Put a webhook/queue in front of payment verification, rate-limit the API at the host, add abuse reporting and dispute handling, and test RLS with `supabase test db` before launch.

## Security model

All exposed tables have RLS enabled. Public visitors can only read published providers, active services, and reviews. Booking, payment, and proof rows are restricted to their customer/provider. Creating a booking, recording payment, completing a booking, and publishing a review run through narrowly scoped database functions which recompute sensitive values and re-check the calling user and booking state. Proof hashes include no PII.

## Important product boundary

Blockchain verifies payment/provenance, not whether an opinion is truthful or whether a service was high quality. Do not market Proofly as a system that "prevents fake reviews".
