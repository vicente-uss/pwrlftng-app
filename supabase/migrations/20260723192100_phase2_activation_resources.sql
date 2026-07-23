create table public.coach_activation_resources (
  id text primary key,
  program_id text unique references public.coach_programs(id) on delete cascade,
  block_id text unique references public.coach_blocks(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid references auth.users(id) on delete cascade,
  title text not null default 'Activación',
  introduction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_activation_resources_target_check
    check ((program_id is not null)::integer + (block_id is not null)::integer = 1),
  constraint coach_activation_resources_owner_check
    check (
      (program_id is not null and athlete_id is null)
      or (block_id is not null and athlete_id is not null)
    ),
  constraint coach_activation_resources_title_check
    check (char_length(btrim(title)) between 1 and 100)
);

create table public.coach_activation_sections (
  id text primary key,
  resource_id text not null references public.coach_activation_resources(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  position smallint not null check (position >= 0),
  unique (resource_id, position)
);

create table public.coach_activation_items (
  id text primary key,
  section_id text not null references public.coach_activation_sections(id) on delete cascade,
  exercise_id text references public.exercises(id) on delete set null,
  movement_name text not null check (char_length(btrim(movement_name)) between 1 and 140),
  repetitions text,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 86400),
  rounds smallint check (rounds is null or rounds between 1 and 100),
  rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 7200),
  load_text text,
  equipment text,
  instructions text,
  notes text,
  video_url text,
  position smallint not null check (position >= 0),
  unique (section_id, position)
);

create index coach_activation_resources_coach_id_idx
  on public.coach_activation_resources(coach_id);
create index coach_activation_resources_athlete_id_idx
  on public.coach_activation_resources(athlete_id)
  where athlete_id is not null;
create index coach_activation_sections_resource_id_idx
  on public.coach_activation_sections(resource_id, position);
create index coach_activation_items_section_id_idx
  on public.coach_activation_items(section_id, position);
create index coach_activation_items_exercise_id_idx
  on public.coach_activation_items(exercise_id)
  where exercise_id is not null;

alter table public.coach_activation_resources enable row level security;
alter table public.coach_activation_sections enable row level security;
alter table public.coach_activation_items enable row level security;

create policy "coach_activation_resources_select_visible"
  on public.coach_activation_resources for select to authenticated
  using (
    coach_id = (select auth.uid())
    or athlete_id = (select auth.uid())
  );

create policy "coach_activation_resources_manage_coach"
  on public.coach_activation_resources for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));

create policy "coach_activation_sections_select_visible"
  on public.coach_activation_sections for select to authenticated
  using (
    exists (
      select 1
      from public.coach_activation_resources
      where coach_activation_resources.id = coach_activation_sections.resource_id
        and (
          coach_activation_resources.coach_id = (select auth.uid())
          or coach_activation_resources.athlete_id = (select auth.uid())
        )
    )
  );

create policy "coach_activation_sections_manage_coach"
  on public.coach_activation_sections for all to authenticated
  using (
    exists (
      select 1
      from public.coach_activation_resources
      where coach_activation_resources.id = coach_activation_sections.resource_id
        and coach_activation_resources.coach_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.coach_activation_resources
      where coach_activation_resources.id = coach_activation_sections.resource_id
        and coach_activation_resources.coach_id = (select auth.uid())
    )
  );

create policy "coach_activation_items_select_visible"
  on public.coach_activation_items for select to authenticated
  using (
    exists (
      select 1
      from public.coach_activation_sections
      join public.coach_activation_resources
        on coach_activation_resources.id = coach_activation_sections.resource_id
      where coach_activation_sections.id = coach_activation_items.section_id
        and (
          coach_activation_resources.coach_id = (select auth.uid())
          or coach_activation_resources.athlete_id = (select auth.uid())
        )
    )
  );

