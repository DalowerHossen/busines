# The written record

Software that handles other people's money outlives the memory of whoever
wrote it. These documents exist so that in two years a different engineer,
or the same one on a bad morning, can answer three questions without reading
the whole codebase: how the thing is shaped, why it was shaped that way, and
what to do when it breaks at three in the morning.

Everything here is kept short on purpose. A runbook nobody reads is worse
than no runbook, because it creates the impression that the situation was
thought about.

## How the system is put together

- [Architecture overview](architecture/overview.md) — the layers, what each
  one is allowed to do, and the rules that are enforced rather than agreed.
- [The data model](architecture/erd.md) — the tables grouped by what they
  are for, and how the groups connect.
- [Data dictionary](architecture/data-dictionary.md) — the columns that
  carry meaning beyond their name, and the invariants attached to them.

## Why it is the way it is

- [Decision records](architecture/decisions) — one file per decision that
  would otherwise be re-argued every six months.

## When something goes wrong

- [An incident has started](runbooks/incident-response.md)
- [Payments are failing](runbooks/payment-outage.md)
- [Restoring from a backup](runbooks/restore-from-backup.md)
- [Rotating a key that has leaked](runbooks/key-rotation.md)
- [Releasing a change](runbooks/release.md)

## Before and after launch

- [DNS records the owner must create](operations/dns-records.md)
- [Browsers and devices we support](operations/browser-matrix.md)
- [Launch checklist](operations/launch-checklist.md)
