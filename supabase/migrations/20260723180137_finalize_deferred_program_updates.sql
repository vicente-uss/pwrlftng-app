create function private.finalize_deferred_program_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_weeks integer;
  selected_weeks integer;
  skipped_weeks integer;
begin
  if new.status <> 'applied' or old.status = 'applied' then
    return new;
  end if;

  select count(*)
  into total_weeks
  from public.coach_program_weeks
  join public.coach_program_assignments
    on coach_program_assignments.program_id = coach_program_weeks.program_id
  where coach_program_assignments.id = new.assignment_id;

  selected_weeks := coalesce(jsonb_array_length(new.selected_changes -> 'weekIds'), 0);
  skipped_weeks := coalesce(jsonb_array_length(new.selected_changes -> 'skippedWeekIds'), 0);

  if skipped_weeks = 0
    and (selected_weeks = 0 or selected_weeks = total_weeks)
    and coalesce(jsonb_array_length(new.deferred_changes -> 'weekIds'), 0) = 0
  then
    update public.coach_program_assignments
    set source_revision = greatest(source_revision, new.to_revision),
        last_synced_revision = greatest(last_synced_revision, new.to_revision)
    where id = new.assignment_id;
  end if;

  return new;
end;
$$;

create trigger coach_assignment_updates_finalize_deferred
  after update of status, deferred_changes
  on public.coach_assignment_updates
  for each row execute function private.finalize_deferred_program_update();

revoke execute on function private.finalize_deferred_program_update()
  from public, anon, authenticated;
