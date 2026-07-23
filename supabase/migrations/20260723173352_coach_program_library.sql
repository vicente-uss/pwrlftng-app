-- Phase 1: reusable coaching library.
-- A library program is the coach-owned master. Athlete blocks remain independent
-- copies so completed training and athlete history never depend on a mutable master.

create table public.coach_programs (
  id text primary key,
  coach_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'mesocycle',
  name text not null check (char_length(name) between 1 and 80),
  goal_text text,
  start_date date,
  status text not null default 'draft',
  revision integer not null default 1 check (revision >= 1),
  source_program_id text references public.coach_programs(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_programs_kind_check
    check (kind in ('mesocycle', 'template')),
  constraint coach_programs_status_check
    check (status in ('draft', 'ready', 'archived'))
);

create table public.coach_program_weeks (
  id text primary key,
  program_id text not null references public.coach_programs(id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 52),
  name text not null check (char_length(name) between 1 and 60),
  week_type text not null default 'training',
  status text not null default 'published',
  start_date_override date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, week_number),
  constraint coach_program_weeks_type_check
    check (week_type in ('training', 'low_stress', 'deload', 'closing')),
  constraint coach_program_weeks_status_check
    check (status in ('draft', 'published'))
);

create table public.coach_program_days (
  id text primary key,
  program_week_id text not null references public.coach_program_weeks(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  training_day smallint not null check (training_day between 1 and 7),
  effort_mode text not null default 'rpe',
  prescription_notes text,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_week_id, training_day),
  constraint coach_program_days_effort_mode_check
    check (effort_mode in ('rpe', 'rir', 'both', 'none')),
  constraint coach_program_days_notes_length_check
    check (char_length(prescription_notes) <= 4000),
  constraint coach_program_days_status_check
    check (status in ('draft', 'published'))
);

create table public.coach_program_exercises (
  id text primary key,
  program_day_id text not null references public.coach_program_days(id) on delete cascade,
  exercise_id text not null references public.exercises(id),
  position smallint not null check (position >= 0),
  unique (program_day_id, position)
);

create table public.coach_program_sets (
  id text primary key,
  program_exercise_id text not null references public.coach_program_exercises(id) on delete cascade,
  position smallint not null check (position >= 0),
  set_type text not null default 'working',
  weight numeric(7,2) not null default 0 check (weight >= 0),
  reps_min smallint not null default 0 check (reps_min between 0 and 1000),
  reps_max smallint not null default 0 check (reps_max between 0 and 1000),
  rpe numeric(3,1) check (rpe between 1 and 10),
  rir numeric(3,1) check (rir between 0 and 10),
  unique (program_exercise_id, position),
  constraint coach_program_sets_type_check
    check (set_type in ('warmup', 'working')),
  constraint coach_program_sets_reps_range_check
    check (reps_max >= reps_min)
);

