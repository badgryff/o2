-- O2 Practice Journal — Static Username Auth Migration v3
-- Corrected for Supabase projects where pgcrypto is installed in the `extensions` schema.
-- Safe to rerun after earlier partial attempts.
-- Expected pgcrypto signatures:
--   extensions.crypt(text,text)
--   extensions.gen_salt(text,integer)
--   extensions.digest(text,text)
--   extensions.gen_random_bytes(integer)

create extension if not exists pgcrypto;

create table if not exists public.o2_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  display_name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists o2_users_username_unique on public.o2_users(lower(username));

create table if not exists public.o2_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.o2_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.o2_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,6)),
  created_by uuid not null references public.o2_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.o2_group_members (
  group_id uuid not null references public.o2_groups(id) on delete cascade,
  user_id uuid not null references public.o2_users(id) on delete cascade,
  role text not null default 'member' check(role in ('member','admin')),
  joined_at timestamptz not null default now(),
  primary key(group_id,user_id)
);

create table if not exists public.o2_practice_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.o2_users(id) on delete cascade,
  group_id uuid not null references public.o2_groups(id) on delete cascade,
  duration_minutes integer not null check(duration_minutes >= 0 and duration_minutes <= 1440),
  description text not null default '',
  improvements text not null default '',
  challenges text not null default '',
  categories text[] not null default '{}',
  homework_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.o2_homework (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.o2_groups(id) on delete cascade,
  title text not null,
  due_date date not null,
  created_by uuid not null references public.o2_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.o2_homework_completion (
  homework_id uuid not null references public.o2_homework(id) on delete cascade,
  user_id uuid not null references public.o2_users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key(homework_id,user_id)
);

create table if not exists public.o2_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.o2_practice_entries(id) on delete cascade,
  user_id uuid not null references public.o2_users(id) on delete cascade,
  body text not null check(length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.o2_reactions (
  entry_id uuid not null references public.o2_practice_entries(id) on delete cascade,
  user_id uuid not null references public.o2_users(id) on delete cascade,
  emoji text not null default '🔥',
  created_at timestamptz not null default now(),
  primary key(entry_id,user_id,emoji)
);

-- No table is directly exposed to browser roles. All access goes through RPCs below.
revoke all on public.o2_users, public.o2_sessions, public.o2_groups, public.o2_group_members,
  public.o2_practice_entries, public.o2_homework, public.o2_homework_completion,
  public.o2_comments, public.o2_reactions from anon, authenticated;

create or replace function public.o2_user_from_token(p_token text)
returns uuid language sql security definer stable set search_path=public,extensions,pg_catalog as $$
  select s.user_id from public.o2_sessions s
  where s.token_hash=encode(extensions.digest(coalesce(p_token,'')::text,'sha256'::text),'hex') and s.expires_at>now()
  order by s.created_at desc limit 1;
$$;

create or replace function public.o2_register(p_username text,p_password text,p_display_name text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_catalog as $$
declare u public.o2_users; raw_token text;
begin
  p_username:=lower(trim(p_username)); p_display_name:=trim(p_display_name);
  if p_username !~ '^[a-z0-9._-]{3,24}$' then raise exception 'Username must be 3–24 characters using letters, numbers, ., _ or -.'; end if;
  if length(coalesce(p_password,''))<6 then raise exception 'Password must be at least 6 characters.'; end if;
  if length(p_password)>128 then raise exception 'Password is too long.'; end if;
  if p_display_name='' or p_display_name is null then p_display_name:=p_username; end if;
  if length(p_display_name)>50 then raise exception 'Display name is too long.'; end if;
  if exists(select 1 from public.o2_users where lower(username)=p_username) then raise exception 'That username is already taken.'; end if;
  insert into public.o2_users(username,display_name,password_hash)
  values(p_username,p_display_name,extensions.crypt(p_password::text, extensions.gen_salt('bf'::text,10::integer)::text)) returning * into u;
  raw_token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.o2_sessions(user_id,token_hash,expires_at) values(u.id,encode(extensions.digest(raw_token::text,'sha256'::text),'hex'),now()+interval '30 days');
  return jsonb_build_object('token',raw_token,'user',jsonb_build_object('id',u.id,'username',u.username,'display_name',u.display_name));
end;$$;

create or replace function public.o2_login(p_username text,p_password text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_catalog as $$
declare u public.o2_users; raw_token text;
begin
  select * into u from public.o2_users where lower(username)=lower(trim(p_username));
  if u.id is null or u.password_hash <> extensions.crypt(p_password::text,u.password_hash::text) then raise exception 'Incorrect username or password.'; end if;
  delete from public.o2_sessions where expires_at<=now();
  raw_token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.o2_sessions(user_id,token_hash,expires_at) values(u.id,encode(extensions.digest(raw_token::text,'sha256'::text),'hex'),now()+interval '30 days');
  return jsonb_build_object('token',raw_token,'user',jsonb_build_object('id',u.id,'username',u.username,'display_name',u.display_name));
end;$$;

create or replace function public.o2_logout(p_token text)
returns boolean language plpgsql security definer set search_path=public,extensions,pg_catalog as $$
begin delete from public.o2_sessions where token_hash=encode(extensions.digest(coalesce(p_token,'')::text,'sha256'::text),'hex'); return true; end;$$;

create or replace function public.o2_create_group(p_token text,p_name text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_catalog as $$
declare uid uuid; g public.o2_groups;
begin
 uid:=public.o2_user_from_token(p_token); if uid is null then raise exception 'Session expired. Sign in again.'; end if;
 if trim(coalesce(p_name,''))='' then raise exception 'Enter a group name.'; end if;
 insert into public.o2_groups(name,created_by) values(trim(p_name),uid) returning * into g;
 insert into public.o2_group_members(group_id,user_id,role) values(g.id,uid,'admin');
 return jsonb_build_object('id',g.id,'name',g.name,'invite_code',g.invite_code,'role','admin');
end;$$;

create or replace function public.o2_join_group(p_token text,p_invite_code text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_catalog as $$
declare uid uuid; g public.o2_groups; r text;
begin
 uid:=public.o2_user_from_token(p_token); if uid is null then raise exception 'Session expired. Sign in again.'; end if;
 select * into g from public.o2_groups where upper(invite_code)=upper(trim(p_invite_code));
 if g.id is null then raise exception 'Invalid invite code.'; end if;
 insert into public.o2_group_members(group_id,user_id,role) values(g.id,uid,'member') on conflict do nothing;
 select role into r from public.o2_group_members where group_id=g.id and user_id=uid;
 return jsonb_build_object('id',g.id,'name',g.name,'invite_code',g.invite_code,'role',r);
end;$$;

create or replace function public.o2_dashboard(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_catalog as $$
declare uid uuid; u public.o2_users; g public.o2_groups; member_role text; result jsonb;
begin
 uid:=public.o2_user_from_token(p_token); if uid is null then return jsonb_build_object('authenticated',false); end if;
 select * into u from public.o2_users where id=uid;
 select gg.*,gm.role into g from public.o2_group_members gm join public.o2_groups gg on gg.id=gm.group_id where gm.user_id=uid order by gm.joined_at limit 1;
 if g.id is null then
   return jsonb_build_object('authenticated',true,'user',jsonb_build_object('id',u.id,'username',u.username,'display_name',u.display_name),'group',null,'entries','[]'::jsonb,'homework','[]'::jsonb,'members','[]'::jsonb);
 end if;
 select role into member_role from public.o2_group_members where group_id=g.id and user_id=uid;
 select jsonb_build_object(
  'authenticated',true,
  'user',jsonb_build_object('id',u.id,'username',u.username,'display_name',u.display_name),
  'group',jsonb_build_object('id',g.id,'name',g.name,'invite_code',g.invite_code,'role',member_role),
  'entries',coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select e.id,e.user_id,e.group_id,e.duration_minutes,e.description,e.improvements,e.challenges,e.categories,e.homework_completed,e.created_at,
      ou.display_name,
      (select count(*) from public.o2_reactions r where r.entry_id=e.id)::int reactions,
      (select count(*) from public.o2_comments c where c.entry_id=e.id)::int comments
    from public.o2_practice_entries e join public.o2_users ou on ou.id=e.user_id where e.group_id=g.id
  ) x),'[]'::jsonb),
  'homework',coalesce((select jsonb_agg(x order by x.due_date) from (
    select h.id,h.title,h.due_date,h.created_at,exists(select 1 from public.o2_homework_completion hc where hc.homework_id=h.id and hc.user_id=uid) completed
    from public.o2_homework h where h.group_id=g.id
  ) x),'[]'::jsonb),
  'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',gm.user_id,'role',gm.role,'display_name',ou.display_name,'username',ou.username) order by gm.joined_at) from public.o2_group_members gm join public.o2_users ou on ou.id=gm.user_id where gm.group_id=g.id),'[]'::jsonb)
 ) into result;
 return result;
