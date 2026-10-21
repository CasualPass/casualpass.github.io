-- CasualPass community game listings. Run once in Supabase SQL Editor.
begin;
create table if not exists public.casual_market_games (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    author text not null,
    title text not null check (char_length(title) between 3 and 60),
    description text not null check (char_length(description) between 10 and 280),
    url text not null check (char_length(url) <= 2048),
    category text not null check (category in ('hizli','zeka','beceri','aksiyon','coklu')),
    listed boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(owner_id,url)
);
alter table public.casual_market_games enable row level security;
revoke all on public.casual_market_games from public, anon, authenticated;
-- Upgrade existing listings without publishing any unreviewed content.
alter table public.casual_market_games add column if not exists status text not null default 'pending' check(status in ('pending','approved','rejected'));
alter table public.casual_market_games add column if not exists revision bigint not null default 1;
alter table public.casual_market_games add column if not exists review_note text not null default '' check(char_length(review_note)<=280);
alter table public.casual_market_games add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.casual_market_games add column if not exists reviewed_at timestamptz;

create index if not exists casual_market_listing_order on public.casual_market_games(created_at desc,id) where listed;

create or replace function public.publish_market_game(p_title text,p_description text,p_url text,p_category text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare player uuid := auth.uid(); player_name text; game_id uuid;
begin
    if player is null then raise exception 'Authentication required' using errcode='42501'; end if;
    if p_title is null or p_description is null or p_url is null or p_category is null
        or char_length(btrim(p_title)) not between 3 and 60 or char_length(btrim(p_description)) not between 10 and 280
        or char_length(p_url)>2048 or p_category not in ('hizli','zeka','beceri','aksiyon','coklu')
        or p_url !~ '^https://([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}([/?#].*)?$'
        or p_url ~ '[[:space:]]' or p_url ~* '^https://[^/?#]+\.(local|localhost|invalid|test|internal)([/?#]|$)' then
        raise exception 'Invalid game listing';
    end if;
    -- Serialize a player's submissions so concurrent requests cannot bypass the active limit.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(player::text,0));
    if not exists(select 1 from public.casual_market_games where owner_id=player and url=p_url and listed)
        and (select count(*) from public.casual_market_games where owner_id=player and listed)>=10 then
        raise exception 'At most ten active games are allowed';
    end if;
    select case when u.email ~ '^[a-z0-9_]{3,24}@accounts\.casualpass\.invalid$' then split_part(u.email,'@',1)
        else 'Oyuncu-' || left(player::text,8) end into player_name from auth.users u where u.id=player;
    insert into public.casual_market_games as games(owner_id,author,title,description,url,category)
    values(player,player_name,btrim(p_title),btrim(p_description),p_url,p_category)
    on conflict(owner_id,url) do update set author=excluded.author,title=excluded.title,description=excluded.description,
        category=excluded.category,listed=true,status='pending',review_note='',reviewed_by=null,reviewed_at=null,revision=games.revision+1,updated_at=now()
    returning id into game_id;
    return game_id;
end;
$$;
revoke all on function public.publish_market_game(text,text,text,text) from public,anon;
grant execute on function public.publish_market_game(text,text,text,text) to authenticated;

create or replace function public.unpublish_market_game(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
    if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
    update public.casual_market_games set listed=false,revision=revision+1,updated_at=now() where id=p_id and owner_id=auth.uid();
    if not found then raise exception 'Listing not available' using errcode='42501'; end if;
end;
$$;
revoke all on function public.unpublish_market_game(uuid) from public,anon;
grant execute on function public.unpublish_market_game(uuid) to authenticated;

drop function if exists public.list_market_games(text,text,integer,boolean);
create function public.list_market_games(p_search text default '',p_category text default 'all',p_offset integer default 0,p_mine boolean default false)
returns table(id uuid,author text,title text,description text,url text,category text,is_owner boolean,status text,review_note text,revision bigint)
language sql stable security definer set search_path = '' as $$
    select g.id,g.author,g.title,g.description,g.url,g.category,coalesce(g.owner_id=auth.uid(),false),g.status,case when g.owner_id=auth.uid() then g.review_note else '' end,g.revision
    from public.casual_market_games g
    where g.listed and ((coalesce(p_mine,false) and g.owner_id=auth.uid()) or (not coalesce(p_mine,false) and g.status='approved'))
        and (coalesce(p_category,'all')='all' or g.category=p_category)
        and position(lower(left(coalesce(p_search,''),80)) in lower(g.title || ' ' || g.description || ' ' || g.author))>0
    order by g.created_at desc,g.id asc limit 24 offset greatest(0,least(coalesce(p_offset,0),100000));
$$;
revoke all on function public.list_market_games(text,text,integer,boolean) from public;
grant execute on function public.list_market_games(text,text,integer,boolean) to anon,authenticated;
-- Appended by market.sql inside the same transaction.
create table if not exists public.casual_market_admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);
alter table public.casual_market_admins enable row level security;
revoke all on public.casual_market_admins from public,anon,authenticated;

create or replace function public.market_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
    select exists(select 1 from public.casual_market_admins where user_id=auth.uid());
$$;
revoke all on function public.market_is_admin() from public,anon;
grant execute on function public.market_is_admin() to authenticated;

create or replace function public.list_market_review(p_status text default 'pending',p_offset integer default 0)
returns table(id uuid,author text,title text,description text,url text,category text,status text,revision bigint,review_note text)
language plpgsql stable security definer set search_path = '' as $$
begin
    if not public.market_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
    return query select g.id,g.author,g.title,g.description,g.url,g.category,g.status,g.revision,g.review_note
        from public.casual_market_games g where g.listed and g.status=p_status
        order by g.updated_at desc,g.id asc limit 24 offset greatest(0,least(coalesce(p_offset,0),100000));
end;
$$;
revoke all on function public.list_market_review(text,integer) from public,anon;
grant execute on function public.list_market_review(text,integer) to authenticated;

create or replace function public.review_market_game(p_id uuid,p_status text,p_revision bigint,p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
    if not public.market_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
    if p_status is null or p_status not in ('approved','rejected') or p_revision is null or p_revision<1 or char_length(coalesce(p_note,''))>280 then
        raise exception 'Invalid review';
    end if;
    update public.casual_market_games set status=p_status,review_note=left(coalesce(p_note,''),280),reviewed_by=auth.uid(),
        reviewed_at=now(),updated_at=now(),revision=revision+1
        where id=p_id and revision=p_revision and listed;
    if not found then raise exception 'Listing changed; refresh before reviewing'; end if;
end;
$$;
revoke all on function public.review_market_game(uuid,text,bigint,text) from public,anon;
grant execute on function public.review_market_game(uuid,text,bigint,text) to authenticated;

create or replace function public.get_market_home_games(p_ids uuid[])
returns table(id uuid,author text,title text,description text,url text,category text,status text)
language sql stable security definer set search_path = '' as $$
    select g.id,g.author,g.title,g.description,g.url,g.category,g.status from public.casual_market_games g
    where g.listed and g.status='approved' and g.id=any((p_ids)[1:30]);
$$;
revoke all on function public.get_market_home_games(uuid[]) from public;
grant execute on function public.get_market_home_games(uuid[]) to anon,authenticated;

commit;
