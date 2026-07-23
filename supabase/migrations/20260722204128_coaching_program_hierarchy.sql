-- Coaching programs are folders, not a flat list of routines:
-- block -> week -> day/routine. Completed workouts remain immutable snapshots.

alter table public.coach_blocks
  add column status text not null default 'published',
  add column current_week_number smallint not null default 1,
  add column published_at timestamptz default now(),
  add column completed_at timestamptz,
  add column archived_at timestamptz;

alter table public.coach_blocks
  add constraint coach_blocks_status_check
    check (status in ('draft', 'published', 'completed', 'archived')),
  add constraint coach_blocks_current_week_check
    check (current_week_number between 1 and 52);

alter table public.coach_block_weeks
  add column week_type text not null default 'training',
  add column status text not null default 'published',
  add column start_date_override date,
  add column published_at timestamptz default now(),
  add column completed_at timestamptz,
  add column archived_at timestamptz,
  add column updated_at timestamptz not null default now();

update public.coach_block_weeks
set week_type = 'activation'
where is_warmup;

alter table public.coach_block_weeks
  add constraint coach_block_weeks_type_check
    check (week_type in ('activation', 'training', 'low_stress', 'deload', 'closing')),
  add constraint coach_block_weeks_status_check
    check (status in ('draft', 'published', 'completed', 'archived')),
  add constraint coach_block_weeks_activation_number_check
    check ((week_type = 'activation' and week_number = 0) or (week_type <> 'activation' and week_number >= 1));

create trigger coach_block_weeks_set_updated_at
  before update on public.coach_block_weeks
  for each row execute function private.set_updated_at();

alter table public.routines
  add column status text not null default 'published',
  add column prescription_notes text,
  add column coach_revision integer not null default 1,
  add column archived_at timestamptz;

alter table public.routines
  add constraint routines_status_check
    check (status in ('draft', 'published', 'archived')),
  add constraint routines_prescription_notes_length_check
    check (char_length(prescription_notes) <= 4000),
  add constraint routines_coach_revision_check
    check (coach_revision >= 1);

alter table public.workouts
  add column block_id text references public.coach_blocks(id) on delete set null,
  add column block_week_id text references public.coach_block_weeks(id) on delete set null,
  add column athlete_modified boolean not null default false;

alter table public.workout_exercises
  add column source_routine_exercise_id text,
  add column modification_type text not null default 'planned';

alter table public.workout_exercises
  add constraint workout_exercises_modification_type_check
    check (modification_type in ('planned', 'edited', 'added', 'replaced'));

alter table public.workout_sets
  add column source_routine_set_id text,
  add column modification_type text not null default 'planned';

alter table public.workout_sets
  add constraint workout_sets_modification_type_check
    check (modification_type in ('planned', 'edited', 'added', 'skipped'));

create index coach_blocks_athlete_status_idx
  on public.coach_blocks(athlete_id, status, created_at desc);
create index coach_block_weeks_block_status_idx
  on public.coach_block_weeks(block_id, status, week_number);
create index routines_block_week_status_idx
  on public.routines(block_week_id, status, training_day);
create index workouts_block_week_idx
  on public.workouts(block_week_id, completed_at desc);

-- Draft weeks and routines are private to the coach. Athlete-owned free routines
-- keep their original create/edit/delete permissions.
drop policy "coach_block_weeks_select_athlete" on public.coach_block_weeks;
create policy "coach_block_weeks_select_athlete"
  on public.coach_block_weeks for select to authenticated
  using (
    status <> 'draft'
    and exists (
      select 1 from public.coach_blocks
      where coach_blocks.id = coach_block_weeks.block_id
        and coach_blocks.athlete_id = (select auth.uid())
    )
  );

drop policy "routines_all_own" on public.routines;
create policy "routines_select_own"
  on public.routines for select to authenticated
  using (
    (select auth.uid()) = user_id
    and (block_week_id is null or status = 'published')
    and archived_at is null
  );
create policy "routines_insert_free_own"
  on public.routines for insert to authenticated
  with check ((select auth.uid()) = user_id and block_week_id is null);
create policy "routines_update_free_own"
  on public.routines for update to authenticated
  using ((select auth.uid()) = user_id and block_week_id is null)
  with check ((select auth.uid()) = user_id and block_week_id is null);
create policy "routines_delete_free_own"
  on public.routines for delete to authenticated
  using ((select auth.uid()) = user_id and block_week_id is null);

drop policy "routine_exercises_all_own" on public.routine_exercises;
create policy "routine_exercises_select_own"
  on public.routine_exercises for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.routines
      where routines.id = routine_exercises.routine_id
        and (routines.block_week_id is null or routines.status = 'published')
        and routines.archived_at is null
    )
  );
