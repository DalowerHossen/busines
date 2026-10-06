-- supabase/migrations/00159_install_marketing_triggers.sql
-- Timestamps, audit trail and the rules that keep marketing honest.

select public.install_standard_triggers('site_pages');
select public.install_standard_triggers('landing_pages');
select public.install_standard_triggers('experiments');
select public.install_standard_triggers('marketing_segments');
select public.install_standard_triggers('marketing_campaigns');
select public.install_standard_triggers('social_channels');
select public.install_standard_triggers('social_posts');
select public.install_standard_triggers('social_auto_rules');
select public.install_standard_triggers('testimonials');

select public.install_timestamp_trigger('url_redirects');
select public.install_timestamp_trigger('cookie_consents');
select public.install_timestamp_trigger('experiment_variants');
select public.install_timestamp_trigger('campaign_steps');
select public.install_timestamp_trigger('campaign_recipients');
select public.install_timestamp_trigger('marketing_subscriptions');
select public.install_timestamp_trigger('social_post_targets');
select public.install_timestamp_trigger('review_requests');

-- Public wording, legal pages and anything that goes out under the company
-- name is worth being able to prove the history of.
select public.install_audit_trigger('site_pages');
select public.install_audit_trigger('landing_pages');
select public.install_audit_trigger('marketing_campaigns');
select public.install_audit_trigger('social_channels');
select public.install_audit_trigger('testimonials');

-- -----------------------------------------------------------------------------
-- A published page keeps its publication date
-- -----------------------------------------------------------------------------

create or replace function public.stamp_publication()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_published and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end;
$$;

comment on function public.stamp_publication() is
  'Fills in the publication date the first time something is published.';

create trigger site_pages_20_publication
  before insert or update on public.site_pages
  for each row execute function public.stamp_publication();

create trigger landing_pages_20_publication
  before insert or update on public.landing_pages
  for each row execute function public.stamp_publication();

-- -----------------------------------------------------------------------------
-- A campaign that has gone out cannot be rewritten
-- -----------------------------------------------------------------------------

-- Changing the wording of a message after it was sent would make the record
-- of what went out a work of fiction.
create or replace function public.guard_sent_campaign()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status in ('sending', 'sent')
     and (new.subject is distinct from old.subject
          or new.body_markdown is distinct from old.body_markdown) then
    raise exception 'The wording of a campaign that has gone out cannot be changed'
      using errcode = '42501';
  end if;

  if old.status = 'sent' and new.status in ('draft', 'scheduled') then
    raise exception 'A campaign that has been sent cannot go back to a draft'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_sent_campaign() is
  'Keeps a campaign that has already gone out exactly as it went out.';

create trigger marketing_campaigns_20_guard_sent
  before update on public.marketing_campaigns
  for each row execute function public.guard_sent_campaign();

-- -----------------------------------------------------------------------------
-- An experiment that is running does not change underneath its own numbers
-- -----------------------------------------------------------------------------

create or replace function public.guard_running_experiment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select status into v_status
    from public.experiments
   where id = coalesce(new.experiment_id, old.experiment_id);

  if v_status = 'running' then
    if tg_op = 'DELETE' then
      raise exception 'A variant cannot be removed while the experiment runs'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE'
       and (new.weight is distinct from old.weight
            or new.overrides is distinct from old.overrides
            or new.is_control is distinct from old.is_control) then
      raise exception 'A variant cannot be changed while the experiment runs'
        using errcode = '42501';
    end if;

    if tg_op = 'INSERT' then
      raise exception 'A variant cannot be added while the experiment runs'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

comment on function public.guard_running_experiment() is
  'Freezes the variants of an experiment for as long as it is running.';

create trigger experiment_variants_20_guard_running
  before insert or update or delete on public.experiment_variants
  for each row execute function public.guard_running_experiment();

-- -----------------------------------------------------------------------------
-- Social content
-- -----------------------------------------------------------------------------

-- A post that has gone out on at least one network is a matter of public
-- record, so the wording stops being editable at that point.
create or replace function public.guard_published_post()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status in ('published', 'partially_published')
     and (new.body is distinct from old.body
          or new.link_url is distinct from old.link_url) then
    raise exception 'A post that is already out cannot be rewritten here'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_published_post() is
  'Stops the wording of a post changing after a network has taken it.';

create trigger social_posts_20_guard_published
  before update on public.social_posts
  for each row execute function public.guard_published_post();

-- An access token is a secret like any other, and the masked hint next to it
-- is shown in plain sight, so it is held to the same rule.
create or replace function public.guard_channel_hint()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.masked_hint is not null and length(new.masked_hint) > 12 then
    raise exception 'The hint is long enough to be the token itself'
      using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'A connected account cannot be moved to another tenant'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_channel_hint() is
  'Keeps a channel with its tenant and its hint too short to be useful.';

create trigger social_channels_20_guard
  before insert or update on public.social_channels
  for each row execute function public.guard_channel_hint();
