alter table public.profiles
  add column display_name text,
  add constraint profiles_display_name_length_check
    check (char_length(display_name) <= 60);

drop function public.get_my_athletes();
drop function private.get_my_athletes();

create function private.get_my_athletes()
returns table (
  athlete_id uuid,
  email text,
  display_name text,
  body_weight numeric,
  height_cm smallint,
  goal text,
  level text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profiles.id as athlete_id,
    users.email::text as email,
    profiles.display_name,
    profiles.body_weight,
    profiles.height_cm,
    profiles.goal,
    profiles.level
  from public.profiles
  join auth.users on users.id = profiles.id
  where (select auth.uid()) is not null
    and profiles.coach_id = (select auth.uid())
  order by users.email nulls last, profiles.id;
$$;

create function public.get_my_athletes()
returns table (
  athlete_id uuid,
  email text,
  display_name text,
  body_weight numeric,
  height_cm smallint,
  goal text,
  level text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_my_athletes();
$$;

create table public.coach_blocks (
  id text primary key,
  coach_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  goal_text text,
  start_date date,
  total_weeks smallint not null check (total_weeks between 1 and 52),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coach_block_weeks (
  id text primary key,
  block_id text not null references public.coach_blocks(id) on delete cascade,
  week_number smallint not null check (week_number >= 0),
  name text not null check (char_length(name) between 1 and 60),
  is_warmup boolean not null default false,
  unique (block_id, week_number)
);

alter table public.routines
  add column block_week_id text
    references public.coach_block_weeks(id) on delete cascade;

create index coach_blocks_coach_id_idx
  on public.coach_blocks(coach_id);
create index coach_blocks_athlete_id_idx
  on public.coach_blocks(athlete_id);
create index routines_block_week_id_idx
  on public.routines(block_week_id);

create trigger coach_blocks_set_updated_at
  before update on public.coach_blocks
  for each row execute function private.set_updated_at();

create function private.validate_routine_block_week()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.block_week_id is not null
    and not exists (
      select 1
      from public.coach_block_weeks
      join public.coach_blocks
        on coach_blocks.id = coach_block_weeks.block_id
      where coach_block_weeks.id = new.block_week_id
        and coach_blocks.athlete_id = new.user_id
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Routine block week must belong to the routine athlete';
  end if;

  return new;
end;
$$;

create trigger routines_validate_block_week
  before insert or update of user_id, block_week_id on public.routines
  for each row execute function private.validate_routine_block_week();

alter table public.coach_blocks enable row level security;
alter table public.coach_block_weeks enable row level security;

create policy "coach_blocks_select_coach"
  on public.coach_blocks for select to authenticated
  using ((select auth.uid()) = coach_id);

create policy "coach_blocks_select_athlete"
  on public.coach_blocks for select to authenticated
  using ((select auth.uid()) = athlete_id);

create policy "coach_blocks_insert_coach"
  on public.coach_blocks for insert to authenticated
  with check (
    (select auth.uid()) = coach_id
    and (select private.is_coach_of(athlete_id))
  );

create policy "coach_blocks_update_coach"
  on public.coach_blocks for update to authenticated
  using ((select auth.uid()) = coach_id)
  with check (
    (select auth.uid()) = coach_id
    and (select private.is_coach_of(athlete_id))
  );

create policy "coach_blocks_delete_coach"
  on public.coach_blocks for delete to authenticated
  using ((select auth.uid()) = coach_id);

create policy "coach_block_weeks_select_coach"
  on public.coach_block_weeks for select to authenticated
  using (
    exists (
      select 1
      from public.coach_blocks
      where coach_blocks.id = coach_block_weeks.block_id
        and coach_blocks.coach_id = (select auth.uid())
    )
  );

create policy "coach_block_weeks_select_athlete"
  on public.coach_block_weeks for select to authenticated
  using (
    exists (
      select 1
      from public.coach_blocks
      where coach_blocks.id = coach_block_weeks.block_id
        and coach_blocks.athlete_id = (select auth.uid())
    )
  );

create policy "coach_block_weeks_insert_coach"
  on public.coach_block_weeks for insert to authenticated
  with check (
    exists (
      select 1
      from public.coach_blocks
      where coach_blocks.id = coach_block_weeks.block_id
        and coach_blocks.coach_id = (select auth.uid())
    )
  );

create policy "coach_block_weeks_update_coach"
  on public.coach_block_weeks for update to authenticated
  using (
    exists (
      select 1
      from public.coach_blocks
      where coach_blocks.id = coach_block_weeks.block_id
        and coach_blocks.coach_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.coach_blocks
      where coach_blocks.id = coach_block_weeks.block_id
        and coach_blocks.coach_id = (select auth.uid())
    )
  );

create policy "coach_block_weeks_delete_coach"
  on public.coach_block_weeks for delete to authenticated
  using (
    exists (
      select 1
      from public.coach_blocks
      where coach_blocks.id = coach_block_weeks.block_id
        and coach_blocks.coach_id = (select auth.uid())
    )
  );

revoke all privileges on table
  public.coach_blocks,
  public.coach_block_weeks
from public, anon, authenticated;

grant select on public.coach_blocks to authenticated;
grant insert (
  id,
  coach_id,
  athlete_id,
  name,
  goal_text,
  start_date,
  total_weeks
) on public.coach_blocks to authenticated;
grant update (
  name,
  goal_text,
  start_date,
  total_weeks
) on public.coach_blocks to authenticated;
grant delete on public.coach_blocks to authenticated;

grant select on public.coach_block_weeks to authenticated;
grant insert (
  id,
  block_id,
  week_number,
  name,
  is_warmup
) on public.coach_block_weeks to authenticated;
grant update (
  week_number,
  name,
  is_warmup
) on public.coach_block_weeks to authenticated;
grant delete on public.coach_block_weeks to authenticated;

revoke insert, update on public.profiles from authenticated;
grant insert (
  id,
  display_name,
  body_weight,
  height_cm,
  goal,
  level,
  default_rest_seconds,
  updated_at
) on public.profiles to authenticated;
grant update (
  id,
  display_name,
  body_weight,
  height_cm,
  goal,
  level,
  default_rest_seconds,
  updated_at
) on public.profiles to authenticated;

revoke execute on function private.get_my_athletes() from public, anon, authenticated;
revoke execute on function private.validate_routine_block_week() from public, anon, authenticated;
revoke execute on function public.get_my_athletes() from public, anon, authenticated;

grant execute on function private.get_my_athletes() to authenticated;
grant execute on function public.get_my_athletes() to authenticated;
