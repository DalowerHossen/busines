-- supabase/migrations/00220_create_site_content_admin.sql
-- Editing the public website without editing the code.
--
-- On an edit a value left out is left alone, and a value sent empty is
-- cleared. Anything else means that editing one field quietly wipes the six
-- the editor did not send.
--
-- A marketing page, the words on it, the title a search engine shows, the
-- address it lives at: none of these are engineering decisions, and all of
-- them change more often than the software does. They are data, and this
-- file is the small set of operations that keeps them honest.
--
-- The address history matters as much as the page. When a page moves, the
-- old address has to keep working or every link anybody ever shared breaks
-- and the search ranking that came with them is thrown away. So moving a
-- page writes the redirect for you rather than trusting somebody to
-- remember.

create or replace function public.save_site_page(
  p_slug text,
  p_title text,
  p_page_type text default 'marketing',
  p_page_id uuid default null,
  p_content_blocks jsonb default '[]'::jsonb,
  p_excerpt text default null,
  p_meta_title text default null,
  p_meta_description text default null,
  p_canonical_url text default null,
  p_open_graph_title text default null,
  p_open_graph_description text default null,
  p_open_graph_image_url text default null,
  p_robots_directive text default 'index,follow',
  p_sitemap_priority numeric default 0.5,
  p_sitemap_change_frequency text default 'monthly',
  p_show_in_navigation boolean default false,
  p_navigation_label text default null,
  p_navigation_order integer default 100
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_page_id uuid;
  v_old_slug text;
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may edit the public website'
      using errcode = '42501';
  end if;

  if p_page_id is null then
    insert into public.site_pages (
      slug, title, page_type, content_blocks, excerpt, meta_title, meta_description,
      canonical_url, open_graph_title, open_graph_description, open_graph_image_url,
      robots_directive, sitemap_priority, sitemap_change_frequency,
      show_in_navigation, navigation_label, navigation_order, created_by, updated_by
    )
    values (
      lower(btrim(p_slug)), btrim(p_title), p_page_type,
      coalesce(p_content_blocks, '[]'::jsonb),
      nullif(btrim(coalesce(p_excerpt, '')), ''),
      nullif(btrim(coalesce(p_meta_title, '')), ''),
      nullif(btrim(coalesce(p_meta_description, '')), ''),
      nullif(btrim(coalesce(p_canonical_url, '')), ''),
      nullif(btrim(coalesce(p_open_graph_title, '')), ''),
      nullif(btrim(coalesce(p_open_graph_description, '')), ''),
      nullif(btrim(coalesce(p_open_graph_image_url, '')), ''),
      coalesce(p_robots_directive, 'index,follow'),
      coalesce(p_sitemap_priority, 0.5),
      coalesce(p_sitemap_change_frequency, 'monthly'),
      coalesce(p_show_in_navigation, false),
      nullif(btrim(coalesce(p_navigation_label, '')), ''),
      coalesce(p_navigation_order, 100)::smallint,
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_page_id;

    return v_page_id;
  end if;

  select slug into v_old_slug
    from public.site_pages
   where id = p_page_id
     and deleted_at is null;

  if v_old_slug is null then
    raise exception 'That page was not found' using errcode = 'P0002';
  end if;

  update public.site_pages
     set slug = lower(btrim(p_slug)),
         title = btrim(p_title),
         page_type = p_page_type,
         content_blocks = coalesce(p_content_blocks, content_blocks),
         excerpt = case
                        when p_excerpt is null then excerpt
                        else nullif(btrim(p_excerpt), '')
                      end,
         meta_title = case
                        when p_meta_title is null then meta_title
                        else nullif(btrim(p_meta_title), '')
                      end,
         meta_description = case
                        when p_meta_description is null then meta_description
                        else nullif(btrim(p_meta_description), '')
                      end,
         canonical_url = case
                        when p_canonical_url is null then canonical_url
                        else nullif(btrim(p_canonical_url), '')
                      end,
         open_graph_title = case
                        when p_open_graph_title is null then open_graph_title
                        else nullif(btrim(p_open_graph_title), '')
                      end,
         open_graph_description = case
                        when p_open_graph_description is null then open_graph_description
                        else nullif(btrim(p_open_graph_description), '')
                      end,
         open_graph_image_url = case
                        when p_open_graph_image_url is null then open_graph_image_url
                        else nullif(btrim(p_open_graph_image_url), '')
                      end,
         robots_directive = coalesce(p_robots_directive, robots_directive),
         sitemap_priority = coalesce(p_sitemap_priority, sitemap_priority),
         sitemap_change_frequency =
           coalesce(p_sitemap_change_frequency, sitemap_change_frequency),
         show_in_navigation = coalesce(p_show_in_navigation, show_in_navigation),
         navigation_label = case
                        when p_navigation_label is null then navigation_label
                        else nullif(btrim(p_navigation_label), '')
                      end,
         navigation_order = coalesce(p_navigation_order, navigation_order)::smallint,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_page_id;

  -- Moving a page keeps the old address alive. Nobody has to remember to do
  -- this, which is the only reason it will actually happen.
  if v_old_slug is distinct from lower(btrim(p_slug)) then
    insert into public.url_redirects (
      source_path, target_path, status_code, reason, created_by
    )
    values (
      '/' || v_old_slug, '/' || lower(btrim(p_slug)), 301,
      'The page was moved in the website editor', public.current_user_id()
    )
    on conflict do nothing;
  end if;

  return p_page_id;
end;
$$;

comment on function public.save_site_page(
  text, text, text, uuid, jsonb, text, text, text, text, text, text, text,
  text, numeric, text, boolean, text, integer
) is 'Creates or edits a public page, keeping the old address alive when it moves.';

create or replace function public.publish_site_page(
  p_page_id uuid,
  p_is_published boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may publish a page' using errcode = '42501';
  end if;

  update public.site_pages
     set is_published = p_is_published,
         published_at = case
                          when p_is_published then coalesce(published_at, now())
                          else published_at
                        end,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_page_id
     and deleted_at is null;

  return found;
end;
$$;

comment on function public.publish_site_page(uuid, boolean) is
  'Puts a page in front of the public, or takes it back out of sight.';

create or replace function public.delete_site_page(p_page_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text;
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may remove a page' using errcode = '42501';
  end if;

  select slug into v_slug
    from public.site_pages
   where id = p_page_id
     and deleted_at is null;

  if v_slug is null then
    return false;
  end if;

  update public.site_pages
     set is_published = false,
         deleted_at = now(),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_page_id;

  -- A removed page should not become a dead end; the home page is the
  -- honest destination until somebody says otherwise.
  insert into public.url_redirects (
    source_path, target_path, status_code, reason, created_by
  )
  values (
    '/' || v_slug, '/', 301, 'The page was removed in the website editor',
    public.current_user_id()
  )
  on conflict do nothing;

  return true;
end;
$$;

comment on function public.delete_site_page(uuid) is
  'Takes a page down and points its address somewhere real.';

create or replace function public.site_page_list(p_include_drafts boolean default true)
returns table (
  page_id uuid,
  slug text,
  title text,
  page_type text,
  is_published boolean,
  show_in_navigation boolean,
  navigation_order smallint,
  meta_title text,
  meta_description text,
  robots_directive text,
  sitemap_priority numeric,
  view_count bigint,
  updated_at timestamptz,
  seo_warning text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the website editor'
      using errcode = '42501';
  end if;

  return query
    select p.id,
           p.slug,
           p.title,
           p.page_type,
           p.is_published,
           p.show_in_navigation,
           p.navigation_order,
           p.meta_title,
           p.meta_description,
           p.robots_directive,
           p.sitemap_priority,
           p.view_count,
           p.updated_at,
           -- Said once, here, rather than in three screens that disagree.
           case
             when p.meta_title is null then 'No title for search results'
             when p.meta_description is null then 'No description for search results'
             when p.is_published and p.robots_directive not like 'index%'
               then 'Published but hidden from search engines'
             else null
           end
      from public.site_pages as p
     where p.deleted_at is null
       and (p_include_drafts or p.is_published)
     order by p.page_type, p.navigation_order, p.slug;
end;
$$;

comment on function public.site_page_list(boolean) is
  'Lists the pages of the public website with anything wrong with their metadata.';

-- One published page, for the renderer. Readable without an account because
-- that is the entire point of a public page.
create or replace function public.published_site_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'page_id', p.id,
           'slug', p.slug,
           'title', p.title,
           'page_type', p.page_type,
           'content_blocks', p.content_blocks,
           'excerpt', p.excerpt,
           'meta_title', p.meta_title,
           'meta_description', p.meta_description,
           'canonical_url', p.canonical_url,
           'open_graph_title', p.open_graph_title,
           'open_graph_description', p.open_graph_description,
           'open_graph_image_url', p.open_graph_image_url,
           'structured_data', p.structured_data,
           'robots_directive', p.robots_directive,
           'published_at', p.published_at,
           'updated_at', p.updated_at
         )
    from public.site_pages as p
   where p.slug = lower(btrim(p_slug))
     and p.is_published
     and p.deleted_at is null;
$$;

comment on function public.published_site_page(text) is
  'Returns one published page for the renderer, or nothing when it is not public.';

-- -----------------------------------------------------------------------------
-- Addresses the site used to serve
-- -----------------------------------------------------------------------------

create or replace function public.save_url_redirect(
  p_source_path text,
  p_target_path text,
  p_status_code integer default 301,
  p_reason text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may change the redirects'
      using errcode = '42501';
  end if;

  if lower(btrim(p_source_path)) = lower(btrim(p_target_path)) then
    raise exception 'An address cannot redirect to itself' using errcode = '22023';
  end if;

  -- A chain of redirects loses both visitors and ranking, so a rule that
  -- would start one is refused and the destination is named.
  if exists (
    select 1 from public.url_redirects
     where source_path = btrim(p_target_path)
       and is_active
  ) then
    raise exception 'That destination is itself redirected; point at the final address'
      using errcode = '22023';
  end if;

  update public.url_redirects
     set is_active = false, updated_at = now()
   where source_path = btrim(p_source_path)
     and is_active;

  insert into public.url_redirects (
    source_path, target_path, status_code, reason, created_by
  )
  values (
    btrim(p_source_path), btrim(p_target_path), coalesce(p_status_code, 301)::smallint,
    nullif(btrim(coalesce(p_reason, '')), ''), public.current_user_id()
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.save_url_redirect(text, text, integer, text) is
  'Points an old address at a new one, refusing anything that would start a chain.';

create or replace function public.remove_url_redirect(p_redirect_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may change the redirects'
      using errcode = '42501';
  end if;

  update public.url_redirects
     set is_active = false, updated_at = now()
   where id = p_redirect_id;

  return found;
end;
$$;

comment on function public.remove_url_redirect(uuid) is
  'Retires a redirect, leaving the record of how often it was used.';

create or replace function public.url_redirect_list()
returns table (
  redirect_id uuid,
  source_path text,
  target_path text,
  status_code smallint,
  reason text,
  is_active boolean,
  hit_count bigint,
  last_hit_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the redirects'
      using errcode = '42501';
  end if;

  return query
    select r.id, r.source_path, r.target_path, r.status_code, r.reason,
           r.is_active, r.hit_count, r.last_hit_at
      from public.url_redirects as r
     order by r.is_active desc, r.hit_count desc, r.source_path;
end;
$$;

comment on function public.url_redirect_list() is
  'Lists the redirects and how much traffic each one is actually carrying.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.save_site_page(
  text, text, text, uuid, jsonb, text, text, text, text, text, text, text,
  text, numeric, text, boolean, text, integer
) from public, authenticated;
revoke execute on function public.publish_site_page(uuid, boolean)
  from public, authenticated;
revoke execute on function public.delete_site_page(uuid)
  from public, authenticated;
revoke execute on function public.site_page_list(boolean)
  from public, authenticated;
revoke execute on function public.save_url_redirect(text, text, integer, text)
  from public, authenticated;
revoke execute on function public.remove_url_redirect(uuid)
  from public, authenticated;
revoke execute on function public.url_redirect_list()
  from public, authenticated;

grant execute on function public.save_site_page(
  text, text, text, uuid, jsonb, text, text, text, text, text, text, text,
  text, numeric, text, boolean, text, integer
) to authenticated, service_role;
grant execute on function public.publish_site_page(uuid, boolean)
  to authenticated, service_role;
grant execute on function public.delete_site_page(uuid)
  to authenticated, service_role;
grant execute on function public.site_page_list(boolean)
  to authenticated, service_role;
grant execute on function public.published_site_page(text)
  to anon, authenticated, service_role;
grant execute on function public.save_url_redirect(text, text, integer, text)
  to authenticated, service_role;
grant execute on function public.remove_url_redirect(uuid)
  to authenticated, service_role;
grant execute on function public.url_redirect_list()
  to authenticated, service_role;
