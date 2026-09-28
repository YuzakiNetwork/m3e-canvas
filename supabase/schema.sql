-- Schema for realtime collaboration (see lib/collaboration.ts).
-- Run this once in your Supabase project's SQL editor. It creates the two
-- tables the app reads and writes, plus the Realtime Authorization policies
-- that let a private channel ("m3e:room:<roomId>") be read and written only
-- by people who have joined that room.
--
-- Before running this, also turn on Authentication > Sign In / Providers >
-- Anonymous sign-ins, and after running it, turn OFF Realtime > Settings >
-- "Allow public access" (this app only opens channels with `private: true`,
-- so that setting should stay off).

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

-- a signed-in (including anonymous) session can create a room it owns
create policy "create own room" on public.collab_rooms
  for insert to authenticated
  with check (owner_id = auth.uid());

-- the creator can roll a room back if joining it as the owner fails
create policy "owner can delete room" on public.collab_rooms
  for delete to authenticated
  using (owner_id = auth.uid());

-- a member can look up the room(s) they belong to
create policy "members can read their room" on public.collab_rooms
  for select to authenticated
  using (id in (select room_id from public.collab_room_members where user_id = auth.uid()));

-- the room id doubles as the invite link, so anyone signed in can join one
create policy "join a room" on public.collab_room_members
  for insert to authenticated
  with check (user_id = auth.uid());

-- a member can see who else is in their room
create policy "members can read roommates" on public.collab_room_members
  for select to authenticated
  using (room_id in (select room_id from public.collab_room_members where user_id = auth.uid()));

-- Realtime Authorization: restrict each room's private channel to its members.
-- The channel topic is "m3e:room:<roomId>" (see openCollaboration in
-- lib/collaboration.ts), so the room id is the 3rd colon-separated segment.
create policy "room members can receive realtime messages" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.collab_room_members m
      where m.room_id = split_part(realtime.topic(), ':', 3)
        and m.user_id = auth.uid()
    )
  );

create policy "room members can send realtime messages" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.collab_room_members m
      where m.room_id = split_part(realtime.topic(), ':', 3)
        and m.user_id = auth.uid()
    )
  );
