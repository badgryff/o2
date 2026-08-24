# O2 Practice Journal — username/password build

This is a static Vercel-ready build. Members see only a **username + password** login. No real email address is required.

## Important: disable Supabase email confirmation

Supabase Password Auth internally expects an email-shaped identifier, so this app maps a username such as `jeremy` to a private synthetic identifier such as `jeremy@o2practice.local`. Members never see or use that synthetic value.

In Supabase go to **Authentication → Providers → Email** and turn **Confirm email** OFF. Otherwise Supabase will try to confirm an address that does not exist.

## If you already ran the older schema

Run **only** this file in Supabase SQL Editor:

`supabase/username-migration.sql`

It adds username support and the safe invite-code join function without deleting your existing data.

## If this is a brand-new Supabase project

Run:

`supabase/schema.sql`

## Configure Supabase

Keep your existing `config.js` values. If needed:

```js
window.O2_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_PUBLIC_ANON_KEY"
};
```

Use only the public/anon/publishable key in the browser, never a service-role/secret key.

## Update GitHub / Vercel

Upload the replacement files to the same GitHub repository and choose **Replace** when GitHub reports files with the same names. Vercel will redeploy automatically after the commit.

### Login flow

New member: Display name + Username + Password. Existing member: Username + Password.

Usernames are lower-case internally and may contain 3–24 letters, numbers, dots, underscores or hyphens.
