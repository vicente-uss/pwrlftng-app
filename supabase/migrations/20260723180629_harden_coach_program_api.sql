-- Keep elevated implementation details outside the exposed API schema. Public
-- RPCs are security-invoker wrappers with explicit EXECUTE grants.

alter function public.save_coach_library_program(jsonb) set schema private;
alter function public.assign_coach_program(text, uuid[]) set schema private;
alter function public.update_coach_program_assignments(text, uuid[], text[], text) set schema private;
alter function public.set_coach_library_program_archived(text, boolean) set schema private;
alter function public.begin_athlete_program_session(text, text) set schema private;
alter function public.finish_athlete_program_session(text) set schema private;

revoke execute on function private.save_coach_library_program(jsonb)
  from public, anon, authenticated;
revoke execute on function private.assign_coach_program(text, uuid[])
  from public, anon, authenticated;
revoke execute on function private.update_coach_program_assignments(text, uuid[], text[], text)
  from public, anon, authenticated;
revoke execute on function private.set_coach_library_program_archived(text, boolean)
  from public, anon, authenticated;
revoke execute on function private.begin_athlete_program_session(text, text)
  from public, anon, authenticated;
revoke execute on function private.finish_athlete_program_session(text)
  from public, anon, authenticated;

grant execute on function private.save_coach_library_program(jsonb) to authenticated;
grant execute on function private.assign_coach_program(text, uuid[]) to authenticated;
grant execute on function private.update_coach_program_assignments(text, uuid[], text[], text) to authenticated;
grant execute on function private.set_coach_library_program_archived(text, boolean) to authenticated;
grant execute on function private.begin_athlete_program_session(text, text) to authenticated;
grant execute on function private.finish_athlete_program_session(text) to authenticated;

create function public.save_coach_library_program(p_program jsonb)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.save_coach_library_program($1);
$$;

create function public.assign_coach_program(
  p_program_id text,
  p_athlete_ids uuid[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.assign_coach_program($1, $2);
$$;

create function public.update_coach_program_assignments(
  p_program_id text,
  p_athlete_ids uuid[],
  p_program_week_ids text[],
  p_customization_policy text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_coach_program_assignments($1, $2, $3, $4);
$$;

create function public.set_coach_library_program_archived(
  p_program_id text,
  p_archived boolean
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_coach_library_program_archived($1, $2);
$$;

create function public.begin_athlete_program_session(
  p_session_id text,
  p_routine_id text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.begin_athlete_program_session($1, $2);
$$;

create function public.finish_athlete_program_session(p_session_id text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.finish_athlete_program_session($1);
$$;

revoke execute on function public.save_coach_library_program(jsonb)
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

grant execute on function public.save_coach_library_program(jsonb) to authenticated;
grant execute on function public.assign_coach_program(text, uuid[]) to authenticated;
grant execute on function public.update_coach_program_assignments(text, uuid[], text[], text) to authenticated;
grant execute on function public.set_coach_library_program_archived(text, boolean) to authenticated;
grant execute on function public.begin_athlete_program_session(text, text) to authenticated;
grant execute on function public.finish_athlete_program_session(text) to authenticated;

drop policy "coach_program_assignments_select_coach"
  on public.coach_program_assignments;
drop policy "coach_program_assignments_select_athlete"
  on public.coach_program_assignments;
create policy "coach_program_assignments_select_participant"
  on public.coach_program_assignments for select to authenticated
  using (
    (select auth.uid()) = coach_id
    or (select auth.uid()) = athlete_id
  );

drop policy "athlete_active_program_sessions_select_own"
  on public.athlete_active_program_sessions;
drop policy "athlete_active_program_sessions_select_coach"
  on public.athlete_active_program_sessions;
create policy "athlete_active_program_sessions_select_participant"
  on public.athlete_active_program_sessions for select to authenticated
  using (
    (select auth.uid()) = athlete_id
    or (select private.is_coach_of(athlete_id))
  );

create index coach_program_assignments_program_id_idx
  on public.coach_program_assignments(program_id);
create index coach_program_exercises_exercise_id_idx
  on public.coach_program_exercises(exercise_id);
create index coach_program_revisions_created_by_idx
  on public.coach_program_revisions(created_by);
create index coach_assignment_updates_created_by_idx
  on public.coach_assignment_updates(created_by);
create index athlete_active_program_sessions_routine_id_idx
  on public.athlete_active_program_sessions(routine_id);
create index workouts_block_id_idx
  on public.workouts(block_id);