create policy "routine_exercises_insert_free_own"
  on public.routine_exercises for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.routines
      where routines.id = routine_exercises.routine_id
        and routines.block_week_id is null
    )
  );
create policy "routine_exercises_update_free_own"
  on public.routine_exercises for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.routines
      where routines.id = routine_exercises.routine_id
        and routines.block_week_id is null
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.routines
      where routines.id = routine_exercises.routine_id
        and routines.block_week_id is null
    )
  );
create policy "routine_exercises_delete_free_own"
  on public.routine_exercises for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.routines
      where routines.id = routine_exercises.routine_id
        and routines.block_week_id is null
    )
  );

drop policy "routine_sets_all_own" on public.routine_sets;
create policy "routine_sets_select_own"
  on public.routine_sets for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.routine_exercises
      join public.routines on routines.id = routine_exercises.routine_id
      where routine_exercises.id = routine_sets.routine_exercise_id
        and (routines.block_week_id is null or routines.status = 'published')
        and routines.archived_at is null
    )
  );
create policy "routine_sets_insert_free_own"
  on public.routine_sets for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.routine_exercises
      join public.routines on routines.id = routine_exercises.routine_id
      where routine_exercises.id = routine_sets.routine_exercise_id
        and routines.block_week_id is null
    )
  );
create policy "routine_sets_update_free_own"
  on public.routine_sets for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.routine_exercises
      join public.routines on routines.id = routine_exercises.routine_id
      where routine_exercises.id = routine_sets.routine_exercise_id
        and routines.block_week_id is null
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.routine_exercises
      join public.routines on routines.id = routine_exercises.routine_id
      where routine_exercises.id = routine_sets.routine_exercise_id
        and routines.block_week_id is null
    )
  );
create policy "routine_sets_delete_free_own"
  on public.routine_sets for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.routine_exercises
      join public.routines on routines.id = routine_exercises.routine_id
      where routine_exercises.id = routine_sets.routine_exercise_id
        and routines.block_week_id is null
    )
  );

-- Athletes log what actually happened in workout snapshots. Prescriptions assigned
-- by a coach can only be changed by that coach.
create function private.protect_assigned_routine()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_user_id uuid := coalesce(new.user_id, old.user_id);
  target_week_id text := coalesce(new.block_week_id, old.block_week_id);
begin
  if target_week_id is not null
    and (select auth.uid()) = target_user_id
  then
    raise exception using
      errcode = '42501',
      message = 'Assigned routines can only be changed by the coach';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger routines_protect_assigned
  before insert or update or delete on public.routines
  for each row execute function private.protect_assigned_routine();

create function private.protect_assigned_routine_child()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_user_id uuid := coalesce(new.user_id, old.user_id);
  parent_routine_id text;
begin
  if tg_table_name = 'routine_exercises' then
    parent_routine_id := coalesce(new.routine_id, old.routine_id);
  else
    select routine_exercises.routine_id
    into parent_routine_id
    from public.routine_exercises
    where routine_exercises.id = coalesce(new.routine_exercise_id, old.routine_exercise_id);
  end if;

  if (select auth.uid()) = target_user_id
    and exists (
      select 1 from public.routines
      where routines.id = parent_routine_id
        and routines.block_week_id is not null
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Assigned routine prescriptions can only be changed by the coach';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger routine_exercises_protect_assigned
  before insert or update or delete on public.routine_exercises
  for each row execute function private.protect_assigned_routine_child();

create trigger routine_sets_protect_assigned
  before insert or update or delete on public.routine_sets
  for each row execute function private.protect_assigned_routine_child();

create policy "routine_exercises_delete_coach"
  on public.routine_exercises for delete to authenticated
  using ((select private.is_coach_of(user_id)));

create policy "routine_sets_delete_coach"
  on public.routine_sets for delete to authenticated
  using ((select private.is_coach_of(user_id)));

grant delete on public.routine_exercises, public.routine_sets to authenticated;

-- Optional reusable templates. Their JSON content mirrors the nested editor and
-- deliberately stays independent from athlete assignments.
create table public.coach_program_templates (
  id text primary key,
  coach_id uuid not null references auth.users(id) on delete cascade,
  template_type text not null,
  name text not null check (char_length(name) between 1 and 80),
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_program_templates_type_check
    check (template_type in ('activation', 'block', 'week', 'day')),
  constraint coach_program_templates_content_check
    check (jsonb_typeof(content) = 'object')
);

create index coach_program_templates_coach_type_idx
  on public.coach_program_templates(coach_id, template_type, updated_at desc);

create trigger coach_program_templates_set_updated_at
  before update on public.coach_program_templates
  for each row execute function private.set_updated_at();

alter table public.coach_program_templates enable row level security;

create policy "coach_program_templates_all_own"
  on public.coach_program_templates for all to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id);

