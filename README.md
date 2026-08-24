# O2 Practice Journal — Static Username Auth

This build does **not** use Supabase Email Auth, Vercel Functions, service-role keys, JWT secrets, or Vercel environment variables.

## Setup

1. In Supabase, open **SQL Editor**.
2. Run `supabase/static-auth-migration.sql` once.
3. Open `config.js` and set only:
   - `SUPABASE_URL` — your Project URL.
   - `SUPABASE_ANON_KEY` — your public anon/publishable key.
4. Upload the project files to GitHub. Keep `index.html` at repository root.
5. Vercel will redeploy automatically if the repo is already connected.

## Authentication model

Users see only Display name, Username and Password. Passwords are hashed with PostgreSQL `pgcrypto`/bcrypt. Login returns a random 30-day opaque session token. Only a SHA-256 hash of that token is stored in the database. Browser roles cannot directly read the O2 tables; all operations go through `SECURITY DEFINER` RPC functions which validate the session token.

Your `SUPABASE_ANON_KEY` is intentionally public and may be committed to frontend code. Never add a service-role key to this project.

## Important

This migration creates new tables prefixed with `o2_` and does not depend on the older email-auth tables. Existing old test users/data are not automatically migrated.
