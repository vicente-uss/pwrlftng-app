begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'phase1-coach@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'phase1-athlete@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'phase1-other@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles
set role = 'coach'
where id in (
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000003'
);

update public.profiles
set coach_id = '20000000-0000-0000-0000-000000000001'
where id = '20000000-0000-0000-0000-000000000002';

create function pg_temp.library_payload(day_name text, target_weight numeric)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'program', jsonb_build_object(
      'id', 'phase1-program',
      'kind', 'mesocycle',
      'name', 'Mesociclo IV',
      'goalText', 'Fuerza base',
      'startDate', null,
      'status', 'ready',
      'sourceProgramId', null
    ),
    'weeks', jsonb_build_array(
      jsonb_build_object(
        'id', 'phase1-program-week-1',
        'name', 'Semana 1',
        'weekNumber', 1,
        'weekType', 'training',
        'status', 'published',
        'startDateOverride', null,
        'days', jsonb_build_array(
          jsonb_build_object(
            'id', 'phase1-program-day-1',
            'name', day_name,
            'trainingDay', 1,
            'effortMode', 'both',
            'prescriptionNotes', 'Técnica',
            'status', 'published',
            'exercises', jsonb_build_array(
              jsonb_build_object(
                'id', 'phase1-program-exercise-1',
                'exerciseId', 'squat',
                'position', 0,
                'sets', jsonb_build_array(
                  jsonb_build_object(
                    'id', 'phase1-program-set-1',
                    'position', 0,
                    'setType', 'working',
                    'weight', target_weight,
                    'repsMin', 5,
                    'repsMax', 5,
                    'rpe', 8,
                    'rir', 2
                  )
                )
              )
            )
          )
        )
      )
    )
  );
$$;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';

select lives_ok(
  $$ select public.save_coach_library_program(pg_temp.library_payload('Día inicial', 130)) $$,
  'coach creates a normalized master program'
);
select is((select count(*)::integer from public.coach_programs where id = 'phase1-program'), 1, 'one master is stored');
select is((select count(*)::integer from public.coach_program_weeks where program_id = 'phase1-program'), 1, 'one master week is stored');
select is((select count(*)::integer from public.coach_program_days where id = 'phase1-program-day-1'), 1, 'one master day is stored');
select is((select revision from public.coach_programs where id = 'phase1-program'), 1, 'the initial revision is one');
select is((select count(*)::integer from public.coach_program_revisions where program_id = 'phase1-program'), 1, 'the initial snapshot is immutable');

select lives_ok(
  $$ select public.assign_coach_program('phase1-program', array['20000000-0000-0000-0000-000000000002'::uuid]) $$,
  'coach assigns an independent copy'
);
select is((select count(*)::integer from public.coach_program_assignments where program_id = 'phase1-program'), 1, 'assignment provenance is stored');
select is((select count(*)::integer from public.coach_blocks where name = 'Mesociclo IV' and athlete_id = '20000000-0000-0000-0000-000000000002'), 1, 'an athlete block copy is created');
select is((select count(*)::integer from public.coach_block_weeks where source_program_week_id = 'phase1-program-week-1'), 1, 'copy week points to the master');
select is((select count(*)::integer from public.routines where source_program_day_id = 'phase1-program-day-1' and archived_at is null), 1, 'copy day points to the master');

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.coach_programs where id = 'phase1-program'), 0, 'athlete cannot read the coach master');
select is((select count(*)::integer from public.coach_program_assignments where program_id = 'phase1-program'), 1, 'athlete can read their assignment metadata');
select lives_ok(
  $$
    select public.begin_athlete_program_session(
      'phase1-active-session',
      (select id from public.routines where source_program_day_id = 'phase1-program-day-1' and archived_at is null limit 1)
    )
  $$,
  'athlete registers an active assigned session'
);

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
select lives_ok(
  $$ select public.save_coach_library_program(pg_temp.library_payload('Día revisado', 135)) $$,
  'coach saves a second master revision'
);
select is((select revision from public.coach_programs where id = 'phase1-program'), 2, 'master revision increments');
select is((select count(*)::integer from public.coach_block_weeks where source_program_week_id = 'phase1-program-week-1'), 1, 'revision rebuild preserves copy provenance');
select lives_ok(
  $$
    select public.update_coach_program_assignments(
      'phase1-program',
      array['20000000-0000-0000-0000-000000000002'::uuid],
      array['phase1-program-week-1'],
      'replace'
    )
  $$,
  'coach requests a future-week update'
);
select is((select status from public.coach_assignment_updates order by created_at desc limit 1), 'deferred', 'active session defers the affected week');
select is((select name from public.routines where source_program_day_id = 'phase1-program-day-1' and archived_at is null limit 1), 'Día inicial', 'active prescription remains frozen');

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
select lives_ok(
  $$ select public.finish_athlete_program_session('phase1-active-session') $$,
  'finishing the session applies deferred changes'
);
select is((select name from public.routines where source_program_day_id = 'phase1-program-day-1' and archived_at is null limit 1), 'Día revisado', 'deferred prescription becomes visible after finish');
select is((select last_synced_revision from public.coach_program_assignments where program_id = 'phase1-program'), 2, 'assignment is marked synchronized after deferred apply');

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
update public.coach_block_weeks
set status = 'completed', completed_at = now()
where source_program_week_id = 'phase1-program-week-1';
select lives_ok(
  $$ select public.save_coach_library_program(pg_temp.library_payload('No reemplazar completado', 140)) $$,
  'coach saves a third master revision'
);
select lives_ok(
  $$
    select public.update_coach_program_assignments(
      'phase1-program',
      array['20000000-0000-0000-0000-000000000002'::uuid],
      array['phase1-program-week-1'],
      'replace'
    )
  $$,
  'update flow processes a completed-copy comparison'
);
select is((select name from public.routines where source_program_day_id = 'phase1-program-day-1' and archived_at is null limit 1), 'Día revisado', 'completed week remains frozen');
select is((select status from public.coach_assignment_updates order by created_at desc limit 1), 'partially_applied', 'completed week is reported as skipped');

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000003';
select throws_ok(
  $$ select public.assign_coach_program('phase1-program', array['20000000-0000-0000-0000-000000000002'::uuid]) $$,
  '42501',
  'Program not found for coach',
  'another coach cannot assign the master'
);

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
select throws_ok(
  $$ select public.set_coach_library_program_archived('phase1-program', true) $$,
  '42501',
  'Program not found for coach',
  'athlete cannot archive the coach master'
);

select * from finish();
rollback;
