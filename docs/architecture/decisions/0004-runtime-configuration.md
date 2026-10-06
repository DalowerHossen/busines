# 4. Configuration is data, not deployment

**Status:** accepted

## The problem

A platform operator should not need an engineer to change a payment key, a
measurement identifier, the fee it charges, or the wording of a page. If
those things require a deployment, they either do not happen or they happen
through somebody editing production by hand.

## The decision

Anything an administrator might reasonably change is stored, read at request
time, and resolved in a fixed order: what is in the database, then the
environment variable, then the built-in default. A revision stamp is bumped
on every change so running servers notice within seconds. Secrets are
encrypted before storage and shown back only as a hint.

Two exceptions are deliberate. The Supabase connection and the encryption
key have to exist before anything can be read, so they stay in the
environment.

## What this costs

An extra read on the resolution path, mitigated by a short cache, and a
larger surface of settings that have to be validated.

## What this buys

A key can be rotated at midnight without a release. A fee can be negotiated
with one account in a meeting. A marketing page can be fixed by the person
who noticed the typo.