end;$$;

create or replace function public.o2_add_entry(p_token text,p_duration integer,p_description text,p_improvements text,p_challenges text,p_categories text[],p_homework_completed boolean)
returns uuid language plpgsql security definer set search_path=public,extensions,pg_catalog as $$
declare uid uuid; gid uuid; eid uuid;
begin
 uid:=public.o2_user_from_token(p_token); if uid is null then raise exception 'Session expired. Sign in again.'; end if;
 select group_id into gid from public.o2_group_members where user_id=uid order by joined_at limit 1; if gid is null then raise exception 'Join a group first.'; end if;
 if coalesce(p_duration,0)<1 or p_duration>1440 then raise exception 'Practice duration must be between 1 and 1440 minutes.'; end if;
 insert into public.o2_practice_entries(user_id,group_id,duration_minutes,description,improvements,challenges,categories,homework_completed)
 values(uid,gid,p_duration,left(coalesce(p_description,''),5000),left(coalesce(p_improvements,''),3000),left(coalesce(p_challenges,''),3000),coalesce(p_categories,'{}'),coalesce(p_homework_completed,false)) returning id into eid;
 return eid;
end;$$;

create or replace function public.o2_add_homework(p_token text,p_title text,p_due_date date)
returns uuid language plpgsql security definer set search_path=public,extensions,pg_catalog as $$
declare uid uuid; gid uuid; hid uuid;
begin
 uid:=public.o2_user_from_token(p_token); if uid is null then raise exception 'Session expired. Sign in again.'; end if;
 select group_id into gid from public.o2_group_members where user_id=uid order by joined_at limit 1; if gid is null then raise exception 'Join a group first.'; end if;
 if trim(coalesce(p_title,''))='' or p_due_date is null then raise exception 'Task and due date are required.'; end if;
 insert into public.o2_homework(group_id,title,due_date,created_by) values(gid,left(trim(p_title),300),p_due_date,uid) returning id into hid; return hid;