create table public.coach_macrocycles (
  id text primary key,
  coach_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  goal_text text,
  start_date date,
  end_date date,
  status text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_macrocycles_status_check
    check (status is null or status in ('draft', 'active', 'completed', 'archived')),
  constraint coach_macrocycles_dates_check
    check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.coach_macrocycle_programs (
  macrocycle_id text not null references public.coach_macrocycles(id) on delete cascade,
  program_id text not null references public.coach_programs(id) on delete cascade,
  position smallint not null default 0 check (position >= 0),
  primary key (macrocycle_id, program_id),
  unique (program_id)
);

create table public.coach_program_revisions (
  program_id text not null references public.coach_programs(id) on delete cascade,
  revision integer not null check (revision >= 1),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (program_id, revision)
);

create index coach_programs_coach_kind_status_idx
  on public.coach_programs(coach_id, kind, status, updated_at desc);
create index coach_programs_source_program_id_idx
  on public.coach_programs(source_program_id);
create index coach_program_weeks_program_id_idx
  on public.coach_program_weeks(program_id, week_number);
create index coach_program_days_week_id_idx
  on public.coach_program_days(program_week_id, training_day);
create index coach_program_exercises_day_id_idx
  on public.coach_program_exercises(program_day_id, position);
create index coach_program_sets_exercise_id_idx
  on public.coach_program_sets(program_exercise_id, position);
create index coach_macrocycles_coach_status_idx
  on public.coach_macrocycles(coach_id, status, updated_at desc);
create index coach_macrocycle_programs_program_id_idx
  on public.coach_macrocycle_programs(program_id);

create trigger coach_programs_set_updated_at
  before update on public.coach_programs
  for each row execute function private.set_updated_at();
create trigger coach_program_weeks_set_updated_at
  before update on public.coach_program_weeks
  for each row execute function private.set_updated_at();
create trigger coach_program_days_set_updated_at
  before update on public.coach_program_days
  for each row execute function private.set_updated_at();
create trigger coach_macrocycles_set_updated_at
  before update on public.coach_macrocycles
  for each row execute function private.set_updated_at();

alter table public.coach_programs enable row level security;
alter table public.coach_program_weeks enable row level security;
alter table public.coach_program_days enable row level security;
alter table public.coach_program_exercises enable row level security;
alter table public.coach_program_sets enable row level security;
alter table public.coach_macrocycles enable row level security;
alter table public.coach_macrocycle_programs enable row level security;
alter table public.coach_program_revisions enable row level security;

create policy "coach_programs_select_own"
  on public.coach_programs for select to authenticated
  using ((select auth.uid()) = coach_id);

create policy "coach_program_weeks_select_own"
  on public.coach_program_weeks for select to authenticated
  using (
    exists (
      select 1 from public.coach_programs
      where coach_programs.id = coach_program_weeks.program_id
        and coach_programs.coach_id = (select auth.uid())
    )
  );

create policy "coach_program_days_select_own"
  on public.coach_program_days for select to authenticated
  using (
    exists (
      select 1
      from public.coach_program_weeks
      join public.coach_programs on coach_programs.id = coach_program_weeks.program_id
      where coach_program_weeks.id = coach_program_days.program_week_id
        and coach_programs.coach_id = (select auth.uid())
    )
  );

create policy "coach_program_exercises_select_own"
  on public.coach_program_exercises for select to authenticated
  using (
    exists (
      select 1
      from public.coach_program_days
      join public.coach_program_weeks on coach_program_weeks.id = coach_program_days.program_week_id
      join public.coach_programs on coach_programs.id = coach_program_weeks.program_id
      where coach_program_days.id = coach_program_exercises.program_day_id
        and coach_programs.coach_id = (select auth.uid())
    )
  );

create policy "coach_program_sets_select_own"
  on public.coach_program_sets for select to authenticated
  using (
    exists (
      select 1
      from public.coach_program_exercises
      join public.coach_program_days on coach_program_days.id = coach_program_exercises.program_day_id
      join public.coach_program_weeks on coach_program_weeks.id = coach_program_days.program_week_id
      join public.coach_programs on coach_programs.id = coach_program_weeks.program_id
      where coach_program_exercises.id = coach_program_sets.program_exercise_id
        and coach_programs.coach_id = (select auth.uid())
    )
  );

create policy "coach_macrocycles_all_own"
  on public.coach_macrocycles for all to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id);

create policy "coach_macrocycle_programs_all_own"
  on public.coach_macrocycle_programs for all to authenticated
  using (
    exists (
      select 1 from public.coach_macrocycles
      where coach_macrocycles.id = coach_macrocycle_programs.macrocycle_id
        and coach_macrocycles.coach_id = (select auth.uid())
    )
    and exists (
      select 1 from public.coach_programs
      where coach_programs.id = coach_macrocycle_programs.program_id
        and coach_programs.coach_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.coach_macrocycles
      where coach_macrocycles.id = coach_macrocycle_programs.macrocycle_id
        and coach_macrocycles.coach_id = (select auth.uid())
    )
    and exists (
      select 1 from public.coach_programs
      where coach_programs.id = coach_macrocycle_programs.program_id
        and coach_programs.coach_id = (select auth.uid())
    )
  );

