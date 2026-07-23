begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select has_column('public', 'routine_sets', 'effort_linked', 'routine prescription stores linked state');
select has_column('public', 'coach_program_sets', 'effort_linked', 'library prescription stores linked state');
select has_column('public', 'workout_sets', 'prescribed_weight', 'execution preserves prescribed weight');
select has_column('public', 'workout_sets', 'prescribed_rpe', 'execution preserves prescribed RPE');
select has_column('public', 'workout_sets', 'prescribed_rir', 'execution preserves prescribed RIR');
select has_column('public', 'workout_sets', 'actual_rpe', 'execution stores actual RPE separately');
select has_column('public', 'workout_sets', 'actual_rir', 'execution stores actual RIR separately');
select has_column('public', 'workout_sets', 'estimated_1rm', 'set estimate is persisted');
select has_column('public', 'workout_sets', 'estimate_confidence', 'estimate confidence is persisted');
select has_column('public', 'workout_exercises', 'best_e1rm', 'best session exposure is persisted');
select has_column('public', 'workout_exercises', 'best_e1rm_confidence', 'best exposure confidence is persisted');

select has_function('public', 'save_coach_program_v3', array['uuid', 'jsonb'], 'athlete save wrapper exists');
select has_function('public', 'save_coach_library_program_v3', array['jsonb'], 'library save wrapper exists');
select has_function('public', 'assign_coach_program_v3', array['text', 'uuid[]'], 'assignment wrapper exists');
select has_function('public', 'update_coach_program_assignments_v3', array['text', 'uuid[]', 'text[]', 'text'], 'update wrapper exists');

select function_privs_are(
  'authenticated',
  'public',
  'save_coach_program_v3',
  array['uuid', 'jsonb'],
  array['EXECUTE'],
  'only authenticated users execute athlete save'
);
select function_privs_are(
  'anon',
  'public',
  'save_coach_program_v3',
  array['uuid', 'jsonb'],
  array[]::text[],
  'anonymous users cannot execute athlete save'
);
select function_privs_are(
  'authenticated',
  'public',
  'assign_coach_program_v3',
  array['text', 'uuid[]'],
  array['EXECUTE'],
  'only authenticated users execute assignment'
);
select function_privs_are(
  'anon',
  'public',
  'assign_coach_program_v3',
  array['text', 'uuid[]'],
  array[]::text[],
  'anonymous users cannot execute assignment'
);

select * from finish();
rollback;
