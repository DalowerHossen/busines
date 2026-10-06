# Payments are failing

## Establish the scope

1. In the connections console, press Test connection on the payment
   provider. The result is stored with a timestamp, so you can also see when
   it last worked.
2. Check whether failures are on one provider or all of them. All of them
   usually means us; one of them usually means them.
3. Check the provider's own status page before anything else. Half of these
   incidents end here.

## If it is the provider

- Tell the affected businesses, in one sentence, that card payments are
  interrupted and that bank transfer still works.
- If the outage will outlast the hour, switch the provider off in the
  connections console. A clean "this way of paying is unavailable" is far
  better for a payer than a failed card attempt, which can leave a hold on
  their account.
- Nothing needs to be reconciled by hand afterwards. Payments that completed
  at the provider but never reached us arrive through the webhook, and the
  settlement routine is idempotent, so a replayed webhook is harmless.

## If it is us

- A key that was rotated recently is the first suspect. The connections
  console shows when each credential was last changed and last used; the
  previous key stays valid for five minutes after a rotation, which means a
  failure starting exactly five minutes after a change is almost certainly
  the cause.
- A failing webhook signature usually means the signing secret was changed
  at the provider and not here.
- Check whether the invoices in question are above a card ceiling the seller
  set themselves. The checkout refuses rather than offering a card route
  that cannot work.

## Money that moved while we were down

The webhook is the source of truth, not the browser. Once the provider is
reachable again, replayed webhooks settle anything outstanding. Check the
settlement list for the affected period and confirm that each succeeded
payment has exactly one settlement row; the unique index guarantees it
cannot have two.
