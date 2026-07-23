begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'phase2-coach@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'phase2-athlete@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'phase2-other@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles
set role = 'coach'
where id in (
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000003'
);

update public.profiles
set coach_id = '30000000-0000-0000-0000-000000000001'
where id = '30000000-0000-0000-0000-000000000002';

select has_column('public', 'exercises', 'movement_family', 'exercise family is explicit');
select has_column('public', 'exercises', 'parent_exercise_id', 'exercise parent is explicit');
select has_column('public', 'exercises', 'creator_id', 'custom exercise creator is stored');
select has_column('public', 'exercises', 'archived_at', 'custom exercise can be archived');
select col_is_fk('public', 'exercises', 'parent_exercise_id', 'exercise parent is a foreign key');
select table_privs_are(
  'authenticated',
  'public',
  'coach_activation_resources',
  array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'authenticated receives explicit Data API privileges'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';

select lives_ok(
  $$ insert into public.exercises (
       id, name, muscle, is_system, movement_family, parent_exercise_id,
       category, creator_id
     ) values (
       'phase2-custom-squat', 'Tempo Squat', 'Piernas', false, 'squat',
       'squat', 'SBD', '30000000-0000-0000-0000-000000000001'
     ) $$,
  'coach creates a custom stable exercise variant'
);

select is(
  (select movement_family from public.exercises where id = 'phase2-custom-squat'),
  'squat',
  'custom family is not inferred from its name'
);

select lives_ok(
  $$ select public.save_coach_library_program(
    jsonb_build_object(
      'program', jsonb_build_object(
        'id', 'phase2-program',
        'kind', 'mesocycle',
        'name', 'Mesociclo con Activación',
        'status', 'ready'
      ),
      'weeks', jsonb_build_array(
        jsonb_build_object(
          'id', 'phase2-week',
          'name', 'Semana 1',
          'weekNumber', 1,
          'weekType', 'training',
          'status', 'published',
          'days', '[]'::jsonb
        )
      )
    )
  ) $$,
  'coach creates the mesocycle independently from activation'
);

select lives_ok(
  $$ select public.save_coach_program_activation(
    'phase2-program',
    jsonb_build_object(
      'title', 'Activación',
      'introduction', 'Lectura permanente',
      'sections', jsonb_build_array(
        jsonb_build_object(
          'id', 'phase2-section',
          'name', 'Pre squat',
          'position', 0,
          'items', jsonb_build_array(
            jsonb_build_object(
              'id', 'phase2-item',
              'movementName', '90/90 Hip lift',
              'repetitions', '5 por lado',
              'rounds', 2,
              'position', 0
            )
          )
        )
      )
    )
  ) $$,
  'coach saves activation atomically'
);

select is((select count(*) from public.coach_activation_resources where program_id = 'phase2-program'), 1::bigint, 'one activation resource belongs to the mesocycle');
select is((select count(*) from public.coach_activation_sections where id = 'phase2-section'), 1::bigint, 'activation stores ordered phases');
select is((select count(*) from public.coach_activation_items where id = 'phase2-item'), 1::bigint, 'activation stores movement detail');
select is((select count(*) from public.coach_program_weeks where program_id = 'phase2-program'), 1::bigint, 'activation does not create a week zero');

select lives_ok(
  $$ select public.assign_coach_program(
    'phase2-program',
    array['30000000-0000-0000-0000-000000000002'::uuid]
  ) $$,
  'assignment copies activation with the independent athlete copy'
);

set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000002';

select is(
  (select count(*) from public.coach_activation_resources where athlete_id = '30000000-0000-0000-0000-000000000002'),
  1::bigint,
  'athlete can read the assigned activation resource'
);
select is(
  (select count(*) from public.coach_activation_items),
  1::bigint,
  'athlete reads activation items through RLS'
);
select is(
  (select count(*) from public.workouts where user_id = '30000000-0000-0000-0000-000000000002'),
  0::bigint,
  'activation never creates workout history'
);

set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000003';
select is(
  (select count(*) from public.exercises where id = 'phase2-custom-squat'),
  0::bigint,
  'another coach cannot read private custom variants'
);

select * from finish();
rollback;
