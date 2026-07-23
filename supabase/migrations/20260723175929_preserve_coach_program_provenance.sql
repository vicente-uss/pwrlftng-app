-- Retain source links while the normalized master is rebuilt by a revision save.
-- Existing payload IDs are stable; removed nodes deliberately remain unlinked.

alter function public.save_coach_library_program(jsonb)
  rename to save_coach_library_program_rebuild;

revoke execute on function public.save_coach_library_program_rebuild(jsonb)
  from public, anon, authenticated;

create function public.save_coach_library_program(p_program jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  requested_program_id text := nullif(btrim(p_program -> 'program' ->> 'id'), '');
  saved_program_id text;
  week_links jsonb := '[]'::jsonb;
  day_links jsonb := '[]'::jsonb;
  exercise_links jsonb := '[]'::jsonb;
  set_links jsonb := '[]'::jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if requested_program_id is not null then
    if exists (
      select 1 from public.coach_programs
      where id = requested_program_id
        and coach_id <> caller_id
    ) then
      raise exception using errcode = '42501', message = 'Program belongs to another coach';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'copy_id', coach_block_weeks.id,
      'source_id', coach_block_weeks.source_program_week_id
    )), '[]'::jsonb)
    into week_links
    from public.coach_block_weeks
    join public.coach_program_assignments
      on coach_program_assignments.block_id = coach_block_weeks.block_id
    where coach_program_assignments.program_id = requested_program_id
      and coach_program_assignments.coach_id = caller_id
      and coach_block_weeks.source_program_week_id is not null;

    select coalesce(jsonb_agg(jsonb_build_object(
      'copy_id', routines.id,
      'source_id', routines.source_program_day_id
    )), '[]'::jsonb)
    into day_links
    from public.routines
    join public.coach_block_weeks
      on coach_block_weeks.id = routines.block_week_id
    join public.coach_program_assignments
      on coach_program_assignments.block_id = coach_block_weeks.block_id
    where coach_program_assignments.program_id = requested_program_id
      and coach_program_assignments.coach_id = caller_id
      and routines.source_program_day_id is not null;

    select coalesce(jsonb_agg(jsonb_build_object(
      'copy_id', routine_exercises.id,
      'source_id', routine_exercises.source_program_exercise_id
    )), '[]'::jsonb)
    into exercise_links
    from public.routine_exercises
    join public.routines on routines.id = routine_exercises.routine_id
    join public.coach_block_weeks
      on coach_block_weeks.id = routines.block_week_id
    join public.coach_program_assignments
      on coach_program_assignments.block_id = coach_block_weeks.block_id
    where coach_program_assignments.program_id = requested_program_id
      and coach_program_assignments.coach_id = caller_id
      and routine_exercises.source_program_exercise_id is not null;

    select coalesce(jsonb_agg(jsonb_build_object(
      'copy_id', routine_sets.id,
      'source_id', routine_sets.source_program_set_id
    )), '[]'::jsonb)
    into set_links
    from public.routine_sets
    join public.routine_exercises
      on routine_exercises.id = routine_sets.routine_exercise_id
    join public.routines on routines.id = routine_exercises.routine_id
    join public.coach_block_weeks
      on coach_block_weeks.id = routines.block_week_id
    join public.coach_program_assignments
      on coach_program_assignments.block_id = coach_block_weeks.block_id
    where coach_program_assignments.program_id = requested_program_id
      and coach_program_assignments.coach_id = caller_id
      and routine_sets.source_program_set_id is not null;
  end if;

  saved_program_id := public.save_coach_library_program_rebuild(p_program);

  update public.coach_block_weeks
  set source_program_week_id = links.source_id
  from (
    select copy_id, source_id
    from jsonb_to_recordset(week_links)
      as restored(copy_id text, source_id text)
  ) as links
  where coach_block_weeks.id = links.copy_id
    and exists (
      select 1 from public.coach_program_weeks
      where coach_program_weeks.id = links.source_id
        and coach_program_weeks.program_id = saved_program_id
    );

  update public.routines
  set source_program_day_id = links.source_id
  from (
    select copy_id, source_id
    from jsonb_to_recordset(day_links)
      as restored(copy_id text, source_id text)
  ) as links
  where routines.id = links.copy_id
    and exists (
      select 1
      from public.coach_program_days
      join public.coach_program_weeks
        on coach_program_weeks.id = coach_program_days.program_week_id
      where coach_program_days.id = links.source_id
        and coach_program_weeks.program_id = saved_program_id
    );

  update public.routine_exercises
  set source_program_exercise_id = links.source_id
  from (
    select copy_id, source_id
    from jsonb_to_recordset(exercise_links)
      as restored(copy_id text, source_id text)
  ) as links
  where routine_exercises.id = links.copy_id
    and exists (
      select 1
      from public.coach_program_exercises
      join public.coach_program_days
        on coach_program_days.id = coach_program_exercises.program_day_id
      join public.coach_program_weeks
        on coach_program_weeks.id = coach_program_days.program_week_id
      where coach_program_exercises.id = links.source_id
        and coach_program_weeks.program_id = saved_program_id
    );

  update public.routine_sets
  set source_program_set_id = links.source_id
  from (
    select copy_id, source_id
    from jsonb_to_recordset(set_links)
      as restored(copy_id text, source_id text)
  ) as links
  where routine_sets.id = links.copy_id
    and exists (
      select 1
      from public.coach_program_sets
      join public.coach_program_exercises
        on coach_program_exercises.id = coach_program_sets.program_exercise_id
      join public.coach_program_days
        on coach_program_days.id = coach_program_exercises.program_day_id
      join public.coach_program_weeks
        on coach_program_weeks.id = coach_program_days.program_week_id
      where coach_program_sets.id = links.source_id
        and coach_program_weeks.program_id = saved_program_id
    );

  return saved_program_id;
end;
$$;

revoke execute on function public.save_coach_library_program(jsonb)
  from public, anon, authenticated;
grant execute on function public.save_coach_library_program(jsonb)
  to authenticated;
