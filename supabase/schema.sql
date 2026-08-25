-- CasualPass cross-device profile storage.
-- Run this once in the Supabase SQL Editor.

create table if not exists public.casual_profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    profile jsonb not null check (
        jsonb_typeof(profile) = 'object'
        and octet_length(profile::text) <= 32768
    ),
    revision bigint not null default 1,
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.casual_profiles enable row level security;

revoke all on table public.casual_profiles from anon, authenticated;
grant select, insert, update on table public.casual_profiles to authenticated;

drop policy if exists "Players can read their profile" on public.casual_profiles;
create policy "Players can read their profile"
on public.casual_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Players can create their profile" on public.casual_profiles;
create policy "Players can create their profile"
on public.casual_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Players can update their profile" on public.casual_profiles;
create policy "Players can update their profile"
on public.casual_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.touch_casual_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = timezone('utc', now());
    new.revision = old.revision + 1;
    return new;
end;
$$;

drop trigger if exists touch_casual_profile_on_update on public.casual_profiles;
create trigger touch_casual_profile_on_update
before update on public.casual_profiles
for each row execute function public.touch_casual_profile();