create policy "coach_activation_items_manage_coach"
  on public.coach_activation_items for all to authenticated
  using (
    exists (
      select 1
      from public.coach_activation_sections
      join public.coach_activation_resources
        on coach_activation_resources.id = coach_activation_sections.resource_id
      where coach_activation_sections.id = coach_activation_items.section_id
        and coach_activation_resources.coach_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.coach_activation_sections
      join public.coach_activation_resources
        on coach_activation_resources.id = coach_activation_sections.resource_id
      where coach_activation_sections.id = coach_activation_items.section_id
        and coach_activation_resources.coach_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.coach_activation_resources to authenticated;
grant select, insert, update, delete on public.coach_activation_sections to authenticated;
grant select, insert, update, delete on public.coach_activation_items to authenticated;

create function private.write_coach_activation(
  requested_program_id text,
  requested_block_id text,
  payload jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_resource_id text;
  target_coach_id uuid;
  target_athlete_id uuid;
  section_payload jsonb;
  item_payload jsonb;
  section_id text;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if (requested_program_id is null) = (requested_block_id is null) then
    raise exception using errcode = '22023', message = 'Select exactly one activation target';
  end if;
  if jsonb_typeof(payload) <> 'object'
    or jsonb_typeof(coalesce(payload -> 'sections', '[]'::jsonb)) <> 'array'
  then
    raise exception using errcode = '22023', message = 'Invalid activation payload';
  end if;

  if requested_program_id is not null then
    select coach_id
    into target_coach_id
    from public.coach_programs
    where id = requested_program_id
      and coach_id = caller_id
    for update;
  else
    select coach_id, athlete_id
    into target_coach_id, target_athlete_id
    from public.coach_blocks
    where id = requested_block_id
      and coach_id = caller_id
    for update;
  end if;

  if target_coach_id is null then
    raise exception using errcode = '42501', message = 'Activation target not found for coach';
  end if;

  select id
  into target_resource_id
  from public.coach_activation_resources
  where program_id is not distinct from requested_program_id
    and block_id is not distinct from requested_block_id
  for update;

  if target_resource_id is null then
    target_resource_id := 'activation-' || replace(gen_random_uuid()::text, '-', '');
    insert into public.coach_activation_resources (
      id, program_id, block_id, coach_id, athlete_id, title, introduction
    ) values (
      target_resource_id,
      requested_program_id,
      requested_block_id,
      target_coach_id,
      target_athlete_id,
      coalesce(nullif(btrim(payload ->> 'title'), ''), 'Activación'),
      nullif(btrim(payload ->> 'introduction'), '')
    );
  else
    update public.coach_activation_resources
    set title = coalesce(nullif(btrim(payload ->> 'title'), ''), 'Activación'),
        introduction = nullif(btrim(payload ->> 'introduction'), ''),
        updated_at = now()
    where id = target_resource_id;

    delete from public.coach_activation_sections
    where resource_id = target_resource_id;
  end if;

  for section_payload in
    select value
    from jsonb_array_elements(coalesce(payload -> 'sections', '[]'::jsonb))
  loop
    section_id := coalesce(
      nullif(section_payload ->> 'id', ''),
      'activation-section-' || replace(gen_random_uuid()::text, '-', '')
    );
    insert into public.coach_activation_sections (id, resource_id, name, position)
    values (
      section_id,
      target_resource_id,
      btrim(section_payload ->> 'name'),
      coalesce((section_payload ->> 'position')::smallint, 0)
    );

    for item_payload in
      select value
      from jsonb_array_elements(coalesce(section_payload -> 'items', '[]'::jsonb))
    loop
      insert into public.coach_activation_items (
        id, section_id, exercise_id, movement_name, repetitions,
        duration_seconds, rounds, rest_seconds, load_text, equipment,
        instructions, notes, video_url, position
      ) values (
        coalesce(
          nullif(item_payload ->> 'id', ''),
          'activation-item-' || replace(gen_random_uuid()::text, '-', '')
        ),
        section_id,
        nullif(item_payload ->> 'exerciseId', ''),
        btrim(item_payload ->> 'movementName'),
        nullif(btrim(item_payload ->> 'repetitions'), ''),
        nullif(item_payload ->> 'durationSeconds', '')::integer,
        nullif(item_payload ->> 'rounds', '')::smallint,
        nullif(item_payload ->> 'restSeconds', '')::integer,
        nullif(btrim(item_payload ->> 'loadText'), ''),
        nullif(btrim(item_payload ->> 'equipment'), ''),
        nullif(btrim(item_payload ->> 'instructions'), ''),
        nullif(btrim(item_payload ->> 'notes'), ''),
        nullif(btrim(item_payload ->> 'videoUrl'), ''),
        coalesce((item_payload ->> 'position')::smallint, 0)
      );
    end loop;
  end loop;

  return target_resource_id;
end;
$$;

create function public.save_coach_program_activation(
  p_program_id text,
  p_activation jsonb
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.write_coach_activation(p_program_id, null, p_activation);
$$;

create function public.save_coach_block_activation(
  p_block_id text,
  p_activation jsonb
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.write_coach_activation(null, p_block_id, p_activation);
$$;

create function private.copy_coach_activation_to_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_resource public.coach_activation_resources%rowtype;
  source_section public.coach_activation_sections%rowtype;
  source_item public.coach_activation_items%rowtype;
  target_resource_id text;
  target_section_id text;
begin
  select *
  into source_resource
  from public.coach_activation_resources
  where program_id = new.program_id;

  if not found then
    return new;
  end if;

  target_resource_id := 'assigned-activation-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.coach_activation_resources (
    id, block_id, coach_id, athlete_id, title, introduction
  ) values (
    target_resource_id, new.block_id, new.coach_id, new.athlete_id,
    source_resource.title, source_resource.introduction
  )
  on conflict (block_id) do nothing;

  if not found then
    return new;
  end if;

  for source_section in
    select *
    from public.coach_activation_sections
    where resource_id = source_resource.id
    order by position
  loop
    target_section_id := 'assigned-activation-section-' || replace(gen_random_uuid()::text, '-', '');
    insert into public.coach_activation_sections (id, resource_id, name, position)
    values (target_section_id, target_resource_id, source_section.name, source_section.position);

    for source_item in
      select *
      from public.coach_activation_items
      where section_id = source_section.id
      order by position
    loop
      insert into public.coach_activation_items (
        id, section_id, exercise_id, movement_name, repetitions,
        duration_seconds, rounds, rest_seconds, load_text, equipment,
        instructions, notes, video_url, position
      ) values (
        'assigned-activation-item-' || replace(gen_random_uuid()::text, '-', ''),
        target_section_id, source_item.exercise_id, source_item.movement_name,
        source_item.repetitions, source_item.duration_seconds, source_item.rounds,
        source_item.rest_seconds, source_item.load_text, source_item.equipment,
        source_item.instructions, source_item.notes, source_item.video_url,
        source_item.position
      );
    end loop;
  end loop;

  return new;
end;
$$;

create trigger coach_program_assignment_copy_activation
  after insert on public.coach_program_assignments
  for each row execute function private.copy_coach_activation_to_assignment();

create function private.copy_activation_on_program_duplicate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_resource public.coach_activation_resources%rowtype;
  source_section public.coach_activation_sections%rowtype;
  source_item public.coach_activation_items%rowtype;
  target_resource_id text;
  target_section_id text;
begin
  if new.source_program_id is null then
    return new;
  end if;
  select * into source_resource
  from public.coach_activation_resources
  where program_id = new.source_program_id;
  if not found then
    return new;
  end if;

  target_resource_id := 'activation-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.coach_activation_resources (
    id, program_id, coach_id, title, introduction
  ) values (
    target_resource_id, new.id, new.coach_id,
    source_resource.title, source_resource.introduction
  );

  for source_section in
    select * from public.coach_activation_sections
    where resource_id = source_resource.id order by position
  loop
    target_section_id := 'activation-section-' || replace(gen_random_uuid()::text, '-', '');
    insert into public.coach_activation_sections (id, resource_id, name, position)
    values (target_section_id, target_resource_id, source_section.name, source_section.position);
    for source_item in
      select * from public.coach_activation_items
      where section_id = source_section.id order by position
    loop
      insert into public.coach_activation_items (
        id, section_id, exercise_id, movement_name, repetitions,
        duration_seconds, rounds, rest_seconds, load_text, equipment,
        instructions, notes, video_url, position
      ) values (
        'activation-item-' || replace(gen_random_uuid()::text, '-', ''),
        target_section_id, source_item.exercise_id, source_item.movement_name,
        source_item.repetitions, source_item.duration_seconds, source_item.rounds,
        source_item.rest_seconds, source_item.load_text, source_item.equipment,
        source_item.instructions, source_item.notes, source_item.video_url,
        source_item.position
      );
    end loop;
  end loop;
  return new;
end;
$$;

create trigger coach_program_duplicate_copy_activation
  after insert on public.coach_programs
  for each row execute function private.copy_activation_on_program_duplicate();

revoke execute on function private.write_coach_activation(text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function private.copy_coach_activation_to_assignment()
  from public, anon, authenticated, service_role;
revoke execute on function private.copy_activation_on_program_duplicate()
  from public, anon, authenticated, service_role;
grant execute on function private.write_coach_activation(text, text, jsonb)
  to authenticated;
revoke all on function public.save_coach_program_activation(text, jsonb) from public, anon;
revoke all on function public.save_coach_block_activation(text, jsonb) from public, anon;
grant execute on function public.save_coach_program_activation(text, jsonb) to authenticated;
grant execute on function public.save_coach_block_activation(text, jsonb) to authenticated;
