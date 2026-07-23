drop policy "coach_activation_resources_manage_coach"
  on public.coach_activation_resources;
create policy "coach_activation_resources_insert_coach"
  on public.coach_activation_resources for insert to authenticated
  with check (coach_id = (select auth.uid()));
create policy "coach_activation_resources_update_coach"
  on public.coach_activation_resources for update to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));
create policy "coach_activation_resources_delete_coach"
  on public.coach_activation_resources for delete to authenticated
  using (coach_id = (select auth.uid()));

drop policy "coach_activation_sections_manage_coach"
  on public.coach_activation_sections;
create policy "coach_activation_sections_insert_coach"
  on public.coach_activation_sections for insert to authenticated
  with check (
    exists (
      select 1
      from public.coach_activation_resources
      where coach_activation_resources.id = coach_activation_sections.resource_id
        and coach_activation_resources.coach_id = (select auth.uid())
    )
  );
create policy "coach_activation_sections_update_coach"
  on public.coach_activation_sections for update to authenticated
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
create policy "coach_activation_sections_delete_coach"
  on public.coach_activation_sections for delete to authenticated
  using (
    exists (
      select 1
      from public.coach_activation_resources
      where coach_activation_resources.id = coach_activation_sections.resource_id
        and coach_activation_resources.coach_id = (select auth.uid())
    )
  );

drop policy "coach_activation_items_manage_coach"
  on public.coach_activation_items;
create policy "coach_activation_items_insert_coach"
  on public.coach_activation_items for insert to authenticated
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
create policy "coach_activation_items_update_coach"
  on public.coach_activation_items for update to authenticated
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
create policy "coach_activation_items_delete_coach"
  on public.coach_activation_items for delete to authenticated
  using (
    exists (
      select 1
      from public.coach_activation_sections
      join public.coach_activation_resources
        on coach_activation_resources.id = coach_activation_sections.resource_id
      where coach_activation_sections.id = coach_activation_items.section_id
        and coach_activation_resources.coach_id = (select auth.uid())
    )
  );
