revoke all privileges on table
  public.profiles,
  public.exercises,
  public.routines,
  public.routine_exercises,
  public.routine_sets,
  public.workouts,
  public.workout_exercises,
  public.workout_sets,
  public.deletion_tombstones
from public, anon;
