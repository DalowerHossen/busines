-- supabase/migrations/00228_seed_contract_templates.sql
-- The wording a signer receives when a business asks them to sign.
--
-- Queueing a message refuses to invent words of its own: if no wording is
-- configured for a key, it raises rather than sending something empty. That
-- is the right behaviour, and it meant that asking somebody to sign a
-- contract failed every time, because this wording had never been written.
--
-- Two more are added for the same reason. A signed document that nobody is
-- told about, and a signature request that expires in silence, are both
-- worse than the email that would have prevented the telephone call.

insert into public.email_templates (
  template_key, name, description, subject, body_html, body_text,
  available_variables, is_system
)
values
  (
    'contract_signature_request',
    'Signature request',
    'Sent to a signer when a business asks them to sign a document.',
    '{{company_name}} has asked you to sign {{document_title}}',
    '<p>Hello {{signer_name}},</p>'
    || '<p>{{company_name}} has asked you to sign <strong>{{document_title}}</strong>.</p>'
    || '<p>You can read it in full and sign it here:</p>'
    || '<p><a href="{{document_url}}">Read and sign the document</a></p>'
    || '<p>The link is personal to you and stops working on {{expires_on}}. '
    || 'Nothing is signed until you press the button yourself, and you will be '
    || 'sent a copy the moment you do.</p>'
    || '<p>If you were not expecting this, reply to this message and tell us. '
    || 'Nothing will happen until you do.</p>',
    'Hello {{signer_name}},' || chr(10) || chr(10)
    || '{{company_name}} has asked you to sign {{document_title}}.' || chr(10) || chr(10)
    || 'Read it in full and sign it here: {{document_url}}' || chr(10) || chr(10)
    || 'The link is personal to you and stops working on {{expires_on}}. Nothing is '
    || 'signed until you press the button yourself, and you will be sent a copy the '
    || 'moment you do.' || chr(10) || chr(10)
    || 'If you were not expecting this, reply and tell us. Nothing will happen until you do.',
    array['signer_name', 'company_name', 'document_title', 'document_url', 'expires_on']::text[],
    true
  ),
  (
    'contract_signed',
    'Signed copy',
    'Sent to everybody who signed, the moment the last signature is in.',
    '{{document_title}} has been signed',
    '<p>Hello {{signer_name}},</p>'
    || '<p><strong>{{document_title}}</strong> has been signed by everybody it needed.</p>'
    || '<p>Your copy is attached to this message and is also here:</p>'
    || '<p><a href="{{document_url}}">Open the signed document</a></p>'
    || '<p>The copy carries the time each person signed and the address they signed '
    || 'from, which is what makes it hold up if it is ever questioned.</p>',
    'Hello {{signer_name}},' || chr(10) || chr(10)
    || '{{document_title}} has been signed by everybody it needed.' || chr(10) || chr(10)
    || 'Your copy: {{document_url}}' || chr(10) || chr(10)
    || 'The copy carries the time each person signed and the address they signed from, '
    || 'which is what makes it hold up if it is ever questioned.',
    array['signer_name', 'company_name', 'document_title', 'document_url']::text[],
    true
  ),
  (
    'contract_reminder',
    'Signature reminder',
    'Sent while a document is still waiting for one of its signatures.',
    'Still waiting on your signature for {{document_title}}',
    '<p>Hello {{signer_name}},</p>'
    || '<p>{{company_name}} is still waiting on your signature for '
    || '<strong>{{document_title}}</strong>.</p>'
    || '<p><a href="{{document_url}}">Read and sign the document</a></p>'
    || '<p>If you have decided not to sign, say so by replying to this message. '
    || 'That is a perfectly good answer and it stops the reminders.</p>',
    'Hello {{signer_name}},' || chr(10) || chr(10)
    || '{{company_name}} is still waiting on your signature for {{document_title}}.'
    || chr(10) || chr(10)
    || 'Read and sign it here: {{document_url}}' || chr(10) || chr(10)
    || 'If you have decided not to sign, reply and say so. That is a perfectly good '
    || 'answer and it stops the reminders.',
    array['signer_name', 'company_name', 'document_title', 'document_url', 'expires_on']::text[],
    true
  )
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Making the gap impossible to leave open again
-- -----------------------------------------------------------------------------

-- Returns the wording keys the platform ships with. The application checks
-- this rather than guessing, so a key used in code with no wording behind
-- it is found by a test rather than by a signer who never received a thing.
create or replace function public.configured_template_keys()
returns table (template_key text, channel public.message_channel, is_system boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.template_key, t.channel, t.is_system
    from public.email_templates as t
   where t.company_id is null
     and t.is_active
     and t.deleted_at is null
   order by t.template_key;
$$;

comment on function public.configured_template_keys() is
  'Lists the wording the platform ships with, so a missing one is found before a client is.';

revoke execute on function public.configured_template_keys() from public;
grant execute on function public.configured_template_keys()
  to authenticated, service_role;
