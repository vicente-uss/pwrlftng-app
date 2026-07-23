-- Phase 1: provenance and lifecycle for independent athlete copies.

alter table public.coach_block_weeks
  add column source_program_week_id text
    references public.coach_program_weeks(id) on delete set null;

alter table public.routines
  add column source_program_day_id text
    references public.coach_program_days(id) on delete set null;

alter table public.routine_exercises
  add column source_program_exercise_id text
    references public.coach_program_exercises(id) on delete set null;

alter table public.routine_sets
  add column source_program_set_id text
    references public.coach_program_sets(id) on delete set null;

create index coach_block_weeks_source_program_week_idx
  on public.coach_block_weeks(source_program_week_id);
create index routines_source_program_day_idx
  on public.routines(source_program_day_id);
create index routine_exercises_source_program_exercise_idx
  on public.routine_exercises(source_program_exercise_id);
create index routine_sets_source_program_set_idx
  on public.routine_sets(source_program_set_id);

create table public.coach_program_assignments (
  id text primary key,
  coach_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  program_id text references public.coach_programs(id) on delete set null,
  block_id text not null unique references public.coach_blocks(id) on delete cascade,
  source_revision integer,
  last_synced_revision integer,
  status text not null default 'active',
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_program_assignments_status_check
    check (status in ('active', 'archived')),
  constraint coach_program_assignments_revision_check
    check (
      (source_revision is null and last_synced_revision is null)
      or (
        source_revision >= 1
        and last_synced_revision >= 1
        and last_synced_revision <= source_revision
      )
    )
);

create table public.coach_assignment_updates (
  id text primary key,
  assignment_id text not null references public.coach_program_assignments(id) on delete cascade,
  from_revision integer not null check (from_revision >= 1),
  to_revision integer not null check (to_revision >= 1),
  selected_changes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(selected_changes) = 'object'),
  customization_policy text not null,
  status text not null,
  deferred_changes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(deferred_changes) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  constraint coach_assignment_updates_policy_check
    check (customization_policy in ('keep', 'replace')),
  constraint coach_assignment_updates_status_check
    check (status in ('applied', 'partially_applied', 'deferred', 'failed')),
  constraint coach_assignment_updates_revision_order_check
    check (to_revision >= from_revision)
);

create table public.athlete_active_program_sessions (
  athlete_id uuid primary key references auth.users(id) on delete cascade,
  session_id text not null,
  routine_id text not null references public.routines(id) on delete cascade,
  block_week_id text not null references public.coach_block_weeks(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours'),
  constraint athlete_active_program_sessions_expiry_check
    check (expires_at > started_at)
);

create index coach_program_assignments_coach_program_idx
  on public.coach_program_assignments(coach_id, program_id, status);
create index coach_program_assignments_athlete_idx
  on public.coach_program_assignments(athlete_id, status, assigned_at desc);
create index coach_assignment_updates_assignment_idx
  on public.coach_assignment_updates(assignment_id, created_at desc);
create index coach_assignment_updates_deferred_idx
  on public.coach_assignment_updates(assignment_id, status)
  where status = 'deferred';
create index athlete_active_program_sessions_week_idx
  on public.athlete_active_program_sessions(block_week_id, expires_at);

create trigger coach_program_assignments_set_updated_at
  before update on public.coach_program_assignments
  for each row execute function private.set_updated_at();

insert into public.coach_program_assignments (
  id,
  coach_id,
  athlete_id,
  program_id,
  block_id,
  source_revision,
  last_synced_revision,
  status,
  assigned_at
)
select
  'legacy-assignment-' || replace(gen_random_uuid()::text, '-', ''),
  coach_blocks.coach_id,
  coach_blocks.athlete_id,
  null,
  coach_blocks.id,
  null,
  null,
  case when coach_blocks.status = 'archived' then 'archived' else 'active' end,
  coach_blocks.created_at
from public.coach_blocks;

alter table public.coach_program_assignments enable row level security;
alter table public.coach_assignment_updates enable row level security;
alter table public.athlete_active_program_sessions enable row level security;

create policy "coach_program_assignments_select_coach"
  on public.coach_program_assignments for select to authenticated
  using ((select auth.uid()) = coach_id);

create policy "coach_program_assignments_select_athlete"
  on public.coach_program_assignments for select to authenticated
  using ((select auth.uid()) = athlete_id);

create policy "coach_assignment_updates_select_coach"
  on public.coach_assignment_updates for select to authenticated
  using (
    exists (
      select 1 from public.coach_program_assignments
      where coach_program_assignments.id = coach_assignment_updates.assignment_id
        and coach_program_assignments.coach_id = (select auth.uid())
    )
  );

create policy "athlete_active_program_sessions_select_own"
  on public.athlete_active_program_sessions for select to authenticated
  using ((select auth.uid()) = athlete_id);

create policy "athlete_active_program_sessions_select_coach"
  on public.athlete_active_program_sessions for select to authenticated
  using ((select private.is_coach_of(athlete_id)));

revoke all privileges on table
  public.coach_program_assignments,
  public.coach_assignment_updates,
  public.athlete_active_program_sessions
from public, anon, authenticated;

grant select on table
  public.coach_program_assignments,
  public.coach_assignment_updates,
  public.athlete_active_program_sessions
to authenticated;

grant select (
  source_program_week_id
) on public.coach_block_weeks to authenticated;
grant select (
  source_program_day_id
) on public.routines to authenticated;
grant select (
  source_program_exercise_id
) on public.routine_exercises to authenticated;
grant select (
  source_program_set_id
) on public.routine_sets to authenticated;
