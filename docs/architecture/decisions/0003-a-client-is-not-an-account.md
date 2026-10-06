# 3. A client is not an account

**Status:** accepted

## The problem

The person being invoiced needs to see a document, pay it and keep a copy.
The obvious way to arrange that is to give them a login. The obvious way is
wrong: it asks somebody who has no relationship with this platform to create
a password in order to pay a bill, and it creates an account directory of
every client of every tenant, which is a liability rather than an asset.

## The decision

A client has no account. They receive a signed link that unlocks exactly one
document, expires, can be revoked, and is resolved by a database routine
before a single row is read. The same mechanism carries payment pages and
signature invitations.

## What this costs

No client-side history across documents unless the business chooses to send
a statement. Tokens have to be treated as credentials: no referrer, no
indexing, no logging of the full address.

## What this buys

Payment in two clicks from an email, nothing to remember, nothing to leak,
and a far smaller blast radius if a link is forwarded.
