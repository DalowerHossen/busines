-- supabase/migrations/00160_enable_rls_marketing.sql
-- Row level security for the site, campaigns, experiments and social content.
--
-- The marketing site is public: the anonymous role may read a published page,
-- a published landing page and an approved testimonial, because that is the
-- whole point of them. Everything behind that is either platform work or
-- tenant work, and never visible across a tenant boundary.

alter table public.site_pages enable row level security;
alter table public.url_redirects enable row level security;
alter table public.cookie_consents enable row level security;
alter table public.site_events enable row level security;
alter table public.landing_pages enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_variants enable row level security;
alter table public.experiment_assignments enable row level security;
alter table public.marketing_segments enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.campaign_steps enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.marketing_subscriptions enable row level security;
alter table public.social_channels enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_post_targets enable row level security;
alter table public.social_auto_rules enable row level security;
alter table public.review_requests enable row level security;
alter table public.testimonials enable row level security;

alter table public.site_pages force row level security;
alter table public.url_redirects force row level security;
alter table public.cookie_consents force row level security;
alter table public.site_events force row level security;
alter table public.landing_pages force row level security;
alter table public.experiments force row level security;
alter table public.experiment_variants force row level security;
alter table public.experiment_assignments force row level security;
alter table public.marketing_segments force row level security;
alter table public.marketing_campaigns force row level security;
alter table public.campaign_steps force row level security;
alter table public.campaign_recipients force row level security;
alter table public.marketing_subscriptions force row level security;
alter table public.social_channels force row level security;
alter table public.social_posts force row level security;
alter table public.social_post_targets force row level security;
alter table public.social_auto_rules force row level security;
alter table public.review_requests force row level security;
alter table public.testimonials force row level security;

-- -----------------------------------------------------------------------------
-- The public site
-- -----------------------------------------------------------------------------

create policy site_pages_public_select on public.site_pages
  for select to anon, authenticated
  using (is_published and deleted_at is null);

create policy site_pages_admin_select on public.site_pages
  for select to authenticated
  using (public.is_super_admin());

create policy site_pages_insert on public.site_pages
  for insert to authenticated
  with check (public.is_super_admin());

create policy site_pages_update on public.site_pages
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy url_redirects_public_select on public.url_redirects
  for select to anon, authenticated
  using (is_active);

create policy url_redirects_insert on public.url_redirects
  for insert to authenticated
  with check (public.is_super_admin());

create policy url_redirects_update on public.url_redirects
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy landing_pages_public_select on public.landing_pages
  for select to anon, authenticated
  using (is_published and deleted_at is null);

create policy landing_pages_admin_select on public.landing_pages
  for select to authenticated
  using (public.is_super_admin());

create policy landing_pages_insert on public.landing_pages
  for insert to authenticated
  with check (public.is_super_admin());

create policy landing_pages_update on public.landing_pages
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy testimonials_public_select on public.testimonials
  for select to anon, authenticated
  using (is_approved and deleted_at is null);

create policy testimonials_owner_select on public.testimonials
  for select to authenticated
  using (
    deleted_at is null
    and (
      (company_id is not null and public.has_company_access(company_id))
      or public.is_super_admin()
    )
  );

create policy testimonials_insert on public.testimonials
  for insert to authenticated
  with check (
    (company_id is not null and public.is_company_owner(company_id))
    or public.is_super_admin()
  );

create policy testimonials_update on public.testimonials
  for update to authenticated
  using (
    (company_id is not null and public.is_company_owner(company_id))
    or public.is_super_admin()
  )
  with check (
    (company_id is not null and public.is_company_owner(company_id))
    or public.is_super_admin()
  );

-- -----------------------------------------------------------------------------
-- Measurement
-- -----------------------------------------------------------------------------

-- A visitor record belongs to nobody, so nobody but the platform team reads
-- it. The banner writes through its routine, which runs as its owner.
create policy cookie_consents_select on public.cookie_consents
  for select to authenticated
  using (public.is_super_admin() or user_id = public.current_user_id());

create policy site_events_select on public.site_events
  for select to authenticated
  using (public.is_super_admin());

create policy experiments_select on public.experiments
  for select to authenticated
  using (public.is_super_admin());

create policy experiments_insert on public.experiments
  for insert to authenticated
  with check (public.is_super_admin());

create policy experiments_update on public.experiments
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy experiment_variants_select on public.experiment_variants
  for select to authenticated
  using (public.is_super_admin());

