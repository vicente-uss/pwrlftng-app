alter table public.profiles
  add column role text not null default 'atleta',
  add column coach_id uuid references auth.users(id) on delete set null;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('atleta', 'coach'));

create index profiles_coach_id_idx
  on public.profiles(coach_id);

create table public.coach_invite_codes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  constraint coach_invite_codes_code_format_check
    check (char_length(code) between 6 and 12 and code ~ '^[A-Z0-9]+$')
);

create index coach_invite_codes_coach_id_idx
  on public.coach_invite_codes(coach_id);
create index coach_invite_codes_used_by_idx
  on public.coach_invite_codes(used_by);

create table public.coach_comments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  workout_id text references public.workouts(id) on delete set null,
  routine_id text references public.routines(id) on delete set null,
  comment text not null check (char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);

create index coach_comments_coach_id_idx
  on public.coach_comments(coach_id);
create index coach_comments_athlete_id_idx
  on public.coach_comments(athlete_id);
create index coach_comments_workout_id_idx
  on public.coach_comments(workout_id);
create index coach_comments_routine_id_idx
  on public.coach_comments(routine_id);

alter table public.coach_invite_codes enable row level security;
alter table public.coach_comments enable row level security;

create or replace function private.is_coach_of(athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles
      where id = $1
        and coach_id = (select auth.uid())
    );
$$;

