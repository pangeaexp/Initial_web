-- Run against an isolated database after the Hall migration. All fixtures roll back.
begin;
set local role anon;
do $$ begin
  begin perform * from public.sun_game_runs; raise exception 'anonymous run read allowed'; exception when insufficient_privilege then null; end;
  begin perform * from public.sun_game_scores; raise exception 'anonymous score read allowed'; exception when insufficient_privilege then null; end;
  begin perform public.create_sun_game_run(repeat('a',64),1,480,300,repeat('b',64)); raise exception 'anonymous RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin perform public.publish_sun_game_score(repeat('a',64),'Player',900,300,0,300); raise exception 'authenticated publish allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
select public.create_sun_game_run(repeat('a',64),1234,480,300,repeat('b',64));
do $$ begin
  begin perform public.publish_sun_game_score(repeat('a',64),'Player',1,1,0,1); raise exception 'early publish allowed'; exception when raise_exception then if sqlerrm <> 'run_unavailable' then raise; end if; end;
end $$;
reset role;
update public.sun_game_runs set created_at = now() - interval '31 seconds' where token_hash = repeat('a',64);
set local role service_role;
do $$ declare a uuid; b uuid; begin
  a := public.publish_sun_game_score(repeat('a',64),'Àlex_7',6,5,1,5);
  b := public.publish_sun_game_score(repeat('a',64),'Changed',900,300,0,300);
  if a <> b or (select count(*) from public.sun_game_scores) <> 1 then raise exception 'idempotency failed'; end if;
  if (select points from public.sun_game_scores where id=a) <> 6 then raise exception 'retry changed score'; end if;
  if (select alias from public.sun_game_scores where id=a) <> 'Àlex_7' then raise exception 'retry changed alias'; end if;
  if (select round(accuracy) from public.sun_game_scores where id=a) <> 83 then raise exception 'accuracy failed'; end if;
end $$;
do $$ begin
  for i in 1..11 loop perform public.create_sun_game_run(lpad(to_hex(i),64,'0'),i,480,300,repeat('b',64)); end loop;
  begin perform public.create_sun_game_run(repeat('c',64),1,480,300,repeat('b',64)); raise exception 'rate limit bypassed'; exception when raise_exception then if sqlerrm <> 'rate_limited' then raise; end if; end;
end $$;
reset role;
update public.sun_game_runs set created_at = now()-interval '1 hour', expires_at = now()-interval '1 second' where token_hash=lpad(to_hex(1),64,'0');
set local role service_role;
do $$ begin
  begin perform public.publish_sun_game_score(lpad(to_hex(1),64,'0'),'Expired',0,0,0,0); raise exception 'expired run allowed'; exception when raise_exception then if sqlerrm <> 'run_unavailable' then raise; end if; end;
end $$;
reset role;
rollback;
