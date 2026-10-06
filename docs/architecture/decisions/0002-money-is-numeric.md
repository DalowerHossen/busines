# 2. Money is numeric, and decimal in the application

**Status:** accepted

## The problem

Floating point arithmetic cannot represent a tenth exactly. In an invoicing
product that shows up as a total that is a penny out, which destroys trust
faster than an outage, because an outage looks like bad luck and a wrong
total looks like dishonesty.

## The decision

Every money column is `numeric(18,4)`. Every calculation in the application
goes through a decimal helper and keeps its value as a string between the
database and the screen. The minor unit integer is stored alongside for the
payment providers that demand one, rather than being computed at the last
moment by multiplying a float by a hundred.

## What this costs

Money cannot be added with `+`. Every arithmetic site has to use the helper,
and lint rules exist to catch the ones that do not.

## What this buys

A total that agrees with itself on the screen, in the PDF, in the ledger and
in the provider's dashboard, in every currency including the ones with no
decimals at all.
