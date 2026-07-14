create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  body_weight numeric(6,2),
  height_cm smallint check (height_cm between 50 and 260),
  goal text not null default 'Fuerza máxima',
  level text not null default 'Intermedio',
  default_rest_seconds smallint not null default 180 check (default_rest_seconds between 0 and 900),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercises (
  id text primary key,
  name text not null,
  muscle text not null,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.routines (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  training_day smallint not null check (training_day between 1 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.routine_exercises (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id text not null,
  exercise_id text not null references public.exercises(id),
  position smallint not null check (position >= 0),
  unique (id, user_id),
  unique (routine_id, position),
  foreign key (routine_id, user_id) references public.routines(id, user_id) on delete cascade
);

create table public.routine_sets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_exercise_id text not null,
  position smallint not null check (position >= 0),
  set_type text not null check (set_type in ('warmup', 'working')),
  weight numeric(7,2) not null default 0 check (weight >= 0),
  reps smallint not null default 0 check (reps between 0 and 1000),
  rpe numeric(3,1) check (rpe between 1 and 10),
  unique (routine_exercise_id, position),
  foreign key (routine_exercise_id, user_id) references public.routine_exercises(id, user_id) on delete cascade
);

create table public.workouts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id text,
  routine_name text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  total_volume numeric(12,2) not null default 0 check (total_volume >= 0),
  sets_completed integer not null default 0 check (sets_completed >= 0),
  unique (id, user_id)
);

create table public.workout_exercises (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id text not null,
  exercise_id text not null references public.exercises(id),
  exercise_name text not null,
  muscle text not null,
  position smallint not null check (position >= 0),
  unique (id, user_id),
  unique (workout_id, position),
  foreign key (workout_id, user_id) references public.workouts(id, user_id) on delete cascade
);

create table public.workout_sets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_exercise_id text not null,
  position smallint not null check (position >= 0),
  set_type text not null check (set_type in ('warmup', 'working')),
  weight numeric(7,2) not null default 0 check (weight >= 0),
  reps smallint not null default 0 check (reps between 0 and 1000),
  rpe numeric(3,1) check (rpe between 1 and 10),
  completed boolean not null default false,
  completed_at timestamptz,
  unique (workout_exercise_id, position),
  foreign key (workout_exercise_id, user_id) references public.workout_exercises(id, user_id) on delete cascade
);

create index routines_user_id_idx on public.routines(user_id);
create index workouts_user_completed_idx on public.workouts(user_id, completed_at desc);
create index routine_exercises_routine_idx on public.routine_exercises(routine_id);
create index routine_exercises_user_id_idx on public.routine_exercises(user_id);
create index routine_sets_user_id_idx on public.routine_sets(user_id);
create index workout_exercises_workout_idx on public.workout_exercises(workout_id);
create index workout_exercises_user_id_idx on public.workout_exercises(user_id);
create index workout_sets_user_id_idx on public.workout_sets(user_id);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger routines_set_updated_at before update on public.routines for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.routine_sets enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "exercises_read_authenticated" on public.exercises for select to authenticated using (true);

create policy "routines_all_own" on public.routines for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "routine_exercises_all_own" on public.routine_exercises for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "routine_sets_all_own" on public.routine_sets for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workouts_all_own" on public.workouts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workout_exercises_all_own" on public.workout_exercises for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workout_sets_all_own" on public.workout_sets for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.exercises to authenticated;
grant select, insert, update on public.routines to authenticated;
grant select, insert, update on public.routine_exercises to authenticated;
grant select, insert, update on public.routine_sets to authenticated;
grant select, insert, update on public.workouts to authenticated;
grant select, insert, update on public.workout_exercises to authenticated;
grant select, insert, update on public.workout_sets to authenticated;

insert into public.exercises (id, name, muscle) values
  ('squat', 'Squat', 'Piernas'),
  ('bench', 'Bench Press', 'Pecho'),
  ('deadlift', 'Deadlift', 'Espalda'),
  ('row', 'Remo con barra', 'Espalda'),
  ('ohp', 'Overhead Press', 'Hombros'),
  ('rdl', 'Romanian Deadlift', 'Piernas'),
  ('pulldown', 'Lat Pulldown', 'Espalda'),
  ('leg-curl', 'Leg Curl', 'Piernas'),
  ('curl', 'Curl con barra', 'Bíceps'),
  ('pushdown', 'Tricep Pushdown', 'Tríceps')
on conflict (id) do update set name = excluded.name, muscle = excluded.muscle;
