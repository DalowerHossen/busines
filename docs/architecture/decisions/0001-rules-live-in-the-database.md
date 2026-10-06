# 1. The rules live in the database

**Status:** accepted

## The problem

A multi-tenant platform that holds money has a small number of rules that
must never be broken: one business must never read another's data, a posted
entry must never change, money must never be invented. Those rules can be
written in the application or in the database. They cannot be written in
both without eventually disagreeing.

## The decision

They live in the database. Row level security is on and forced for every
tenant table. Anything privileged is a `security definer` function whose
first act is its own permission check. The application calls those functions
rather than writing tables directly wherever a rule applies.

## What this costs

More SQL, and a slower loop when changing a rule: a migration rather than a
deployment. Tests are slower to write because they have to exercise real
policies rather than mocks.

## What this buys

A bug in a page cannot leak another tenant's invoices. Nor can a new
developer, a hurried server action, a direct database client, or a future
integration written by somebody who never read this file. The guarantee does
not depend on anybody remembering it.
