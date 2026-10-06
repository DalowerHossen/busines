# An incident has started

An incident is anything where a business cannot do what it pays us to do:
send an invoice, take a payment, or reach its money. Slowness counts.

## First five minutes

1. Open `/api/health`. It reaches the database, checks that a file store is
   configured and that something can send mail, and reports how long the
   database took. The answer tells you which layer to look at.
2. Open `/api/version`. Confirm which build is actually running. A
   surprising answer here explains a surprising number of incidents.
3. Open the platform console at `/admin/platform`. The recent health probes
   show whether this started a minute ago or has been degrading for a day.

## Decide what is broken

| Symptom                            | Where to look first                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Pages load but nothing saves       | The database. Check the health probe timing and the Supabase status page.                            |
| Payments fail, pages are fine      | The provider. Follow the payment outage runbook.                                                     |
| Invoices send but never arrive     | The sending domain. Check the DNS records are still verified in the platform console.                |
| One business affected, others fine | Their data, their keys, or their plan. Check their integration connections and their account status. |
| Everything is slow                 | A single query. Check the slowest recent health probe and the database dashboard.                    |

## Communicate before you fix

Write one sentence to the people affected saying what is broken and when
you will say more. A support queue during an outage costs more time than
the fix. Do this before investigating further; it takes a minute.

## While fixing

- Change one thing at a time and write down what you changed. Two changes at
  once leave you not knowing which worked.
- Prefer switching something off to patching it under pressure. A payment
  route can be disabled from the connections console in seconds, and bank
  transfer keeps working.
- Never edit money rows by hand to make a screen look right. The ledger is
  the record; correct it with a reversal, not an update.

## Afterwards

Within two days, write what happened, what the user saw, what the cause was
and what will stop it recurring. If the answer to the last is "we will be
careful", it is not an answer.
