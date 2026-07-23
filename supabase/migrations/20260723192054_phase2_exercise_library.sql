alter table public.exercises
  add column movement_family text,
  add column parent_exercise_id text references public.exercises(id) on delete set null,
  add column category text not null default 'General',
  add column creator_id uuid references auth.users(id) on delete set null,
  add column archived_at timestamptz,
  add column updated_at timestamptz not null default now();

alter table public.exercises
  add constraint exercises_movement_family_check
  check (movement_family is null or movement_family in ('squat', 'bench', 'deadlift', 'other'));

alter table public.exercises
  add constraint exercises_custom_creator_check
  check (is_system or creator_id is not null);

update public.exercises
set movement_family = case id
      when 'squat' then 'squat'
      when 'bench' then 'bench'
      when 'deadlift' then 'deadlift'
      when 'rdl' then 'deadlift'
      else 'other'
    end,
    parent_exercise_id = case id
      when 'rdl' then 'deadlift'
      else null
    end,
    category = case id
      when 'squat' then 'SBD'
      when 'bench' then 'SBD'
      when 'deadlift' then 'SBD'
      when 'rdl' then 'SBD'
      else muscle
    end,
    updated_at = now();

create index exercises_creator_id_idx
  on public.exercises(creator_id)
  where creator_id is not null;
create index exercises_parent_exercise_id_idx
  on public.exercises(parent_exercise_id)
  where parent_exercise_id is not null;
create index exercises_movement_family_active_idx
  on public.exercises(movement_family, name)
  where archived_at is null;

drop policy "exercises_read_authenticated" on public.exercises;

create policy "exercises_select_visible"
  on public.exercises for select to authenticated
  using (
    is_system
    or creator_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.coach_id = exercises.creator_id
    )
  );

create policy "exercises_insert_custom_own"
  on public.exercises for insert to authenticated
  with check (
    not is_system
    and creator_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'coach'
    )
  );

create policy "exercises_update_custom_own"
  on public.exercises for update to authenticated
  using (
    not is_system
    and creator_id = (select auth.uid())
  )
  with check (
    not is_system
    and creator_id = (select auth.uid())
  );

grant select, insert, update on public.exercises to authenticated;