revoke all privileges on table public.coach_program_templates from public, anon, authenticated;
grant select, insert, update, delete on public.coach_program_templates to authenticated;

-- Athlete confirms progression after completing every published day in the
-- current week. The next week may still be a draft, which drives the waiting UI.
create function private.complete_current_coach_week(requested_block_id text)
returns table (
  block_status text,
  next_week_id text,
  next_week_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_block public.coach_blocks%rowtype;
  target_week public.coach_block_weeks%rowtype;
  next_week public.coach_block_weeks%rowtype;
  required_days integer;
  completed_days integer;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select * into target_block
  from public.coach_blocks
  where id = requested_block_id
    and athlete_id = caller_id
  for update;

  if not found or target_block.status <> 'published' then
    raise exception 'Active block not found';
  end if;

  select * into target_week
  from public.coach_block_weeks
  where block_id = target_block.id
    and week_number = target_block.current_week_number
    and week_type <> 'activation'
    and archived_at is null
  for update;

  if not found or target_week.status <> 'published' then
    raise exception 'Current week is not published';
  end if;

  select count(*) into required_days
  from public.routines
  where block_week_id = target_week.id
    and status = 'published'
    and archived_at is null;

  select count(distinct workouts.routine_id) into completed_days
  from public.workouts
  join public.routines on routines.id = workouts.routine_id
  where workouts.user_id = caller_id
    and routines.block_week_id = target_week.id
    and routines.status = 'published'
    and routines.archived_at is null;

  if required_days = 0 or completed_days < required_days then
    raise exception 'Complete every day in the week before advancing';
  end if;

  update public.coach_block_weeks
  set status = 'completed', completed_at = now()
  where id = target_week.id;

  select * into next_week
  from public.coach_block_weeks
  where block_id = target_block.id
    and week_type <> 'activation'
    and week_number > target_week.week_number
    and status <> 'archived'
    and archived_at is null
  order by week_number
  limit 1;

  if found then
    update public.coach_blocks
    set current_week_number = next_week.week_number
    where id = target_block.id;
    return query select 'published'::text, next_week.id, next_week.status;
  else
    update public.coach_blocks
    set status = 'completed', completed_at = now()
    where id = target_block.id;
    return query select 'completed'::text, null::text, null::text;
  end if;
end;
$$;

create function public.complete_current_coach_week(block_id text)
returns table (block_status text, next_week_id text, next_week_status text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.complete_current_coach_week($1);
$$;

create function private.set_coach_week_start_date(requested_week_id text, requested_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  update public.coach_block_weeks
  set start_date_override = requested_date
  where id = requested_week_id
    and exists (
      select 1 from public.coach_blocks
      where coach_blocks.id = coach_block_weeks.block_id
        and ((select auth.uid()) = coach_blocks.athlete_id
          or (select auth.uid()) = coach_blocks.coach_id)
    );

  if not found then
    raise exception 'Week not found';
  end if;
end;
$$;

create function public.set_coach_week_start_date(week_id text, start_date date)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_coach_week_start_date($1, $2);
$$;

grant update (
  status,
  current_week_number,
  published_at,
  completed_at,
  archived_at
) on public.coach_blocks to authenticated;

grant insert (
  status,
  current_week_number,
  published_at,
  completed_at,
  archived_at
) on public.coach_blocks to authenticated;

grant update (
  week_type,
  status,
  start_date_override,
  published_at,
  completed_at,
  archived_at,
  updated_at
) on public.coach_block_weeks to authenticated;

grant insert (
  id,
  block_id,
  week_number,
  name,
  is_warmup,
  week_type,
  status,
  start_date_override,
  published_at
) on public.coach_block_weeks to authenticated;

revoke execute on function private.protect_assigned_routine() from public, anon, authenticated;
revoke execute on function private.protect_assigned_routine_child() from public, anon, authenticated;
revoke execute on function private.complete_current_coach_week(text) from public, anon, authenticated;
revoke execute on function private.set_coach_week_start_date(text, date) from public, anon, authenticated;
revoke execute on function public.complete_current_coach_week(text) from public, anon, authenticated;
revoke execute on function public.set_coach_week_start_date(text, date) from public, anon, authenticated;

grant execute on function private.complete_current_coach_week(text) to authenticated;
grant execute on function private.set_coach_week_start_date(text, date) to authenticated;
grant execute on function public.complete_current_coach_week(text) to authenticated;
grant execute on function public.set_coach_week_start_date(text, date) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.coach_blocks;
    alter publication supabase_realtime add table public.coach_block_weeks;
    alter publication supabase_realtime add table public.routines;
  end if;
exception when duplicate_object then
  null;
end;
$$;
