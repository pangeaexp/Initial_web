-- New feature only. Run and token data are never exposed to browser database clients.
create table public.sun_game_runs (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  client_hash text not null check (client_hash ~ '^[a-f0-9]{64}$'),
  seed integer not null check (seed >= 0),
  width integer not null check (width between 240 and 960),
  height integer not null check (height between 160 and 600),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at timestamptz
);
create index sun_game_runs_client_time on public.sun_game_runs(client_hash, created_at desc);
create index sun_game_runs_expiry on public.sun_game_runs(expires_at) where used_at is null;
create table public.sun_game_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.sun_game_runs(id),
  alias text not null check (alias = btrim(alias) and char_length(alias) between 3 and 20 and alias ~ '^[[:alnum:] _-]+$'),
  points integer not null check (points between 0 and 900),
  hits integer not null check (hits between 0 and 300),
  misses integer not null check (misses between 0 and 300),
  best_streak integer not null check (best_streak between 0 and hits),
  accuracy numeric generated always as (case when hits + misses = 0 then 0 else 100.0 * hits / (hits + misses) end) stored,
  created_at timestamptz not null default now(),
  check (hits + misses <= 300 and points between hits and hits * 3)
);
create index sun_game_scores_ranking on public.sun_game_scores(points desc, accuracy desc, best_streak desc, created_at, id);
alter table public.sun_game_runs enable row level security;
alter table public.sun_game_scores enable row level security;
revoke all on public.sun_game_runs, public.sun_game_scores from public, anon, authenticated;
grant select, insert, update, delete on public.sun_game_runs to service_role;
grant select, insert on public.sun_game_scores to service_role;

create function public.create_sun_game_run(p_token_hash text, p_seed integer, p_width integer, p_height integer, p_client_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sun-hall:' || p_client_hash, 0));
  if (select count(*) from public.sun_game_runs where client_hash = p_client_hash and created_at > now() - interval '1 hour') >= 12 then
    raise exception 'rate_limited';
  end if;
  delete from public.sun_game_runs where used_at is null and expires_at < now() - interval '1 day';
  insert into public.sun_game_runs(token_hash, seed, width, height, client_hash)
    values(p_token_hash, p_seed, p_width, p_height, p_client_hash) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_sun_game_run(text,integer,integer,integer,text) from public, anon, authenticated;
grant execute on function public.create_sun_game_run(text,integer,integer,integer,text) to service_role;

-- Row locking makes retries idempotent and prevents concurrent double publication.
create function public.publish_sun_game_score(p_token_hash text, p_alias text, p_points integer, p_hits integer, p_misses integer, p_best_streak integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_run public.sun_game_runs%rowtype; v_id uuid;
begin
  select * into v_run from public.sun_game_runs where token_hash = p_token_hash for update;
  if not found then raise exception 'run_unavailable'; end if;
  if v_run.used_at is not null then
    select id into v_id from public.sun_game_scores where run_id = v_run.id;
    return v_id;
  end if;
  if v_run.expires_at <= now() or now() < v_run.created_at + interval '30 seconds' then raise exception 'run_unavailable'; end if;
  insert into public.sun_game_scores(run_id, alias, points, hits, misses, best_streak)
    values(v_run.id, p_alias, p_points, p_hits, p_misses, p_best_streak) returning id into v_id;
  update public.sun_game_runs set used_at = now() where id = v_run.id;
  return v_id;
end;
$$;
revoke all on function public.publish_sun_game_score(text,text,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.publish_sun_game_score(text,text,integer,integer,integer,integer) to service_role;
