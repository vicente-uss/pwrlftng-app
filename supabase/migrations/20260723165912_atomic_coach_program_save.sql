-- Save a complete coaching prescription as one PostgreSQL statement. Because
-- functions execute inside the caller's transaction, any exception rolls back
-- the block and every nested week, routine, exercise and set.
create function public.save_coach_program(
  p_athlete_id uuid,
  p_program jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  saved_at timestamptz := now();
  block_payload jsonb;
  weeks_payload jsonb;
  week_payload jsonb;
  day_payload jsonb;
  exercise_payload jsonb;
  set_payload jsonb;
  target_block_id text;
  block_name text;
  block_status text;
  block_start_date date;
  block_total_weeks smallint;
  block_current_week smallint;
  existing_block public.coach_blocks%rowtype;
  target_week_id text;
  week_ids text[] := array[]::text[];
  target_day_id text;
  routine_ids text[] := array[]::text[];
  target_routine_exercise_id text;
  old_exercise_ids text[];
  affected_rows integer;
begin
  if caller_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication required';
  end if;

  if p_athlete_id is null or not (select private.is_coach_of(p_athlete_id)) then
    raise exception using
      errcode = '42501',
      message = 'Coach can only manage assigned athletes';
  end if;

  if jsonb_typeof(p_program) <> 'object'
    or jsonb_typeof(p_program -> 'block') <> 'object'
    or jsonb_typeof(p_program -> 'weeks') <> 'array'
  then
    raise exception using
      errcode = '22023',
      message = 'Program must contain a block object and a weeks array';
  end if;

  block_payload := p_program -> 'block';
  weeks_payload := p_program -> 'weeks';

  if jsonb_array_length(weeks_payload) = 0 then
    raise exception using
      errcode = '22023',
      message = 'A coaching program must contain at least one week';
  end if;

  target_block_id := nullif(btrim(block_payload ->> 'id'), '');
  block_name := nullif(btrim(block_payload ->> 'name'), '');
  block_status := coalesce(nullif(block_payload ->> 'status', ''), 'draft');
  block_start_date := nullif(block_payload ->> 'startDate', '')::date;
  block_total_weeks := (block_payload ->> 'totalWeeks')::smallint;
  block_current_week := coalesce(
    nullif(block_payload ->> 'currentWeekNumber', '')::smallint,
    1
  );

  if target_block_id is null or block_name is null then
    raise exception using
      errcode = '22023',
      message = 'Block id and name are required';
  end if;

  select *
  into existing_block
  from public.coach_blocks
  where id = target_block_id
  for update;

  if found then
    if existing_block.coach_id <> caller_id
      or existing_block.athlete_id <> p_athlete_id
    then
      raise exception using
        errcode = '42501',
        message = 'Coach cannot edit this program';
    end if;

    update public.coach_blocks
    set name = block_name,
        goal_text = nullif(block_payload ->> 'goalText', ''),
        start_date = block_start_date,
        total_weeks = block_total_weeks,
        status = block_status,
        current_week_number = block_current_week,
        published_at = saved_at
    where id = target_block_id;
  else
    insert into public.coach_blocks (
      id,
      coach_id,
      athlete_id,
      name,
      goal_text,
      start_date,
      total_weeks,
      status,
      current_week_number,
      published_at
    )
    values (
      target_block_id,
      caller_id,
      p_athlete_id,
      block_name,
      nullif(block_payload ->> 'goalText', ''),
      block_start_date,
      block_total_weeks,
      block_status,
      block_current_week,
      saved_at
    );
  end if;

  -- A block lock serializes edits to the same tree. Child rows are locked in a
  -- stable order as an additional guard against future multi-tree operations.
  perform coach_block_weeks.id
  from public.coach_block_weeks
  where coach_block_weeks.block_id = target_block_id
  order by coach_block_weeks.id
  for update;

  perform routines.id
  from public.routines
  join public.coach_block_weeks
    on coach_block_weeks.id = routines.block_week_id
  where coach_block_weeks.block_id = target_block_id
  order by routines.id
  for update of routines;

  for week_payload in
    select value
    from jsonb_array_elements(weeks_payload)
  loop
    if jsonb_typeof(week_payload) <> 'object'
      or jsonb_typeof(week_payload -> 'days') <> 'array'
    then
      raise exception using
        errcode = '22023',
        message = 'Every week must be an object with a days array';
    end if;

    target_week_id := nullif(btrim(week_payload ->> 'id'), '');
    if target_week_id is null or target_week_id = any(week_ids) then
      raise exception using
        errcode = '22023',
        message = 'Every week must have a unique id';
    end if;
    week_ids := array_append(week_ids, target_week_id);

    update public.coach_block_weeks
    set week_number = (week_payload ->> 'weekNumber')::smallint,
        name = btrim(week_payload ->> 'name'),
        is_warmup = coalesce((week_payload ->> 'isWarmup')::boolean, false),
        week_type = coalesce(nullif(week_payload ->> 'weekType', ''), 'training'),
        status = coalesce(nullif(week_payload ->> 'status', ''), 'published'),
        start_date_override = nullif(week_payload ->> 'startDateOverride', '')::date,
        published_at = saved_at,
        archived_at = null
    where coach_block_weeks.id = target_week_id
      and coach_block_weeks.block_id = target_block_id;

    get diagnostics affected_rows = row_count;
    if affected_rows = 0 then
      -- archived_at deliberately uses its default here. The previous client
      -- payload explicitly inserted NULL without having that column privilege,
      -- which was the exact source of PostgreSQL 42501.
      insert into public.coach_block_weeks (
        id,
        block_id,
        week_number,
        name,
        is_warmup,
        week_type,
        status,
        start_date_override,
        published_at
      )
      values (
        target_week_id,
        target_block_id,
        (week_payload ->> 'weekNumber')::smallint,
        btrim(week_payload ->> 'name'),
        coalesce((week_payload ->> 'isWarmup')::boolean, false),
        coalesce(nullif(week_payload ->> 'weekType', ''), 'training'),
        coalesce(nullif(week_payload ->> 'status', ''), 'published'),
        nullif(week_payload ->> 'startDateOverride', '')::date,
        saved_at
      );
    end if;

    for day_payload in
      select value
      from jsonb_array_elements(week_payload -> 'days')
    loop
      if jsonb_typeof(day_payload) <> 'object'
        or jsonb_typeof(day_payload -> 'exercises') <> 'array'
      then
        raise exception using
          errcode = '22023',
          message = 'Every day must be an object with an exercises array';
      end if;

      target_day_id := nullif(btrim(day_payload ->> 'id'), '');
      if target_day_id is null or target_day_id = any(routine_ids) then
        raise exception using
          errcode = '22023',
          message = 'Every day must have a unique id';
      end if;
      routine_ids := array_append(routine_ids, target_day_id);

      update public.routines
      set name = btrim(day_payload ->> 'name'),
          training_day = (day_payload ->> 'trainingDay')::smallint,
          effort_mode = coalesce(nullif(day_payload ->> 'effortMode', ''), 'rpe'),
          prescription_notes = nullif(day_payload ->> 'prescriptionNotes', ''),
          status = coalesce(nullif(day_payload ->> 'status', ''), 'published'),
          updated_at = saved_at,
          archived_at = null
      where id = target_day_id
        and user_id = p_athlete_id
        and block_week_id = target_week_id;

      get diagnostics affected_rows = row_count;
      if affected_rows = 0 then
        insert into public.routines (
          id,
          user_id,
          block_week_id,
          name,
          training_day,
          effort_mode,
          prescription_notes,
          status,
          created_at,
          updated_at,
          archived_at
        )
        values (
          target_day_id,
          p_athlete_id,
          target_week_id,
          btrim(day_payload ->> 'name'),
          (day_payload ->> 'trainingDay')::smallint,
          coalesce(nullif(day_payload ->> 'effortMode', ''), 'rpe'),
          nullif(day_payload ->> 'prescriptionNotes', ''),
          coalesce(nullif(day_payload ->> 'status', ''), 'published'),
          saved_at,
          saved_at,
          null
        );
      end if;

      select array_agg(id order by id)
      into old_exercise_ids
      from public.routine_exercises
      where routine_id = target_day_id;

      if old_exercise_ids is not null then
        delete from public.routine_sets
        where routine_exercise_id = any(old_exercise_ids);

        delete from public.routine_exercises
        where id = any(old_exercise_ids);
      end if;

      for exercise_payload in
        select value
        from jsonb_array_elements(day_payload -> 'exercises')
      loop
        if jsonb_typeof(exercise_payload) <> 'object'
          or jsonb_typeof(exercise_payload -> 'sets') <> 'array'
        then
          raise exception using
            errcode = '22023',
            message = 'Every exercise must be an object with a sets array';
        end if;

        target_routine_exercise_id := nullif(btrim(exercise_payload ->> 'id'), '');
        if target_routine_exercise_id is null then
          raise exception using
            errcode = '22023',
            message = 'Every routine exercise must have an id';
        end if;

        insert into public.routine_exercises (
          id,
          user_id,
          routine_id,
          exercise_id,
          position
        )
        values (
          target_routine_exercise_id,
          p_athlete_id,
          target_day_id,
          nullif(btrim(exercise_payload ->> 'exerciseId'), ''),
          (exercise_payload ->> 'position')::smallint
        );

        for set_payload in
          select value
          from jsonb_array_elements(exercise_payload -> 'sets')
        loop
          if jsonb_typeof(set_payload) <> 'object' then
            raise exception using
              errcode = '22023',
              message = 'Every set must be an object';
          end if;

          insert into public.routine_sets (
            id,
            user_id,
            routine_exercise_id,
            position,
            set_type,
            weight,
            reps,
            reps_min,
            reps_max,
            rpe,
            rir
          )
          values (
            nullif(btrim(set_payload ->> 'id'), ''),
            p_athlete_id,
            target_routine_exercise_id,
            (set_payload ->> 'position')::smallint,
            coalesce(nullif(set_payload ->> 'setType', ''), 'working'),
            (set_payload ->> 'weight')::numeric,
            (set_payload ->> 'repsMin')::smallint,
            (set_payload ->> 'repsMin')::smallint,
            (set_payload ->> 'repsMax')::smallint,
            nullif(set_payload ->> 'rpe', '')::numeric,
            nullif(set_payload ->> 'rir', '')::numeric
          );
        end loop;
      end loop;
    end loop;
  end loop;

  -- Missing descendants are archived only after the complete replacement tree
  -- has been validated and written. Any later failure still rolls this back.
  update public.routines
  set status = 'archived',
      archived_at = saved_at,
      updated_at = saved_at
  where block_week_id = any(week_ids)
    and not (id = any(routine_ids))
    and archived_at is null;

  update public.routines
  set status = 'archived',
      archived_at = saved_at,
      updated_at = saved_at
  where block_week_id in (
    select id
    from public.coach_block_weeks
    where coach_block_weeks.block_id = target_block_id
      and not (id = any(week_ids))
  )
    and archived_at is null;

  update public.coach_block_weeks
  set status = 'archived',
      archived_at = saved_at
  where coach_block_weeks.block_id = target_block_id
    and not (id = any(week_ids))
    and archived_at is null;

  return target_block_id;
end;
$$;

-- New database objects are not automatically exposed. Keep EXECUTE limited to
-- signed-in users; RLS and the explicit coach/athlete check remain in force.
revoke execute on function public.save_coach_program(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_coach_program(uuid, jsonb)
  to authenticated;

-- The atomic insert does not name these defaulted lifecycle columns. Explicitly
-- keep them outside the authenticated INSERT surface instead of broadening the
-- grant that caused the original 42501.
revoke insert (archived_at, completed_at, updated_at)
  on public.coach_block_weeks
  from authenticated;

-- Draft hierarchy is coach-only. Completed/archived folders remain readable as
-- history, while an assigned day must still be published and not archived.
drop policy "coach_blocks_select_athlete" on public.coach_blocks;
create policy "coach_blocks_select_athlete"
  on public.coach_blocks for select to authenticated
  using (
    (select auth.uid()) = athlete_id
    and status <> 'draft'
  );

drop policy "coach_block_weeks_select_athlete" on public.coach_block_weeks;
create policy "coach_block_weeks_select_athlete"
  on public.coach_block_weeks for select to authenticated
  using (
    status <> 'draft'
    and exists (
      select 1
      from public.coach_blocks
      where coach_blocks.id = coach_block_weeks.block_id
        and coach_blocks.athlete_id = (select auth.uid())
        and coach_blocks.status <> 'draft'
    )
  );

drop policy "routines_select_own" on public.routines;
create policy "routines_select_own"
  on public.routines for select to authenticated
  using (
    (select auth.uid()) = user_id
    and archived_at is null
    and (
      block_week_id is null
      or (
        status = 'published'
        and exists (
          select 1
          from public.coach_block_weeks
          join public.coach_blocks
            on coach_blocks.id = coach_block_weeks.block_id
          where coach_block_weeks.id = routines.block_week_id
            and coach_block_weeks.status <> 'draft'
            and coach_blocks.status <> 'draft'
            and coach_blocks.athlete_id = (select auth.uid())
        )
      )
    )
  );

drop policy "routine_exercises_select_own" on public.routine_exercises;
create policy "routine_exercises_select_own"
  on public.routine_exercises for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.routines
      where routines.id = routine_exercises.routine_id
        and routines.archived_at is null
        and (
          routines.block_week_id is null
          or (
            routines.status = 'published'
            and exists (
              select 1
              from public.coach_block_weeks
              join public.coach_blocks
                on coach_blocks.id = coach_block_weeks.block_id
              where coach_block_weeks.id = routines.block_week_id
                and coach_block_weeks.status <> 'draft'
                and coach_blocks.status <> 'draft'
                and coach_blocks.athlete_id = (select auth.uid())
            )
          )
        )
    )
  );

drop policy "routine_sets_select_own" on public.routine_sets;
create policy "routine_sets_select_own"
  on public.routine_sets for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.routine_exercises
      join public.routines
        on routines.id = routine_exercises.routine_id
      where routine_exercises.id = routine_sets.routine_exercise_id
        and routines.archived_at is null
        and (
          routines.block_week_id is null
          or (
            routines.status = 'published'
            and exists (
              select 1
              from public.coach_block_weeks
              join public.coach_blocks
                on coach_blocks.id = coach_block_weeks.block_id
              where coach_block_weeks.id = routines.block_week_id
                and coach_block_weeks.status <> 'draft'
                and coach_blocks.status <> 'draft'
                and coach_blocks.athlete_id = (select auth.uid())
            )
          )
        )
    )
  );