create policy experiment_variants_insert on public.experiment_variants
  for insert to authenticated
  with check (public.is_super_admin());

create policy experiment_variants_update on public.experiment_variants
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy experiment_assignments_select on public.experiment_assignments
  for select to authenticated
  using (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- Campaigns
-- -----------------------------------------------------------------------------

-- A tenant campaign is the tenant's business. A platform campaign is not.
create policy marketing_segments_select on public.marketing_segments
  for select to authenticated
  using (
    deleted_at is null
    and (
      (company_id is not null and public.has_company_access(company_id))
      or (company_id is null and public.is_super_admin())
    )
  );

create policy marketing_segments_insert on public.marketing_segments
  for insert to authenticated
  with check (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy marketing_segments_update on public.marketing_segments
  for update to authenticated
  using (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  )
  with check (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy marketing_campaigns_select on public.marketing_campaigns
  for select to authenticated
  using (
    deleted_at is null
    and (
      (company_id is not null and public.has_company_access(company_id))
      or (company_id is null and public.is_super_admin())
    )
  );

-- Writing to clients is an owner act, exactly like sending them an invoice.
create policy marketing_campaigns_insert on public.marketing_campaigns
  for insert to authenticated
  with check (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy marketing_campaigns_update on public.marketing_campaigns
  for update to authenticated
  using (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  )
  with check (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy campaign_steps_select on public.campaign_steps
  for select to authenticated
  using (
    (company_id is not null and public.has_company_access(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy campaign_steps_insert on public.campaign_steps
  for insert to authenticated
  with check (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy campaign_steps_update on public.campaign_steps
  for update to authenticated
  using (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  )
  with check (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy campaign_recipients_select on public.campaign_recipients
  for select to authenticated
  using (
    (company_id is not null and public.has_company_access(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy marketing_subscriptions_select on public.marketing_subscriptions
  for select to authenticated
  using (
    (company_id is not null and public.has_company_access(company_id))
    or (company_id is null and public.is_super_admin())
  );

-- -----------------------------------------------------------------------------
-- Social content
-- -----------------------------------------------------------------------------

-- The token column is kept out of reach by the column grants, so the policy
-- only has to decide who sees the account at all.
create policy social_channels_select on public.social_channels
  for select to authenticated
  using (
    deleted_at is null
    and (
      (company_id is not null and public.has_company_access(company_id))
      or (company_id is null and public.is_super_admin())
    )
  );

create policy social_channels_insert on public.social_channels
  for insert to authenticated
  with check (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy social_channels_update on public.social_channels
  for update to authenticated
  using (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  )
  with check (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy social_posts_select on public.social_posts
  for select to authenticated
  using (
    deleted_at is null
    and (
      (company_id is not null and public.has_company_access(company_id))
      or (company_id is null and public.is_super_admin())
    )
  );

-- Staff may write a post. Only an owner may schedule it, which is enforced
-- by the scheduling routine rather than by this policy.
create policy social_posts_insert on public.social_posts
  for insert to authenticated
  with check (
    (company_id is not null and public.can_write_company_data(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy social_posts_update on public.social_posts
  for update to authenticated
  using (
    (company_id is not null and public.can_write_company_data(company_id))
    or (company_id is null and public.is_super_admin())
  )
  with check (
    (company_id is not null and public.can_write_company_data(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy social_post_targets_select on public.social_post_targets
  for select to authenticated
  using (
    (company_id is not null and public.has_company_access(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy social_auto_rules_select on public.social_auto_rules
  for select to authenticated
  using (
    deleted_at is null
    and (
      (company_id is not null and public.has_company_access(company_id))
      or (company_id is null and public.is_super_admin())
    )
  );

create policy social_auto_rules_insert on public.social_auto_rules
  for insert to authenticated
  with check (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  );

create policy social_auto_rules_update on public.social_auto_rules
  for update to authenticated
  using (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  )
  with check (
    (company_id is not null and public.is_company_owner(company_id))
    or (company_id is null and public.is_super_admin())
  );

-- -----------------------------------------------------------------------------
-- Reviews
-- -----------------------------------------------------------------------------

-- A review arrives through a token link, so it is written by the routine and
-- never read by anybody outside the tenant it belongs to.
create policy review_requests_select on public.review_requests
  for select to authenticated
  using (
    (company_id is not null and public.has_company_access(company_id))
    or (company_id is null and public.is_super_admin())
  );
