-- Run this in the Supabase SQL editor to create the user_notes table and RLS.

create table if not exists public.user_notes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{"notes":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_notes enable row level security;

create policy "Users can read own user_notes"
  on public.user_notes for select
  using (auth.uid() = user_id);

create policy "Users can insert own user_notes"
  on public.user_notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own user_notes"
  on public.user_notes for update
  using (auth.uid() = user_id);
