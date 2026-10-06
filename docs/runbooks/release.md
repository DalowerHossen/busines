# Releasing a change

## Before

- `npm run verify` is green. It runs the language check, the unfinished work
  check, types, lint, formatting and the full database validation.
- Migrations have been validated. The validation harness runs every
  migration from empty against a real PostgreSQL engine and then exercises
  the behaviour, so a migration that only works on top of today's production
  data will fail here.
- Anything that changes money arithmetic has a test that would have caught
  the bug you are fixing.

## Deploying

1. Push to the branch the host builds from. The build runs type checking and
   linting again; a red build is never deployed past.
2. Apply migrations before the new code is serving, not after. Every
   migration in this project is written so that the previous version of the
   application keeps working against it.
3. Watch `/api/version` until it reports the new commit.
4. Watch `/api/health` for a few minutes. The probe writes a trail, so a
   slow degradation after a release is visible rather than anecdotal.

## If it goes wrong

Roll the application back first; it is a minute. Migrations are additive and
designed to be safe under the previous version, so a rollback of code alone
is almost always enough. Only reverse a migration if it is actually the
cause, and prefer a new corrective migration to an undo.

## After

Check the error reporting for anything new rather than merely frequent. A
new error with three occurrences matters more than a familiar one with
three hundred.