end;$$;

create or replace function public.o2_set_homework(p_token text,p_homework_id uuid,p_completed boolean)
returns boolean language plpgsql security definer set search_path=public,extensions,pg_catalog as $$
declare uid uuid; gid uuid;
begin
 uid:=public.o2_user_from_token(p_token); if uid is null then raise exception 'Session expired. Sign in again.'; end if;
 select h.group_id into gid from public.o2_homework h join public.o2_group_members gm on gm.group_id=h.group_id and gm.user_id=uid where h.id=p_homework_id;
 if gid is null then raise exception 'Homework not found.'; end if;
 if p_completed then insert into public.o2_homework_completion(homework_id,user_id) values(p_homework_id,uid) on conflict(homework_id,user_id) do update set completed_at=now();
 else delete from public.o2_homework_completion where homework_id=p_homework_id and user_id=uid; end if; return true;
end;$$;

create or replace function public.o2_toggle_reaction(p_token text,p_entry_id uuid,p_emoji text default '🔥')
returns boolean language plpgsql security definer set search_path=public,extensions,pg_catalog as $$
declare uid uuid; exists_row boolean;
begin
 uid:=public.o2_user_from_token(p_token); if uid is null then raise exception 'Session expired. Sign in again.'; end if;
 if not exists(select 1 from public.o2_practice_entries e join public.o2_group_members gm on gm.group_id=e.group_id and gm.user_id=uid where e.id=p_entry_id) then raise exception 'Entry not found.'; end if;
 select exists(select 1 from public.o2_reactions where entry_id=p_entry_id and user_id=uid and emoji=p_emoji) into exists_row;
 if exists_row then delete from public.o2_reactions where entry_id=p_entry_id and user_id=uid and emoji=p_emoji; return false;
 else insert into public.o2_reactions(entry_id,user_id,emoji) values(p_entry_id,uid,p_emoji); return true; end if;
end;$$;

create or replace function public.o2_add_comment(p_token text,p_entry_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public,extensions,pg_catalog as $$
declare uid uuid; cid uuid;
begin
 uid:=public.o2_user_from_token(p_token); if uid is null then raise exception 'Session expired. Sign in again.'; end if;
 if not exists(select 1 from public.o2_practice_entries e join public.o2_group_members gm on gm.group_id=e.group_id and gm.user_id=uid where e.id=p_entry_id) then raise exception 'Entry not found.'; end if;
 if trim(coalesce(p_body,''))='' then raise exception 'Write a comment first.'; end if;
 insert into public.o2_comments(entry_id,user_id,body) values(p_entry_id,uid,left(trim(p_body),1000)) returning id into cid; return cid;
end;$$;

-- Limit browser roles to RPC execution only.
grant execute on function public.o2_register(text,text,text), public.o2_login(text,text), public.o2_logout(text),
 public.o2_create_group(text,text), public.o2_join_group(text,text), public.o2_dashboard(text),
 public.o2_add_entry(text,integer,text,text,text,text[],boolean), public.o2_add_homework(text,text,date),
 public.o2_set_homework(text,uuid,boolean), public.o2_toggle_reaction(text,uuid,text), public.o2_add_comment(text,uuid,text)
to anon, authenticated;
