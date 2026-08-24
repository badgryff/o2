create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Member',
  username text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin')),
  joined_at timestamptz not null default now(),
  primary key(group_id,user_id)
);

create table if not exists public.practice_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  duration_minutes integer not null check(duration_minutes >= 0),
  description text not null default '',
  improvements text not null default '',
  challenges text not null default '',
  categories text[] not null default '{}',
  homework_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  title text not null,
  due_date date not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.homework_completion (
  homework_id uuid references public.homework(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  completed_at timestamptz,
  primary key(homework_id,user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.practice_entries(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  entry_id uuid references public.practice_entries(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  emoji text not null default '🔥',
  created_at timestamptz not null default now(),
  primary key(entry_id,user_id,emoji)
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,display_name,username)
  values(new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), nullif(lower(new.raw_user_meta_data->>'username'), ''));
  return new;
end;
$$;


create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.join_group_by_code(p_invite_code text)
returns table(group_id uuid, group_name text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups%rowtype;
begin
  select * into g from public.groups where upper(invite_code) = upper(trim(p_invite_code));
  if g.id is null then raise exception 'Invalid invite code'; end if;
  insert into public.group_members(group_id,user_id,role)
  values(g.id,auth.uid(),'member')
  on conflict (group_id,user_id) do nothing;
  return query select g.id,g.name,'member'::text;
end;
$$;

grant execute on function public.join_group_by_code(text) to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.practice_entries enable row level security;
alter table public.homework enable row level security;
alter table public.homework_completion enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;

create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid()=id);
create policy "groups readable by members" on public.groups for select to authenticated using (exists(select 1 from public.group_members gm where gm.group_id=id and gm.user_id=auth.uid()));
create policy "signed in users create groups" on public.groups for insert to authenticated with check (created_by=auth.uid());
create policy "memberships readable" on public.group_members for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.group_members gm where gm.group_id=group_members.group_id and gm.user_id=auth.uid()));
create policy "users can join groups" on public.group_members for insert to authenticated with check(user_id=auth.uid());
create policy "group entries readable" on public.practice_entries for select to authenticated using (group_id is null or exists(select 1 from public.group_members gm where gm.group_id=practice_entries.group_id and gm.user_id=auth.uid()));
create policy "users create own entries" on public.practice_entries for insert to authenticated with check(user_id=auth.uid());
create policy "users update own entries" on public.practice_entries for update to authenticated using(user_id=auth.uid());
create policy "homework readable" on public.homework for select to authenticated using(group_id is null or exists(select 1 from public.group_members gm where gm.group_id=homework.group_id and gm.user_id=auth.uid()));
create policy "signed in homework create" on public.homework for insert to authenticated with check(created_by=auth.uid());
create policy "completion own rows" on public.homework_completion for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "comments readable" on public.comments for select to authenticated using(true);
create policy "comments create own" on public.comments for insert to authenticated with check(user_id=auth.uid());
create policy "reactions readable" on public.reactions for select to authenticated using(true);
create policy "reactions own" on public.reactions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
