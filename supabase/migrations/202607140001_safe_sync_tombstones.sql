create table public.deletion_tombstones (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('routine')),
  record_id text not null,
  deleted_at timestamptz not null,
  primary key (user_id, entity_type, record_id)
);

create index deletion_tombstones_user_deleted_idx
  on public.deletion_tombstones(user_id, deleted_at desc);

alter table public.deletion_tombstones enable row level security;

create policy "deletion_tombstones_select_own"
  on public.deletion_tombstones for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "deletion_tombstones_insert_own"
  on public.deletion_tombstones for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "deletion_tombstones_update_own"
  on public.deletion_tombstones for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.deletion_tombstones to authenticated;

create or replace function private.apply_deletion_tombstone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and (select auth.uid()) <> new.user_id then
    raise exception 'Cannot delete data owned by another user';
  end if;
  if new.entity_type = 'routine' then
    delete from public.routines
    where id = new.record_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger deletion_tombstones_apply
  after insert or update on public.deletion_tombstones
  for each row execute function private.apply_deletion_tombstone();

create or replace function private.prevent_tombstoned_routine_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and (select auth.uid()) <> new.user_id then
    raise exception 'Cannot write data owned by another user';
  end if;
  if exists (
    select 1 from public.deletion_tombstones
    where user_id = new.user_id
      and entity_type = 'routine'
      and record_id = new.id
  ) then
    return null;
  end if;
  return new;
end;
$$;

create trigger routines_prevent_tombstoned_write
  before insert or update on public.routines
  for each row execute function private.prevent_tombstoned_routine_write();

revoke execute on function private.apply_deletion_tombstone() from public, anon, authenticated;
revoke execute on function private.prevent_tombstoned_routine_write() from public, anon, authenticated;