create policy "coach_program_revisions_select_own"
  on public.coach_program_revisions for select to authenticated
  using (
    exists (
      select 1 from public.coach_programs
      where coach_programs.id = coach_program_revisions.program_id
        and coach_programs.coach_id = (select auth.uid())
    )
  );

revoke all privileges on table
  public.coach_programs,
  public.coach_program_weeks,
  public.coach_program_days,
  public.coach_program_exercises,
  public.coach_program_sets,
  public.coach_macrocycles,
  public.coach_macrocycle_programs,
  public.coach_program_revisions
from public, anon, authenticated;

grant select on table
  public.coach_programs,
  public.coach_program_weeks,
  public.coach_program_days,
  public.coach_program_exercises,
  public.coach_program_sets,
  public.coach_program_revisions
to authenticated;

grant select, insert, update, delete on table
  public.coach_macrocycles,
  public.coach_macrocycle_programs
to authenticated;

create function public.save_coach_library_program(p_program jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  program_payload jsonb := p_program -> 'program';
  weeks_payload jsonb := p_program -> 'weeks';
  week_payload jsonb;
  day_payload jsonb;
  exercise_payload jsonb;
  set_payload jsonb;
  target_program_id text;
  next_revision integer;
  week_ids text[] := array[]::text[];
  day_ids text[] := array[]::text[];
  exercise_ids text[] := array[]::text[];
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if jsonb_typeof(p_program) <> 'object'
    or jsonb_typeof(program_payload) <> 'object'
    or jsonb_typeof(weeks_payload) <> 'array'
    or jsonb_array_length(weeks_payload) < 1
  then
    raise exception using errcode = '22023', message = 'Invalid coaching program payload';
  end if;

  target_program_id := nullif(btrim(program_payload ->> 'id'), '');
  if target_program_id is null then
    target_program_id := 'program-' || replace(gen_random_uuid()::text, '-', '');
  end if;
  if nullif(program_payload ->> 'sourceProgramId', '') is not null
    and not exists (
      select 1 from public.coach_programs
      where id = nullif(program_payload ->> 'sourceProgramId', '')
        and coach_id = caller_id
    )
  then
    raise exception using errcode = '42501', message = 'Source program belongs to another coach';
  end if;

  select revision + 1
  into next_revision
  from public.coach_programs
  where id = target_program_id
    and coach_id = caller_id
  for update;

  if next_revision is null then
    if exists (select 1 from public.coach_programs where id = target_program_id) then
      raise exception using errcode = '42501', message = 'Program belongs to another coach';
    end if;
    next_revision := 1;
    insert into public.coach_programs (
      id, coach_id, kind, name, goal_text, start_date, status, revision,
      source_program_id
    ) values (
      target_program_id,
      caller_id,
      coalesce(nullif(program_payload ->> 'kind', ''), 'mesocycle'),
      btrim(program_payload ->> 'name'),
      nullif(btrim(program_payload ->> 'goalText'), ''),
      nullif(program_payload ->> 'startDate', '')::date,
      coalesce(nullif(program_payload ->> 'status', ''), 'draft'),
      next_revision,
      nullif(program_payload ->> 'sourceProgramId', '')
    );
  else
    update public.coach_programs
    set kind = coalesce(nullif(program_payload ->> 'kind', ''), kind),
        name = btrim(program_payload ->> 'name'),
        goal_text = nullif(btrim(program_payload ->> 'goalText'), ''),
        start_date = nullif(program_payload ->> 'startDate', '')::date,
        status = coalesce(nullif(program_payload ->> 'status', ''), status),
        revision = next_revision,
        archived_at = case
          when coalesce(nullif(program_payload ->> 'status', ''), status) = 'archived'
          then coalesce(archived_at, now())
          else null
        end
    where id = target_program_id;

    delete from public.coach_program_weeks
    where program_id = target_program_id;
  end if;

  for week_payload in select value from jsonb_array_elements(weeks_payload)
  loop
    if coalesce((week_payload ->> 'weekNumber')::integer, 0) not between 1 and 52 then
      raise exception using errcode = '22023', message = 'Program weeks must be numbered from 1 to 52';
    end if;

    week_ids := week_ids || coalesce(
      nullif(week_payload ->> 'id', ''),
      'program-week-' || replace(gen_random_uuid()::text, '-', '')
    );

    insert into public.coach_program_weeks (
      id, program_id, week_number, name, week_type, status, start_date_override
    ) values (
      week_ids[array_length(week_ids, 1)],
      target_program_id,
      (week_payload ->> 'weekNumber')::smallint,
      btrim(week_payload ->> 'name'),
      coalesce(nullif(week_payload ->> 'weekType', ''), 'training'),
      coalesce(nullif(week_payload ->> 'status', ''), 'published'),
      nullif(week_payload ->> 'startDateOverride', '')::date
    );

    for day_payload in
      select value from jsonb_array_elements(coalesce(week_payload -> 'days', '[]'::jsonb))
    loop
      day_ids := day_ids || coalesce(
        nullif(day_payload ->> 'id', ''),
        'program-day-' || replace(gen_random_uuid()::text, '-', '')
      );

      insert into public.coach_program_days (
        id, program_week_id, name, training_day, effort_mode,
        prescription_notes, status
      ) values (
        day_ids[array_length(day_ids, 1)],
        week_ids[array_length(week_ids, 1)],
        btrim(day_payload ->> 'name'),
        (day_payload ->> 'trainingDay')::smallint,
        coalesce(nullif(day_payload ->> 'effortMode', ''), 'rpe'),
        nullif(btrim(day_payload ->> 'prescriptionNotes'), ''),
        coalesce(nullif(day_payload ->> 'status', ''), 'published')
      );

      for exercise_payload in
        select value from jsonb_array_elements(coalesce(day_payload -> 'exercises', '[]'::jsonb))
      loop
        exercise_ids := exercise_ids || coalesce(
          nullif(exercise_payload ->> 'id', ''),
          'program-exercise-' || replace(gen_random_uuid()::text, '-', '')
        );

        insert into public.coach_program_exercises (
          id, program_day_id, exercise_id, position
        ) values (
          exercise_ids[array_length(exercise_ids, 1)],
          day_ids[array_length(day_ids, 1)],
          exercise_payload ->> 'exerciseId',
          (exercise_payload ->> 'position')::smallint
        );

        for set_payload in
          select value from jsonb_array_elements(coalesce(exercise_payload -> 'sets', '[]'::jsonb))
        loop
          insert into public.coach_program_sets (
            id, program_exercise_id, position, set_type, weight,
            reps_min, reps_max, rpe, rir
          ) values (
            coalesce(
              nullif(set_payload ->> 'id', ''),
              'program-set-' || replace(gen_random_uuid()::text, '-', '')
            ),
            exercise_ids[array_length(exercise_ids, 1)],
            (set_payload ->> 'position')::smallint,
            coalesce(nullif(set_payload ->> 'setType', ''), 'working'),
            coalesce((set_payload ->> 'weight')::numeric, 0),
            coalesce((set_payload ->> 'repsMin')::smallint, 0),
            coalesce((set_payload ->> 'repsMax')::smallint, 0),
            nullif(set_payload ->> 'rpe', '')::numeric,
            nullif(set_payload ->> 'rir', '')::numeric
          );
        end loop;
      end loop;
    end loop;
  end loop;

  insert into public.coach_program_revisions (
    program_id, revision, snapshot, created_by
  ) values (
    target_program_id,
    next_revision,
    jsonb_set(
      p_program,
      '{program,id}',
      to_jsonb(target_program_id),
      true
    ),
    caller_id
  );

  return target_program_id;
end;
$$;

revoke execute on function public.save_coach_library_program(jsonb)
  from public, anon, authenticated;
grant execute on function public.save_coach_library_program(jsonb)
  to authenticated;
