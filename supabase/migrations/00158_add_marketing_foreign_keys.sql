-- supabase/migrations/00158_add_marketing_foreign_keys.sql
-- The relationships of the site, campaign, experiment and social tables.
--
-- Measurement rows keep their figures when the thing they measured is
-- removed, because a report of last quarter should not change when somebody
-- tidies up a landing page today.

alter table public.site_pages
  add constraint site_pages_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint site_pages_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.url_redirects
  add constraint url_redirects_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null;

alter table public.cookie_consents
  add constraint cookie_consents_user_fk
    foreign key (user_id) references public.users (id) on delete set null;

alter table public.site_events
  add constraint site_events_user_fk
    foreign key (user_id) references public.users (id) on delete set null,
  add constraint site_events_landing_page_fk
    foreign key (landing_page_id) references public.landing_pages (id)
      on delete set null,
  add constraint site_events_variant_fk
    foreign key (experiment_variant_id)
    references public.experiment_variants (id) on delete set null;

alter table public.landing_pages
  add constraint landing_pages_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint landing_pages_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.experiments
  add constraint experiments_landing_page_fk
    foreign key (landing_page_id) references public.landing_pages (id)
      on delete set null,
  add constraint experiments_winning_variant_fk
    foreign key (winning_variant_id) references public.experiment_variants (id)
      on delete set null,
  add constraint experiments_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint experiments_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.experiment_variants
  add constraint experiment_variants_experiment_fk
    foreign key (experiment_id) references public.experiments (id)
      on delete cascade;

alter table public.experiment_assignments
  add constraint experiment_assignments_experiment_fk
    foreign key (experiment_id) references public.experiments (id)
      on delete cascade,
  add constraint experiment_assignments_variant_fk
    foreign key (variant_id) references public.experiment_variants (id)
      on delete cascade,
  add constraint experiment_assignments_user_fk
    foreign key (user_id) references public.users (id) on delete set null;

alter table public.marketing_segments
  add constraint marketing_segments_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint marketing_segments_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint marketing_segments_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.marketing_campaigns
  add constraint marketing_campaigns_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint marketing_campaigns_segment_fk
    foreign key (segment_id) references public.marketing_segments (id)
      on delete set null,
  add constraint marketing_campaigns_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint marketing_campaigns_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.campaign_steps
  add constraint campaign_steps_campaign_fk
    foreign key (campaign_id) references public.marketing_campaigns (id)
      on delete cascade,
  add constraint campaign_steps_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.campaign_recipients
  add constraint campaign_recipients_campaign_fk
    foreign key (campaign_id) references public.marketing_campaigns (id)
      on delete cascade,
  add constraint campaign_recipients_step_fk
    foreign key (step_id) references public.campaign_steps (id)
      on delete cascade,
  add constraint campaign_recipients_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint campaign_recipients_client_fk
    foreign key (client_id) references public.clients (id) on delete set null,
  add constraint campaign_recipients_user_fk
    foreign key (user_id) references public.users (id) on delete set null;

alter table public.marketing_subscriptions
  add constraint marketing_subscriptions_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint marketing_subscriptions_client_fk
    foreign key (client_id) references public.clients (id) on delete set null,
  add constraint marketing_subscriptions_user_fk
    foreign key (user_id) references public.users (id) on delete set null;

alter table public.social_channels
  add constraint social_channels_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint social_channels_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint social_channels_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.social_posts
  add constraint social_posts_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint social_posts_rule_fk
    foreign key (created_by_rule_id) references public.social_auto_rules (id)
      on delete set null,
  add constraint social_posts_campaign_fk
    foreign key (campaign_id) references public.marketing_campaigns (id)
      on delete set null,
  add constraint social_posts_approved_by_fk
    foreign key (approved_by) references public.users (id) on delete set null,
  add constraint social_posts_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint social_posts_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.social_post_targets
  add constraint social_post_targets_post_fk
    foreign key (post_id) references public.social_posts (id) on delete cascade,
  add constraint social_post_targets_channel_fk
    foreign key (channel_id) references public.social_channels (id)
      on delete cascade,
  add constraint social_post_targets_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.social_auto_rules
  add constraint social_auto_rules_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint social_auto_rules_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint social_auto_rules_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.review_requests
  add constraint review_requests_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint review_requests_client_fk
    foreign key (client_id) references public.clients (id) on delete set null,
  add constraint review_requests_user_fk
    foreign key (user_id) references public.users (id) on delete set null;

alter table public.testimonials
  add constraint testimonials_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint testimonials_review_fk
    foreign key (review_request_id) references public.review_requests (id)
      on delete set null,
  add constraint testimonials_approved_by_fk
    foreign key (approved_by) references public.users (id) on delete set null,
  add constraint testimonials_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint testimonials_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;
