# Restoring from a backup

## Before touching anything

A restore loses every change made after the point you restore to. Write
down the time you are restoring to, and tell the affected businesses what
window of work will disappear. For a single-tenant mistake, do not restore
the whole database; recover the rows instead.

## Recovering a few rows

Almost every "we deleted it" is recoverable without a restore, because
nothing is actually deleted. Set `deleted_at` back to null on the rows in
question, as the service role, and record why in the audit trail. Check for
dependent rows that were soft deleted in the same action.

## Restoring the whole database

1. Put the platform into maintenance from the platform settings, so nobody
   writes while you work.
2. Take a fresh backup of the current state first, however broken it looks.
   You may need something from it afterwards.
3. Restore the Supabase backup to a new project rather than over the top of
   the live one. Compare before you switch.
4. Point the application at the restored project by changing the Supabase
   environment variables, then redeploy. These are the two settings that
   deliberately require a deployment.
5. Run the health endpoint, then sign in and check one invoice, one
   payment and one settlement by eye.
6. Take maintenance off.

## Afterwards

- Payment webhooks that arrived during the window will not be replayed by
  the provider forever. Check each provider's dashboard for events in the
  gap and replay them from there; the settlement routine is idempotent.
- Tell the businesses what was lost, specifically. "Some data between two
  and four" is worse than silence; "invoices you created between 14:10 and
  15:40 will need raising again" can be acted on.
