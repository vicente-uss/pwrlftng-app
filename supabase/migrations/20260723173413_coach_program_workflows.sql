-- Phase 1: atomic assignment and controlled propagation from a master program.

create or replace function private.protect_assigned_routine()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_user_id uuid := coalesce(new.user_id, old.user_id);
  target_week_id text := coalesce(new.block_week_id, old.block_week_id);
begin
  if current_setting('app.coach_program_propagation', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if target_week_id is not null
    and (select auth.uid()) = target_user_id
  then
    raise exception using
      errcode = '42501',
      message = 'Assigned routines can only be changed by the coach';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.protect_assigned_routine_child()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_user_id uuid := coalesce(new.user_id, old.user_id);
  parent_routine_id text;
begin
  if current_setting('app.coach_program_propagation', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_table_name = 'routine_exercises' then
    parent_routine_id := coalesce(new.routine_id, old.routine_id);
  else
    select routine_exercises.routine_id
    into parent_routine_id
    from public.routine_exercises
    where routine_exercises.id = coalesce(
      new.routine_exercise_id,
      old.routine_exercise_id
    );
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
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function private.copy_coach_program_week(
  requested_assignment_id text,
  requested_program_week_id text,
  customization_policy text,
  actor_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_assignment public.coach_program_assignments%rowtype;
  source_week public.coach_program_weeks%rowtype;
  copy_week public.coach_block_weeks%rowtype;
  source_day public.coach_program_days%rowtype;
  source_exercise public.coach_program_exercises%rowtype;
  source_set public.coach_program_sets%rowtype;
  copy_week_id text;
  copy_routine_id text;
  copy_exercise_id text;
  has_customizations boolean;
begin
  perform set_config('app.coach_program_propagation', 'on', true);

  select *
  into target_assignment
  from public.coach_program_assignments
  where id = requested_assignment_id
    and coach_id = actor_id
    and status = 'active'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Assignment not found for coach';
  end if;

  select *
  into source_week
  from public.coach_program_weeks
  where id = requested_program_week_id
    and program_id = target_assignment.program_id;

  if not found then
    raise exception using errcode = '22023', message = 'Week does not belong to assignment program';
  end if;

  select *
  into copy_week
  from public.coach_block_weeks
  where block_id = target_assignment.block_id
    and source_program_week_id = source_week.id
  for update;

  if found and copy_week.status = 'completed' then
    return 'completed';
  end if;

  if found and exists (
    select 1
    from public.athlete_active_program_sessions
    join public.routines
      on routines.id = athlete_active_program_sessions.routine_id
    where routines.block_week_id = copy_week.id
      and athlete_active_program_sessions.expires_at > now()
  ) then
    return 'deferred';
  end if;

  select exists (
    select 1
    from public.routines
    where routines.block_week_id = copy_week.id
      and routines.archived_at is null
      and routines.coach_revision > 1
  )
  into has_customizations;

  if has_customizations and customization_policy = 'keep' then
    return 'customized';
  end if;

  if copy_week.id is null then
    copy_week_id := 'assigned-week-' || replace(gen_random_uuid()::text, '-', '');
    insert into public.coach_block_weeks (
      id, block_id, week_number, name, is_warmup, week_type, status,
      start_date_override, published_at, source_program_week_id
    ) values (
      copy_week_id,
      target_assignment.block_id,
      source_week.week_number,
      source_week.name,
      false,
      source_week.week_type,
      source_week.status,
      source_week.start_date_override,
      case when source_week.status = 'published' then now() else null end,
      source_week.id
    );
  else
    copy_week_id := copy_week.id;
    update public.coach_block_weeks
    set week_number = source_week.week_number,
        name = source_week.name,
        is_warmup = false,
        week_type = source_week.week_type,
        status = source_week.status,
        start_date_override = source_week.start_date_override,
        published_at = case
          when source_week.status = 'published' then coalesce(published_at, now())
          else null
        end,
        archived_at = null,
        source_program_week_id = source_week.id
    where id = copy_week_id;

    update public.routines
    set status = 'archived',
        archived_at = now(),
        updated_at = now()
    where block_week_id = copy_week_id
      and archived_at is null;
  end if;

  for source_day in
    select *
    from public.coach_program_days
    where program_week_id = source_week.id
    order by training_day, id
  loop
    copy_routine_id := 'assigned-routine-' || replace(gen_random_uuid()::text, '-', '');
    insert into public.routines (
      id, user_id, name, training_day, effort_mode, block_week_id,
      status, prescription_notes, coach_revision, source_program_day_id
    ) values (
      copy_routine_id,
      target_assignment.athlete_id,
      source_day.name,
      source_day.training_day,
      source_day.effort_mode,
      copy_week_id,
      source_day.status,
      source_day.prescription_notes,
      1,
      source_day.id
    );

    for source_exercise in
      select *
      from public.coach_program_exercises
      where program_day_id = source_day.id
      order by position, id
    loop
      copy_exercise_id := 'assigned-exercise-' || replace(gen_random_uuid()::text, '-', '');
      insert into public.routine_exercises (
        id, user_id, routine_id, exercise_id, position,
        source_program_exercise_id
      ) values (
        copy_exercise_id,
        target_assignment.athlete_id,
        copy_routine_id,
        source_exercise.exercise_id,
        source_exercise.position,
        source_exercise.id
      );

      for source_set in
        select *
        from public.coach_program_sets
        where program_exercise_id = source_exercise.id
        order by position, id
      loop
        insert into public.routine_sets (
          id, user_id, routine_exercise_id, position, set_type, weight,
          reps, reps_min, reps_max, rpe, rir, source_program_set_id
        ) values (
          'assigned-set-' || replace(gen_random_uuid()::text, '-', ''),
          target_assignment.athlete_id,
          copy_exercise_id,
          source_set.position,
          source_set.set_type,
          source_set.weight,
          source_set.reps_min,
          source_set.reps_min,
          source_set.reps_max,
          source_set.rpe,
          source_set.rir,
          source_set.id
        );
      end loop;
    end loop;
  end loop;

  return case when has_customizations then 'replaced_customization' else 'applied' end;
end;
$$;

create function public.assign_coach_program(
  p_program_id text,
  p_athlete_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  source_program public.coach_programs%rowtype;
  target_athlete_id uuid;
  assignment_id text;
  block_id text;
  source_week public.coach_program_weeks%rowtype;
  result_ids jsonb := '[]'::jsonb;
  week_result text;
  week_count integer;
  first_week_number smallint;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if coalesce(cardinality(p_athlete_ids), 0) = 0 then
    raise exception using errcode = '22023', message = 'Select at least one athlete';
  end if;

  select *
  into source_program
  from public.coach_programs
  where id = p_program_id
    and coach_id = caller_id
    and status <> 'archived'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Program not found for coach';
  end if;

  select count(*)
  into week_count
  from public.coach_program_weeks
  where program_id = source_program.id;

  select min(week_number)
  into first_week_number
  from public.coach_program_weeks
  where program_id = source_program.id;

  if week_count < 1 then
    raise exception using errcode = '22023', message = 'Program has no weeks';
  end if;

  for target_athlete_id in
    select distinct selected.athlete_id
    from unnest(p_athlete_ids) as selected(athlete_id)
    order by selected.athlete_id
  loop
    if not (select private.is_coach_of(target_athlete_id)) then
      raise exception using errcode = '42501', message = 'Coach can only assign linked athletes';
    end if;

    assignment_id := 'assignment-' || replace(gen_random_uuid()::text, '-', '');
    block_id := 'assigned-block-' || replace(gen_random_uuid()::text, '-', '');

    insert into public.coach_blocks (
      id, coach_id, athlete_id, name, goal_text, start_date, total_weeks,
      status, current_week_number, published_at
    ) values (
      block_id,
      caller_id,
      target_athlete_id,
      source_program.name,
      source_program.goal_text,
      source_program.start_date,
      week_count,
      'published',
      first_week_number,
      now()
    );

    insert into public.coach_program_assignments (
      id, coach_id, athlete_id, program_id, block_id, source_revision,
      last_synced_revision
    ) values (
      assignment_id,
      caller_id,
      target_athlete_id,
      source_program.id,
      block_id,
      source_program.revision,
      source_program.revision
    );

    for source_week in
      select *
      from public.coach_program_weeks
      where program_id = source_program.id
      order by week_number, id
    loop
      week_result := private.copy_coach_program_week(
        assignment_id,
        source_week.id,
        'replace',
        caller_id
      );
      if week_result not in ('applied', 'replaced_customization') then
        raise exception 'Unexpected result while assigning program: %', week_result;
      end if;
    end loop;

    result_ids := result_ids || jsonb_build_array(jsonb_build_object(
      'assignmentId', assignment_id,
      'athleteId', target_athlete_id,
      'blockId', block_id
    ));
  end loop;

  return result_ids;
end;
$$;

create function public.update_coach_program_assignments(
  p_program_id text,
  p_athlete_ids uuid[],
  p_program_week_ids text[],
  p_customization_policy text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  source_program public.coach_programs%rowtype;
  target_assignment public.coach_program_assignments%rowtype;
  source_week public.coach_program_weeks%rowtype;
  update_id text;
  copy_result text;
  applied_ids text[];
  skipped_ids text[];
  deferred_ids text[];
  audit_status text;
  results jsonb := '[]'::jsonb;
  selected_week_count integer;
  total_week_count integer;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if p_customization_policy not in ('keep', 'replace') then
    raise exception using errcode = '22023', message = 'Invalid customization policy';
  end if;

  select *
  into source_program
  from public.coach_programs
  where id = p_program_id
    and coach_id = caller_id
    and status <> 'archived'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Program not found for coach';
  end if;

  select count(*)
  into total_week_count
  from public.coach_program_weeks
  where program_id = source_program.id;

  select count(*)
  into selected_week_count
  from public.coach_program_weeks
  where program_id = source_program.id
    and (
      coalesce(cardinality(p_program_week_ids), 0) = 0
      or id = any(p_program_week_ids)
    );

  if selected_week_count = 0 then
    raise exception using errcode = '22023', message = 'Select at least one valid program week';
  end if;

  for target_assignment in
    select *
    from public.coach_program_assignments
    where coach_id = caller_id
      and program_id = source_program.id
      and status = 'active'
      and (
        coalesce(cardinality(p_athlete_ids), 0) = 0
        or athlete_id = any(p_athlete_ids)
      )
    order by id
    for update
  loop
    applied_ids := array[]::text[];
    skipped_ids := array[]::text[];
    deferred_ids := array[]::text[];

    for source_week in
      select *
      from public.coach_program_weeks
      where program_id = source_program.id
        and (
          coalesce(cardinality(p_program_week_ids), 0) = 0
          or id = any(p_program_week_ids)
        )
      order by week_number, id
    loop
      copy_result := private.copy_coach_program_week(
        target_assignment.id,
        source_week.id,
        p_customization_policy,
        caller_id
      );
      if copy_result in ('applied', 'replaced_customization') then
        applied_ids := applied_ids || source_week.id;
      elsif copy_result = 'deferred' then
        deferred_ids := deferred_ids || source_week.id;
      else
        skipped_ids := skipped_ids || source_week.id;
      end if;
    end loop;

    audit_status := case
      when cardinality(deferred_ids) > 0 and cardinality(applied_ids) = 0
        and cardinality(skipped_ids) = 0 then 'deferred'
      when cardinality(deferred_ids) > 0 or cardinality(skipped_ids) > 0
        then 'partially_applied'
      else 'applied'
    end;
    update_id := 'assignment-update-' || replace(gen_random_uuid()::text, '-', '');

    insert into public.coach_assignment_updates (
      id, assignment_id, from_revision, to_revision, selected_changes,
      customization_policy, status, deferred_changes, created_by, applied_at
    ) values (
      update_id,
      target_assignment.id,
      coalesce(target_assignment.last_synced_revision, 1),
      source_program.revision,
      jsonb_build_object(
        'weekIds', to_jsonb(coalesce(p_program_week_ids, array[]::text[])),
        'appliedWeekIds', to_jsonb(applied_ids),
        'skippedWeekIds', to_jsonb(skipped_ids)
      ),
      p_customization_policy,
      audit_status,
      jsonb_build_object('weekIds', to_jsonb(deferred_ids)),
      caller_id,
      case when audit_status = 'deferred' then null else now() end
    );

    update public.coach_program_assignments
    set source_revision = source_program.revision,
        last_synced_revision = case
          when selected_week_count = total_week_count
            and cardinality(deferred_ids) = 0
            and cardinality(skipped_ids) = 0
          then source_program.revision
          else last_synced_revision
        end
    where id = target_assignment.id;

    results := results || jsonb_build_array(jsonb_build_object(
      'assignmentId', target_assignment.id,
      'athleteId', target_assignment.athlete_id,
      'status', audit_status,
      'appliedWeekIds', applied_ids,
      'skippedWeekIds', skipped_ids,
      'deferredWeekIds', deferred_ids
    ));
  end loop;

  return results;
end;
$$;

create function public.set_coach_library_program_archived(
  p_program_id text,
  p_archived boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  update public.coach_programs
  set status = case when p_archived then 'archived' else 'draft' end,
      archived_at = case when p_archived then now() else null end
  where id = p_program_id
    and coach_id = caller_id;

  if not found then
    raise exception using errcode = '42501', message = 'Program not found for coach';
  end if;
end;
$$;

create function public.begin_athlete_program_session(
  p_session_id text,
  p_routine_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_week_id text;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  select block_week_id
  into target_week_id
  from public.routines
  where id = p_routine_id
    and user_id = caller_id
    and block_week_id is not null
    and archived_at is null;

  if target_week_id is null then
    return;
  end if;

  insert into public.athlete_active_program_sessions (
    athlete_id, session_id, routine_id, block_week_id, started_at, expires_at
  ) values (
    caller_id, p_session_id, p_routine_id, target_week_id, now(), now() + interval '12 hours'
  )
  on conflict (athlete_id) do update
  set session_id = excluded.session_id,
      routine_id = excluded.routine_id,
      block_week_id = excluded.block_week_id,
      started_at = excluded.started_at,
      expires_at = excluded.expires_at;
end;
$$;

create function public.finish_athlete_program_session(p_session_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  pending_update public.coach_assignment_updates%rowtype;
  pending_week_id text;
  copy_result text;
  still_deferred text[];
  skipped_ids text[];
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  delete from public.athlete_active_program_sessions
  where athlete_id = caller_id
    and session_id = p_session_id;

  for pending_update in
    select coach_assignment_updates.*
    from public.coach_assignment_updates
    join public.coach_program_assignments
      on coach_program_assignments.id = coach_assignment_updates.assignment_id
    where coach_program_assignments.athlete_id = caller_id
      and coach_assignment_updates.status in ('deferred', 'partially_applied')
      and jsonb_array_length(coach_assignment_updates.deferred_changes -> 'weekIds') > 0
    order by coach_assignment_updates.created_at, coach_assignment_updates.id
    for update
  loop
    still_deferred := array[]::text[];
    skipped_ids := array[]::text[];
    for pending_week_id in
      select jsonb_array_elements_text(pending_update.deferred_changes -> 'weekIds')
    loop
      copy_result := private.copy_coach_program_week(
        pending_update.assignment_id,
        pending_week_id,
        pending_update.customization_policy,
        pending_update.created_by
      );
      if copy_result = 'deferred' then
        still_deferred := still_deferred || pending_week_id;
      elsif copy_result not in ('applied', 'replaced_customization') then
        skipped_ids := skipped_ids || pending_week_id;
      end if;
    end loop;

    update public.coach_assignment_updates
    set status = case
          when cardinality(still_deferred) > 0 then 'deferred'
          when cardinality(skipped_ids) > 0 then 'partially_applied'
          else 'applied'
        end,
        deferred_changes = jsonb_build_object('weekIds', to_jsonb(still_deferred)),
        applied_at = case when cardinality(still_deferred) = 0 then now() else applied_at end
    where id = pending_update.id;
  end loop;
end;
$$;

revoke execute on function private.copy_coach_program_week(text, text, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.assign_coach_program(text, uuid[])
  from public, anon, authenticated;
revoke execute on function public.update_coach_program_assignments(text, uuid[], text[], text)
  from public, anon, authenticated;
revoke execute on function public.set_coach_library_program_archived(text, boolean)
  from public, anon, authenticated;
revoke execute on function public.begin_athlete_program_session(text, text)
  from public, anon, authenticated;
revoke execute on function public.finish_athlete_program_session(text)
  from public, anon, authenticated;

grant execute on function public.assign_coach_program(text, uuid[])
  to authenticated;
grant execute on function public.update_coach_program_assignments(text, uuid[], text[], text)
  to authenticated;
grant execute on function public.set_coach_library_program_archived(text, boolean)
  to authenticated;
grant execute on function public.begin_athlete_program_session(text, text)
  to authenticated;
grant execute on function public.finish_athlete_program_session(text)
  to authenticated;
