begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'phase0-coach@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'phase0-athlete@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'phase0-other-coach@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles
set role = 'coach'
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000003'
);

update public.profiles
set coach_id = '10000000-0000-0000-0000-000000000001'
where id = '10000000-0000-0000-0000-000000000002';

create function pg_temp.coach_program_payload(
  requested_block_id text,
  requested_block_name text,
  requested_routine_name text,
  requested_exercise_id text,
  include_draft_week boolean default true
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'block', jsonb_build_object(
      'id', requested_block_id,
      'name', requested_block_name,
      'goalText', 'Fuerza',
      'startDate', '2026-07-27',
      'totalWeeks', 2,
      'status', 'published',
      'currentWeekNumber', 1
    ),
    'weeks', jsonb_build_array(
      jsonb_build_object(
        'id', requested_block_id || '-week-1',
        'name', 'Semana 1',
        'weekNumber', 1,
        'isWarmup', false,
        'weekType', 'training',
        'status', 'published',
        'startDateOverride', null,
        'days', jsonb_build_array(
          jsonb_build_object(
            'id', requested_block_id || '-routine-1',
            'name', requested_routine_name,
            'trainingDay', 1,
            'effortMode', 'both',
            'prescriptionNotes', 'Técnica',
            'status', 'published',
            'exercises', jsonb_build_array(
              jsonb_build_object(
                'id', requested_block_id || '-exercise-1',
                'exerciseId', requested_exercise_id,
                'position', 0,
                'sets', jsonb_build_array(
                  jsonb_build_object(
                    'id', requested_block_id || '-set-1',
                    'position', 0,
                    'setType', 'working',
                    'weight', 130,
                    'repsMin', 5,
                    'repsMax', 6,
                    'rpe', 8,
                    'rir', 2
                  )
                )
              )
            )
          )
        )
      )
    ) || case
      when include_draft_week then jsonb_build_array(
        jsonb_build_object(
          'id', requested_block_id || '-week-2',
          'name', 'Semana 2',
          'weekNumber', 2,
          'isWarmup', false,
          'weekType', 'training',
          'status', 'draft',
          'startDateOverride', null,
          'days', jsonb_build_array(
            jsonb_build_object(
              'id', requested_block_id || '-routine-2',
              'name', 'Día futuro',
              'trainingDay', 1,
              'effortMode', 'rpe',
              'prescriptionNotes', null,
              'status', 'published',
              'exercises', jsonb_build_array()
            )
          )
        )
      )
      else '[]'::jsonb
    end
  );
$$;

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';

select lives_ok(
  $$
    select public.save_coach_program(
      '10000000-0000-0000-0000-000000000002',
      pg_temp.coach_program_payload('phase0-block', 'Mesociclo IV', 'Día 1', 'squat')
    )
  $$,
  'the coach creates the complete program tree'
);

select is(
  (select count(*)::integer from public.coach_blocks where id = 'phase0-block'),
  1,
  'creation persists one block'
);
select is(
  (select count(*)::integer from public.coach_block_weeks where block_id = 'phase0-block'),
  2,
  'creation persists all weeks'
);
select is(
  (select count(*)::integer from public.routines where block_week_id like 'phase0-block-week-%'),
  2,
  'creation persists all days'
);
select is(
  (select count(*)::integer from public.routine_exercises where routine_id = 'phase0-block-routine-1'),
  1,
  'creation persists all exercises'
);
select is(
  (select count(*)::integer from public.routine_sets where routine_exercise_id = 'phase0-block-exercise-1'),
  1,
  'creation persists all sets'
);

