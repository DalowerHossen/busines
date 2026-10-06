-- supabase/migrations/00157_create_reviews_testimonials.sql
-- Asking for a review, and showing the good ones.
--
-- A review request goes out after something good happened, once, and never
-- again to the same person for the same thing. Nothing a client writes is
-- shown anywhere until somebody has read it and agreed to publish it.

create table public.review_requests (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,

  client_id uuid,
  user_id uuid,
  email_address citext not null,

  -- What the request is about, so the same person is not asked twice for
  -- the same invoice.
  subject_type text not null default 'invoice',
  subject_id uuid,

  token text not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),

  rating smallint,
  comment text,
  would_recommend boolean,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint review_requests_email_check
    check (public.is_valid_email(email_address::text)),
  constraint review_requests_subject_check
    check (subject_type in ('invoice', 'project', 'subscription', 'platform')),
  constraint review_requests_token_check
    check (length(token) between 32 and 128),
  constraint review_requests_status_check
    check (status in ('pending', 'sent', 'responded', 'declined', 'expired')),
  constraint review_requests_rating_check
    check (rating is null or rating between 1 and 5),
  constraint review_requests_comment_check
    check (comment is null or length(btrim(comment)) between 2 and 2000),
  constraint review_requests_responded_check
    check (status <> 'responded' or (rating is not null and responded_at is not null)),
  constraint review_requests_expiry_check
    check (expires_at > requested_at)
);

comment on table public.review_requests is
  'An invitation to rate something, and the answer if one came back.';

create unique index review_requests_token_unique
  on public.review_requests (token);

create unique index review_requests_subject_unique
  on public.review_requests
     (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
      email_address, subject_type,
      coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index review_requests_pending_idx
  on public.review_requests (requested_at)
  where status = 'pending';

create index review_requests_responded_idx
  on public.review_requests (company_id, responded_at desc)
  where status = 'responded';

-- -----------------------------------------------------------------------------
-- What gets shown
-- -----------------------------------------------------------------------------

create table public.testimonials (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,
  review_request_id uuid,

  author_name text not null,
  author_title text,
  author_company text,
  author_avatar_url text,
  author_country_code char(2),

  quote text not null,
  rating smallint,

  -- Nothing appears on the site until somebody approved it, and the person
  -- who wrote it has to have agreed to that.
  is_approved boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  consent_given boolean not null default false,
  consent_given_at timestamptz,

  is_featured boolean not null default false,
  display_order smallint not null default 100,
  display_surface text not null default 'home',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint testimonials_author_check
    check (length(btrim(author_name)) between 2 and 80),
  constraint testimonials_quote_check
    check (length(btrim(quote)) between 20 and 600),
  constraint testimonials_rating_check
    check (rating is null or rating between 1 and 5),
  constraint testimonials_country_check
    check (author_country_code is null or author_country_code ~ '^[A-Z]{2}$'),
  constraint testimonials_surface_check
    check (display_surface in ('home', 'pricing', 'features', 'checkout',
                               'landing')),
  constraint testimonials_approved_check
    check (not is_approved or (approved_at is not null and consent_given)),
  constraint testimonials_consent_check
    check (not consent_given or consent_given_at is not null)
);

comment on table public.testimonials is
  'A quote that may be shown publicly, once it has been approved and consented to.';

create index testimonials_display_idx
  on public.testimonials (display_surface, display_order)
  where is_approved and deleted_at is null;

create index testimonials_featured_idx
  on public.testimonials (display_order)
  where is_featured and is_approved and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Asking and answering
-- -----------------------------------------------------------------------------

-- Raises a request, once per person per thing.
create or replace function public.request_review(
  p_company_id uuid,
  p_email_address text,
  p_subject_type text default 'invoice',
  p_subject_id uuid default null,
  p_client_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_valid_email(p_email_address) then
    raise exception 'That is not an address we can write to' using errcode = '22023';
  end if;

  insert into public.review_requests (
    company_id, client_id, email_address, subject_type, subject_id, token
  )
  values (
    p_company_id, p_client_id, public.normalize_email(p_email_address)::citext,
    coalesce(p_subject_type, 'invoice'), p_subject_id,
    public.generate_secure_token(32)
  )
  on conflict do nothing
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.request_review(uuid, text, text, uuid, uuid) is
  'Invites somebody to rate one thing, and never invites them twice for it.';

-- Records an answer against the token in the link.
create or replace function public.submit_review(
  p_token text,
  p_rating smallint,
  p_comment text default null,
  p_would_recommend boolean default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.review_requests%rowtype;
begin
  select * into v_request
    from public.review_requests
   where token = p_token
     for update;

  if not found then
    raise exception 'That review link is not valid' using errcode = 'P0002';
  end if;

  if v_request.expires_at <= now() then
    raise exception 'That review link has expired' using errcode = '22023';
  end if;

  if v_request.status = 'responded' then
    raise exception 'That review has already been given' using errcode = '22023';
  end if;

  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'A review needs a rating between one and five'
      using errcode = '22023';
  end if;

  update public.review_requests
     set status = 'responded',
         rating = p_rating,
         comment = p_comment,
         would_recommend = p_would_recommend,
         responded_at = now(),
         updated_at = now()
   where id = v_request.id;

  return v_request.id;
end;
$$;

comment on function public.submit_review(text, smallint, text, boolean) is
  'Records a rating and comment against the token in the invitation.';

-- Publishes a quote. Both halves are required: somebody inside approved it,
-- and the person who wrote it agreed to it being shown.
create or replace function public.approve_testimonial(p_testimonial_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_testimonial public.testimonials%rowtype;
begin
  select * into v_testimonial
    from public.testimonials
   where id = p_testimonial_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That testimonial does not exist' using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.is_super_admin()
          or (v_testimonial.company_id is not null
              and public.is_company_owner(v_testimonial.company_id))) then
    raise exception 'Only an owner can publish a testimonial'
      using errcode = '42501';
  end if;

  if not v_testimonial.consent_given then
    raise exception
      'The person who wrote this has not agreed to it being shown'
      using errcode = '22023';
  end if;

  update public.testimonials
     set is_approved = true,
         approved_by = public.current_user_id(),
         approved_at = now(),
         updated_at = now()
   where id = p_testimonial_id;

  return true;
end;
$$;

comment on function public.approve_testimonial(uuid) is
  'Publishes a testimonial, once it has been consented to and read.';

-- Closes invitations nobody answered.
create or replace function public.expire_review_requests()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.review_requests
     set status = 'expired',
         updated_at = now()
   where status in ('pending', 'sent')
     and expires_at <= now();

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.expire_review_requests() is
  'Closes review invitations that were never answered.';

-- What people think, in one line.
create or replace function public.review_summary(p_company_id uuid default null)
returns table (
  response_count integer,
  average_rating numeric,
  promoter_count integer,
  detractor_count integer,
  recommend_rate numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer,
         round(avg(rating), 2),
         (count(*) filter (where rating >= 4))::integer,
         (count(*) filter (where rating <= 2))::integer,
         case
           when count(*) filter (where would_recommend is not null) > 0
           then round(
             count(*) filter (where would_recommend) * 100.0
             / count(*) filter (where would_recommend is not null),
             1
           )
           else 0
         end
    from public.review_requests
   where status = 'responded'
     and company_id is not distinct from p_company_id;
$$;

comment on function public.review_summary(uuid) is
  'Summarises the ratings a tenant, or the platform, has received.';
