-- supabase/migrations/00001_extensions.sql
-- Enables every Postgres extension the schema relies on. Installed once,
-- into the dedicated `extensions` schema per Supabase convention (kept out
-- of `public` so application tables never collide with extension objects).

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;