reset role;
insert into public.workouts (
  id,
  user_id,
  routine_id,
  routine_name,
  effort_mode,
  started_at,
  completed_at,
  duration_seconds,
  total_volume,
  sets_completed,
  block_id,
  block_week_id
)
values (
  'phase0-workout',
  '10000000-0000-0000-0000-000000000002',
  'phase0-block-routine-1',
  'Día 1',
  'both',
  now() - interval '1 hour',
  now(),
  3600,
  650,
  1,
  'phase0-block',
  'phase0-block-week-1'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';

select lives_ok(
  $$
    select public.save_coach_program(
      '10000000-0000-0000-0000-000000000002',
      pg_temp.coach_program_payload('phase0-block', 'Mesociclo editado', 'Día editado', 'bench', false)
    )
  $$,
  'the coach edits the complete tree atomically'
);
select is(
  (select name from public.coach_blocks where id = 'phase0-block'),
  'Mesociclo editado',
  'the block edit is visible'
);
select is(
  (select name from public.routines where id = 'phase0-block-routine-1'),
  'Día editado',
  'the routine edit is visible'
);
select is(
  (select exercise_id from public.routine_exercises where id = 'phase0-block-exercise-1'),
  'bench',
  'the replacement exercise is consistent'
);
select is(
  (select status from public.coach_block_weeks where id = 'phase0-block-week-2'),
  'archived',
  'a removed week is archived'
);
select is(
  (select routine_name from public.workouts where id = 'phase0-workout'),
  'Día 1',
  'a completed workout snapshot remains unchanged'
);

select throws_matching(
  $$
    select public.save_coach_program(
      '10000000-0000-0000-0000-000000000002',
      pg_temp.coach_program_payload('phase0-broken-create', 'No persistir', 'Día inválido', 'missing-exercise', false)
    )
  $$,
  '.*foreign key constraint.*',
  'a failing descendant aborts creation'
);
select is(
  (select count(*)::integer from public.coach_blocks where id = 'phase0-broken-create'),
  0,
  'creation rollback leaves no empty block'
);

select throws_matching(
  $$
    select public.save_coach_program(
      '10000000-0000-0000-0000-000000000002',
      pg_temp.coach_program_payload('phase0-block', 'No debe quedar', 'No debe quedar', 'missing-exercise', false)
    )
  $$,
  '.*foreign key constraint.*',
  'a failing descendant aborts an edit'
);
select is(
  (select name from public.coach_blocks where id = 'phase0-block'),
  'Mesociclo editado',
  'edit rollback restores the block'
);
select is(
  (select name from public.routines where id = 'phase0-block-routine-1'),
  'Día editado',
  'edit rollback restores the routine'
);

select lives_ok(
  $$
    select public.save_coach_program(
      '10000000-0000-0000-0000-000000000002',
      pg_temp.coach_program_payload('phase0-visibility', 'Visibilidad', 'Publicado', 'squat', true)
    )
  $$,
  'the coach can prepare published and draft weeks together'
);

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';
select throws_ok(
  $$
    select public.save_coach_program(
      '10000000-0000-0000-0000-000000000002',
      pg_temp.coach_program_payload('phase0-foreign', 'Ajeno', 'Ajeno', 'squat', false)
    )
  $$,
  '42501',
  'Coach can only manage assigned athletes',
  'another coach cannot manage the athlete'
);

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
select throws_ok(
  $$
    select public.save_coach_program(
      '10000000-0000-0000-0000-000000000002',
      pg_temp.coach_program_payload('phase0-self', 'Propio', 'Propio', 'squat', false)
    )
  $$,
  '42501',
  'Coach can only manage assigned athletes',
  'the athlete cannot invoke the coaching save'
);
select is(
  (select count(*)::integer from public.coach_blocks where id = 'phase0-block'),
  1,
  'the athlete reads a published block'
);
select is(
  (select count(*)::integer from public.coach_block_weeks where block_id = 'phase0-visibility' and status = 'draft'),
  0,
  'the athlete cannot read draft weeks'
);
select is(
  (select count(*)::integer from public.routines where id = 'phase0-visibility-routine-2'),
  0,
  'the athlete cannot read routines below a draft week'
);

select * from finish();
rollback;
