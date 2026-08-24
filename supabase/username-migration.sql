-- O2 Practice Journal: migrate an existing installation from email UI to username-only UI.
-- Run this ONCE in Supabase SQL Editor after the original schema.sql.

alter table public.profiles add column if not exists username text;

-- Usernames are optional for old accounts, but unique (case-insensitive) when present.
create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, display_name, username)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    nullif(lower(new.raw_user_meta_data->>'username'), '')
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    username = coalesce(excluded.username, public.profiles.username);
  return new;
end;
$$;

-- Safe invite-code join RPC. This avoids exposing unjoined groups just to look up a code.
create or replace function public.join_group_by_code(p_invite_code text)
returns table(group_id uuid, group_name text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups%rowtype;
begin
  select * into g
  from public.groups
  where upper(invite_code) = upper(trim(p_invite_code));

  if g.id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.group_members(group_id, user_id, role)
  values(g.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return query select g.id, g.name, 'member'::text;
end;
$$;

grant execute on function public.join_group_by_code(text) to authenticated;
