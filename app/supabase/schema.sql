-- Essola backend schema. Run in Supabase → SQL Editor.
-- Auth: enable Email (OTP code) and Apple providers in Authentication → Providers.

create table if not exists public.recipe_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

alter table public.recipe_likes enable row level security;

create policy "read own likes" on public.recipe_likes
  for select using (auth.uid() = user_id);
create policy "like as self" on public.recipe_likes
  for insert with check (auth.uid() = user_id);
create policy "unlike as self" on public.recipe_likes
  for delete using (auth.uid() = user_id);

-- Public aggregate so everyone sees totals without reading other people's rows.
create or replace view public.recipe_like_counts
with (security_invoker = false) as
  select recipe_id, count(*)::int as likes
  from public.recipe_likes
  group by recipe_id;

grant select on public.recipe_like_counts to anon, authenticated;
