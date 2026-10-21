-- Run AFTER market.sql, once the real eymnyld account exists.
-- Bind to the existing auth UUID; do not authorize by browser profile name or mutable metadata.
begin;
do $$
declare administrator uuid;
begin
    select id into administrator from auth.users where lower(email)='eymnyld@accounts.casualpass.invalid';
    if administrator is null then
        raise exception 'eymnyld account not found. Create/sign in to the actual account first, then rerun this script.';
    end if;
    insert into public.casual_market_admins(user_id) values(administrator) on conflict(user_id) do nothing;
end;
$$;
commit;
