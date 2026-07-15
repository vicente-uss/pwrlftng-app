alter table public.exercises
  add column is_active boolean not null default true;

update public.exercises
set is_active = id in ('squat', 'bench', 'deadlift', 'ohp', 'curl', 'pushdown');

alter table public.routines
  add column effort_mode text not null default 'rpe';

alter table public.routines
  add constraint routines_effort_mode_check
  check (effort_mode in ('rpe', 'rir', 'both', 'none'));

alter table public.routine_sets
  add column reps_min smallint,
  add column reps_max smallint,
  add column rir numeric(3,1);

update public.routine_sets
set reps_min = reps,
    reps_max = reps;

alter table public.routine_sets
  alter column reps_min set not null,
  alter column reps_max set not null;

alter table public.routine_sets
  add constraint routine_sets_reps_range_check
    check (reps_min between 0 and 1000 and reps_max between 0 and 1000 and reps_min <= reps_max),
  add constraint routine_sets_rir_check
    check (rir between 0 and 10);

alter table public.workouts
  add column effort_mode text not null default 'rpe',
  add column notes text;

alter table public.workouts
  add constraint workouts_effort_mode_check
    check (effort_mode in ('rpe', 'rir', 'both', 'none')),
  add constraint workouts_notes_length_check
    check (char_length(notes) <= 2000);

alter table public.workout_exercises
  add column notes text;

alter table public.workout_exercises
  add constraint workout_exercises_notes_length_check
    check (char_length(notes) <= 2000);

alter table public.workout_sets
  add column target_reps_min smallint,
  add column target_reps_max smallint,
  add column rir numeric(3,1);

update public.workout_sets
set target_reps_min = reps,
    target_reps_max = reps;

alter table public.workout_sets
  alter column target_reps_min set not null,
  alter column target_reps_max set not null;

alter table public.workout_sets
  add constraint workout_sets_target_reps_range_check
    check (target_reps_min between 0 and 1000 and target_reps_max between 0 and 1000 and target_reps_min <= target_reps_max),
  add constraint workout_sets_rir_check
    check (rir between 0 and 10);
