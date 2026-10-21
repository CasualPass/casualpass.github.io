-- Apply once in the Supabase SQL Editor. Does not expose save JSON or auth data.
begin;
create table if not exists public.casual_leaderboard (
    user_id uuid primary key references auth.users(id) on delete cascade,
    username text not null check (char_length(username) between 3 and 40),
    active_seconds bigint not null default 0 check (active_seconds between 0 and 9007199254740991),
    total_points bigint not null default 0 check (total_points between 0 and 9007199254740991),
    played bigint not null default 0 check (played between 0 and 9007199254740991),
    wins bigint not null default 0 check (wins between 0 and played),
    updated_at timestamptz not null default now()
);
alter table public.casual_leaderboard enable row level security;
revoke all on public.casual_leaderboard from public, anon, authenticated;

create or replace function public.publish_casual_leaderboard(p_active_seconds bigint, p_total_points bigint, p_played bigint, p_wins bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare player uuid := auth.uid(); player_name text;
begin
    if player is null then raise exception 'Authentication required' using errcode = '42501'; end if;
    if p_active_seconds is null or p_total_points is null or p_played is null or p_wins is null
        or least(p_active_seconds,p_total_points,p_played,p_wins) < 0
        or greatest(p_active_seconds,p_total_points,p_played,p_wins) > 9007199254740991 or p_wins > p_played then
        raise exception 'Invalid statistics';
    end if;
    select case when u.email ~ '^[a-z0-9_]{3,24}@accounts\.casualpass\.invalid$'
        then split_part(u.email, '@', 1) else 'Oyuncu-' || left(player::text, 8) end
        into player_name from auth.users u where u.id = player;
    insert into public.casual_leaderboard as board (user_id, username, active_seconds, total_points, played, wins)
    values (player, player_name, p_active_seconds, p_total_points, p_played, p_wins)
    on conflict (user_id) do update set username = excluded.username,
        active_seconds = greatest(board.active_seconds, excluded.active_seconds),
        total_points = greatest(board.total_points, excluded.total_points),
        played = greatest(board.played, excluded.played), wins = greatest(board.wins, excluded.wins), updated_at = now();
end;
$$;
revoke all on function public.publish_casual_leaderboard(bigint,bigint,bigint,bigint) from public, anon;
grant execute on function public.publish_casual_leaderboard(bigint,bigint,bigint,bigint) to authenticated;

create or replace function public.list_casual_leaderboard(p_sort text default 'points')
returns table(username text, active_seconds bigint, total_points bigint, played bigint, wins bigint)
language sql stable security definer set search_path = '' as $$
    select b.username, b.active_seconds, b.total_points, b.played, b.wins from public.casual_leaderboard b
    order by case p_sort when 'time' then b.active_seconds when 'played' then b.played else b.total_points end desc,
        b.total_points desc, b.active_seconds desc, b.username asc, b.user_id asc limit 50;
$$;
revoke all on function public.list_casual_leaderboard(text) from public;
grant execute on function public.list_casual_leaderboard(text) to anon, authenticated;
commit;
