-- Database for realtime collaboration (lib/collaboration.ts) and cloud save (lib/cloud.ts).
-- Run the whole file in your Supabase project's SQL editor. It is safe to run again:
-- every policy is dropped and recreated, so it also replaces the first version of this
-- file, whose room policies looked themselves up and failed with
-- "infinite recursion detected in policy for relation collab_room_members".
--
-- One-time dashboard settings this file cannot do for you:
--   Authentication > Sign In / Providers > Anonymous sign-ins ........ ON  (collaboration)
--   Authentication > Sign In / Providers > Email ..................... ON  (cloud save)
--   Authentication > Sign In / Providers > Email > Confirm email ..... your call: off means
--     a new account can sign in right away, on means it must click the emailed link first
--   Authentication > URL Configuration > Site URL and Redirect URLs .. your deployed URL
--   Realtime > Settings > Allow public access ........................ OFF

---------------------------------------------------------------- collaboration

create table if not exists public.collab_rooms (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.collab_room_members (
  room_id text not null references public.collab_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor',
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.collab_rooms enable row level security;
alter table public.collab_room_members enable row level security;

grant select, insert, delete on public.collab_rooms to authenticated;
grant select, insert on public.collab_room_members to authenticated;

-- A policy on collab_room_members cannot select from collab_room_members (Postgres
-- rejects that as infinite recursion), and the room and realtime policies both need
-- "is this person in that room?". This function answers it with the table owner's
-- rights, so the lookup itself skips row-level security.
create or replace function public.is_room_member(rid text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.collab_room_members m
    where m.room_id = rid
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_room_member(text) from public;
grant execute on function public.is_room_member(text) to authenticated;

-- Drop EVERY existing policy on these tables, whatever it is called. Dropping only the
-- names this file used before is not enough: a policy added by hand or by an earlier
-- setup under another name keeps the recursion alive and the error does not go away.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('collab_rooms', 'collab_room_members', 'cloud_projects')
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end
$$;

drop policy if exists "room members can receive realtime messages" on realtime.messages;
drop policy if exists "room members can send realtime messages" on realtime.messages;

-- a signed-in (anonymous sessions included) person can create a room they own
create policy "create own room" on public.collab_rooms
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

-- the creator can roll a room back when joining it as owner fails
create policy "owner can delete room" on public.collab_rooms
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "members can read their room" on public.collab_rooms
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_room_member(id));

-- the room id in the link is the invite, so anyone signed in can join a room that exists
create policy "join a room" on public.collab_room_members
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "members can read roommates" on public.collab_room_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_room_member(room_id));

-- Realtime Authorization: a room's private channel is "m3e:room:<roomId>", so the room
-- id is the third colon-separated part of the topic.
create policy "room members can receive realtime messages" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.is_room_member(split_part((select realtime.topic()), ':', 3))
  );

create policy "room members can send realtime messages" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.is_room_member(split_part((select realtime.topic()), ':', 3))
  );

---------------------------------------------------------------- cloud save

create table if not exists public.cloud_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Untitled',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cloud_projects_owner_updated_idx
  on public.cloud_projects (owner_id, updated_at desc);

alter table public.cloud_projects enable row level security;

grant select, insert, update, delete on public.cloud_projects to authenticated;

create or replace function public.touch_cloud_project()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cloud_projects_touch on public.cloud_projects;
create trigger cloud_projects_touch
  before update on public.cloud_projects
  for each row execute function public.touch_cloud_project();

drop policy if exists "own projects: read" on public.cloud_projects;
drop policy if exists "own projects: create" on public.cloud_projects;
drop policy if exists "own projects: update" on public.cloud_projects;
drop policy if exists "own projects: delete" on public.cloud_projects;

-- an anonymous collaboration session is also "authenticated"; it has no email and the
-- app never saves with one, but the policies hold it to its own rows all the same
create policy "own projects: read" on public.cloud_projects
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "own projects: create" on public.cloud_projects
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "own projects: update" on public.cloud_projects
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "own projects: delete" on public.cloud_projects
  for delete to authenticated
  using (owner_id = (select auth.uid()));
