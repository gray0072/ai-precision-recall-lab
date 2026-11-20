-- AI Precision Recall Lab — the cloud copy of the campaign (core/cloud.js, campaign.js merge).
-- Run this in the Supabase SQL editor of the project the game points at (CLOUD_URL in core/cloud.js);
-- running it again is safe. A row per Google account: the campaign, as in localStorage under
-- prLab.campaign.v1. The project is shared with other apps (the ivan games world-aviation and lift-logic,
-- the swedish app), so the table's name and its policies start with the game's prefix, the localStorage one
-- (prLab.) in lower case: prlab_.

create table if not exists public.prlab_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,                 -- { v, campaign } (Campaign.snapshot)
  updated_at timestamptz not null default now()
);

alter table public.prlab_progress enable row level security;

grant select, insert, update, delete on public.prlab_progress to authenticated;

drop policy if exists "prlab: read own progress" on public.prlab_progress;
create policy "prlab: read own progress" on public.prlab_progress
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "prlab: insert own progress" on public.prlab_progress;
create policy "prlab: insert own progress" on public.prlab_progress
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "prlab: update own progress" on public.prlab_progress;
create policy "prlab: update own progress" on public.prlab_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "prlab: delete own progress" on public.prlab_progress;
create policy "prlab: delete own progress" on public.prlab_progress
  for delete to authenticated using (auth.uid() = user_id);
