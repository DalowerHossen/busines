# How the system is put together

## The short version

A Next.js application in front of a PostgreSQL database managed by Supabase.
Almost every rule that matters lives in the database, not in the
application, because the database is the one thing every path has to go
through. A screen can be bypassed. A server action can be called directly. A
row level security policy and a `security definer` function cannot.

## The layers, and what each is allowed to do

**The database.** Owns the truth. Every table that belongs to a tenant has
row level security switched on and forced, so even a mistake in the
application cannot read another business's data. Anything that needs
elevated rights is a named function with its permission check in its first
ten lines. Money is numeric, never floating point. Records are soft deleted
so that an accident is recoverable and an audit trail stays complete.

**Server queries.** Read-only modules under `src/features/*/queries`. They
run as the signed in user, which means row level security is doing the
filtering rather than a `where` clause somebody might forget. Each returns a
plain shape and an `isDegraded` flag; a page that cannot read its data shows
what it has and says so, rather than throwing away the whole screen.

**Server actions.** Write modules under `src/features/*/actions`. Every one
is a `createAction` with a Zod schema, an authorisation guard, a database
call, an audit entry and a cache invalidation, in that order. The return
shape is always `{ success, data }` or `{ success, error, fieldErrors }`, so
no caller has to guess.

**The service role.** Used only where there is no signed in user to act as:
webhooks, cron routes, client links, health checks. Those paths resolve a
token first and read nothing until the token has been accepted by the
database.

**Pages and components.** Server components read; client components act.
Every client component has a loading, error, empty and success state,
because three of those four are what a real user meets on a bad connection.

## The rules that are enforced rather than agreed

- A tenant query without `company_id` filtering cannot see another tenant,
  because the policy, not the query, decides.
- A posted journal entry, a settled payment, a sealed proof of work and a
  recorded consent are append only. Mistakes are corrected with a new row.
- Credentials are encrypted before they reach the database and are never
  read back to a browser; a screen shows a hint of the last characters.
- Anything that leaves the platform under a business's name — an email to a
  client, a social post, a campaign — needs an owner, not merely a signed in
  user.

## Where the money logic lives

Collection, holding and payout are in the database as a single chain:
`settle_payment_intent` → `settle_invoice_funds` → wallet credit with a hold
→ `release_matured_settlements` → `request_payout` → `attach_settlements_to_payout`.
Each step is idempotent, which is what makes a webhook delivered three times
harmless.

## Runtime configuration

Nothing that an administrator might reasonably want to change requires a
deployment. Integration keys, collection terms, measurement identifiers,
platform settings and the public website are all data, resolved in the order
database, then environment variable, then built-in default. The two
exceptions are deliberate: the Supabase connection itself, and the
encryption key, both of which have to exist before the database can be
asked anything.
