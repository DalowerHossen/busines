-- supabase/migrations/00161_grant_marketing_privileges.sql
-- Table, column and routine privileges for the site, campaigns and social.
--
-- The anonymous role gets exactly what a visitor to the marketing site needs
-- and nothing else: published wording, approved quotes, and the two routines
-- behind the cookie banner.

grant select on public.site_pages to anon, authenticated;
grant insert, update on public.site_pages to authenticated;

grant select on public.url_redirects to anon, authenticated;
grant insert, update on public.url_redirects to authenticated;

grant select on public.landing_pages to anon, authenticated;
grant insert, update on public.landing_pages to authenticated;

grant select on public.testimonials to anon, authenticated;
grant insert, update on public.testimonials to authenticated;

grant select on public.cookie_consents to authenticated;
grant select on public.site_events to authenticated;

grant select on public.experiments to authenticated;
grant insert, update on public.experiments to authenticated;
grant select on public.experiment_variants to authenticated;
grant insert, update on public.experiment_variants to authenticated;
grant select on public.experiment_assignments to authenticated;

grant select, insert, update on public.marketing_segments to authenticated;
grant select, insert, update on public.marketing_campaigns to authenticated;
grant select, insert, update on public.campaign_steps to authenticated;
grant select on public.campaign_recipients to authenticated;
grant select on public.marketing_subscriptions to authenticated;

-- The connection tokens of a social account are never selectable, in the
-- same way an integration secret is not.
grant select (
  id, company_id, platform, account_name, account_handle, external_account_id,
  avatar_url, token_expires_at, masked_hint, granted_scopes, is_connected,
  is_active, connection_error, last_published_at, post_count, created_at,
  updated_at, deleted_at, created_by, updated_by
) on public.social_channels to authenticated;

grant insert on public.social_channels to authenticated;
grant update (
  account_name, account_handle, avatar_url, is_active, connection_error,
  deleted_at, updated_at, updated_by
) on public.social_channels to authenticated;

grant select, insert, update on public.social_posts to authenticated;
grant select on public.social_post_targets to authenticated;
grant select, insert, update on public.social_auto_rules to authenticated;
grant select on public.review_requests to authenticated;

-- -----------------------------------------------------------------------------
-- The public site
-- -----------------------------------------------------------------------------

grant execute on function public.sitemap_entries() to anon, authenticated;
grant execute on function public.follow_redirect(text) to anon, authenticated;

-- The banner has to work before anybody has signed in, and so does the
-- question of whether a tag may load.
grant execute on function public.record_cookie_consent(
  text, boolean, boolean, boolean, text, text, text, char
) to anon, authenticated;
grant execute on function public.consent_allows(text, text)
  to anon, authenticated;
grant execute on function public.record_site_event(
  text, text, text, jsonb, text, text, text, text, text, text, text, text, char
) to anon, authenticated;

grant execute on function public.assign_experiment_variant(text, text)
  to anon, authenticated;
grant execute on function public.record_experiment_conversion(text, text)
  to anon, authenticated;

grant execute on function public.subscribe_to_marketing(uuid, text, text, uuid)
  to anon, authenticated;
grant execute on function public.unsubscribe_from_marketing(uuid, text, text)
  to anon, authenticated;
grant execute on function public.submit_review(text, smallint, text, boolean)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Running the marketing
-- -----------------------------------------------------------------------------

grant execute on function public.funnel_report(text[], timestamptz, timestamptz)
  to authenticated;
grant execute on function public.experiment_results(text) to authenticated;
grant execute on function public.experiment_weights_balanced(uuid)
  to authenticated;
grant execute on function public.start_experiment(uuid) to authenticated;
grant execute on function public.conclude_experiment(uuid, uuid, text)
  to authenticated;

grant execute on function public.may_receive_marketing(uuid, text)
  to authenticated;
grant execute on function public.build_campaign_audience(uuid) to authenticated;
grant execute on function public.campaign_performance(uuid) to authenticated;

grant execute on function public.schedule_social_post(uuid, uuid[], timestamptz)
  to authenticated;
grant execute on function public.social_calendar(uuid, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.request_review(uuid, text, text, uuid, uuid)
  to authenticated;
grant execute on function public.approve_testimonial(uuid) to authenticated;
grant execute on function public.review_summary(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Worker routines
-- -----------------------------------------------------------------------------

-- Sending, publishing and the sweepers belong to the queue runner.
revoke execute on function public.claim_campaign_recipients(integer)
  from public, authenticated;
revoke execute on function public.record_campaign_outcome(uuid, text, text)
  from public, authenticated;
revoke execute on function public.advance_campaign_sequences()
  from public, authenticated;
revoke execute on function public.claim_social_targets(text, integer)
  from public, authenticated;
revoke execute on function public.record_social_result(
  uuid, boolean, text, text, text
) from public, authenticated;
revoke execute on function public.record_social_metrics(uuid, integer, integer)
  from public, authenticated;
revoke execute on function public.trigger_social_rules(uuid, text, jsonb)
  from public, authenticated;
revoke execute on function public.expire_review_requests()
  from public, authenticated;

grant execute on function public.claim_campaign_recipients(integer)
  to service_role;
grant execute on function public.record_campaign_outcome(uuid, text, text)
  to service_role;
grant execute on function public.advance_campaign_sequences() to service_role;
grant execute on function public.claim_social_targets(text, integer)
  to service_role;
grant execute on function public.record_social_result(
  uuid, boolean, text, text, text
) to service_role;
grant execute on function public.record_social_metrics(uuid, integer, integer)
  to service_role;
grant execute on function public.trigger_social_rules(uuid, text, jsonb)
  to service_role;
grant execute on function public.expire_review_requests() to service_role;
