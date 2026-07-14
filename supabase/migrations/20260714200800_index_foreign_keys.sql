drop index public.routine_exercises_routine_idx;
drop index public.workout_exercises_workout_idx;

create index routine_exercises_exercise_id_idx
  on public.routine_exercises(exercise_id);
create index routine_exercises_routine_user_idx
  on public.routine_exercises(routine_id, user_id);
create index routine_sets_exercise_user_idx
  on public.routine_sets(routine_exercise_id, user_id);

create index workout_exercises_exercise_id_idx
  on public.workout_exercises(exercise_id);
create index workout_exercises_workout_user_idx
  on public.workout_exercises(workout_id, user_id);
create index workout_sets_exercise_user_idx
  on public.workout_sets(workout_exercise_id, user_id);
