-- Phase 3: preserve prescription separately from execution and persist the
-- evidence used by the read-only performance dashboards.

alter table public.routine_sets
  add column effort_linked boolean not null default true;

alter table public.coach_program_sets
  add column effort_linked boolean not null default true;

alter table public.workout_sets
  add column prescribed_weight numeric(7,2),
  add column prescribed_rpe numeric(3,1),
  add column prescribed_rir numeric(3,1),
  add column actual_rpe numeric(3,1),
  add column actual_rir numeric(3,1),
  add column effort_linked boolean not null default true,
  add column estimated_1rm numeric(9,3),
  add column estimate_confidence text,
  add column estimate_formula_version text;

alter table public.workout_exercises
  add column best_e1rm numeric(9,3),
  add column best_e1rm_confidence text,
  add column e1rm_formula_version text;

update public.workout_sets
set actual_rpe = rpe,
    actual_rir = rir;

update public.workout_sets as performed
set prescribed_weight = prescribed.weight,
    prescribed_rpe = prescribed.rpe,
    prescribed_rir = prescribed.rir,
    effort_linked = prescribed.effort_linked
from public.routine_sets as prescribed
where prescribed.id = performed.source_routine_set_id;

alter table public.workout_sets
  add constraint workout_sets_prescribed_weight_check
    check (prescribed_weight is null or prescribed_weight >= 0),
  add constraint workout_sets_prescribed_rpe_check
    check (prescribed_rpe is null or prescribed_rpe between 1 and 10),
  add constraint workout_sets_prescribed_rir_check
    check (prescribed_rir is null or prescribed_rir between 0 and 10),
  add constraint workout_sets_actual_rpe_check
    check (actual_rpe is null or actual_rpe between 1 and 10),
  add constraint workout_sets_actual_rir_check
    check (actual_rir is null or actual_rir between 0 and 10),
  add constraint workout_sets_estimated_1rm_check
    check (estimated_1rm is null or estimated_1rm > 0),
  add constraint workout_sets_estimate_confidence_check
    check (estimate_confidence is null or estimate_confidence in ('high', 'medium', 'low'));

alter table public.workout_exercises
  add constraint workout_exercises_best_e1rm_check
    check (best_e1rm is null or best_e1rm > 0),
  add constraint workout_exercises_best_e1rm_confidence_check
    check (best_e1rm_confidence is null or best_e1rm_confidence in ('high', 'medium', 'low'));

-- These indexes match the completed-working-set analytics path and the
-- hierarchy joins used to compare microcycles inside a mesocycle.
create index workout_sets_completed_working_exercise_idx
  on public.workout_sets(workout_exercise_id)
  where completed and set_type = 'working';

create index workout_exercises_user_exercise_workout_idx
  on public.workout_exercises(user_id, exercise_id, workout_id);

create index workouts_user_block_week_completed_idx
  on public.workouts(user_id, block_id, block_week_id, completed_at desc);

-- Wrappers keep existing, audited atomic functions intact while persisting the
-- new linked/unlinked state in the same transaction.
create function public.save_coach_program_v3(
  p_athlete_id uuid,
  p_program jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id text;
  week_payload jsonb;
  day_payload jsonb;
  exercise_payload jsonb;
  set_payload jsonb;
begin
  saved_id := public.save_coach_program(p_athlete_id, p_program);
  for week_payload in select value from jsonb_array_elements(p_program -> 'weeks')
  loop
    for day_payload in select value from jsonb_array_elements(week_payload -> 'days')
    loop
      for exercise_payload in select value from jsonb_array_elements(day_payload -> 'exercises')
      loop
        for set_payload in select value from jsonb_array_elements(exercise_payload -> 'sets')
        loop
          update public.routine_sets
          set effort_linked = coalesce((set_payload ->> 'effortLinked')::boolean, true)
          where id = set_payload ->> 'id'
            and user_id = p_athlete_id;
        end loop;
      end loop;
    end loop;
  end loop;
  return saved_id;
end;
$$;

create function public.save_coach_library_program_v3(p_program jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id text;
  week_payload jsonb;
  day_payload jsonb;
  exercise_payload jsonb;
  set_payload jsonb;
begin
  saved_id := public.save_coach_library_program(p_program);
  for week_payload in select value from jsonb_array_elements(p_program -> 'weeks')
  loop
    for day_payload in select value from jsonb_array_elements(week_payload -> 'days')
    loop
      for exercise_payload in select value from jsonb_array_elements(day_payload -> 'exercises')
      loop
        for set_payload in select value from jsonb_array_elements(exercise_payload -> 'sets')
        loop
          update public.coach_program_sets
          set effort_linked = coalesce((set_payload ->> 'effortLinked')::boolean, true)
          where id = set_payload ->> 'id';
        end loop;
      end loop;
    end loop;
  end loop;
  return saved_id;
end;
$$;

create function private.sync_assignment_effort_links(
  requested_program_id text,
  requested_athlete_ids uuid[]
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.routine_sets as assigned
  set effort_linked = source.effort_linked
  from public.coach_program_sets as source,
       public.routine_exercises,
       public.routines,
       public.coach_block_weeks,
       public.coach_program_assignments
  where assigned.source_program_set_id = source.id
    and public.routine_exercises.id = assigned.routine_exercise_id
    and public.routines.id = public.routine_exercises.routine_id
    and public.coach_block_weeks.id = public.routines.block_week_id
    and public.coach_program_assignments.block_id = public.coach_block_weeks.block_id
    and public.coach_program_assignments.program_id = requested_program_id
    and (
      coalesce(cardinality(requested_athlete_ids), 0) = 0
      or public.coach_program_assignments.athlete_id = any(requested_athlete_ids)
    )
    and public.coach_program_assignments.coach_id = (select auth.uid());
$$;

create function public.assign_coach_program_v3(
  p_program_id text,
  p_athlete_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := public.assign_coach_program(p_program_id, p_athlete_ids);
  perform private.sync_assignment_effort_links(p_program_id, p_athlete_ids);
  return result;
end;
$$;

create function public.update_coach_program_assignments_v3(
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
  result jsonb;
begin
  result := public.update_coach_program_assignments(
    p_program_id,
    p_athlete_ids,
    p_program_week_ids,
    p_customization_policy
  );
  perform private.sync_assignment_effort_links(p_program_id, p_athlete_ids);
  return result;
end;
$$;

revoke execute on function public.save_coach_program_v3(uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function public.save_coach_library_program_v3(jsonb)
  from public, anon, authenticated;
revoke execute on function public.assign_coach_program_v3(text, uuid[])
  from public, anon, authenticated;
revoke execute on function public.update_coach_program_assignments_v3(text, uuid[], text[], text)
  from public, anon, authenticated;
revoke execute on function private.sync_assignment_effort_links(text, uuid[])
  from public, anon, authenticated, service_role;

grant execute on function public.save_coach_program_v3(uuid, jsonb) to authenticated;
grant execute on function public.save_coach_library_program_v3(jsonb) to authenticated;
grant execute on function public.assign_coach_program_v3(text, uuid[]) to authenticated;
grant execute on function public.update_coach_program_assignments_v3(text, uuid[], text[], text) to authenticated;
