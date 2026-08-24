# O2 Practice Journal — Vercel static version

This folder is the deployable website. It does not need npm, Next.js or a build command.

## 1. Preview immediately

Open `index.html` in a browser. With no Supabase values it runs in demo mode so you can inspect the design and interactions.

## 2. Turn on real shared accounts/data

Create a free Supabase project, then open its **SQL Editor** and run:

`supabase/schema.sql`

Next open **Project Settings → API** in Supabase. Copy your Project URL and anon/public key into `config.js`:

```js
window.O2_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_PUBLIC_ANON_KEY"
};
```

The anon key is designed to be used in browser apps. Row Level Security is enabled by the supplied schema.

For easiest testing, in Supabase Authentication settings you may temporarily disable email confirmation. Otherwise new users need to confirm their email before signing in.

## 3. Deploy on Vercel

Put the contents of this folder in a GitHub repository, import it into Vercel, and deploy it as a static project. No build command is required.

Alternatively, in Vercel you can upload/import the folder through a repository. The root contains `index.html`, so it will be served directly.

## Features in this build

The app has real email/password accounts, group creation, invite-code joining, shared practice entries, multi-select colour flairs, practice duration, session notes, improvements, challenges, homework with due dates, per-member homework completion, reactions, comments, personal journal history, practice statistics, streaks, member lists and admin/member roles in the database.

The interface uses a sharp O2 blue (#0057FF), white and near-black, with the supplied O2 Studios logo extracted into a transparent asset.