create or replace function private.get_my_athletes()
returns table (
  athlete_id uuid,
  email text,
  body_weight numeric,
  height_cm smallint,
  goal text,
  level text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profiles.id as athlete_id,
    users.email::text as email,
    profiles.body_weight,
    profiles.height_cm,
    profiles.goal,
    profiles.level
  from public.profiles
  join auth.users on users.id = profiles.id
  where (select auth.uid()) is not null
    and profiles.coach_id = (select auth.uid())
  order by users.email nulls last, profiles.id;
$$;

create or replace function private.prevent_tombstoned_routine_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and (select auth.uid()) <> new.user_id
    and not private.is_coach_of(new.user_id)
  then
    raise exception 'Cannot write data owned by another user';
  end if;

  if exists (
    select 1
    from public.deletion_tombstones
    where user_id = new.user_id
      and entity_type = 'routine'
      and record_id = new.id
  ) then
    return null;
  end if;

  return new;
end;
$$;

create policy "profiles_select_coach"
  on public.profiles for select to authenticated
  using (private.is_coach_of(id));

create policy "coach_invite_codes_select_own"
  on public.coach_invite_codes for select to authenticated
  using ((select auth.uid()) = coach_id);

create policy "coach_invite_codes_insert_own"
  on public.coach_invite_codes for insert to authenticated
  with check (
    (select auth.uid()) = coach_id
    and used_by is null
    and used_at is null
  );

create policy "coach_comments_select_athlete"
  on public.coach_comments for select to authenticated
  using ((select auth.uid()) = athlete_id);

create policy "coach_comments_select_coach"
  on public.coach_comments for select to authenticated
  using (
    (select auth.uid()) = coach_id
    and (select private.is_coach_of(athlete_id))
  );

create policy "coach_comments_insert_coach"
  on public.coach_comments for insert to authenticated
  with check (
    (select auth.uid()) = coach_id
    and (select private.is_coach_of(athlete_id))
  );

create policy "coach_comments_update_coach"
  on public.coach_comments for update to authenticated
  using (
    (select auth.uid()) = coach_id
    and (select private.is_coach_of(athlete_id))
  )
  with check (
    (select auth.uid()) = coach_id
    and (select private.is_coach_of(athlete_id))
  );

create policy "coach_comments_delete_coach"
  on public.coach_comments for delete to authenticated
  using (
    (select auth.uid()) = coach_id
    and (select private.is_coach_of(athlete_id))
  );

create policy "routines_select_coach"
  on public.routines for select to authenticated
  using ((select private.is_coach_of(user_id)));

create policy "routines_insert_coach"
  on public.routines for insert to authenticated
  with check ((select private.is_coach_of(user_id)));

create policy "routines_update_coach"
  on public.routines for update to authenticated
  using ((select private.is_coach_of(user_id)))
  with check ((select private.is_coach_of(user_id)));

create policy "routine_exercises_select_coach"
  on public.routine_exercises for select to authenticated
  using ((select private.is_coach_of(user_id)));

create policy "routine_exercises_insert_coach"
  on public.routine_exercises for insert to authenticated
  with check ((select private.is_coach_of(user_id)));

create policy "routine_exercises_update_coach"
  on public.routine_exercises for update to authenticated
  using ((select private.is_coach_of(user_id)))
  with check ((select private.is_coach_of(user_id)));

create policy "routine_sets_select_coach"
  on public.routine_sets for select to authenticated
  using ((select private.is_coach_of(user_id)));

create policy "routine_sets_insert_coach"
  on public.routine_sets for insert to authenticated
  with check ((select private.is_coach_of(user_id)));

create policy "routine_sets_update_coach"
  on public.routine_sets for update to authenticated
  using ((select private.is_coach_of(user_id)))
  with check ((select private.is_coach_of(user_id)));

create policy "workouts_select_coach"
  on public.workouts for select to authenticated
  using ((select private.is_coach_of(user_id)));

create policy "workout_exercises_select_coach"
  on public.workout_exercises for select to authenticated
  using ((select private.is_coach_of(user_id)));

create policy "workout_sets_select_coach"
  on public.workout_sets for select to authenticated
  using ((select private.is_coach_of(user_id)));

create or replace function private.redeem_coach_code(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.coach_invite_codes%rowtype;
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  if $1 is null or btrim($1) = '' then
    raise exception 'Coach code is required';
  end if;

  select *
  into invite
  from public.coach_invite_codes
  where coach_invite_codes.code = upper(btrim($1))
  for update;

  if not found then
    raise exception 'Invalid coach code';
  end if;

  if invite.used_by is not null or invite.used_at is not null then
    raise exception 'Coach code has already been used';
  end if;

  if invite.expires_at is not null and invite.expires_at <= now() then
    raise exception 'Coach code has expired';
  end if;

  update public.profiles
  set role = 'coach'
  where id = invite.coach_id;

  if not found then
    raise exception 'Coach profile not found';
  end if;

  update public.profiles
  set coach_id = invite.coach_id
  where id = caller_id;

  if not found then
    raise exception 'Athlete profile not found';
  end if;

  update public.coach_invite_codes
  set used_by = caller_id,
      used_at = now()
  where id = invite.id;

  return invite.coach_id;
end;
$$;

create or replace function public.redeem_coach_code(code text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.redeem_coach_code($1);
$$;

create or replace function public.get_my_athletes()
returns table (
  athlete_id uuid,
  email text,
  body_weight numeric,
  height_cm smallint,
  goal text,
  level text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_my_athletes();
$$;

revoke all privileges on table
  public.coach_invite_codes,
  public.coach_comments
from public, anon;

grant select, insert on public.coach_invite_codes to authenticated;
grant select, insert, update, delete on public.coach_comments to authenticated;

revoke insert, update on public.profiles from authenticated;
grant insert (
  id,
  body_weight,
  height_cm,
  goal,
  level,
  default_rest_seconds,
  updated_at
) on public.profiles to authenticated;
grant update (
  id,
  body_weight,
  height_cm,
  goal,
  level,
  default_rest_seconds,
  updated_at
) on public.profiles to authenticated;

revoke execute on function private.is_coach_of(uuid) from public, anon, authenticated;
revoke execute on function private.get_my_athletes() from public, anon, authenticated;
revoke execute on function private.prevent_tombstoned_routine_write() from public, anon, authenticated;
revoke execute on function private.redeem_coach_code(text) from public, anon, authenticated;
revoke execute on function public.get_my_athletes() from public, anon, authenticated;
revoke execute on function public.redeem_coach_code(text) from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.is_coach_of(uuid) to authenticated;
grant execute on function private.get_my_athletes() to authenticated;
grant execute on function private.redeem_coach_code(text) to authenticated;
grant execute on function public.get_my_athletes() to authenticated;
grant execute on function public.redeem_coach_code(text) to authenticated;
