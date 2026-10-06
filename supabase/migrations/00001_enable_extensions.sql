-- supabase/migrations/00001_enable_extensions.sql
-- Enables the PostgreSQL extensions required by the KD SOLUTION IT platform.
-- Extensions are installed into the dedicated "extensions" schema so that the
-- public schema contains application objects only.

create schema if not exists extensions;

comment on schema extensions is
  'Container schema for PostgreSQL extensions used by the platform.';

-- Cryptographic primitives: digest(), gen_random_bytes(), crypt().
-- Required by the audit hash chain, secure token generation and UUID v7.
create extension if not exists pgcrypto with schema extensions;

-- Trigram matching, required by fuzzy search on clients, products and invoices.
create extension if not exists pg_trgm with schema extensions;

-- Accent insensitive text handling, required by slug generation and search.
create extension if not exists unaccent with schema extensions;

-- Case insensitive text type, used by email columns.
create extension if not exists citext with schema extensions;

-- Exclusion constraints on scalar types, used by date range guards.
create extension if not exists btree_gist with schema extensions;

-- Make extension functions resolvable without schema qualification for the
-- roles that execute application queries, and let those roles use the index
-- operator classes and types the extensions provide.
grant usage on schema extensions to public;

alter database postgres set search_path to public, extensions;
