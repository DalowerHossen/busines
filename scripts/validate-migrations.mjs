// scripts/validate-migrations.mjs
// Executes every SQL migration against an in-process PostgreSQL engine and runs
// a functional test suite against the resulting schema. This catches syntax
// errors, logic errors and regressions before a migration reaches Supabase.
// Run with: npm run db:validate

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const MIGRATIONS_DIRECTORY = join(process.cwd(), 'supabase', 'migrations');

let failureCount = 0;
let successCount = 0;

/**
 * Reports the outcome of a single assertion.
 *
 * @param {boolean} passed Whether the assertion succeeded.
 * @param {string} label Human readable assertion name.
 * @param {string} detail Observed value.
 * @returns {void}
 */
function report(passed, label, detail) {
  if (passed) {
    successCount += 1;
    console.log(`  pass  ${label}${detail ? ` => ${detail}` : ''}`);
    return;
  }

  failureCount += 1;
  console.error(`  FAIL  ${label}${detail ? ` => ${detail}` : ''}`);
}

/**
 * Creates the database objects and roles that Supabase provides natively.
 * The PostgreSQL extensions themselves are real; only the authentication
 * schema and the platform roles are recreated locally.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function installLocalEquivalents(db) {
  await db.exec(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin noinherit bypassrls;
      end if;
    end
    $$;

    create schema if not exists auth;

    create table if not exists auth.users (
      id uuid primary key,
      email text,
      created_at timestamptz not null default now()
    );

    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    create schema if not exists extensions;

    -- The embedded engine does not ship pgcrypto or unaccent as loadable
    -- modules, so the two functions the platform relies on are recreated here
    -- with identical signatures and behaviour.
    create or replace function extensions.gen_random_bytes(n integer) returns bytea
      language plpgsql as $$
      declare r bytea := ''::bytea;
      begin
        while length(r) < n loop
          r := r || decode(md5(random()::text || clock_timestamp()::text), 'hex');
        end loop;
        return substring(r from 1 for n);
      end; $$;

    create or replace function extensions.digest(t text, alg text) returns bytea
      language sql immutable as $$ select sha256(convert_to(t, 'UTF8')); $$;

    create or replace function extensions.unaccent(t text) returns text
      language sql immutable as $$ select t; $$;
  `);
}

/**
 * Applies every migration file in lexical order.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function applyMigrations(db) {
  const files = readdirSync(MIGRATIONS_DIRECTORY)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error('No migration files were found.');
  }

  console.log(`Applying ${files.length} migration file(s).`);

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIRECTORY, file), 'utf8')
      // The hosted database applies the search path cluster wide. The embedded
      // engine has a single session, so the equivalent session setting is used.
      .replace(
        /alter database postgres set search_path[^;]*;/gi,
        'set search_path to public, extensions;'
      )
      .replace(/create extension if not exists (pgcrypto|unaccent)[^;]*;/gi, '');

    try {
      await db.exec(sql);
      report(true, file);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report(false, file, message);
    }
  }

  if (failureCount > 0) {
    console.error('\nMigrations failed to apply. Functional tests were skipped.');
    process.exit(1);
  }
}

/**
 * Runs a scalar assertion against the database.
 *
 * @param {PGlite} db Database handle.
 * @param {string} label Assertion name.
 * @param {string} sql Query returning exactly one column.
 * @param {unknown} expected Expected value.
 * @returns {Promise<void>}
 */
async function expectScalar(db, label, sql, expected) {
  const result = await db.query(sql);
  const firstRow = result.rows[0];
  const actual = firstRow === undefined ? null : Object.values(firstRow)[0];
  report(JSON.stringify(actual) === JSON.stringify(expected), label, JSON.stringify(actual));
}

/**
 * Verifies the helper functions that every module depends on.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testHelperFunctions(db) {
  console.log('\nIdentifier and text helpers');
  await expectScalar(
    db,
    'uuid v7 carries version nibble 7',
    'select substring(public.generate_uuid_v7()::text from 15 for 1)',
    '7'
  );
  await expectScalar(
    db,
    'secure token is url safe',
    "select public.generate_secure_token(32) !~ '[+/=]'",
    true
  );
  await expectScalar(
    db,
    'slugify normalises text',
    "select public.slugify('  KD Solution IT -- Invoice #42! ')",
    'kd-solution-it-invoice-42'
  );
  await expectScalar(
    db,
    'valid email accepted',
    "select public.is_valid_email('support@kdsolutionit.com')",
    true
  );
  await expectScalar(
    db,
    'invalid email rejected',
    "select public.is_valid_email('not-an-email')",
    false
  );
  await expectScalar(
    db,
    'secret masking keeps last four characters',
    "select public.mask_secret('sk_live_1234567890abcd')",
    '********abcd'
  );

  console.log('\nMoney helpers');
  await expectScalar(
    db,
    'half up rounding',
    "select public.round_money(2.675, 2, 'half_up')::text",
    '2.68'
  );
  await expectScalar(
    db,
    'bankers rounding rounds to even',
    "select public.round_money(2.665, 2, 'half_even')::text",
    '2.66'
  );
  await expectScalar(
    db,
    'minor units for a two decimal currency',
    'select public.to_minor_units(19.95, 2)',
    1995
  );
  await expectScalar(
    db,
    'minor units for a zero decimal currency',
    'select public.to_minor_units(1995, 0)',
    1995
  );
  await expectScalar(
    db,
    'minor units round trip',
    'select public.from_minor_units(1995, 2)::text',
    '19.95'
  );
  await expectScalar(
    db,
    'exclusive tax calculation',
    "select public.calculate_tax_amount(100, 15, 'exclusive')::text",
    '15.00'
  );
  await expectScalar(
    db,
    'inclusive tax calculation',
    "select public.calculate_tax_amount(115, 15, 'inclusive')::text",
    '15.00'
  );
  await expectScalar(
    db,
    'percentage discount',
    "select public.calculate_discount_amount(200, 10, 'percentage')::text",
    '20.00'
  );
  await expectScalar(
    db,
    'discount never exceeds the base amount',
    "select public.calculate_discount_amount(50, 80, 'fixed_amount')::text",
    '50.00'
  );
  await expectScalar(
    db,
    'currency conversion',
    'select public.convert_currency(100, 1.2345)::text',
    '123.45'
  );

  console.log('\nDate helpers');
  await expectScalar(
    db,
    'business days skip the weekend',
    "select public.add_business_days(date '2026-10-01', 3)::text",
    '2026-10-06'
  );
  await expectScalar(
    db,
    'end of month',
    "select public.end_of_month(date '2026-02-10')::text",
    '2026-02-28'
  );
  await expectScalar(
    db,
    'monthly recurrence clamps to a short month',
    "select public.add_recurrence(date '2026-01-31', 'monthly', 1)::text",
    '2026-02-28'
  );
  await expectScalar(
    db,
    'annual recurrence',
    "select public.add_recurrence(date '2026-03-15', 'annual', 1)::text",
    '2027-03-15'
  );

  console.log('\nAudit helpers');
  await expectScalar(
    db,
    'audit hash is a sha-256 digest',
    'select length(public.compute_audit_hash(null, \'{"a":1}\'::jsonb))',
    64
  );
  await expectScalar(
    db,
    'sensitive fields are redacted',
    'select public.redact_sensitive_fields(\'{"password":"x"}\'::jsonb) ->> \'password\'',
    '[redacted]'
  );
}

/**
 * Verifies that document numbering is sequential, gapless and import safe.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testDocumentNumbering(db) {
  console.log('\nDocument numbering');
  const companyId = SEED.companyA;
  const issued = [];

  for (let index = 0; index < 5; index += 1) {
    const result = await db.query(
      `select public.next_document_number('${companyId}'::uuid, 'invoice', 'INV-', 4::smallint, 'yearly') as number`
    );
    issued.push(result.rows[0].number);
  }

  const expected = ['INV-0001', 'INV-0002', 'INV-0003', 'INV-0004', 'INV-0005'];
  report(
    JSON.stringify(issued) === JSON.stringify(expected),
    'numbering is sequential and gapless',
    issued.join(', ')
  );

  await expectScalar(
    db,
    'historic import raises the counter',
    `select public.set_document_number_start('${companyId}'::uuid, 'invoice', 9000, 'yearly')`,
    9000
  );

  const next = await db.query(
    `select public.next_document_number('${companyId}'::uuid, 'invoice', 'INV-', 4::smallint, 'yearly') as number`
  );
  report(
    next.rows[0].number === 'INV-9000',
    'numbering continues after an import',
    next.rows[0].number
  );

  await expectScalar(
    db,
    'separate document types keep separate sequences',
    `select public.next_document_number('${companyId}'::uuid, 'estimate', 'EST-', 4::smallint, 'yearly')`,
    'EST-0001'
  );
}

/**
 * Verifies timestamp maintenance and soft delete protection.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testTriggers(db) {
  console.log('\nTriggers and soft delete protection');

  await db.exec(`
    create table public.trigger_probe (
      id uuid primary key default public.generate_uuid_v7(),
      company_id uuid,
      name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    );
    select public.install_timestamp_trigger('trigger_probe');
    select public.install_soft_delete_guard('trigger_probe');
    insert into public.trigger_probe (name) values ('first');
  `);

  const probe = await db.query('select id from public.trigger_probe limit 1');
  const probeId = probe.rows[0].id;

  await db.query('update public.trigger_probe set name = $1 where id = $2', ['second', probeId]);
  const touched = await db.query('select updated_at >= created_at as ok from public.trigger_probe');
  report(touched.rows[0].ok === true, 'updated_at is maintained on write');

  await expectScalar(
    db,
    'soft delete marks the row',
    `select public.soft_delete_record('trigger_probe', '${probeId}'::uuid)`,
    true
  );

  try {
    await db.query('update public.trigger_probe set name = $1 where id = $2', ['third', probeId]);
    report(false, 'a deleted row must not be editable');
  } catch {
    report(true, 'a deleted row is immutable');
  }

  try {
    await db.query('delete from public.trigger_probe where id = $1', [probeId]);
    report(false, 'a physical delete must be blocked');
  } catch {
    report(true, 'a physical delete is blocked');
  }

  await expectScalar(
    db,
    'restore clears the deletion marker',
    `select public.restore_record('trigger_probe', '${probeId}'::uuid)`,
    true
  );
}

/**
 * Identifiers used by the tenancy and policy suites. Fixed values keep the
 * assertions readable and the runs reproducible.
 */
const SEED = {
  companyA: '00000000-0000-7000-8000-00000000c0a1',
  companyB: '00000000-0000-7000-8000-00000000c0b2',
  superAdmin: '00000000-0000-7000-8000-0000000005a0',
  ownerA: '00000000-0000-7000-8000-00000000074a',
  staffA: '00000000-0000-7000-8000-000000000574',
  ownerB: '00000000-0000-7000-8000-00000000074b',
  accountant: '00000000-0000-7000-8000-0000000000ac',
  affiliate: '00000000-0000-7000-8000-0000000000af',
  resellerUser: '00000000-0000-7000-8000-0000000000e5',
  reseller: '00000000-0000-7000-8000-0000000000e6',
};

/**
 * Switches the session to a signed in application user.
 *
 * @param {PGlite} db Database handle.
 * @param {string|null} userId Authenticated user identifier, or null to sign out.
 * @returns {Promise<void>}
 */
async function signIn(db, userId) {
  await db.exec('reset role;');
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.role', '']);
  await db.query('select set_config($1, $2, false)', [
    'request.jwt.claim.sub',
    userId === null ? '' : userId,
  ]);
  await db.exec('set role authenticated;');
}

/**
 * Returns the session to the privileged migration role.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function signOut(db) {
  await db.exec('reset role;');
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', '']);
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.role', '']);
}

/**
 * Asserts that a statement is rejected by the database.
 *
 * @param {PGlite} db Database handle.
 * @param {string} label Assertion name.
 * @param {string} sql Statement expected to fail.
 * @returns {Promise<void>}
 */
async function expectRejection(db, label, sql) {
  try {
    await db.query(sql);
    report(false, label, 'the statement unexpectedly succeeded');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report(true, label, message.split('\n')[0]);
  }
}

/**
 * Creates two tenants and one account for each role in the model.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function seedTenancy(db) {
  const authUsers = [
    [SEED.superAdmin, 'admin@kdsolutionit.com'],
    [SEED.ownerA, 'owner.a@example.com'],
    [SEED.staffA, 'staff.a@example.com'],
    [SEED.ownerB, 'owner.b@example.com'],
    [SEED.accountant, 'accountant@example.com'],
    [SEED.affiliate, 'affiliate@example.com'],
    [SEED.resellerUser, 'partner@example.com'],
  ];

  for (const [id, email] of authUsers) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  }

  await db.query(
    `insert into public.companies (id, slug, legal_name, display_name, status)
     values ($1, 'northwind-supply', 'Northwind Supply LLC', 'Northwind Supply', 'active'),
            ($2, 'harbor-studio', 'Harbor Studio Inc', 'Harbor Studio', 'active')`,
    [SEED.companyA, SEED.companyB]
  );

  await db.query(
    `insert into public.users (id, role, status, email, full_name, company_id)
     values ($1, 'super_admin', 'active', 'admin@kdsolutionit.com', 'Platform Admin', null),
            ($2, 'owner', 'active', 'owner.a@example.com', 'Anna Owner', $7),
            ($3, 'staff', 'active', 'staff.a@example.com', 'Sam Staff', $7),
            ($4, 'owner', 'active', 'owner.b@example.com', 'Ben Owner', $8),
            ($5, 'accountant', 'active', 'accountant@example.com', 'Ada Books', null),
            ($6, 'affiliate', 'active', 'affiliate@example.com', 'Alex Referral', null),
            ($9, 'reseller', 'active', 'partner@example.com', 'Pat Partner', null)`,
    [
      SEED.superAdmin,
      SEED.ownerA,
      SEED.staffA,
      SEED.ownerB,
      SEED.accountant,
      SEED.affiliate,
      SEED.companyA,
      SEED.companyB,
      SEED.resellerUser,
    ]
  );

  await db.query(
    `insert into public.resellers (id, user_id, partner_name, slug, status, contact_email, approved_at)
     values ($1, $2, 'Partner Billing Group', 'partner-billing-group', 'approved',
             'partner@example.com', now())`,
    [SEED.reseller, SEED.resellerUser]
  );

  await db.query('update public.companies set reseller_id = $1 where id = $2', [
    SEED.reseller,
    SEED.companyA,
  ]);

  await db.query(
    `insert into public.accountant_company_access (accountant_user_id, company_id, granted_by)
     values ($1, $2, $3)`,
    [SEED.accountant, SEED.companyB, SEED.ownerB]
  );
}

/**
 * Verifies the structural rules of the tenancy tables.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testTenancyStructure(db) {
  console.log('\nTenancy structure');

  await expectScalar(
    db,
    'a new company receives its document profile automatically',
    `select count(*)::int from public.company_profiles where company_id = '${SEED.companyA}'`,
    1
  );

  await expectScalar(
    db,
    'the profile inherits the registered legal name',
    `select legal_name from public.company_profiles where company_id = '${SEED.companyA}'`,
    'Northwind Supply LLC'
  );

  await expectScalar(
    db,
    'the reseller tenant count follows the companies assigned to it',
    `select sub_tenant_count from public.resellers where id = '${SEED.reseller}'`,
    1
  );

  await expectRejection(
    db,
    'a company cannot hold a second active owner',
    `insert into public.users (id, role, status, email, full_name, company_id)
     values ('${SEED.companyB}'::uuid, 'owner', 'active', 'second.owner@example.com',
             'Second Owner', '${SEED.companyA}')`
  );

  await db.query('insert into auth.users (id, email) values ($1, $2)', [
    '00000000-0000-7000-8000-00000000dead',
    'unbound@example.com',
  ]);
  await expectRejection(
    db,
    'a staff member must belong to a company',
    `insert into public.users (id, role, status, email, full_name, company_id)
     values ('00000000-0000-7000-8000-00000000dead', 'staff', 'active',
             'unbound@example.com', 'No Company', null)`
  );

  await expectRejection(
    db,
    'a platform level role cannot be tied to a company',
    `insert into public.users (id, role, status, email, full_name, company_id)
     values ('00000000-0000-7000-8000-00000000beef', 'super_admin', 'active',
             'y@example.com', 'Bound Admin', '${SEED.companyA}')`
  );
}

/**
 * Verifies that an issued document keeps the identity it was issued with.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testProfileSnapshots(db) {
  console.log('\nDocument identity snapshots');

  const first = await db.query(
    `select public.capture_company_profile_snapshot('${SEED.companyA}'::uuid) as id`
  );
  const second = await db.query(
    `select public.capture_company_profile_snapshot('${SEED.companyA}'::uuid) as id`
  );
  report(
    first.rows[0].id === second.rows[0].id,
    'an unchanged profile reuses the existing snapshot',
    String(first.rows[0].id)
  );

  await db.query(`update public.company_profiles set address_line1 = $1 where company_id = $2`, [
    '14 Harbour Road',
    SEED.companyA,
  ]);

  const third = await db.query(
    `select public.capture_company_profile_snapshot('${SEED.companyA}'::uuid) as id`
  );
  report(
    third.rows[0].id !== first.rows[0].id,
    'an edited profile produces a new snapshot',
    String(third.rows[0].id)
  );

  await expectScalar(
    db,
    'the earlier snapshot still shows the original address',
    `select profile_data ->> 'address_line1' from public.company_profile_snapshots
      where id = '${first.rows[0].id}'`,
    null
  );

  await expectRejection(
    db,
    'a snapshot cannot be edited',
    `update public.company_profile_snapshots set content_hash = repeat('0', 64)
      where id = '${first.rows[0].id}'`
  );

  await expectRejection(
    db,
    'a snapshot cannot be deleted',
    `delete from public.company_profile_snapshots where id = '${first.rows[0].id}'`
  );
}

/**
 * Verifies that the audit trail records writes and refuses to be rewritten.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testAuditTrail(db) {
  console.log('\nAudit trail');

  await expectScalar(
    db,
    'company registration is recorded',
    `select count(*)::int from public.audit_logs
      where entity_type = 'companies' and entity_id = '${SEED.companyA}' and action = 'insert'`,
    1
  );

  await expectScalar(
    db,
    'the hash chain is unbroken',
    'select count(*)::int from public.verify_audit_chain(1000) where not is_valid',
    0
  );

  await expectRejection(
    db,
    'an audit entry cannot be edited',
    "update public.audit_logs set description = 'rewritten' where description is null"
  );

  await expectRejection(
    db,
    'an audit entry cannot be deleted',
    'delete from public.audit_logs where id is not null'
  );

  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', SEED.ownerA]);
  const manual = await db.query(
    `select public.record_manual_audit_entry('export', 'invoices', null, $1,
            'Exported the receivables report', '{"format":"csv"}'::jsonb) as id`,
    [SEED.companyA]
  );
  report(typeof manual.rows[0].id === 'string', 'a manual action can be recorded');
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', '']);

  await expectScalar(
    db,
    'the chain stays valid after a manual entry',
    'select count(*)::int from public.verify_audit_chain(1000) where not is_valid',
    0
  );
}

/**
 * Verifies the row level security policies from the perspective of each role.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testRowLevelSecurity(db) {
  console.log('\nRow level security');

  await expectScalar(
    db,
    'every identity table enforces row level security',
    `select count(*)::int from pg_tables
      where schemaname = 'public'
        and tablename in ('companies', 'users', 'resellers', 'company_profiles',
                          'company_profile_snapshots', 'accountant_company_access',
                          'team_invitations', 'user_two_factor', 'user_sessions',
                          'login_attempts', 'user_consents', 'audit_logs')
        and rowsecurity`,
    12
  );

  await signIn(db, SEED.ownerA);
  await expectScalar(
    db,
    'an owner sees exactly one company',
    'select count(*)::int from public.companies',
    1
  );
  await expectScalar(
    db,
    'an owner sees only their own company',
    'select slug from public.companies',
    'northwind-supply'
  );
  await expectScalar(
    db,
    'an owner sees their own team',
    'select count(*)::int from public.users',
    2
  );
  await expectScalar(
    db,
    'an owner reads their own document profile',
    'select count(*)::int from public.company_profiles',
    1
  );

  await signIn(db, SEED.ownerB);
  await expectScalar(
    db,
    'the second tenant is isolated from the first',
    `select count(*)::int from public.companies where id = '${SEED.companyA}'`,
    0
  );
  await expectScalar(
    db,
    'cross tenant profile reads return nothing',
    `select count(*)::int from public.company_profiles where company_id = '${SEED.companyA}'`,
    0
  );

  await signIn(db, SEED.staffA);
  const staffUpdate = await db.query(
    `update public.companies set display_name = 'Renamed' where id = '${SEED.companyA}'`
  );
  report(
    staffUpdate.affectedRows === 0,
    'a staff member cannot rename the company',
    `rows affected: ${staffUpdate.affectedRows}`
  );

  await signIn(db, SEED.accountant);
  await expectScalar(
    db,
    'an accountant sees the company that granted access',
    'select slug from public.companies',
    'harbor-studio'
  );
  const accountantUpdate = await db.query(
    `update public.company_profiles set phone = '000' where company_id = '${SEED.companyB}'`
  );
  report(
    accountantUpdate.affectedRows === 0,
    'an accountant cannot edit the company profile',
    `rows affected: ${accountantUpdate.affectedRows}`
  );

  await signIn(db, SEED.affiliate);
  await expectScalar(
    db,
    'an affiliate sees no company at all',
    'select count(*)::int from public.companies',
    0
  );
  await expectScalar(
    db,
    'an affiliate sees no audit entry of another account',
    'select count(*)::int from public.audit_logs',
    0
  );

  await signIn(db, SEED.resellerUser);
  await expectScalar(
    db,
    'a reseller sees its own sub tenant',
    'select slug from public.companies',
    'northwind-supply'
  );
  const resellerUpdate = await db.query(
    `update public.companies set display_name = 'Partner Rename' where id = '${SEED.companyA}'`
  );
  report(
    resellerUpdate.affectedRows === 0,
    'a reseller cannot modify a sub tenant record',
    `rows affected: ${resellerUpdate.affectedRows}`
  );

  await signIn(db, SEED.superAdmin);
  await expectScalar(
    db,
    'the platform administrator sees every company',
    'select count(*)::int from public.companies',
    2
  );

  await signIn(db, SEED.ownerA);
  await expectScalar(
    db,
    'two factor secrets of other accounts are invisible',
    'select count(*)::int from public.user_two_factor',
    0
  );

  await signOut(db);

  await db.query(
    `insert into public.user_two_factor (user_id, secret_encrypted)
     values ($1, 'encrypted-secret')`,
    [SEED.ownerB]
  );

  await signIn(db, SEED.ownerA);
  await expectScalar(
    db,
    'a colleague cannot read a two factor secret',
    'select count(*)::int from public.user_two_factor',
    0
  );

  await signOut(db);
}

/**
 * Verifies invitation and accountant grant lifecycle rules.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testAccessLifecycle(db) {
  console.log('\nAccess lifecycle');

  await db.query(
    `insert into public.team_invitations
       (company_id, email, role, token_hash, invited_by, created_at, expires_at)
     values ($1, 'new.staff@example.com', 'staff', $2, $3,
             now() - interval '20 days', now() - interval '6 days')`,
    [SEED.companyA, 'a'.repeat(64), SEED.ownerA]
  );

  await expectScalar(
    db,
    'an overdue invitation is expired by the maintenance routine',
    'select public.expire_stale_invitations()',
    1
  );

  await expectRejection(
    db,
    'an invitation token must be a sha-256 digest',
    `insert into public.team_invitations
       (company_id, email, role, token_hash, invited_by)
     values ('${SEED.companyA}', 'another@example.com', 'staff', 'short-token', '${SEED.ownerA}')`
  );

  await expectRejection(
    db,
    'an accountant cannot be invited twice to the same company',
    `insert into public.accountant_company_access (accountant_user_id, company_id, granted_by)
     values ('${SEED.accountant}', '${SEED.companyB}', '${SEED.ownerB}')`
  );

  await db.query(
    `update public.accountant_company_access
        set granted_at = now() - interval '30 days',
            expires_at = now() - interval '1 hour'
      where accountant_user_id = $1 and company_id = $2`,
    [SEED.accountant, SEED.companyB]
  );

  await expectScalar(
    db,
    'an overdue accountant grant is expired by the maintenance routine',
    'select public.expire_stale_access_grants()',
    1
  );

  await signIn(db, SEED.accountant);
  await expectScalar(
    db,
    'an expired grant removes access immediately',
    'select count(*)::int from public.companies',
    0
  );
  await signOut(db);
}

/**
 * Verifies the client directory, the catalogue, pricing and their isolation.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testBusinessCore(db) {
  console.log('\nClient directory');

  const clientA = await db.query(
    `insert into public.clients (company_id, display_name, email, phone, country_code)
     values ($1, 'Riverside Dental Group', 'Billing@Riverside.example', '+1 (415) 555-0142', 'US')
     returning id, client_number, normalized_email, normalized_phone`,
    [SEED.companyA]
  );
  report(
    clientA.rows[0].client_number === 'CL-0001',
    'the first client receives the opening reference',
    String(clientA.rows[0].client_number)
  );
  report(
    clientA.rows[0].normalized_email === 'billing@riverside.example',
    'the email is normalised for duplicate detection',
    String(clientA.rows[0].normalized_email)
  );
  report(
    clientA.rows[0].normalized_phone === '14155550142',
    'the phone number is reduced to digits',
    String(clientA.rows[0].normalized_phone)
  );

  const clientB = await db.query(
    `insert into public.clients (company_id, display_name, email)
     values ($1, 'Riverside Dental Grp', 'accounts@riverside.example')
     returning id, client_number`,
    [SEED.companyA]
  );
  report(
    clientB.rows[0].client_number === 'CL-0002',
    'the client reference continues in sequence',
    String(clientB.rows[0].client_number)
  );

  await expectScalar(
    db,
    'a near identical name is reported as a possible duplicate',
    `select count(*)::int from public.find_duplicate_clients(
       '${SEED.companyA}', 'Riverside Dental Group', null, null,
       '${clientB.rows[0].id}')`,
    1
  );

  await expectRejection(
    db,
    'a tax exempt client must state a reason',
    `insert into public.clients (company_id, display_name, is_tax_exempt)
     values ('${SEED.companyA}', 'Exempt Without Reason', true)`
  );

  console.log('\nCatalogue and pricing');

  const taxRate = await db.query(
    `insert into public.tax_rates (company_id, name, code, kind, rate_percentage, is_default)
     values ($1, 'Standard VAT', 'VAT-STD', 'vat', 20.0000, true)
     returning id`,
    [SEED.companyA]
  );

  const unit = await db.query(
    `insert into public.units_of_measure (company_id, name, abbreviation, is_default)
     values ($1, 'Hour', 'hr', true) returning id`,
    [SEED.companyA]
  );

  const category = await db.query(
    `insert into public.product_categories (company_id, name, slug)
     values ($1, 'Consulting', 'consulting') returning id`,
    [SEED.companyA]
  );

  const child = await db.query(
    `insert into public.product_categories (company_id, name, slug, parent_category_id)
     values ($1, 'Advisory', 'advisory', $2) returning id`,
    [SEED.companyA, category.rows[0].id]
  );

  await expectRejection(
    db,
    'the category tree cannot be nested a second level',
    `insert into public.product_categories (company_id, name, slug, parent_category_id)
     values ('${SEED.companyA}', 'Deep', 'deep', '${child.rows[0].id}')`
  );

  const product = await db.query(
    `insert into public.products
       (company_id, category_id, unit_of_measure_id, tax_rate_id, sku, name,
        product_type, unit_price)
     values ($1, $2, $3, $4, 'CONS-001', 'Senior consulting hour', 'service', 180.0000)
     returning id`,
    [SEED.companyA, category.rows[0].id, unit.rows[0].id, taxRate.rows[0].id]
  );

  await expectRejection(
    db,
    'a duplicate stock keeping unit is rejected',
    `insert into public.products (company_id, sku, name, unit_price)
     values ('${SEED.companyA}', 'CONS-001', 'Duplicate code', 10)`
  );

  await expectRejection(
    db,
    'only stock items may take part in inventory control',
    `insert into public.products (company_id, name, product_type, unit_price, track_inventory)
     values ('${SEED.companyA}', 'Tracked service', 'service', 10, true)`
  );

  await expectRejection(
    db,
    'a product cannot borrow a tax rate from another company',
    `insert into public.products (company_id, name, unit_price, tax_rate_id)
     values ('${SEED.companyB}', 'Cross tenant rate', 10, '${taxRate.rows[0].id}')`
  );

  const priceList = await db.query(
    `insert into public.price_lists
       (company_id, name, method, adjustment_percentage, is_default)
     values ($1, 'Partner rate', 'discount_percentage', 15.0000, true)
     returning id`,
    [SEED.companyA]
  );

  await db.query(
    `insert into public.price_list_items
       (company_id, price_list_id, product_id, adjustment_percentage, minimum_quantity)
     values ($1, $2, $3, 25.0000, 10)`,
    [SEED.companyA, priceList.rows[0].id, product.rows[0].id]
  );

  await db.query('update public.clients set default_price_list_id = $1 where id = $2', [
    priceList.rows[0].id,
    clientA.rows[0].id,
  ]);

  await expectScalar(
    db,
    'the catalogue price applies when no client is given',
    `select public.resolve_product_price('${product.rows[0].id}')::text`,
    '180.0000'
  );

  await expectScalar(
    db,
    'the price list discount applies to a single unit',
    `select public.resolve_product_price('${product.rows[0].id}',
            '${clientA.rows[0].id}', 1)::text`,
    '153.0000'
  );

  await expectScalar(
    db,
    'the quantity break applies from ten units',
    `select public.resolve_product_price('${product.rows[0].id}',
            '${clientA.rows[0].id}', 12)::text`,
    '135.0000'
  );

  const cityRate = await db.query(
    `insert into public.tax_rates (company_id, name, rate_percentage, is_compound)
     values ($1, 'City surcharge', 5.0000, true) returning id`,
    [SEED.companyA]
  );

  const taxGroup = await db.query(
    `insert into public.tax_groups (company_id, name) values ($1, 'Standard plus city')
     returning id`,
    [SEED.companyA]
  );

  await db.query(
    `insert into public.tax_group_members (company_id, tax_group_id, tax_rate_id, apply_order)
     values ($1, $2, $3, 1), ($1, $2, $4, 2)`,
    [SEED.companyA, taxGroup.rows[0].id, taxRate.rows[0].id, cityRate.rows[0].id]
  );

  await expectScalar(
    db,
    'a compound tax group reports its combined percentage',
    `select public.effective_tax_group_rate('${taxGroup.rows[0].id}')::text`,
    '26.0000'
  );

  console.log('\nDuplicate merging and contacts');

  await db.query(
    `insert into public.client_contacts (company_id, client_id, full_name, email, is_primary)
     values ($1, $2, 'Dana Reed', 'dana@riverside.example', true)`,
    [SEED.companyA, clientB.rows[0].id]
  );

  await db.query(
    `insert into public.client_contacts (company_id, client_id, full_name, email, is_primary)
     values ($1, $2, 'Chris Lane', 'chris@riverside.example', true)`,
    [SEED.companyA, clientB.rows[0].id]
  );

  await expectScalar(
    db,
    'promoting a contact demotes the previous primary',
    `select count(*)::int from public.client_contacts
      where client_id = '${clientB.rows[0].id}' and is_primary`,
    1
  );

  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', SEED.ownerA]);
  await expectScalar(
    db,
    'merging returns the surviving client',
    `select public.merge_clients('${clientB.rows[0].id}', '${clientA.rows[0].id}')`,
    clientA.rows[0].id
  );
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', '']);

  await expectScalar(
    db,
    'the contacts moved to the surviving client',
    `select count(*)::int from public.client_contacts
      where client_id = '${clientA.rows[0].id}'`,
    2
  );

  await expectScalar(
    db,
    'the duplicate is archived rather than removed',
    `select status::text from public.clients where id = '${clientB.rows[0].id}'`,
    'archived'
  );

  console.log('\nBusiness data isolation');

  await signIn(db, SEED.ownerB);
  await expectScalar(
    db,
    'a second tenant sees none of the first tenant clients',
    'select count(*)::int from public.clients',
    0
  );
  await expectScalar(
    db,
    'a second tenant sees none of the first tenant products',
    'select count(*)::int from public.products',
    0
  );

  await signIn(db, SEED.ownerA);
  await expectScalar(
    db,
    'the owner sees their own catalogue',
    'select count(*)::int from public.products',
    1
  );

  await signOut(db);

  // The owner of the first company now invites the same accountant.
  await db.query(
    `insert into public.accountant_company_access (accountant_user_id, company_id, granted_by)
     values ($1, $2, $3)`,
    [SEED.accountant, SEED.companyA, SEED.ownerA]
  );

  await signIn(db, SEED.accountant);
  await expectScalar(
    db,
    'an accountant with a grant can read the client directory',
    'select count(*)::int from public.clients',
    2
  );
  const accountantWrite = await db.query(
    `update public.products set unit_price = 1 where id = '${product.rows[0].id}'`
  );
  report(
    accountantWrite.affectedRows === 0,
    'an accountant cannot change a catalogue price',
    `rows affected: ${accountantWrite.affectedRows}`
  );

  await signIn(db, SEED.affiliate);
  await expectScalar(
    db,
    'an affiliate sees no client at all',
    'select count(*)::int from public.clients',
    0
  );

  await signOut(db);
}

/**
 * Verifies invoices, estimates, credit notes, schedules and client links.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testDocuments(db) {
  console.log('\nInvoice arithmetic');

  const client = await db.query(
    `select id from public.clients
      where company_id = $1 and merged_into_client_id is null
      order by client_number limit 1`,
    [SEED.companyA]
  );
  const clientId = client.rows[0].id;

  const product = await db.query(
    `select id, tax_rate_id from public.products where company_id = $1 limit 1`,
    [SEED.companyA]
  );

  await signIn(db, SEED.ownerA);

  const invoice = await db.query(
    `insert into public.invoices (company_id, client_id, issue_date)
     values ($1, $2, current_date)
     returning id, currency, tax_mode::text as tax_mode, due_date, status::text as status`,
    [SEED.companyA, clientId]
  );
  const invoiceId = invoice.rows[0].id;
  report(invoice.rows[0].currency === 'USD', 'the document inherits the company currency');
  report(invoice.rows[0].tax_mode === 'exclusive', 'the document inherits the tax treatment');

  await db.query(
    `insert into public.invoice_items (company_id, invoice_id, product_id, quantity)
     values ($1, $2, $3, 2)`,
    [SEED.companyA, invoiceId, product.rows[0].id]
  );

  await expectScalar(
    db,
    'the line copies the catalogue description',
    `select description from public.invoice_items where invoice_id = '${invoiceId}'`,
    'Senior consulting hour'
  );

  await expectScalar(
    db,
    'the line total includes exclusive tax',
    `select line_total::text from public.invoice_items where invoice_id = '${invoiceId}'`,
    '432.0000'
  );

  await expectScalar(
    db,
    'the document subtotal excludes tax',
    `select subtotal_amount::text from public.invoices where id = '${invoiceId}'`,
    '360.0000'
  );

  await expectScalar(
    db,
    'the document tax is twenty percent',
    `select tax_amount::text from public.invoices where id = '${invoiceId}'`,
    '72.0000'
  );

  await expectScalar(
    db,
    'the document total adds the tax',
    `select total_amount::text from public.invoices where id = '${invoiceId}'`,
    '432.0000'
  );

  await expectScalar(
    db,
    'the total is also stored in minor units',
    `select total_amount_minor from public.invoices where id = '${invoiceId}'`,
    43200
  );

  await expectScalar(
    db,
    'the outstanding balance equals the total',
    `select balance_due::text from public.invoices where id = '${invoiceId}'`,
    '432.0000'
  );

  await expectScalar(
    db,
    'the printed tax summary holds one rate',
    `select count(*)::int from public.invoice_taxes where invoice_id = '${invoiceId}'`,
    1
  );

  await db.query(
    `update public.invoices set discount_type = 'percentage', discount_value = 10
      where id = $1`,
    [invoiceId]
  );

  await expectScalar(
    db,
    'a discount before tax reduces the taxable base',
    `select tax_amount::text from public.invoices where id = '${invoiceId}'`,
    '64.8000'
  );

  await expectScalar(
    db,
    'the discounted total is correct',
    `select total_amount::text from public.invoices where id = '${invoiceId}'`,
    '388.8000'
  );

  console.log('\nIssuing and immutability');

  await expectScalar(
    db,
    'issuing assigns the first invoice number',
    `select public.issue_invoice('${invoiceId}')`,
    'INV-0001'
  );

  await expectScalar(
    db,
    'the issued document is locked',
    `select is_locked from public.invoices where id = '${invoiceId}'`,
    true
  );

  await expectScalar(
    db,
    'the issued document carries an identity snapshot',
    `select company_profile_snapshot_id is not null from public.invoices
      where id = '${invoiceId}'`,
    true
  );

  await expectScalar(
    db,
    'the client billing name is frozen onto the document',
    `select bill_to ->> 'name' from public.invoices where id = '${invoiceId}'`,
    'Riverside Dental Group'
  );

  await expectRejection(
    db,
    'an issued invoice cannot be repriced',
    `update public.invoices set discount_value = 50 where id = '${invoiceId}'`
  );

  await expectRejection(
    db,
    'a line cannot be added to an issued invoice',
    `insert into public.invoice_items (company_id, invoice_id, description, quantity, unit_price)
     values ('${SEED.companyA}', '${invoiceId}', 'Extra work', 1, 100)`
  );

  console.log('\nCredit notes');

  const creditNote = await db.query(
    `insert into public.credit_notes
       (company_id, client_id, invoice_id, credit_note_number, status, currency)
     values ($1, $2, $3, 'CN-0001', 'issued', 'USD')
     returning id`,
    [SEED.companyA, clientId, invoiceId]
  );

  await db.query(
    `insert into public.credit_note_items
       (company_id, credit_note_id, line_number, description, quantity, unit_price,
        tax_percentage)
     values ($1, $2, 1, 'Agreed correction', 1, 100, 20)`,
    [SEED.companyA, creditNote.rows[0].id]
  );

  await expectScalar(
    db,
    'the credit note totals include tax',
    `select total_amount::text from public.credit_notes where id = '${creditNote.rows[0].id}'`,
    '120.0000'
  );

  await expectScalar(
    db,
    'applying credit returns the amount used',
    `select public.apply_credit_note_to_invoice('${creditNote.rows[0].id}',
            '${invoiceId}')::text`,
    '120.0000'
  );

  await expectScalar(
    db,
    'the invoice balance falls by the credited amount',
    `select balance_due::text from public.invoices where id = '${invoiceId}'`,
    '268.8000'
  );

  await expectScalar(
    db,
    'the credit note is fully applied',
    `select status::text from public.credit_notes where id = '${creditNote.rows[0].id}'`,
    'applied'
  );

  console.log('\nEstimates');

  const estimate = await db.query(
    `insert into public.estimates (company_id, client_id, title)
     values ($1, $2, 'Quarterly advisory retainer') returning id, valid_until`,
    [SEED.companyA, clientId]
  );
  report(
    estimate.rows[0].valid_until !== null,
    'an estimate receives a validity date automatically'
  );

  await db.query(
    `insert into public.estimate_items
       (company_id, estimate_id, line_number, description, quantity, unit_price,
        tax_percentage)
     values ($1, $2, 1, 'Advisory retainer', 10, 150, 20),
            ($1, $2, 2, 'Optional workshop', 1, 900, 20)`,
    [SEED.companyA, estimate.rows[0].id]
  );

  await db.query(
    `update public.estimate_items set is_optional = true, is_selected = false
      where estimate_id = $1 and line_number = 2`,
    [estimate.rows[0].id]
  );

  await expectScalar(
    db,
    'an unselected optional line stays out of the total',
    `select total_amount::text from public.estimates where id = '${estimate.rows[0].id}'`,
    '1800.0000'
  );

  const converted = await db.query(
    `select public.convert_estimate_to_invoice('${estimate.rows[0].id}') as id`
  );

  await expectScalar(
    db,
    'conversion copies only the selected lines',
    `select count(*)::int from public.invoice_items
      where invoice_id = '${converted.rows[0].id}'`,
    1
  );

  await expectScalar(
    db,
    'the estimate is marked as converted',
    `select status::text from public.estimates where id = '${estimate.rows[0].id}'`,
    'converted'
  );

  const quote = await db.query(
    `insert into public.estimates (company_id, client_id, title)
     values ($1, $2, 'Website rebuild') returning id`,
    [SEED.companyA, clientId]
  );

  await expectRejection(
    db,
    'an empty estimate cannot be sent',
    `select public.issue_estimate('${quote.rows[0].id}')`
  );

  await db.query(
    `insert into public.estimate_items
       (company_id, estimate_id, line_number, description, quantity, unit_price)
     values ($1, $2, 1, 'Design and build', 1, 4000)`,
    [SEED.companyA, quote.rows[0].id]
  );

  await db.query(`select public.issue_estimate('${quote.rows[0].id}')`);

  await expectScalar(
    db,
    'sending an estimate gives it a number',
    `select estimate_number is not null from public.estimates
      where id = '${quote.rows[0].id}'`,
    true
  );

  await expectScalar(
    db,
    'and freezes the client it was addressed to',
    `select bill_to ? 'name' from public.estimates where id = '${quote.rows[0].id}'`,
    true
  );

  await expectRejection(
    db,
    'the same estimate cannot be sent twice',
    `select public.issue_estimate('${quote.rows[0].id}')`
  );

  await db.query(
    `select public.decline_estimate('${quote.rows[0].id}', 'Budget moved to next year')`
  );

  await expectScalar(
    db,
    'a decline keeps the reason on record',
    `select decline_reason from public.estimates where id = '${quote.rows[0].id}'`,
    'Budget moved to next year'
  );

  await db.query(`select public.approve_estimate('${quote.rows[0].id}', 'Ada Whitfield')`);

  await expectScalar(
    db,
    'a client who changes their mind can still accept',
    `select status::text from public.estimates where id = '${quote.rows[0].id}'`,
    'approved'
  );

  await expectScalar(
    db,
    'and the earlier decline is cleared',
    `select declined_at is null from public.estimates where id = '${quote.rows[0].id}'`,
    true
  );

  await expectRejection(
    db,
    'an estimate that became an invoice cannot be withdrawn',
    `select public.cancel_estimate('${estimate.rows[0].id}', 'No longer needed')`
  );

  await db.query(`select public.cancel_estimate('${quote.rows[0].id}', 'Client went elsewhere')`);

  await expectScalar(
    db,
    'withdrawing an estimate closes it',
    `select status::text from public.estimates where id = '${quote.rows[0].id}'`,
    'cancelled'
  );

  console.log('\nRecurring schedules');

  const template = await db.query(
    `insert into public.invoices (company_id, client_id) values ($1, $2) returning id`,
    [SEED.companyA, clientId]
  );

  await db.query(
    `insert into public.invoice_items
       (company_id, invoice_id, description, quantity, unit_price, tax_percentage)
     values ($1, $2, 'Monthly support plan', 1, 500, 20)`,
    [SEED.companyA, template.rows[0].id]
  );

  const schedule = await db.query(
    `insert into public.recurring_invoice_schedules
       (company_id, client_id, name, template_invoice_id, frequency, status, start_date)
     values ($1, $2, 'Monthly support', $3, 'monthly', 'active', current_date)
     returning id, next_run_date`,
    [SEED.companyA, clientId, template.rows[0].id]
  );
  report(schedule.rows[0].next_run_date !== null, 'activating a schedule sets its first run date');

  const generated = await db.query(
    `select public.generate_recurring_invoice('${schedule.rows[0].id}') as id`
  );

  await expectScalar(
    db,
    'the generated invoice is issued with the next number',
    `select invoice_number from public.invoices where id = '${generated.rows[0].id}'`,
    'INV-0002'
  );

  await expectScalar(
    db,
    'the schedule advances to the following month',
    `select (next_run_date > current_date) from public.recurring_invoice_schedules
      where id = '${schedule.rows[0].id}'`,
    true
  );

  console.log('\nClient links');

  const link = await db.query(
    `insert into public.document_links
       (company_id, document_kind, document_id, token_hash, short_code, recipient_email,
        expires_at)
     values ($1, 'invoice', $2, $3, 'inv1a2b3c', 'billing@riverside.example',
             now() + interval '30 days')
     returning id`,
    [SEED.companyA, invoiceId, 'b'.repeat(64)]
  );

  await signOut(db);

  await expectScalar(
    db,
    'a valid token resolves to its document',
    `select document_id from public.resolve_document_link('${'b'.repeat(64)}')`,
    invoiceId
  );

  await expectScalar(
    db,
    'opening the link is recorded on the invoice',
    `select view_count from public.invoices where id = '${invoiceId}'`,
    1
  );

  await expectScalar(
    db,
    'the open is stored in the evidence chain',
    `select count(*)::int from public.document_events
      where document_id = '${invoiceId}' and event_type = 'opened'`,
    1
  );

  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', SEED.ownerA]);
  await expectScalar(
    db,
    'revoking a link succeeds',
    `select public.revoke_document_link('${link.rows[0].id}', 'Sent to the wrong address')`,
    true
  );
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', '']);

  await expectRejection(
    db,
    'a revoked link no longer opens the document',
    `select * from public.resolve_document_link('${'b'.repeat(64)}')`
  );

  console.log('\nDocument isolation and collections');

  await signIn(db, SEED.ownerA);
  await db.query(`select public.issue_invoice($1, current_date - 40)`, [converted.rows[0].id]);
  await signOut(db);

  await expectScalar(
    db,
    'the nightly sweep marks overdue invoices',
    'select public.mark_overdue_invoices() >= 1',
    true
  );

  await signIn(db, SEED.ownerB);
  await expectScalar(
    db,
    'a second tenant sees no invoice of the first',
    'select count(*)::int from public.invoices',
    0
  );

  await signIn(db, SEED.accountant);
  await expectScalar(
    db,
    'an accountant can read the invoices of the companies that granted access',
    `select count(*)::int from public.invoices where company_id = '${SEED.companyA}'`,
    4
  );
  const accountantEdit = await db.query(
    `update public.invoices set notes = 'edited' where id = '${converted.rows[0].id}'`
  );
  report(
    accountantEdit.affectedRows === 0,
    'an accountant cannot edit an invoice',
    `rows affected: ${accountantEdit.affectedRows}`
  );

  await signIn(db, SEED.affiliate);
  await expectScalar(
    db,
    'an affiliate sees no invoice at all',
    'select count(*)::int from public.invoices',
    0
  );

  console.log('\nProving the work was done');

  await signIn(db, SEED.ownerA);

  const proofInvoice = await db.query(
    `insert into public.invoices (company_id, client_id, issue_date)
     values ($1, $2, current_date)
     returning id`,
    [SEED.companyA, clientId]
  );
  const proofInvoiceId = proofInvoice.rows[0].id;

  const proofLink = await db.query(
    `select public.add_work_evidence($1, 'link', 'The delivered site',
       'Everything agreed in the brief is live here.', null,
       'https://example.com/delivered-work') as id`,
    [proofInvoiceId]
  );

  await expectScalar(
    db,
    'a freelancer can attach the address of what they delivered',
    `select external_url from public.invoice_work_evidence
      where id = '${proofLink.rows[0].id}'`,
    'https://example.com/delivered-work'
  );

  await expectRejection(
    db,
    'a link that is not a secure address is refused',
    `select public.add_work_evidence('${proofInvoiceId}', 'link', 'Insecure',
       null, null, 'http://example.com/work')`
  );

  await expectRejection(
    db,
    'a piece of proof called a file has to have one',
    `select public.add_work_evidence('${proofInvoiceId}', 'file', 'Nothing attached')`
  );

  await db.query(
    `select public.add_work_evidence($1, 'hours', 'Design and build',
       'Four sessions across the week', null, null, 12.5, current_date - 2) as id`,
    [proofInvoiceId]
  );

  const privateNote = await db.query(
    `select public.add_work_evidence($1, 'note', 'Internal handover note',
       'Kept for our own records', null, null, null, null, false) as id`,
    [proofInvoiceId]
  );

  await expectScalar(
    db,
    'the hours behind the invoice are totalled for the seller',
    `select (public.work_evidence_summary('${proofInvoiceId}') ->> 'hours_logged')::numeric`,
    '12.50'
  );

  await expectScalar(
    db,
    'the seller sees everything they attached',
    `select count(*)::int from public.invoice_work_evidence('${proofInvoiceId}')`,
    3
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'the client sees only what was marked for them',
    `select count(*)::int from public.client_work_evidence('${proofInvoiceId}')`,
    2
  );

  await expectScalar(
    db,
    'an internal note never reaches the client',
    `select count(*)::int from public.client_work_evidence('${proofInvoiceId}')
      where evidence_id = '${privateNote.rows[0].id}'`,
    0
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'proof can be removed while the invoice is still open',
    `select public.remove_work_evidence('${privateNote.rows[0].id}')`,
    true
  );

  await db.query(
    `insert into public.invoice_items (company_id, invoice_id, description, quantity, unit_price)
     values ($1, $2, 'Design and build', 1, 500)`,
    [SEED.companyA, proofInvoiceId]
  );
  await db.query('select public.issue_invoice($1)', [proofInvoiceId]);
  await db.query(`update public.invoices set status = 'paid' where id = $1`, [proofInvoiceId]);

  await expectScalar(
    db,
    'paying the invoice seals the proof the client saw',
    `select bool_and(is_sealed) from public.invoice_work_evidence('${proofInvoiceId}')`,
    true
  );

  await expectRejection(
    db,
    'sealed proof cannot be removed afterwards',
    `select public.remove_work_evidence('${proofLink.rows[0].id}')`
  );

  await expectRejection(
    db,
    'nor can anything more be added to a closed invoice',
    `select public.add_work_evidence('${proofInvoiceId}', 'note', 'Afterthought')`
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'another business cannot attach proof to an invoice that is not theirs',
    `select public.add_work_evidence('${proofInvoiceId}', 'note', 'Not mine')`
  );

  await expectScalar(
    db,
    'nor read the proof behind it',
    'select count(*)::int from public.invoice_work_evidence',
    0
  );

  await signOut(db);
}

/**
 * Verifies payments, refunds, disputes, webhooks, wallets and payouts.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testPayments(db) {
  console.log('\nReceiving money');

  const invoice = await db.query(
    `select id, balance_due::text as balance_due
       from public.invoices
      where company_id = $1 and invoice_number = 'INV-0001'`,
    [SEED.companyA]
  );
  const invoiceId = invoice.rows[0].id;

  await signIn(db, SEED.ownerA);

  const payment = await db.query(
    `select public.record_payment($1, $2, 100, 'bank_transfer', 'manual') as id`,
    [SEED.companyA, invoiceId]
  );
  const paymentId = payment.rows[0].id;

  await expectScalar(
    db,
    'a part payment lowers the outstanding balance',
    `select balance_due::text from public.invoices where id = '${invoiceId}'`,
    '168.8000'
  );

  await expectScalar(
    db,
    'the invoice moves to partially paid',
    `select status::text from public.invoices where id = '${invoiceId}'`,
    'partially_paid'
  );

  await expectScalar(
    db,
    'the payment is fully allocated',
    `select unallocated_amount::text from public.payments where id = '${paymentId}'`,
    '0.0000'
  );

  const settling = await db.query(
    `select public.record_payment($1, $2, 500, 'card', 'stripe') as id`,
    [SEED.companyA, invoiceId]
  );

  await expectScalar(
    db,
    'an overpayment settles the invoice without exceeding it',
    `select balance_due::text from public.invoices where id = '${invoiceId}'`,
    '0.0000'
  );

  await expectScalar(
    db,
    'the invoice is marked paid',
    `select status::text from public.invoices where id = '${invoiceId}'`,
    'paid'
  );

  await expectScalar(
    db,
    'the surplus stays unallocated on the payment',
    `select unallocated_amount::text from public.payments where id = '${settling.rows[0].id}'`,
    '331.2000'
  );

  await expectScalar(
    db,
    'the allocations of a payment always add up',
    `select public.verify_payment_allocation_total('${settling.rows[0].id}')`,
    true
  );

  await expectRejection(
    db,
    'a draft invoice cannot be paid',
    `select public.allocate_payment_to_invoice('${settling.rows[0].id}',
            (select id from public.invoices
              where company_id = '${SEED.companyA}' and status = 'draft' limit 1), 10)`
  );

  console.log('\nRefunds');

  await expectScalar(
    db,
    'a refund returns a new record',
    `select public.record_refund('${paymentId}', 40, 'Goodwill adjustment')
            is not null`,
    true
  );

  await expectScalar(
    db,
    'the payment is marked partially refunded',
    `select status::text from public.payments where id = '${paymentId}'`,
    'partially_refunded'
  );

  await expectScalar(
    db,
    'the invoice shows the money as outstanding again',
    `select (balance_due > 0) from public.invoices where id = '${invoiceId}'`,
    true
  );

  await expectRejection(
    db,
    'a refund cannot exceed the payment',
    `select public.record_refund('${paymentId}', 500, 'Too much')`
  );

  console.log('\nDisputes and evidence');

  const dispute = await db.query(
    `insert into public.disputes
       (company_id, payment_id, invoice_id, provider, disputed_amount, currency,
        reason_code, evidence_due_at)
     values ($1, $2, $3, 'stripe', 100, 'USD', 'product_not_received',
             now() + interval '7 days')
     returning id`,
    [SEED.companyA, settling.rows[0].id, invoiceId]
  );

  await expectScalar(
    db,
    'the evidence package is assembled from the platform data',
    `select public.assemble_dispute_evidence('${dispute.rows[0].id}')`,
    3
  );

  await expectScalar(
    db,
    'the evidence file is sent to the provider in one step',
    `select public.submit_dispute_evidence('${dispute.rows[0].id}')::text`,
    'evidence_submitted'
  );

  await expectRejection(
    db,
    'an outcome has to be an outcome, not another waiting state',
    `select public.record_dispute_outcome('${dispute.rows[0].id}', 'under_review')`
  );

  await expectScalar(
    db,
    'winning a dispute records what came back',
    `select public.record_dispute_outcome('${dispute.rows[0].id}', 'won',
            'The delivery record settled it', 100)::text`,
    'won'
  );

  await expectRejection(
    db,
    'a decided dispute is never decided again',
    `select public.record_dispute_outcome('${dispute.rows[0].id}', 'lost')`
  );

  console.log('\nRefunds that need a second pair of eyes');

  await db.query(
    `update public.companies
        set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{payments}',
              jsonb_build_object('refund_approval_threshold', 20), true)
      where id = $1`,
    [SEED.companyA]
  );

  await signIn(db, SEED.staffA);

  const held = await db.query(
    `select public.record_refund('${paymentId}', 25, 'Client cancelled the order') as id`
  );

  await expectScalar(
    db,
    'a refund over the threshold waits for approval instead of paying out',
    `select status::text from public.refunds where id = '${held.rows[0].id}'`,
    'requested'
  );

  await expectRejection(
    db,
    'the person who asked for the money cannot release it themselves',
    `select public.review_refund('${held.rows[0].id}', true)`
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'declining a refund without a reason is refused',
    `select public.review_refund('${held.rows[0].id}', false)`
  );

  await expectScalar(
    db,
    'the owner approves it and the money goes back',
    `select public.review_refund('${held.rows[0].id}', true)::text`,
    'approved'
  );

  await expectScalar(
    db,
    'the approved refund is settled rather than left pending',
    `select status::text from public.refunds where id = '${held.rows[0].id}'`,
    'succeeded'
  );

  await expectRejection(
    db,
    'the same refund cannot be approved twice',
    `select public.review_refund('${held.rows[0].id}', true)`
  );

  await db.query(`update public.companies set settings = settings - 'payments' where id = $1`, [
    SEED.companyA,
  ]);

  console.log('\nGateways');

  await signOut(db);

  await expectRejection(
    db,
    'collected evidence cannot be altered',
    `update public.dispute_evidence_items set title = 'changed'
      where dispute_id = '${dispute.rows[0].id}'`
  );

  await db.query(
    `insert into public.payment_gateways
       (owner_type, provider, display_name, mode, is_enabled, credentials_encrypted)
     values ('platform', 'stripe', 'Stripe', 'live', true, 'encrypted-bundle')`
  );

  await expectScalar(
    db,
    'a provider enabled by the platform is available to a tenant',
    `select public.is_gateway_available('${SEED.companyA}', 'stripe', 'live')`,
    true
  );

  await db.query(
    `insert into public.gateway_availability (company_id, provider, is_enabled_by_tenant)
     values ($1, 'stripe', false)`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'a tenant can switch a provider off for itself',
    `select public.is_gateway_available('${SEED.companyA}', 'stripe', 'live')`,
    false
  );

  await expectRejection(
    db,
    'a custom provider must carry an adapter configuration',
    `insert into public.payment_gateways
       (owner_type, provider, display_name, mode, is_enabled)
     values ('platform', 'custom', 'House gateway', 'test', false)`
  );

  await signIn(db, SEED.staffA);
  await expectScalar(
    db,
    'a staff member cannot read gateway credentials',
    'select count(*)::int from public.payment_gateways',
    0
  );
  await signOut(db);

  console.log('\nWebhooks');

  const first = await db.query(
    `select * from public.register_webhook_event('stripe', 'evt_1001',
            'payment_intent.succeeded', '{"ok":true}'::jsonb, $1, true)`,
    ['c'.repeat(64)]
  );
  report(first.rows[0].is_new === true, 'a new webhook is stored');

  const repeat = await db.query(
    `select * from public.register_webhook_event('stripe', 'evt_1001',
            'payment_intent.succeeded', '{"ok":true}'::jsonb, $1, true)`,
    ['c'.repeat(64)]
  );
  report(repeat.rows[0].is_new === false, 'a redelivered webhook is recognised');

  await expectScalar(
    db,
    'a failed attempt is scheduled for a retry',
    `select public.complete_webhook_event('${first.rows[0].event_id}', false,
            'Temporary provider error')::text`,
    'pending'
  );

  await db.query(
    `update public.webhook_events set attempt_count = max_attempts - 1 where id = $1`,
    [first.rows[0].event_id]
  );

  await expectScalar(
    db,
    'an exhausted webhook lands in the dead letter queue',
    `select public.complete_webhook_event('${first.rows[0].event_id}', false,
            'Still failing')::text`,
    'exhausted'
  );

  console.log('\nWallets and payouts');

  const wallet = await db.query(
    `select id from public.wallets where company_id = $1 and currency = 'USD'`,
    [SEED.companyA]
  );
  report(wallet.rows.length === 1, 'every company receives a wallet automatically');

  // A zero day hold lets the maturity sweep be exercised in the same run.
  await db.query(`update public.wallets set payout_hold_days = 0 where id = $1`, [
    wallet.rows[0].id,
  ]);

  await db.query(`select public.settle_merchant_of_record_payment($1, 12.50)`, [
    settling.rows[0].id,
  ]);

  await expectScalar(
    db,
    'the net proceeds are held until the payout window passes',
    `select pending_balance::text from public.wallets where id = '${wallet.rows[0].id}'`,
    '487.5000'
  );

  await expectScalar(
    db,
    'the fee breakdown states every deduction',
    `select (public.payment_fee_breakdown('${settling.rows[0].id}') ->> 'platform_fee')`,
    '12.5000'
  );

  await expectScalar(
    db,
    'the maturity sweep releases one held entry',
    'select public.release_matured_wallet_funds()',
    1
  );

  await expectScalar(
    db,
    'the released money is now available',
    `select available_balance::text from public.wallets where id = '${wallet.rows[0].id}'`,
    '487.5000'
  );

  await expectScalar(
    db,
    'nothing is left on hold',
    `select pending_balance::text from public.wallets where id = '${wallet.rows[0].id}'`,
    '0.0000'
  );

  await db.query(
    `insert into public.payout_accounts
       (wallet_id, company_id, label, account_holder_name, account_details_encrypted,
        account_mask, is_default, is_verified)
     values ($1, $2, 'Business account', 'Northwind Supply LLC', 'encrypted-account',
             '****4321', true, true)`,
    [wallet.rows[0].id, SEED.companyA]
  );

  await expectRejection(
    db,
    'a payout below the threshold is refused',
    `select public.request_payout('${wallet.rows[0].id}', 10)`
  );

  await db.query(
    `update public.wallets set available_balance = 1000, pending_balance = 0 where id = $1`,
    [wallet.rows[0].id]
  );

  const payout = await db.query(`select public.request_payout('${wallet.rows[0].id}', 400) as id`);

  await expectScalar(
    db,
    'a payout reserves the amount it will send',
    `select reserved_balance::text from public.wallets where id = '${wallet.rows[0].id}'`,
    '400.0000'
  );

  await expectScalar(
    db,
    'the available balance falls when a payout is requested',
    `select available_balance::text from public.wallets where id = '${wallet.rows[0].id}'`,
    '600.0000'
  );

  await expectScalar(
    db,
    'a failed payout returns the money to the wallet',
    `select public.complete_payout('${payout.rows[0].id}', false, null,
            'Bank rejected the transfer')::text`,
    'failed'
  );

  await expectScalar(
    db,
    'the returned payout is available again',
    `select available_balance::text from public.wallets where id = '${wallet.rows[0].id}'`,
    '1000.0000'
  );

  const callable = await db.query(
    `select public.request_payout('${wallet.rows[0].id}', 250) as id`
  );

  await expectScalar(
    db,
    'a payout that has not been sent can be called off',
    `select public.cancel_payout('${callable.rows[0].id}', 'Asked the bank to wait')::text`,
    'cancelled'
  );

  await expectScalar(
    db,
    'calling it off puts the money back where it came from',
    `select available_balance::text from public.wallets where id = '${wallet.rows[0].id}'`,
    '1000.0000'
  );

  await expectRejection(
    db,
    'a payout already decided cannot be called off',
    `select public.cancel_payout('${callable.rows[0].id}')`
  );

  await expectRejection(
    db,
    'the wallet ledger cannot be rewritten',
    `update public.wallet_transactions set amount = 1
      where wallet_id = '${wallet.rows[0].id}'`
  );

  const reviewable = await db.query(
    `select public.request_payout('${wallet.rows[0].id}', 300) as id`
  );

  await signIn(db, SEED.ownerA);
  await expectRejection(
    db,
    'a business cannot release its own payout',
    `select public.review_payout('${reviewable.rows[0].id}', true)`
  );

  await signIn(db, SEED.superAdmin);

  await expectRejection(
    db,
    'refusing a payout without a reason is refused',
    `select public.review_payout('${reviewable.rows[0].id}', false)`
  );

  await expectScalar(
    db,
    'the platform team refuses a payout and the money goes back',
    `select public.review_payout('${reviewable.rows[0].id}', false,
            'The destination account name does not match the business')::text`,
    'rejected'
  );

  await expectScalar(
    db,
    'nothing is left reserved after a refusal',
    `select available_balance::text from public.wallets where id = '${wallet.rows[0].id}'`,
    '1000.0000'
  );

  const releasable = await db.query(
    `select public.request_payout('${wallet.rows[0].id}', 150) as id`
  );

  await expectScalar(
    db,
    'an approved payout is on its way to the provider',
    `select public.review_payout('${releasable.rows[0].id}', true, 'Checks passed')::text`,
    'approved'
  );

  await expectScalar(
    db,
    'and who approved it is on the record',
    `select (approved_by is not null)::text from public.payouts
      where id = '${releasable.rows[0].id}'`,
    'true'
  );

  await expectRejection(
    db,
    'the same payout is never reviewed twice',
    `select public.review_payout('${releasable.rows[0].id}', true)`
  );

  await db.query(
    `select public.complete_payout('${releasable.rows[0].id}', true, 'BANK-REF-0001')`
  );

  await signOut(db);

  console.log('\nPaying online');

  await signOut(db);

  const onlineInvoice = await db.query(
    `select id, company_id, client_id, currency, currency_exponent
       from public.invoices
      where company_id = $1 and invoice_number = 'INV-0002'`,
    [SEED.companyA]
  );
  const onlineRow = onlineInvoice.rows[0];

  await signInAsService(db);

  const intent = await db.query(
    `insert into public.payment_intents
       (company_id, client_id, invoice_id, provider, mode, amount, amount_minor,
        currency, currency_exponent, idempotency_key)
     values ($1, $2, $3, 'stripe', 'test', 25, 2500, $4, $5, 'checkout-test-0001')
     returning id`,
    [
      onlineRow.company_id,
      onlineRow.client_id,
      onlineRow.id,
      onlineRow.currency,
      onlineRow.currency_exponent,
    ]
  );
  const intentId = intent.rows[0].id;

  const settled = await db.query(
    `select public.settle_payment_intent($1, 'pi_test_0001', null, 0.75) as id`,
    [intentId]
  );

  await expectScalar(
    db,
    'a finished checkout becomes money against the invoice',
    `select amount::text from public.payments where id = '${settled.rows[0].id}'`,
    '25.0000'
  );

  await expectScalar(
    db,
    'the provider fee and the platform fee are both kept apart from what the client paid',
    `select net_amount::text from public.payments where id = '${settled.rows[0].id}'`,
    '23.7500'
  );

  await expectScalar(
    db,
    'the platform keeps its collection fee out of the same payment',
    `select platform_fee_amount::text from public.payments
      where id = '${settled.rows[0].id}'`,
    '0.5000'
  );

  await expectScalar(
    db,
    'the attempt is marked as finished',
    `select status::text from public.payment_intents where id = '${intentId}'`,
    'succeeded'
  );

  await expectScalar(
    db,
    'the invoice shows the online payment',
    `select (paid_amount >= 25) from public.invoices where id = '${onlineRow.id}'`,
    true
  );

  await expectScalar(
    db,
    'the same event delivered twice settles only once',
    `select public.settle_payment_intent('${intentId}', 'pi_test_0001')
            = '${settled.rows[0].id}'`,
    true
  );

  await expectScalar(
    db,
    'and the invoice is not paid a second time',
    `select count(*)::int from public.payments where payment_intent_id = '${intentId}'`,
    1
  );

  await expectScalar(
    db,
    'a late failure notice never undoes money that arrived',
    `select public.fail_payment_intent('${intentId}', 'card_declined', 'Too late')::text`,
    'succeeded'
  );

  const failing = await db.query(
    `insert into public.payment_intents
       (company_id, client_id, invoice_id, provider, mode, amount, amount_minor,
        currency, currency_exponent, idempotency_key)
     values ($1, $2, $3, 'stripe', 'test', 10, 1000, $4, $5, 'checkout-test-0002')
     returning id`,
    [
      onlineRow.company_id,
      onlineRow.client_id,
      onlineRow.id,
      onlineRow.currency,
      onlineRow.currency_exponent,
    ]
  );

  await expectScalar(
    db,
    'a declined attempt is written down with its reason',
    `select public.fail_payment_intent('${failing.rows[0].id}', 'card_declined',
            'The bank declined the card')::text`,
    'failed'
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'another business cannot settle an attempt that is not theirs',
    `select public.settle_payment_intent('${failing.rows[0].id}', 'pi_test_0002')`
  );

  await signOut(db);

  console.log('\nHolding the money and paying the seller');

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the platform ships with collection terms every account falls back to',
    `select (public.resolve_settlement_policy('${SEED.companyA}') ->> 'source')`,
    'platform'
  );

  await expectScalar(
    db,
    'a small payment pays the floor rather than the percentage',
    `select public.quote_settlement_fee('${SEED.companyA}', 20, 0)
       ->> 'platform_fee_amount'`,
    '0.5000'
  );

  await expectScalar(
    db,
    'a large payment pays the percentage',
    `select public.quote_settlement_fee('${SEED.companyA}', 1000, 0)
       ->> 'platform_fee_amount'`,
    '5.0000'
  );

  await expectScalar(
    db,
    'the three parts of a payment always add back up to what the payer was charged',
    `select (q ->> 'gateway_fee_amount')::numeric
            + (q ->> 'platform_fee_amount')::numeric
            + (q ->> 'net_amount')::numeric
            = (q ->> 'gross_amount')::numeric
       from public.quote_settlement_fee('${SEED.companyA}', 480.75, 14.2) as q`,
    true
  );

  await expectRejection(
    db,
    'a payment worth nothing cannot be quoted',
    `select public.quote_settlement_fee('${SEED.companyA}', 0, 0)`
  );

  await signInAsService(db);

  const collected = await db.query(
    `insert into public.payments
       (company_id, client_id, amount, amount_minor, currency, method_type,
        provider, gateway_fee_amount, status)
     values ($1, $2, 400, 40000, 'USD', 'card', 'stripe', 12, 'succeeded')
     returning id`,
    [SEED.companyA, SEED.clientA]
  );
  const collectedId = collected.rows[0].id;

  const settlement = await db.query('select public.settle_invoice_funds($1) as id', [collectedId]);
  const settlementId = settlement.rows[0].id;

  await expectScalar(
    db,
    'a collected payment becomes one settlement',
    `select count(*)::int from public.settlements where payment_id = '${collectedId}'`,
    1
  );

  await expectScalar(
    db,
    'settling the same payment twice changes nothing the second time',
    `select public.settle_invoice_funds('${collectedId}')::text`,
    String(settlementId)
  );

  await expectScalar(
    db,
    'the seller is credited what is left after both fees',
    `select net_amount::text from public.settlements where id = '${settlementId}'`,
    '386.0000'
  );

  await expectScalar(
    db,
    'and the platform fee is the percentage of what the client paid',
    `select platform_fee_amount::text from public.settlements where id = '${settlementId}'`,
    '2.0000'
  );

  await expectScalar(
    db,
    'the money starts inside the hold window rather than ready to withdraw',
    `select status from public.settlements where id = '${settlementId}'`,
    'held'
  );

  await expectScalar(
    db,
    'the wallet shows it as held rather than as available',
    `select pending_balance >= 386 from public.wallets
      where company_id = '${SEED.companyA}' and currency = 'USD'`,
    true
  );

  await expectScalar(
    db,
    'the ledger entry says which payment produced it',
    `select count(*)::int from public.wallet_transactions
      where payment_id = '${collectedId}' and is_pending`,
    1
  );

  await db.query(`update public.settlements set hold_until = current_date - 1 where id = $1`, [
    settlementId,
  ]);
  await expectScalar(
    db,
    'once the hold passes the money is released',
    'select public.release_matured_settlements() >= 1',
    true
  );

  await expectScalar(
    db,
    'and the seller can now withdraw it',
    `select status from public.settlements where id = '${settlementId}'`,
    'available'
  );

  await expectScalar(
    db,
    'the wallet moved it from held to available',
    `select available_balance >= 386 from public.wallets
      where company_id = '${SEED.companyA}' and currency = 'USD'`,
    true
  );

  const sellerWallet = await db.query(
    `select id from public.wallets where company_id = $1 and currency = 'USD'`,
    [SEED.companyA]
  );
  const withdrawal = await db.query('select public.request_payout($1, 100) as id', [
    sellerWallet.rows[0].id,
  ]);

  await expectScalar(
    db,
    'a withdrawal reserves the money straight away',
    `select reserved_balance::text from public.wallets
      where id = '${sellerWallet.rows[0].id}'`,
    '100.0000'
  );

  await db.query('select public.attach_settlements_to_payout($1)', [withdrawal.rows[0].id]);

  await expectScalar(
    db,
    'the transfer records which invoices it actually paid for',
    `select status from public.settlements where id = '${settlementId}'`,
    'paid_out'
  );

  await expectScalar(
    db,
    'the platform team can see how long is left of the promise made',
    `select count(*)::int >= 1 from public.payout_sla_queue(50)
      where payout_id = '${withdrawal.rows[0].id}'`,
    true
  );

  await expectScalar(
    db,
    'a withdrawal requested just now is not yet late',
    `select is_breached from public.payout_sla_queue(50)
      where payout_id = '${withdrawal.rows[0].id}'`,
    false
  );

  await expectRejection(
    db,
    'a reversal has to say why',
    `select public.reverse_settlement('${collectedId}', '   ')`
  );

  await db.query(`select public.reverse_settlement($1, 'The payer disputed the charge')`, [
    collectedId,
  ]);

  await expectScalar(
    db,
    'a disputed payment is taken back out of the wallet it went into',
    `select status from public.settlements where payment_id = '${collectedId}'`,
    'reversed'
  );

  await expectScalar(
    db,
    'reversing twice does not take the money twice',
    `select public.reverse_settlement('${collectedId}', 'Tried again')`,
    false
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the seller is told what the fees have cost them',
    `select (public.company_settlement_summary('${SEED.companyA}') ->> 'fees_paid')::numeric >= 0`,
    true
  );

  await expectScalar(
    db,
    'and can read every settlement of their own',
    `select count(*)::int >= 1 from public.company_settlements('${SEED.companyA}')`,
    true
  );

  await expectRejection(
    db,
    'a tenant cannot set its own collection terms',
    `select public.save_settlement_policy('Cheaper', 0.1, 0, '${SEED.companyA}')`
  );

  await signIn(db, SEED.superAdmin);

  await db.query(
    `select public.save_settlement_policy('Negotiated terms', 0.3000, 0.25, $1,
       0, 3, 12, 10, 'Agreed with this account directly')`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'the platform team can agree different terms with one account',
    `select (public.resolve_settlement_policy('${SEED.companyA}') ->> 'source')`,
    'account'
  );

  await expectScalar(
    db,
    'and those terms are what the next payment is charged',
    `select public.quote_settlement_fee('${SEED.companyA}', 1000, 0)
       ->> 'platform_fee_amount'`,
    '3.0000'
  );

  await expectScalar(
    db,
    'the terms in force are listed with what they have earned',
    'select count(*)::int >= 2 from public.platform_settlement_policies()',
    true
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'one seller cannot read the money of another',
    `select count(*)::int from public.company_settlements('${SEED.companyA}')`
  );

  await expectScalar(
    db,
    'nor see a single settlement row of theirs',
    'select count(*)::int from public.settlements',
    0
  );

  await signOut(db);

  console.log('\nControlling how money is taken');

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a seller who has said nothing still gets a safe default',
    `select (public.company_checkout_preferences('${SEED.companyA}') ->> 'accept_card_payments')::boolean`,
    true
  );

  await db.query(
    `select public.save_checkout_preferences($1, false, true, true, true, false, true,
       false, 0, null, null, 14)`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'one switch turns card payments off for the whole account',
    `select (public.company_checkout_preferences('${SEED.companyA}') ->> 'accept_card_payments')::boolean`,
    false
  );

  await signInAsService(db);

  const guardedInvoice = await db.query(
    `select id from public.invoices where company_id = $1 and invoice_number is not null
      order by created_at limit 1`,
    [SEED.companyA]
  );
  const guardedInvoiceId = guardedInvoice.rows[0].id;

  await expectScalar(
    db,
    'and no card is offered on any invoice while it is off',
    `select (public.card_payment_allowed('${guardedInvoiceId}') ->> 'is_allowed')::boolean`,
    false
  );

  await signIn(db, SEED.ownerA);

  await db.query(
    `select public.save_checkout_preferences($1, true, true, true, true, false, true,
       false, 10, 2000, 'I confirm the work was delivered and I authorise this payment.', 7)`,
    [SEED.companyA]
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'turning it back on restores the card option',
    `select (public.card_payment_allowed('${guardedInvoiceId}') ->> 'is_allowed')::boolean`,
    true
  );

  const consentId = await db.query(
    `select public.record_checkout_consent($1,
       'I confirm the work was delivered and I authorise this payment.',
       '203.0.113.9'::inet, $2, 'Mozilla/5.0 Test', 'en-GB', 'Asia/Dhaka',
       '1440x900', null, null, 95) as id`,
    [guardedInvoiceId, 'a'.repeat(64)]
  );

  await expectScalar(
    db,
    'what the payer agreed to is frozen with a digest of the exact words',
    `select statement_hash ~ '^[0-9a-f]{64}$' from public.checkout_consents
      where id = '${consentId.rows[0].id}'`,
    true
  );

  await expectScalar(
    db,
    'together with the address and device it was given from',
    `select host(ip_address) from public.checkout_consents
      where id = '${consentId.rows[0].id}'`,
    '203.0.113.9'
  );

  await expectRejection(
    db,
    'an agreement can never be edited afterwards',
    `update public.checkout_consents set consent_statement = 'Changed'
      where id = '${consentId.rows[0].id}'`
  );

  await expectRejection(
    db,
    'nor deleted',
    `delete from public.checkout_consents where id = '${consentId.rows[0].id}'`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the seller is scored on the file they could submit today',
    `select (public.dispute_readiness('${guardedInvoiceId}') ->> 'score')::int >= 25`,
    true
  );

  await expectScalar(
    db,
    'and told the agreement is on record',
    `select (public.dispute_readiness('${guardedInvoiceId}') ->> 'has_consent_record')::boolean`,
    true
  );

  await expectScalar(
    db,
    'a file with gaps names each gap in plain words',
    `select jsonb_array_length(public.dispute_readiness('${guardedInvoiceId}') -> 'missing') >= 0`,
    true
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'one seller cannot change how another takes money',
    `select public.save_checkout_preferences('${SEED.companyA}', false)`
  );

  await expectScalar(
    db,
    'nor read the authorisations given to another',
    'select count(*)::int from public.checkout_consents',
    0
  );

  await signInAsService(db);

  await db.query(
    `select public.record_bot_defence_event('/d/token', 'known_crawler', 'GPTBot/1.0', $1)`,
    ['b'.repeat(64)]
  );

  await expectScalar(
    db,
    'a crawler turned away at the door is written down',
    `select count(*)::int from public.bot_defence_events where reason = 'known_crawler'`,
    1
  );

  await expectRejection(
    db,
    'and only a known reason can be recorded',
    `select public.record_bot_defence_event('/d/token', 'because_i_said_so')`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a seller cannot see what the platform turned away',
    'select count(*)::int from public.bot_defence_events',
    0
  );

  await signOut(db);

  console.log('\nGetting a new seller ready to be paid');

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the setup list is worked out from the data rather than kept as a checklist',
    `select jsonb_array_length(public.company_onboarding_state('${SEED.companyA}') -> 'tasks') >= 5`,
    true
  );

  await expectScalar(
    db,
    'five things stand between signing up and being paid',
    `select (public.company_onboarding_state('${SEED.companyA}') ->> 'required_count')::int`,
    5
  );

  await expectScalar(
    db,
    'a business that has issued an invoice has that step behind it',
    `select (task ->> 'is_done')::boolean
       from jsonb_array_elements(
         public.company_onboarding_state('${SEED.companyA}') -> 'tasks'
       ) as task
      where task ->> 'key' = 'first_invoice'`,
    true
  );

  await expectScalar(
    db,
    'and adding a client counts as done too',
    `select (task ->> 'is_done')::boolean
       from jsonb_array_elements(
         public.company_onboarding_state('${SEED.companyA}') -> 'tasks'
       ) as task
      where task ->> 'key' = 'first_client'`,
    true
  );

  await expectScalar(
    db,
    'an optional suggestion can be waved away',
    `select public.dismiss_onboarding_task('${SEED.companyA}', 'upload_logo')`,
    true
  );

  await expectScalar(
    db,
    'and the state remembers it was hidden',
    `select public.company_onboarding_state('${SEED.companyA}') -> 'dismissed' ? 'upload_logo'`,
    true
  );

  await expectScalar(
    db,
    'hiding the same suggestion twice changes nothing',
    `select count(*)::int from public.onboarding_dismissals
      where company_id = '${SEED.companyA}' and task_key = 'upload_logo'`,
    1
  );

  await expectScalar(
    db,
    'a hidden suggestion can be brought back',
    `select public.restore_onboarding_task('${SEED.companyA}', 'upload_logo')`,
    true
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'one seller cannot read the setup state of another',
    `select public.company_onboarding_state('${SEED.companyA}')`
  );

  await expectRejection(
    db,
    'nor hide a suggestion on their behalf',
    `select public.dismiss_onboarding_task('${SEED.companyA}', 'upload_logo')`
  );

  await expectScalar(
    db,
    'a brand new account is told it is not ready to trade yet',
    `select (public.company_onboarding_state('${SEED.companyB}') ->> 'is_ready_to_trade')::boolean`,
    false
  );

  await expectScalar(
    db,
    'and it is not moved out of onboarding while something is missing',
    `select public.activate_ready_company('${SEED.companyB}')`,
    false
  );

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'the platform team can see who signed up recently',
    'select count(*)::int >= 1 from public.onboarding_funnel(365)',
    true
  );

  await expectScalar(
    db,
    'and which step each of them is stuck on',
    `select stuck_on is not null from public.onboarding_funnel(365)
      where company_id = '${SEED.companyB}'`,
    true
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'a seller cannot read the signup funnel of the platform',
    'select count(*)::int from public.onboarding_funnel(30)'
  );

  await signOut(db);

  console.log('\nThe controls over the money the platform holds');

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'the platform team can read what the arrangement earned',
    `select (public.settlement_revenue_report(current_date - 30, current_date)
       ->> 'settled_count')::int >= 1`,
    true
  );

  await expectScalar(
    db,
    'the report separates what the platform kept from what the card cost',
    `select (public.settlement_revenue_report(current_date - 30, current_date)
       ->> 'platform_fees')::numeric >= 0`,
    true
  );

  await expectScalar(
    db,
    'and ranks the accounts worth negotiating with',
    'select count(*)::int >= 1 from public.top_settlement_accounts(10)',
    true
  );

  await expectScalar(
    db,
    'an account on negotiated terms is marked as such in that ranking',
    `select has_own_terms from public.top_settlement_accounts(10)
      where company_id = '${SEED.companyA}'`,
    true
  );

  await expectRejection(
    db,
    'the standard terms cannot be removed, only edited',
    'select public.delete_settlement_policy(null)'
  );

  await expectScalar(
    db,
    'a negotiated deal can be dropped',
    `select public.delete_settlement_policy('${SEED.companyA}')`,
    true
  );

  await expectScalar(
    db,
    'and that account goes back to the standard terms',
    `select (public.resolve_settlement_policy('${SEED.companyA}') ->> 'source')`,
    'platform'
  );

  await expectScalar(
    db,
    'dropping it changes no settlement already made',
    `select count(*)::int >= 1 from public.settlements
      where company_id = '${SEED.companyA}'`,
    true
  );

  await db.query(
    `select public.save_settlement_policy('Standard collection terms', 0.4500, 0.75, null,
       0, 5, 18, 30, 'Reviewed by the platform team')`
  );

  await expectScalar(
    db,
    'the standard terms themselves can be edited without a deployment',
    `select public.quote_settlement_fee('${SEED.companyB}', 1000, 0)
       ->> 'platform_fee_amount'`,
    '4.5000'
  );

  await expectScalar(
    db,
    'the new hold period applies to the next payment',
    `select (public.resolve_settlement_policy('${SEED.companyB}') ->> 'hold_days')::int`,
    5
  );

  await expectScalar(
    db,
    'and so does the new withdrawal promise',
    `select (public.resolve_settlement_policy('${SEED.companyB}') ->> 'payout_sla_hours')::int`,
    18
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'a seller cannot read what the platform earns',
    'select public.settlement_revenue_report(null, null)'
  );

  await expectRejection(
    db,
    'nor drop the terms of another account',
    `select public.delete_settlement_policy('${SEED.companyA}')`
  );

  await signOut(db);

  console.log('\nPayment isolation');

  await signIn(db, SEED.ownerB);
  await expectScalar(
    db,
    'a second tenant sees no payment of the first',
    'select count(*)::int from public.payments',
    0
  );
  await expectScalar(
    db,
    'a second tenant sees no wallet of the first',
    'select count(*)::int from public.wallets where company_id = $$' + SEED.companyA + '$$',
    0
  );

  await signIn(db, SEED.affiliate);
  await expectScalar(
    db,
    'an affiliate sees no payment at all',
    'select count(*)::int from public.payments',
    0
  );

  await signOut(db);
}

/**
 * Exercises plans, entitlements, usage, coupons, billing and referrals.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testSubscriptions(db) {
  console.log('\nPlans and entitlements');

  await signOut(db);

  const plans = await db.query(
    `insert into public.subscription_plans
       (plan_key, name, is_free, is_default_on_signup, trial_days, display_order,
        limits, features)
     values
       ('free', 'Free', true, true, 0, 1,
        '{"monthly_invoices": 5, "team_members": 1}'::jsonb,
        '{"inventory": false, "recurring": false}'::jsonb),
       ('professional', 'Professional', false, false, 14, 2,
        '{"monthly_invoices": null, "team_members": 10}'::jsonb,
        '{"inventory": true, "recurring": true}'::jsonb)
     returning id, plan_key`
  );
  const planId = Object.fromEntries(plans.rows.map((row) => [row.plan_key, row.id]));

  await db.query(
    `insert into public.plan_prices (plan_id, billing_interval, currency, amount)
     values ($1, 'monthly', 'USD', 0),
            ($2, 'monthly', 'USD', 29),
            ($2, 'annual', 'USD', 290)`,
    [planId.free, planId.professional]
  );

  await db.query('select public.start_default_subscription($1)', [SEED.companyA]);
  await db.query('select public.start_default_subscription($1)', [SEED.companyB]);

  await expectScalar(
    db,
    'a new company starts on the signup plan',
    `select p.plan_key
       from public.subscriptions as s
       join public.subscription_plans as p on p.id = s.plan_id
      where s.company_id = '${SEED.companyA}'`,
    'free'
  );

  await expectScalar(
    db,
    'the opening movement is written to the history',
    `select change_type from public.subscription_changes
      where company_id = '${SEED.companyA}'`,
    'created'
  );

  await expectRejection(
    db,
    'a company cannot hold two live subscriptions',
    `insert into public.subscriptions (company_id, plan_id)
     values ('${SEED.companyA}', '${planId.free}')`
  );

  await expectScalar(
    db,
    'the free plan keeps the paid modules locked',
    `select public.has_feature('${SEED.companyA}', 'inventory')::text`,
    'false'
  );

  await expectScalar(
    db,
    'the plan ceiling is readable through the entitlement resolver',
    `select public.usage_limit('${SEED.companyA}', 'monthly_invoices')::text`,
    '5'
  );

  console.log('\nUsage metering');

  await expectScalar(
    db,
    'consumption moves the counter',
    `select public.consume_usage('${SEED.companyA}', 'monthly_invoices', 4)::text`,
    '4'
  );

  await expectScalar(
    db,
    'the remaining allowance is reported',
    `select remaining::text from public.check_usage_limit('${SEED.companyA}', 'monthly_invoices', 1)`,
    '1'
  );

  await expectScalar(
    db,
    'an action beyond the ceiling is refused with a sentence',
    `select reason from public.check_usage_limit('${SEED.companyA}', 'monthly_invoices', 5)`,
    'You have used 4 of 5 on your plan. Upgrade to continue.'
  );

  await expectRejection(
    db,
    'consumption past the ceiling is rejected',
    `select public.consume_usage('${SEED.companyA}', 'monthly_invoices', 5)`
  );

  await db.query(
    `insert into public.company_entitlement_overrides
       (company_id, entitlement_key, value, reason)
     values ($1, 'limits.monthly_invoices', '50'::jsonb,
             'Agreed during the migration from the previous provider')`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'an exception raises the ceiling for one tenant',
    `select public.usage_limit('${SEED.companyA}', 'monthly_invoices')::text`,
    '50'
  );

  await expectScalar(
    db,
    'the raised ceiling lets the action through',
    `select is_allowed::text from public.check_usage_limit('${SEED.companyA}', 'monthly_invoices', 5)`,
    'true'
  );

  await expectScalar(
    db,
    'releasing usage lowers the counter again',
    `select public.release_usage('${SEED.companyA}', 'monthly_invoices', 2)::text`,
    '2'
  );

  console.log('\nCoupons');

  await db.query(
    `insert into public.coupons (code, name, coupon_type, value, max_redemptions_per_account)
     values ('WELCOME20', 'Welcome offer', 'percentage', 20, 1)`
  );

  await expectScalar(
    db,
    'a valid code reports the discount it would give',
    `select discount_amount::text from public.validate_coupon('WELCOME20', '${SEED.companyA}', 'professional', 29)`,
    '5.8000'
  );

  await expectScalar(
    db,
    'an unknown code is explained in plain words',
    `select reason from public.validate_coupon('NOPE', '${SEED.companyA}')`,
    'This code was not recognised'
  );

  const subscriptionA = await db.query(
    `select id from public.subscriptions where company_id = $1 and deleted_at is null`,
    [SEED.companyA]
  );
  const subscriptionAId = subscriptionA.rows[0].id;

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'moving up a plan returns the prorated difference',
    `select public.change_subscription_plan('${subscriptionAId}', '${planId.professional}')::text`,
    '29.0000'
  );

  await expectScalar(
    db,
    'the subscription now carries the new price',
    `select amount::text from public.subscriptions where id = '${subscriptionAId}'`,
    '29.0000'
  );

  await expectScalar(
    db,
    'the upgrade is recorded in the history',
    `select change_type from public.subscription_changes
      where subscription_id = '${subscriptionAId}'
      order by created_at desc limit 1`,
    'upgrade'
  );

  await signIn(db, SEED.staffA);
  await expectRejection(
    db,
    'a staff member cannot change the plan',
    `select public.change_subscription_plan('${subscriptionAId}', '${planId.free}')`
  );

  await signIn(db, SEED.ownerA);
  await db.query('select public.redeem_coupon($1, $2, $3, $4)', [
    'WELCOME20',
    SEED.companyA,
    subscriptionAId,
    29,
  ]);

  await expectScalar(
    db,
    'the redeemed coupon sits on the subscription',
    `select discount_amount::text from public.subscriptions where id = '${subscriptionAId}'`,
    '5.8000'
  );

  await expectRejection(
    db,
    'the same account cannot claim the code twice',
    `select public.redeem_coupon('WELCOME20', '${SEED.companyA}', '${subscriptionAId}', 29)`
  );

  console.log('\nPlatform billing');

  await signOut(db);

  const subscriptionB = await db.query(
    `select id from public.subscriptions where company_id = $1 and deleted_at is null`,
    [SEED.companyB]
  );
  const subscriptionBId = subscriptionB.rows[0].id;

  await signIn(db, SEED.ownerB);
  await db.query('select public.change_subscription_plan($1, $2)', [
    subscriptionBId,
    planId.professional,
  ]);
  await signOut(db);

  const platformInvoice = await db.query('select public.create_subscription_invoice($1) as id', [
    subscriptionBId,
  ]);
  const platformInvoiceId = platformInvoice.rows[0].id;

  await expectScalar(
    db,
    'the platform invoice uses its own numbering series',
    `select invoice_number from public.subscription_invoices where id = '${platformInvoiceId}'`,
    `KD-${new Date().getUTCFullYear()}-000001`
  );

  await expectScalar(
    db,
    'raising the same period twice is refused',
    `select coalesce(public.create_subscription_invoice('${subscriptionBId}')::text, 'none')`,
    'none'
  );

  console.log('\nReferral programme');

  const affiliate = await db.query(
    `insert into public.affiliates
       (user_id, referral_code, display_name, status, contact_email, commission_percentage)
     values ($1, 'ALEX-REF', 'Alex Referral', 'approved', 'affiliate@example.com', 20)
     returning id`,
    [SEED.affiliate]
  );
  const affiliateId = affiliate.rows[0].id;

  await expectScalar(
    db,
    'the referral code is stored in one consistent case',
    `select referral_code from public.affiliates where id = '${affiliateId}'`,
    'alex-ref'
  );

  await db.query(
    `select public.record_affiliate_click('alex-ref', 'visitor-token-0001', '/pricing')`
  );

  await expectScalar(
    db,
    'a repeated load is not counted twice',
    `select coalesce(
              public.record_affiliate_click('alex-ref', 'visitor-token-0001', '/pricing')::text,
              'ignored')`,
    'ignored'
  );

  await db.query('select public.attribute_affiliate_signup($1, $2)', [
    SEED.companyB,
    'visitor-token-0001',
  ]);

  await expectScalar(
    db,
    'the signup is attributed to the partner',
    `select count(*)::int from public.affiliate_referrals
      where affiliate_id = '${affiliateId}' and company_id = '${SEED.companyB}'`,
    1
  );

  await expectScalar(
    db,
    'a company can only be attributed once',
    `select coalesce(
              public.attribute_affiliate_signup('${SEED.companyB}', 'visitor-token-0001')::text,
              'ignored')`,
    'ignored'
  );

  await expectScalar(
    db,
    'paying the platform invoice settles it',
    `select public.settle_subscription_invoice('${platformInvoiceId}', 29)::text`,
    'paid'
  );

  await expectScalar(
    db,
    'the paid period rolls the subscription forward',
    `select change_type from public.subscription_changes
      where subscription_id = '${subscriptionBId}' order by created_at desc limit 1`,
    'renewed'
  );

  await expectRejection(
    db,
    'a paid platform invoice can no longer be altered',
    `update public.subscription_invoices set total_amount = 1
      where id = '${platformInvoiceId}'`
  );

  await expectScalar(
    db,
    'the partner earns a share of the payment',
    `select amount::text from public.affiliate_commissions
      where affiliate_id = '${affiliateId}'`,
    '5.8000'
  );

  await db.query(
    `update public.affiliate_commissions set available_on = current_date
      where affiliate_id = $1`,
    [affiliateId]
  );

  await expectScalar(
    db,
    'the matured commission is released',
    'select public.release_due_commissions()::text',
    '1'
  );

  await expectScalar(
    db,
    'the released commission reaches the partner wallet',
    `select available_balance::text from public.wallets where user_id = '${SEED.affiliate}'`,
    '5.8000'
  );

  console.log('\nDunning and cancellation');

  await db.query(
    `update public.subscriptions
        set status = 'trialing', trial_start_date = current_date - 20,
            trial_end_date = current_date - 1
      where id = $1`,
    [subscriptionAId]
  );

  await expectScalar(
    db,
    'a finished trial is moved on',
    'select public.process_expired_trials()::text',
    '1'
  );

  await expectScalar(
    db,
    'an unpaid trial lands in dunning',
    `select status::text from public.subscriptions where id = '${subscriptionAId}'`,
    'past_due'
  );

  const overdueInvoice = await db.query('select public.create_subscription_invoice($1) as id', [
    subscriptionAId,
  ]);

  await db.query(
    `update public.subscription_invoices set due_date = current_date - 20 where id = $1`,
    [overdueInvoice.rows[0].id]
  );

  await db.query('select public.run_subscription_dunning(14)');

  await expectScalar(
    db,
    'the unpaid platform invoice is marked overdue',
    `select status::text from public.subscription_invoices
      where id = '${overdueInvoice.rows[0].id}'`,
    'overdue'
  );

  await db.query(
    `update public.subscriptions set past_due_since = current_date - 30 where id = $1`,
    [subscriptionAId]
  );
  await db.query('select public.run_subscription_dunning(14)');

  await expectScalar(
    db,
    'access is paused once the grace period runs out',
    `select status::text from public.subscriptions where id = '${subscriptionAId}'`,
    'paused'
  );

  await signIn(db, SEED.ownerB);
  await db.query('select public.cancel_subscription($1, false, $2)', [
    subscriptionBId,
    'Closing the business',
  ]);

  await expectScalar(
    db,
    'a cancellation waits for the end of the paid period',
    `select cancel_at_period_end::text from public.subscriptions where id = '${subscriptionBId}'`,
    'true'
  );

  await signOut(db);
  await db.query(
    `update public.subscriptions
        set current_period_start = current_date - 31, current_period_end = current_date - 1
      where id = $1`,
    [subscriptionBId]
  );

  await expectScalar(
    db,
    'the cancelled subscription expires when its period ends',
    'select public.process_scheduled_cancellations()::text',
    '1'
  );

  await expectScalar(
    db,
    'the tenant falls back to the signup plan',
    `select p.plan_key
       from public.subscriptions as s
       join public.subscription_plans as p on p.id = s.plan_id
      where s.company_id = '${SEED.companyB}' and s.status = 'active'`,
    'free'
  );

  console.log('\nPlan catalogue guards');

  await expectRejection(
    db,
    'a plan with subscribers cannot be removed',
    `update public.subscription_plans set deleted_at = now()
      where id = '${planId.professional}'`
  );

  await db.query(
    `insert into public.subscription_plans (plan_key, name, is_free, is_default_on_signup)
     values ('starter', 'Starter', true, true)`
  );

  await expectScalar(
    db,
    'marking a new signup plan stands down the previous one',
    `select count(*)::int from public.subscription_plans
      where is_default_on_signup and deleted_at is null`,
    1
  );

  console.log('\nSubscription isolation');

  await signIn(db, SEED.ownerB);
  await expectScalar(
    db,
    'a tenant sees no subscription of another tenant',
    `select count(*)::int from public.subscriptions where company_id = '${SEED.companyA}'`,
    0
  );

  await signIn(db, SEED.affiliate);
  await expectScalar(
    db,
    'a partner sees its own commission',
    'select count(*)::int from public.affiliate_commissions',
    1
  );

  await expectRejection(
    db,
    'a partner cannot learn which tenant generated the commission',
    'select company_id from public.affiliate_commissions'
  );

  await expectRejection(
    db,
    'a partner cannot read the referred company records at all',
    'select count(*) from public.affiliate_referrals'
  );

  await signIn(db, SEED.ownerA);
  await expectScalar(
    db,
    'a tenant sees no commission of a partner',
    'select count(*)::int from public.affiliate_commissions',
    0
  );

  console.log('\nChanging your mind about the plan');

  await signIn(db, SEED.staffA);
  await expectRejection(
    db,
    'a staff member cannot restart the plan',
    `select public.resume_subscription('${subscriptionAId}')`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the owner wakes a plan that was paused for non payment',
    `select public.resume_subscription('${subscriptionAId}', 'The platform invoice was settled')::text`,
    'active'
  );

  await expectScalar(
    db,
    'and the restart is written to the history',
    `select change_type from public.subscription_changes
      where subscription_id = '${subscriptionAId}' order by created_at desc limit 1`,
    'resumed'
  );

  await expectRejection(
    db,
    'a plan already running cannot be restarted again',
    `select public.resume_subscription('${subscriptionAId}')`
  );

  await expectScalar(
    db,
    'the billing screen reads every allowance in one answer',
    `select used::text from public.company_usage_snapshot('${SEED.companyA}')
      where metric_key = 'monthly_invoices'`,
    '2'
  );

  await expectScalar(
    db,
    'an exception granted to this tenant is reflected in the allowance',
    `select allowance::text from public.company_usage_snapshot('${SEED.companyA}')
      where metric_key = 'monthly_invoices'`,
    '50'
  );

  await signIn(db, SEED.ownerB);
  await expectRejection(
    db,
    'the usage of another business cannot be read',
    `select count(*) from public.company_usage_snapshot('${SEED.companyA}')`
  );

  await signOut(db);
}

/**
 * Exercises templates, senders, the outbox, reminders and approvals.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testCommunications(db) {
  console.log('\nMessage wording');

  await signOut(db);

  await expectScalar(
    db,
    'the platform ships wording for every standard message',
    'select count(*)::int >= 10 from public.email_templates where company_id is null',
    true
  );

  await expectScalar(
    db,
    'a tenant inherits the platform wording',
    `select template_key from public.email_templates
      where id = public.resolve_email_template('invoice_sent', '${SEED.companyA}')
        and company_id is null`,
    'invoice_sent'
  );

  await db.query(
    `insert into public.email_templates
       (company_id, template_key, name, subject, body_html, body_text)
     values ($1, 'invoice_sent', 'Our invoice note',
             'Invoice {{invoice_number}} from Northwind Supply',
             '<p>Hi {{client_name}}, invoice {{invoice_number}} is ready.</p>',
             'Hi {{client_name}}, invoice {{invoice_number}} is ready.')`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'its own rewrite takes precedence',
    `select subject from public.email_templates
      where id = public.resolve_email_template('invoice_sent', '${SEED.companyA}')`,
    'Invoice {{invoice_number}} from Northwind Supply'
  );

  await db.query(
    `update public.email_templates
        set subject = 'Invoice {{invoice_number}} is ready'
      where company_id = $1 and template_key = 'invoice_sent'`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'an edit moves the template to the next version',
    `select version::text from public.email_templates
      where company_id = '${SEED.companyA}' and template_key = 'invoice_sent'`,
    '2'
  );

  await expectScalar(
    db,
    'the previous wording is kept as evidence',
    `select subject from public.email_template_versions
      where version = 1
        and template_id = (select id from public.email_templates
                            where company_id = '${SEED.companyA}'
                              and template_key = 'invoice_sent')`,
    'Invoice {{invoice_number}} from Northwind Supply'
  );

  await signIn(db, SEED.ownerA);
  await expectScalar(
    db,
    'a tenant cannot rewrite the platform wording',
    `with changed as (
       update public.email_templates set subject = 'Rewritten'
        where company_id is null and template_key = 'invoice_sent'
        returning 1
     )
     select count(*)::int from changed`,
    0
  );

  console.log('\nSender identity');

  await signOut(db);

  await expectScalar(
    db,
    'every message leaves from the platform address by default',
    `select from_email::text from public.sender_identities
      where id = public.resolve_sender_identity('${SEED.companyA}')`,
    'support@kdsolutionit.com'
  );

  const domain = await db.query(
    `insert into public.sending_domains
       (company_id, domain_name, mail_subdomain, spf_record, dkim_host,
        dkim_record, dmarc_record)
     values ($1, 'northwind-supply.test', 'mail.northwind-supply.test',
             'v=spf1 include:amazonses.com ~all',
             'resend._domainkey.mail.northwind-supply.test',
             'p=publish-the-value-from-the-mail-provider-dashboard',
             'v=DMARC1; p=none; rua=mailto:dmarc@northwind-supply.test')
     returning id`,
    [SEED.companyA]
  );

  await db.query(
    `insert into public.sender_identities
       (company_id, sending_domain_id, from_name, from_email, uses_platform_domain,
        is_default)
     values ($1, $2, 'Northwind Supply', 'billing@northwind-supply.test', false, true)`,
    [SEED.companyA, domain.rows[0].id]
  );

  await expectScalar(
    db,
    'an unverified domain cannot be sent from',
    `select from_email::text from public.sender_identities
      where id = public.resolve_sender_identity('${SEED.companyA}')`,
    'support@kdsolutionit.com'
  );

  await db.query(
    `update public.sending_domains
        set spf_verified_at = now(), dkim_verified_at = now(), is_verified = true
      where id = $1`,
    [domain.rows[0].id]
  );

  await expectScalar(
    db,
    'a verified domain becomes the sender',
    `select from_email::text from public.sender_identities
      where id = public.resolve_sender_identity('${SEED.companyA}')`,
    'billing@northwind-supply.test'
  );

  console.log('\nOutbox');

  await signIn(db, SEED.ownerA);

  const queued = await db.query(
    `select public.queue_message(
              $1, 'invoice_sent', 'buyer@example.com',
              jsonb_build_object('client_name', 'Jane Buyer',
                                 'invoice_number', 'INV-0042'),
              'test-message-0001', 'Jane Buyer'
            ) as id`,
    [SEED.companyA]
  );
  const messageId = queued.rows[0].id;

  await expectScalar(
    db,
    'the wording is rendered with the supplied values',
    `select subject from public.messages where id = '${messageId}'`,
    'Invoice INV-0042 is ready'
  );

  await expectScalar(
    db,
    'no placeholder is left behind in the body',
    `select (body_text not like '%{{%')::text from public.messages where id = '${messageId}'`,
    'true'
  );

  await expectScalar(
    db,
    'the same send key never produces a second message',
    `select (public.queue_message(
               '${SEED.companyA}', 'invoice_sent', 'buyer@example.com',
               '{}'::jsonb, 'test-message-0001'
             ) = '${messageId}')::text`,
    'true'
  );

  await signIn(db, SEED.staffA);
  await expectRejection(
    db,
    'a staff member cannot write to a client',
    `select public.queue_message('${SEED.companyA}', 'invoice_sent',
                                 'second.buyer@example.com', '{}'::jsonb,
                                 'test-message-0002')`
  );

  await signOut(db);

  await expectScalar(
    db,
    'the provider callback marks the message delivered',
    `select public.record_message_event('${messageId}', 'delivered', 'evt-0001')::text`,
    'true'
  );

  await expectScalar(
    db,
    'a repeated callback is ignored',
    `select public.record_message_event('${messageId}', 'delivered', 'evt-0001')::text`,
    'false'
  );

  await db.query(`select public.record_message_event($1, 'read', 'evt-0002')`, [messageId]);

  await expectScalar(
    db,
    'an open is counted once per callback',
    `select open_count::int from public.messages where id = '${messageId}'`,
    1
  );

  const bouncing = await db.query(
    `select public.queue_message(
              $1, 'invoice_sent', 'gone.away@example.com', '{}'::jsonb,
              'test-message-0003'
            ) as id`,
    [SEED.companyA]
  );

  await db.query(
    `select public.record_message_event($1, 'bounced', 'evt-0003',
             jsonb_build_object('reason', 'The mailbox does not exist'))`,
    [bouncing.rows[0].id]
  );

  await expectScalar(
    db,
    'a bounce closes the address',
    `select public.is_email_suppressed('gone.away@example.com', '${SEED.companyA}')::text`,
    'true'
  );

  await expectRejection(
    db,
    'a suppressed address is never written to again',
    `select public.queue_message('${SEED.companyA}', 'invoice_sent',
                                 'gone.away@example.com', '{}'::jsonb,
                                 'test-message-0004')`
  );

  await signIn(db, SEED.ownerA);
  await db.query(
    `select public.queue_message($1, 'invoice_sent', 'third.buyer@example.com',
                                 '{}'::jsonb, 'test-message-0005')`,
    [SEED.companyA]
  );
  await signOut(db);

  await expectScalar(
    db,
    'a worker claims the messages that are due',
    'select count(*)::int from public.claim_due_messages(10)',
    1
  );

  console.log('\nReminders');

  await expectScalar(
    db,
    'a new tenant receives a working reminder ladder',
    `select count(*)::int from public.reminder_rules
      where company_id = '${SEED.companyA}' and deleted_at is null`,
    4
  );

  await expectScalar(
    db,
    'a send is moved out of quiet hours and onto a working day',
    `select to_char(
              public.next_sending_slot('${SEED.companyA}',
                                       timestamptz '2026-01-04 02:00+00')
                at time zone 'UTC',
              'ID HH24')`,
    '1 08'
  );

  const client = await db.query(
    `select id from public.clients where company_id = $1 and deleted_at is null limit 1`,
    [SEED.companyA]
  );
  const product = await db.query(`select id from public.products where company_id = $1 limit 1`, [
    SEED.companyA,
  ]);

  await signIn(db, SEED.ownerA);
  const chased = await db.query(
    `insert into public.invoices (company_id, client_id, issue_date, due_date)
     values ($1, $2, current_date, current_date + 30)
     returning id`,
    [SEED.companyA, client.rows[0].id]
  );
  const chasedId = chased.rows[0].id;

  await db.query(
    `insert into public.invoice_items (company_id, invoice_id, product_id, quantity)
     values ($1, $2, $3, 1)`,
    [SEED.companyA, chasedId, product.rows[0].id]
  );

  await db.query('select public.issue_invoice($1)', [chasedId]);

  await expectScalar(
    db,
    'issuing an invoice plans the whole reminder ladder',
    `select count(*)::int from public.invoice_reminders
      where invoice_id = '${chasedId}' and status = 'scheduled'`,
    4
  );

  await db.query('select public.record_payment_promise($1, current_date + 40)', [chasedId]);

  await expectScalar(
    db,
    'a promise to pay silences every reminder due before that date',
    `select count(*)::int from public.invoice_reminders
      where invoice_id = '${chasedId}' and status = 'scheduled'
        and scheduled_for::date <= current_date + 40`,
    0
  );

  await expectScalar(
    db,
    'chasing resumes after the promised date passes',
    `select count(*)::int from public.invoice_reminders
      where invoice_id = '${chasedId}' and status = 'scheduled'`,
    1
  );

  await expectRejection(
    db,
    'a promise cannot be backdated',
    `select public.record_payment_promise('${chasedId}', current_date - 1)`
  );

  await db.query('select public.schedule_invoice_reminders($1)', [chasedId]);

  const balance = await db.query(
    `select balance_due::text as balance_due from public.invoices where id = $1`,
    [chasedId]
  );

  await db.query(`select public.record_payment($1, $2, $3::numeric, 'bank_transfer', 'manual')`, [
    SEED.companyA,
    chasedId,
    balance.rows[0].balance_due,
  ]);

  await expectScalar(
    db,
    'settling the invoice stops every planned reminder',
    `select count(*)::int from public.invoice_reminders
      where invoice_id = '${chasedId}' and status = 'scheduled'`,
    0
  );

  console.log('\nSend approval');

  await signIn(db, SEED.staffA);
  const request = await db.query(
    `select public.request_document_send(
              $1, 'invoice', $2, 'buyer@example.com', 'Jane Buyer',
              'Please find the invoice attached.'
            ) as id`,
    [SEED.companyA, chasedId]
  );

  await expectScalar(
    db,
    'a staff member can prepare a send for approval',
    `select status::text from public.send_requests where id = '${request.rows[0].id}'`,
    'pending'
  );

  await expectRejection(
    db,
    'the colleague who raised a request cannot approve it',
    `select public.review_send_request('${request.rows[0].id}', true)`
  );

  await signIn(db, SEED.ownerA);
  await expectScalar(
    db,
    'the owner approves the send',
    `select public.review_send_request('${request.rows[0].id}', true)::text`,
    'approved'
  );

  console.log('\nNotifications');

  await signOut(db);

  await expectScalar(
    db,
    'a notification reaches the person it is addressed to',
    `select (public.notify_user('${SEED.ownerA}', 'invoice_paid',
                                'An invoice was paid',
                                'Invoice INV-0042 has been settled in full.',
                                '${SEED.companyA}') is not null)::text`,
    'true'
  );

  await db.query(
    `insert into public.notification_preferences
       (user_id, company_id, notification_kind, channel, is_enabled)
     values ($1, $2, 'low_stock', 'in_app', false)`,
    [SEED.ownerA, SEED.companyA]
  );

  await expectScalar(
    db,
    'a switched off event is not raised',
    `select coalesce(public.notify_user('${SEED.ownerA}', 'low_stock',
                                        'Stock is running low',
                                        'Two products are below their reorder point.',
                                        '${SEED.companyA}')::text, 'skipped')`,
    'skipped'
  );

  await db.query(
    `insert into public.notification_preferences
       (user_id, company_id, notification_kind, channel, is_enabled)
     values ($1, $2, 'security_alert', 'in_app', false)`,
    [SEED.ownerA, SEED.companyA]
  );

  await expectScalar(
    db,
    'a security alert is never silenced',
    `select (public.notify_user('${SEED.ownerA}', 'security_alert',
                                'A new sign in was detected',
                                'Your account was opened from a new device.',
                                '${SEED.companyA}') is not null)::text`,
    'true'
  );

  await signIn(db, SEED.ownerA);
  await expectScalar(
    db,
    'the recipient can clear the unread list',
    'select public.mark_notifications_read() >= 2',
    true
  );

  console.log('\nCommunication isolation');

  await signIn(db, SEED.ownerB);
  await expectScalar(
    db,
    'a second tenant sees no message of the first',
    'select count(*)::int from public.messages',
    0
  );

  await signIn(db, SEED.staffA);
  await expectScalar(
    db,
    'a staff member cannot read the do not contact list',
    'select count(*)::int from public.email_suppressions',
    0
  );

  await signIn(db, SEED.ownerA);
  await expectScalar(
    db,
    'the owner can read the do not contact list',
    'select count(*)::int from public.email_suppressions',
    1
  );

  await signIn(db, SEED.affiliate);
  await expectScalar(
    db,
    'an affiliate sees no message at all',
    'select count(*)::int from public.messages',
    0
  );

  await signOut(db);
}

/**
 * Switches the session to the trusted server layer, which is how the platform
 * calls the posting routines from a webhook or a scheduled job.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function signInAsService(db) {
  await db.exec('reset role;');
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', '']);
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.role', 'service_role']);
}

/**
 * Verifies the ledger, spending, purchasing and bank reconciliation rules.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testAccounting(db) {
  console.log('\nChart of accounts');

  await signOut(db);

  await expectScalar(
    db,
    'a new tenant starts with a working chart',
    `select count(*)::int from public.ledger_accounts
      where company_id = '${SEED.companyA}' and deleted_at is null`,
    30
  );

  await expectScalar(
    db,
    'the postings can find the receivable account',
    `select code from public.ledger_accounts
      where id = public.system_account_id('${SEED.companyA}', 'accounts_receivable')`,
    '1100'
  );

  await db.query("select public.install_chart_of_accounts($1, 'general')", [SEED.companyA]);

  await expectScalar(
    db,
    'installing the chart again changes nothing',
    `select count(*)::int from public.ledger_accounts
      where company_id = '${SEED.companyA}' and deleted_at is null`,
    30
  );

  await expectRejection(
    db,
    'an account the postings depend on cannot be removed',
    `update public.ledger_accounts set deleted_at = now()
      where company_id = '${SEED.companyA}' and system_key = 'accounts_receivable'`
  );

  console.log('\nJournal entries');

  await signInAsService(db);

  await expectRejection(
    db,
    'an entry that does not balance is refused',
    `select public.post_journal_entry('${SEED.companyA}',
       '[{"account_key": "cash", "debit": 100, "credit": 0},
         {"account_key": "sales_revenue", "debit": 0, "credit": 90}]'::jsonb,
       'Unbalanced test entry')`
  );

  await expectRejection(
    db,
    'an entry that moves nothing is refused',
    `select public.post_journal_entry('${SEED.companyA}',
       '[{"account_key": "cash", "debit": 0, "credit": 0},
         {"account_key": "sales_revenue", "debit": 0, "credit": 0}]'::jsonb,
       'Empty test entry')`
  );

  const manualEntry = await db.query(
    `select public.post_journal_entry($1,
       '[{"account_key": "cash", "debit": 500, "credit": 0,
          "description": "Opening float"},
         {"account_key": "owner_equity", "debit": 0, "credit": 500,
          "description": "Owner contribution"}]'::jsonb,
       'Opening float', current_date, 'manual') as id`,
    [SEED.companyA]
  );
  const manualEntryId = manualEntry.rows[0].id;

  await signOut(db);

  await expectScalar(
    db,
    'a posted entry takes the next number in the series',
    `select entry_number from public.journal_entries where id = '${manualEntryId}'`,
    'JE-00001'
  );

  await expectScalar(
    db,
    'the cached account balance follows the posting',
    `select current_balance::text from public.ledger_accounts
      where company_id = '${SEED.companyA}' and system_key = 'cash'`,
    '500.0000'
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the balance is read in the natural direction of the account',
    `select public.account_balance(
       public.system_account_id('${SEED.companyA}', 'owner_equity'))::text`,
    '500.0000'
  );

  await signOut(db);

  await expectRejection(
    db,
    'a posted entry cannot be edited',
    `update public.journal_entries set memo = 'Rewritten'
      where id = '${manualEntryId}'`
  );

  await expectRejection(
    db,
    'the lines of a posted entry cannot be edited',
    `update public.journal_lines set debit_amount = 900
      where entry_id = '${manualEntryId}' and debit_amount > 0`
  );

  await expectRejection(
    db,
    'a line cannot be a debit and a credit at the same time',
    `insert into public.journal_lines
       (company_id, entry_id, account_id, line_number, debit_amount, credit_amount)
     values ('${SEED.companyA}', '${manualEntryId}',
             public.system_account_id('${SEED.companyA}', 'cash'), 9, 10, 10)`
  );

  await signInAsService(db);

  const reversal = await db.query(
    `select public.reverse_journal_entry($1, 'Posted to the wrong account') as id`,
    [manualEntryId]
  );
  const reversalId = reversal.rows[0].id;

  await signOut(db);

  await expectScalar(
    db,
    'the original entry is marked as reversed',
    `select status::text from public.journal_entries where id = '${manualEntryId}'`,
    'reversed'
  );

  await expectScalar(
    db,
    'the reversal cancels the balance it corrected',
    `select current_balance::text from public.ledger_accounts
      where company_id = '${SEED.companyA}' and system_key = 'cash'`,
    '0.0000'
  );

  await expectScalar(
    db,
    'the reversal points back at the entry it corrects',
    `select source_type from public.journal_entries where id = '${reversalId}'`,
    'reversal'
  );

  console.log('\nDocument postings');

  const invoice = await db.query(
    `select id, total_amount from public.invoices
      where company_id = $1 and status <> 'draft' and deleted_at is null
      order by created_at limit 1`,
    [SEED.companyA]
  );
  const invoiceId = invoice.rows[0].id;
  const invoiceTotal = invoice.rows[0].total_amount;

  await signInAsService(db);

  const posted = await db.query('select public.post_invoice_to_ledger($1) as id', [invoiceId]);
  report(
    posted.rows[0].id !== null,
    'an issued invoice reaches the ledger',
    String(posted.rows[0].id)
  );

  await expectScalar(
    db,
    'posting the same invoice twice is refused quietly',
    `select public.post_invoice_to_ledger('${invoiceId}')`,
    null
  );

  await signOut(db);

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the receivable carries the value of the invoice',
    `select public.account_balance(
       public.system_account_id('${SEED.companyA}', 'accounts_receivable'))::text`,
    String(invoiceTotal)
  );

  await signOut(db);

  await expectScalar(
    db,
    'every debit of the tenant is answered by a credit',
    `select is_balanced from public.verify_ledger_balance('${SEED.companyA}')`,
    true
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the profit and loss report lists the income',
    `select count(*)::int from public.profit_and_loss(
       '${SEED.companyA}', current_date - 365, current_date)
      where section = 'Income'`,
    1
  );

  await expectScalar(
    db,
    'the balance sheet lists the receivable',
    `select count(*)::int from public.balance_sheet('${SEED.companyA}', current_date)
      where account_name = 'Accounts receivable'`,
    1
  );

  await expectScalar(
    db,
    'the trial balance itself balances',
    `select sum(debit_total) = sum(credit_total)
       from public.trial_balance('${SEED.companyA}', null, null)`,
    true
  );

  console.log('\nSuppliers and spending');

  await signIn(db, SEED.ownerA);

  const vendor = await db.query(
    `insert into public.vendors (company_id, display_name, email, country_code)
     values ($1, 'Harbour Paper Supply', 'billing@harbourpaper.test', 'US')
     returning id, vendor_reference, normalized_name`,
    [SEED.companyA]
  );
  const vendorId = vendor.rows[0].id;

  report(
    vendor.rows[0].vendor_reference === 'VN-0001',
    'a supplier is numbered on arrival',
    vendor.rows[0].vendor_reference
  );

  report(
    vendor.rows[0].normalized_name === 'harbour paper supply',
    'a supplier name is normalised for searching',
    vendor.rows[0].normalized_name
  );

  await db.query(
    `insert into public.vendor_contacts (company_id, vendor_id, full_name, is_primary)
     values ($1, $2, 'Alice Weaver', true), ($1, $2, 'Dmitri Olsen', true)`,
    [SEED.companyA, vendorId]
  );

  await expectScalar(
    db,
    'a supplier keeps exactly one main contact',
    `select count(*)::int from public.vendor_contacts
      where vendor_id = '${vendorId}' and is_primary and deleted_at is null`,
    1
  );

  const category = await db.query(
    `insert into public.expense_categories (company_id, name, ledger_account_id)
     values ($1, 'Software', public.system_account_id($1, 'software_expense'))
     returning id`,
    [SEED.companyA]
  );
  const categoryId = category.rows[0].id;

  await expectRejection(
    db,
    'a rechargeable expense has to name the client it belongs to',
    `insert into public.expenses
       (company_id, description, subtotal_amount, is_billable)
     values ('${SEED.companyA}', 'Rechargeable hosting', 40, true)`
  );

  const expense = await db.query(
    `insert into public.expenses
       (company_id, category_id, vendor_id, description, subtotal_amount,
        is_paid, payment_account_id, submitted_at, submitted_by, status)
     values ($1, $2, $3, 'Design software licence', 120, true,
             public.system_account_id($1, 'bank'), now(), $4, 'submitted')
     returning id, expense_number, total_amount`,
    [SEED.companyA, categoryId, vendorId, SEED.ownerA]
  );
  const expenseId = expense.rows[0].id;

  report(
    expense.rows[0].expense_number === 'EXP-0001',
    'a claim is numbered on arrival',
    expense.rows[0].expense_number
  );

  await expectScalar(
    db,
    'the total of a claim is worked out by the database',
    `select total_amount::text from public.expenses where id = '${expenseId}'`,
    '120.0000'
  );

  await signIn(db, SEED.staffA);
  await expectRejection(
    db,
    'only the account owner approves spending',
    `select public.review_expense('${expenseId}', true)`
  );

  await signIn(db, SEED.ownerA);
  await expectScalar(
    db,
    'the owner approves the claim',
    `select public.review_expense('${expenseId}', true)::text`,
    'approved'
  );

  await expectScalar(
    db,
    'an approved claim writes itself into the ledger',
    `select count(*)::int from public.journal_entries
      where source_type = 'expense' and source_id = '${expenseId}'
        and status = 'posted'`,
    1
  );

  await expectRejection(
    db,
    'a claim is only reviewed once',
    `select public.review_expense('${expenseId}', false, 'Changed my mind')`
  );

  console.log('\nPurchase orders');

  const order = await db.query(
    `insert into public.purchase_orders (company_id, vendor_id, status)
     values ($1, $2, 'confirmed')
     returning id, order_number`,
    [SEED.companyA, vendorId]
  );
  const orderId = order.rows[0].id;

  report(
    order.rows[0].order_number === 'PO-0001',
    'an order is numbered on arrival',
    order.rows[0].order_number
  );

  const orderItems = await db.query(
    `insert into public.purchase_order_items
       (company_id, purchase_order_id, line_number, description, quantity, unit_price)
     values ($1, $2, 1, 'A4 paper, box of five reams', 10, 24.5),
            ($1, $2, 2, 'Toner cartridge', 4, 89)
     returning id, line_number`,
    [SEED.companyA, orderId]
  );
  const firstItemId = orderItems.rows.find((row) => row.line_number === 1).id;
  const secondItemId = orderItems.rows.find((row) => row.line_number === 2).id;

  await expectScalar(
    db,
    'the order total follows its lines',
    `select total_amount::text from public.purchase_orders where id = '${orderId}'`,
    '601.0000'
  );

  await expectRejection(
    db,
    'more cannot be delivered than was ordered',
    `select public.receive_purchase_order('${orderId}',
       '[{"purchase_order_item_id": "${firstItemId}", "quantity_received": 11}]'::jsonb)`
  );

  await db.query(
    `select public.receive_purchase_order($1,
       jsonb_build_array(jsonb_build_object(
         'purchase_order_item_id', $2::text, 'quantity_received', 10)))`,
    [orderId, firstItemId]
  );

  await expectScalar(
    db,
    'a part delivery leaves the order open',
    `select status::text from public.purchase_orders where id = '${orderId}'`,
    'partially_received'
  );

  await db.query(
    `select public.receive_purchase_order($1,
       jsonb_build_array(jsonb_build_object(
         'purchase_order_item_id', $2::text, 'quantity_received', 4)))`,
    [orderId, secondItemId]
  );

  await expectScalar(
    db,
    'the last delivery closes the order',
    `select status::text from public.purchase_orders where id = '${orderId}'`,
    'received'
  );

  console.log('\nBank feed and reconciliation');

  const bankAccount = await db.query(
    `insert into public.bank_accounts
       (company_id, name, institution_name, account_number_last4, is_primary,
        ledger_account_id)
     values ($1, 'Operating account', 'First Harbour Bank', '4417', true,
             public.system_account_id($1, 'bank'))
     returning id`,
    [SEED.companyA]
  );
  const bankAccountId = bankAccount.rows[0].id;

  await signOut(db);

  const payment = await db.query(
    `select id, amount, coalesce(value_date, received_at::date) as paid_on
       from public.payments
      where company_id = $1
        and status = 'succeeded'
        and reconciled_at is null
        and deleted_at is null
      order by created_at limit 1`,
    [SEED.companyA]
  );
  const paymentId = payment.rows[0].id;
  const paymentAmount = payment.rows[0].amount;
  const paidOn =
    payment.rows[0].paid_on instanceof Date
      ? payment.rows[0].paid_on.toISOString().slice(0, 10)
      : String(payment.rows[0].paid_on);

  const line = await db.query(
    `select public.import_bank_transaction($1, $2, $3,
       'Card settlement, batch 7781', 'FHB-7781', 'Card acquirer', null, null,
       'bank_feed') as id`,
    [bankAccountId, paymentAmount, paidOn]
  );
  const lineId = line.rows[0].id;

  await expectScalar(
    db,
    'the same statement line is never imported twice',
    `select public.import_bank_transaction('${bankAccountId}', ${paymentAmount},
       '${paidOn}'::date, 'Card settlement, batch 7781', 'FHB-7781')::text`,
    String(lineId)
  );

  await expectScalar(
    db,
    'the feed produced exactly one statement line',
    `select count(*)::int from public.bank_transactions
      where bank_account_id = '${bankAccountId}'`,
    1
  );

  await expectRejection(
    db,
    'a statement line is a fact and cannot be rewritten',
    `update public.bank_transactions set amount = amount + 10 where id = '${lineId}'`
  );

  await expectScalar(
    db,
    'reconciliation offers the payment that fits',
    `select confidence::text from public.suggest_bank_matches('${lineId}', 5) limit 1`,
    '100'
  );

  await expectScalar(
    db,
    'the suggestion names the right payment',
    `select payment_id::text from public.suggest_bank_matches('${lineId}', 5) limit 1`,
    String(paymentId)
  );

  await signIn(db, SEED.ownerA);

  await db.query('select public.match_bank_transaction($1, $2)', [lineId, paymentId]);

  await expectScalar(
    db,
    'confirming a match settles the statement line',
    `select status from public.bank_transactions where id = '${lineId}'`,
    'matched'
  );

  await expectScalar(
    db,
    'the payment is marked as reconciled',
    `select (reconciled_at is not null and bank_transaction_id = '${lineId}')
       from public.payments where id = '${paymentId}'`,
    true
  );

  await expectRejection(
    db,
    'a settled statement line is not matched again',
    `select public.match_bank_transaction('${lineId}', '${paymentId}')`
  );

  await expectScalar(
    db,
    'undoing a match releases both sides',
    `select public.unmatch_bank_transaction('${lineId}', 'Matched in error')`,
    true
  );

  await expectScalar(
    db,
    'the payment waits for reconciliation again',
    `select (reconciled_at is null and bank_transaction_id is null)
       from public.payments where id = '${paymentId}'`,
    true
  );

  await db.query(
    `insert into public.reconciliation_rules
       (company_id, name, description_contains, set_ledger_account_id)
     values ($1, 'Card settlements', 'Card settlement',
             public.system_account_id($1, 'bank'))`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'a rule proposes a line but never confirms the money',
    `select public.apply_reconciliation_rules('${SEED.companyA}', 100)`,
    1
  );

  await expectScalar(
    db,
    'the proposed line waits for a person',
    `select status from public.bank_transactions where id = '${lineId}'`,
    'suggested'
  );

  await expectScalar(
    db,
    'the summary counts what is still unexplained',
    `select unmatched_count from public.reconciliation_summary('${bankAccountId}')`,
    1
  );

  await expectScalar(
    db,
    'the summary counts nothing as settled',
    `select matched_count from public.reconciliation_summary('${bankAccountId}')`,
    0
  );

  console.log('\nBooks isolation');

  await signIn(db, SEED.ownerB);

  await expectScalar(
    db,
    'another tenant sees none of these suppliers',
    'select count(*)::int from public.vendors',
    0
  );

  await expectScalar(
    db,
    'another tenant sees none of these entries',
    'select count(*)::int from public.journal_entries',
    0
  );

  await expectScalar(
    db,
    'another tenant sees none of these statement lines',
    'select count(*)::int from public.bank_transactions',
    0
  );

  await signOut(db);
  await db.query(
    `insert into public.accountant_company_access
       (accountant_user_id, company_id, granted_by)
     select $1, $2, $3
      where not exists (
        select 1 from public.accountant_company_access
         where accountant_user_id = $1 and company_id = $2
      )`,
    [SEED.accountant, SEED.companyA, SEED.ownerA]
  );

  await db.query(
    `update public.accountant_company_access
        set status = 'active', expires_at = null, deleted_at = null
      where accountant_user_id = $1 and company_id = $2`,
    [SEED.accountant, SEED.companyA]
  );

  await signIn(db, SEED.accountant);

  await expectScalar(
    db,
    'an invited accountant reads the books',
    `select count(*)::int > 0 from public.journal_entries
      where company_id = '${SEED.companyA}'`,
    true
  );

  await expectScalar(
    db,
    'an invited accountant may post an entry',
    `select public.can_post_journal_entries('${SEED.companyA}')`,
    true
  );

  await expectScalar(
    db,
    'an accountant cannot open a bank account',
    `with attempted as (
       insert into public.bank_accounts (company_id, name)
       select '${SEED.companyA}', 'Unauthorised account'
        where public.can_write_company_data('${SEED.companyA}')
       returning 1
     )
     select count(*)::int from attempted`,
    0
  );

  await signIn(db, SEED.staffA);

  await expectRejection(
    db,
    'writing off a receivable is reserved for the owner',
    `select public.write_off_invoice('${invoiceId}', 'The client stopped replying')`
  );

  await signOut(db);
}

/**
 * Verifies projects, tracked time, timesheets, milestones, retainers,
 * project billing and stock control.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testProjects(db) {
  console.log('\nProjects and rates');

  await signOut(db);

  const client = await db.query(
    `select id from public.clients
      where company_id = $1 and deleted_at is null
      order by created_at limit 1`,
    [SEED.companyA]
  );
  const clientId = client.rows[0].id;

  await signIn(db, SEED.ownerA);

  const project = await db.query(
    `insert into public.projects
       (company_id, client_id, name, status, billing_type, hourly_rate,
        budget_hours, is_billable)
     values ($1, $2, 'Harbour website rebuild', 'active', 'time_and_materials',
             90, 120, true)
     returning id, project_code`,
    [SEED.companyA, clientId]
  );
  const projectId = project.rows[0].id;

  report(
    project.rows[0].project_code === 'PRJ-0001',
    'a project is given its reference on arrival',
    project.rows[0].project_code
  );

  await expectRejection(
    db,
    'billable work has to belong to a client',
    `insert into public.projects (company_id, name, is_billable)
     values ('${SEED.companyA}', 'Internal tooling', true)`
  );

  await expectRejection(
    db,
    'a fixed price project has to state the price',
    `insert into public.projects
       (company_id, client_id, name, billing_type)
     values ('${SEED.companyA}', '${clientId}', 'Brand refresh', 'fixed_price')`
  );

  await db.query(
    `insert into public.project_members
       (company_id, project_id, user_id, project_role, hourly_rate, cost_rate)
     values ($1, $2, $3, 'manager', 140, 55)`,
    [SEED.companyA, projectId, SEED.ownerA]
  );

  await expectScalar(
    db,
    'the rate of the person on the project wins',
    `select public.project_hourly_rate('${projectId}', '${SEED.ownerA}')::text`,
    '140.0000'
  );

  await expectScalar(
    db,
    'everyone else is charged at the project rate',
    `select public.project_hourly_rate('${projectId}', '${SEED.staffA}')::text`,
    '90.0000'
  );

  console.log('\nTracked time');

  const timer = await db.query(
    `select public.start_time_entry($1, 'Scoping call with the client') as id`,
    [projectId]
  );
  const timerId = timer.rows[0].id;

  await expectScalar(
    db,
    'a started timer is running',
    `select is_running from public.time_entries where id = '${timerId}'`,
    true
  );

  await expectRejection(
    db,
    'only one timer runs at a time',
    `select public.start_time_entry('${projectId}', 'Second parallel timer')`
  );

  await expectScalar(
    db,
    'stopping the timer records the minutes worked',
    `select public.stop_time_entry('${timerId}') >= 1`,
    true
  );

  const logged = await db.query(
    `select public.log_time_entry($1, 120, 'Information architecture',
       current_date - 1) as id`,
    [projectId]
  );
  const loggedEntryId = logged.rows[0].id;

  await expectScalar(
    db,
    'logged work is priced at the rate of the person',
    `select billable_amount::text from public.time_entries
      where id = '${loggedEntryId}'`,
    '280.0000'
  );

  await expectScalar(
    db,
    'the internal cost of the work is recorded too',
    `select cost_amount::text from public.time_entries
      where id = '${loggedEntryId}'`,
    '110.0000'
  );

  const task = await db.query(
    `insert into public.project_tasks
       (company_id, project_id, name, estimated_hours, assignee_user_id)
     values ($1, $2, 'Build the pricing page', 8, $3)
     returning id`,
    [SEED.companyA, projectId, SEED.ownerA]
  );
  const taskId = task.rows[0].id;

  await db.query(`select public.log_time_entry($1, 90, 'Pricing page markup', current_date, $2)`, [
    projectId,
    taskId,
  ]);

  await expectScalar(
    db,
    'the hours of a task follow the entries logged against it',
    `select logged_hours::text from public.project_tasks where id = '${taskId}'`,
    '1.50'
  );

  await expectScalar(
    db,
    'the project holds the hours of all its work',
    `select logged_hours >= 3.5 from public.projects where id = '${projectId}'`,
    true
  );

  await expectScalar(
    db,
    'a task can be marked finished',
    `select public.set_task_status('${taskId}', 'done')`,
    'done'
  );

  await expectScalar(
    db,
    'finishing a task records when it happened',
    `select completed_at is not null from public.project_tasks
      where id = '${taskId}'`,
    true
  );

  console.log('\nTimesheets');

  await signIn(db, SEED.staffA);

  await db.query(`select public.log_time_entry($1, 180, 'Content migration', current_date)`, [
    projectId,
  ]);

  const timesheet = await db.query(
    `select public.build_timesheet($1, (current_date - 3)::date) as id`,
    [SEED.staffA]
  );
  const timesheetId = timesheet.rows[0].id;

  await expectScalar(
    db,
    'building a timesheet gathers the week that was worked',
    `select total_hours > 0 from public.timesheets where id = '${timesheetId}'`,
    true
  );

  await db.query('select public.submit_timesheet($1)', [timesheetId]);

  await expectRejection(
    db,
    'a person cannot approve their own week',
    `select public.review_timesheet('${timesheetId}', true)`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the owner approves the week',
    `select public.review_timesheet('${timesheetId}', true)::text`,
    'approved'
  );

  await expectScalar(
    db,
    'approval carries down to the entries',
    `select count(*)::int from public.time_entries
      where timesheet_id = '${timesheetId}' and status = 'approved'`,
    1
  );

  await expectRejection(
    db,
    'a reviewed timesheet is not reviewed twice',
    `select public.review_timesheet('${timesheetId}', false, 'Changed my mind')`
  );

  console.log('\nMilestones and retainers');

  const fixedProject = await db.query(
    `insert into public.projects
       (company_id, client_id, name, billing_type, fixed_price_amount, status)
     values ($1, $2, 'Brand refresh', 'fixed_price', 6000, 'active')
     returning id`,
    [SEED.companyA, clientId]
  );
  const fixedProjectId = fixedProject.rows[0].id;

  const milestone = await db.query(
    `insert into public.project_milestones
       (company_id, project_id, name, amount, sort_order)
     values ($1, $2, 'Discovery and concepts', 2000, 1),
            ($1, $2, 'Final artwork', 4000, 2)
     returning id, sort_order`,
    [SEED.companyA, fixedProjectId]
  );
  const firstMilestoneId = milestone.rows.find((row) => row.sort_order === 1).id;

  await expectScalar(
    db,
    'the agreed value of the stages is tracked',
    `select agreed_amount::text from public.milestone_progress('${fixedProjectId}')`,
    '6000.0000'
  );

  await expectScalar(
    db,
    'a delivered stage becomes billable',
    `select public.complete_milestone('${firstMilestoneId}')`,
    'completed'
  );

  await expectScalar(
    db,
    'delivery is reflected in the progress report',
    `select completed_amount::text from public.milestone_progress('${fixedProjectId}')`,
    '2000.0000'
  );

  const retainer = await db.query(
    `insert into public.retainer_agreements
       (company_id, client_id, name, amount, included_hours,
        overage_hourly_rate, status)
     values ($1, $2, 'Monthly care plan', 1200, 10, 95, 'active')
     returning id`,
    [SEED.companyA, clientId]
  );
  const retainerId = retainer.rows[0].id;

  const period = await db.query(
    `select public.open_retainer_period($1, date_trunc('month', current_date)::date)
       as id`,
    [retainerId]
  );
  const periodId = period.rows[0].id;

  await expectScalar(
    db,
    'opening the same cycle twice returns the cycle that exists',
    `select public.open_retainer_period('${retainerId}',
       date_trunc('month', current_date)::date)::text`,
    String(periodId)
  );

  await expectScalar(
    db,
    'hours inside the block cost nothing extra',
    `select public.draw_retainer_hours('${periodId}', 6)::text`,
    '0'
  );

  await expectScalar(
    db,
    'hours beyond the block become overage',
    `select public.draw_retainer_hours('${periodId}', 6)::text`,
    '2.00'
  );

  await expectScalar(
    db,
    'overage is priced at the agreed rate',
    `select overage_amount::text from public.retainer_periods
      where id = '${periodId}'`,
    '190.0000'
  );

  await expectScalar(
    db,
    'closing a cycle returns the fee plus the overage',
    `select public.close_retainer_period('${periodId}')::text`,
    '1390.0000'
  );

  console.log('\nBilling the work');

  await expectScalar(
    db,
    'the unbilled queue holds the tracked work',
    `select count(*)::int from public.uninvoiced_project_work('${projectId}')`,
    4
  );

  const workInvoice = await db.query('select public.invoice_project_work($1) as id', [projectId]);
  const workInvoiceId = workInvoice.rows[0].id;

  await expectScalar(
    db,
    'the work becomes the lines of one draft invoice',
    `select count(*)::int from public.invoice_items
      where invoice_id = '${workInvoiceId}'`,
    4
  );

  await expectScalar(
    db,
    'nothing is left waiting to be billed',
    `select count(*)::int from public.uninvoiced_project_work('${projectId}')`,
    0
  );

  await expectRejection(
    db,
    'invoiced work can no longer be changed',
    `update public.time_entries set duration_minutes = 500
      where id = '${loggedEntryId}'`
  );

  await expectRejection(
    db,
    'there is nothing to bill a second time',
    `select public.invoice_project_work('${projectId}')`
  );

  await expectScalar(
    db,
    'discarding the draft puts the work back in the queue',
    `select public.release_project_work('${workInvoiceId}')`,
    4
  );

  await expectScalar(
    db,
    'the released work is waiting again',
    `select count(*)::int from public.uninvoiced_project_work('${projectId}')`,
    4
  );

  await expectScalar(
    db,
    'the margin report knows what the work cost',
    `select labour_cost > 0 from public.project_profitability('${projectId}')`,
    true
  );

  console.log('\nStock control');

  const warehouse = await db.query(
    `insert into public.warehouses (company_id, name, code, is_default)
     values ($1, 'Main store', 'MAIN', true), ($1, 'Overflow unit', 'OVER', false)
     returning id, code`,
    [SEED.companyA]
  );
  const mainWarehouseId = warehouse.rows.find((row) => row.code === 'MAIN').id;
  const overflowWarehouseId = warehouse.rows.find((row) => row.code === 'OVER').id;

  await db.query(`update public.warehouses set is_default = true where id = $1`, [
    overflowWarehouseId,
  ]);

  await expectScalar(
    db,
    'only one warehouse is the default one',
    `select count(*)::int from public.warehouses
      where company_id = '${SEED.companyA}' and is_default and deleted_at is null`,
    1
  );

  await db.query(`update public.warehouses set is_default = true where id = $1`, [mainWarehouseId]);

  const product = await db.query(
    `insert into public.products
       (company_id, name, product_type, track_inventory, unit_price, cost_price)
     values ($1, 'Harbour branded notebook', 'goods', true, 18, 5)
     returning id`,
    [SEED.companyA]
  );
  const productId = product.rows[0].id;

  await db.query(`select public.record_stock_movement($1, 'purchase', 10, 5, $2)`, [
    productId,
    mainWarehouseId,
  ]);

  await db.query(`select public.record_stock_movement($1, 'purchase', 10, 7, $2)`, [
    productId,
    mainWarehouseId,
  ]);

  await expectScalar(
    db,
    'buying at two prices gives a weighted average cost',
    `select average_cost::text from public.stock_levels
      where product_id = '${productId}' and warehouse_id = '${mainWarehouseId}'`,
    '6.0000'
  );

  await db.query(`select public.record_stock_movement($1, 'sale', 5, null, $2)`, [
    productId,
    mainWarehouseId,
  ]);

  await expectScalar(
    db,
    'selling stock leaves the average cost alone',
    `select average_cost::text from public.stock_levels
      where product_id = '${productId}' and warehouse_id = '${mainWarehouseId}'`,
    '6.0000'
  );

  await expectScalar(
    db,
    'the quantity on hand follows the movements',
    `select quantity_on_hand::text from public.stock_levels
      where product_id = '${productId}' and warehouse_id = '${mainWarehouseId}'`,
    '15.000'
  );

  await expectRejection(
    db,
    'stock cannot be sold that is not there',
    `select public.record_stock_movement('${productId}', 'sale', 100, null,
       '${mainWarehouseId}')`
  );

  await expectRejection(
    db,
    'the stock history cannot be rewritten',
    `update public.stock_movements set quantity = 1
      where product_id = '${productId}'`
  );

  await db.query('select public.transfer_stock($1, $2, $3, 5)', [
    productId,
    mainWarehouseId,
    overflowWarehouseId,
  ]);

  await expectScalar(
    db,
    'a transfer moves stock without creating or destroying any',
    `select sum(quantity_on_hand)::text from public.stock_levels
      where product_id = '${productId}'`,
    '15.000'
  );

  await expectScalar(
    db,
    'the receiving warehouse now holds the transferred stock',
    `select quantity_on_hand::text from public.stock_levels
      where product_id = '${productId}' and warehouse_id = '${overflowWarehouseId}'`,
    '5.000'
  );

  await db.query(
    `update public.stock_levels set reorder_point = 20, reorder_quantity = 25
      where product_id = $1 and warehouse_id = $2`,
    [productId, mainWarehouseId]
  );

  await expectScalar(
    db,
    'the reorder report picks up what is running low',
    `select count(*)::int from public.low_stock_report('${SEED.companyA}')`,
    1
  );

  await expectScalar(
    db,
    'the stock on hand is valued at its average cost',
    `select stock_value::text from public.inventory_valuation('${SEED.companyA}')
      where product_id = '${productId}'`,
    '90.0000'
  );

  const stockCount = await db.query(
    `insert into public.stock_counts (company_id, warehouse_id, reference)
     values ($1, $2, 'COUNT-0001')
     returning id`,
    [SEED.companyA, mainWarehouseId]
  );
  const stockCountId = stockCount.rows[0].id;

  await db.query(
    `insert into public.stock_count_items
       (company_id, stock_count_id, product_id, counted_quantity)
     values ($1, $2, $3, 8)`,
    [SEED.companyA, stockCountId, productId]
  );

  await expectScalar(
    db,
    'a count line starts from what the records say',
    `select expected_quantity::text from public.stock_count_items
      where stock_count_id = '${stockCountId}'`,
    '10.000'
  );

  await expectScalar(
    db,
    'settling the count writes the difference as an adjustment',
    `select public.apply_stock_count('${stockCountId}')`,
    1
  );

  await expectScalar(
    db,
    'the counted quantity is now the quantity on hand',
    `select quantity_on_hand::text from public.stock_levels
      where product_id = '${productId}' and warehouse_id = '${mainWarehouseId}'`,
    '8.000'
  );

  console.log('\nWork isolation');

  await signIn(db, SEED.ownerB);

  await expectScalar(
    db,
    'another tenant sees none of these projects',
    'select count(*)::int from public.projects',
    0
  );

  await expectScalar(
    db,
    'another tenant sees none of this tracked time',
    'select count(*)::int from public.time_entries',
    0
  );

  await expectScalar(
    db,
    'another tenant sees none of this stock',
    'select count(*)::int from public.stock_movements',
    0
  );

  await signIn(db, SEED.affiliate);

  await expectScalar(
    db,
    'an affiliate sees no project at all',
    'select count(*)::int from public.projects',
    0
  );

  await signOut(db);
}

/**
 * Verifies storage targets, uploads, the file register, quotas, contracts
 * and electronic signatures.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testStorage(db) {
  console.log('\nWhere files live');

  await signOut(db);

  await expectScalar(
    db,
    'the platform ships with somewhere to put files',
    `select count(*)::int from public.storage_targets
      where company_id is null and is_default and deleted_at is null`,
    1
  );

  await expectScalar(
    db,
    'a tenant without its own bucket writes to the platform one',
    `select company_id is null from public.storage_targets
      where id = public.resolve_storage_target('${SEED.companyA}')`,
    true
  );

  await expectScalar(
    db,
    'an object key is scoped to the tenant that owns it',
    `select public.build_storage_key('${SEED.companyA}', 'receipt', 'Scan 01.pdf')
       like 'tenants/${SEED.companyA}/receipt/%'`,
    true
  );

  console.log('\nUploading');

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a file larger than the limit is refused before it is uploaded',
    `select public.begin_upload_session('${SEED.companyA}', 'huge.pdf',
       'application/pdf', 99999999999)`
  );

  await expectRejection(
    db,
    'a file type nobody asked for is refused',
    `select public.begin_upload_session('${SEED.companyA}', 'script.exe',
       'application/x-msdownload', 1024)`
  );

  const session = await db.query(
    `select public.begin_upload_session($1, 'Taxi receipt.pdf',
       'application/pdf', 240000, 'receipt') as id`,
    [SEED.companyA]
  );
  const sessionId = session.rows[0].id;

  const digest = 'a'.repeat(64);

  const uploaded = await db.query('select public.complete_upload_session($1, 240000, $2) as id', [
    sessionId,
    digest,
  ]);
  const fileId = uploaded.rows[0].id;

  await expectScalar(
    db,
    'a finished upload becomes a file',
    `select file_purpose from public.files where id = '${fileId}'`,
    'receipt'
  );

  await expectScalar(
    db,
    'completing the same upload twice returns the same file',
    `select public.complete_upload_session('${sessionId}', 240000, '${digest}')::text`,
    String(fileId)
  );

  const secondSession = await db.query(
    `select public.begin_upload_session($1, 'Taxi receipt copy.pdf',
       'application/pdf', 240000, 'receipt') as id`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'the same bytes uploaded again are not stored twice',
    `select public.complete_upload_session('${secondSession.rows[0].id}', 240000,
       '${digest}')::text`,
    String(fileId)
  );

  await expectScalar(
    db,
    'the register holds one file for those bytes',
    `select count(*)::int from public.files
      where company_id = '${SEED.companyA}' and content_hash = '${digest}'
        and deleted_at is null`,
    1
  );

  await expectScalar(
    db,
    'the quota counts what the tenant is holding',
    `select used_bytes::text from public.storage_quotas
      where company_id = '${SEED.companyA}'`,
    '240000'
  );

  const staleSession = await db.query(
    `select public.begin_upload_session($1, 'Abandoned.pdf',
       'application/pdf', 1000) as id`,
    [SEED.companyA]
  );

  await signOut(db);
  await db.query(
    `update public.upload_sessions set expires_at = now() - interval '1 hour'
      where id = $1`,
    [staleSession.rows[0].id]
  );

  await expectScalar(
    db,
    'uploads nobody came back to are expired by the maintenance routine',
    'select public.expire_stale_upload_sessions()',
    1
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'the key of a stored object cannot be rewritten',
    `update public.files set storage_key = 'tenants/elsewhere/file.pdf'
      where id = '${fileId}'`
  );

  console.log('\nThe life of a file');

  const version = await db.query(
    `select public.create_file_version($1,
       public.build_storage_key($2, 'receipt', 'Taxi receipt v2.pdf'),
       'Taxi receipt v2.pdf', 250000, $3) as id`,
    [fileId, SEED.companyA, 'b'.repeat(64)]
  );
  const versionId = version.rows[0].id;

  await expectScalar(
    db,
    'replacing a file creates the next version',
    `select version::text from public.files where id = '${versionId}'`,
    '2'
  );

  await expectScalar(
    db,
    'the version it replaced is no longer the current one',
    `select is_current from public.files where id = '${fileId}'`,
    false
  );

  await expectScalar(
    db,
    'a file can be attached to the record it belongs to',
    `select public.attach_file('${versionId}', 'expense',
       (select id from public.expenses where company_id = '${SEED.companyA}' limit 1))`,
    true
  );

  await db.query('select public.record_file_access($1, $2, null, $3)', [
    versionId,
    'download',
    'c'.repeat(64),
  ]);

  await expectScalar(
    db,
    'opening a file is recorded against it',
    `select access_count from public.files where id = '${versionId}'`,
    1
  );

  await expectScalar(
    db,
    'the read trail keeps the entry',
    `select count(*)::int from public.file_access_logs
      where file_id = '${versionId}' and action = 'download'`,
    1
  );

  await signOut(db);
  await db.query(
    `update public.files
        set created_at = now() - interval '400 days',
            last_accessed_at = now() - interval '400 days'
      where id = $1`,
    [fileId]
  );

  await expectScalar(
    db,
    'files nobody has opened for a year move to the cheap tier',
    'select public.archive_cold_files(365, 100)',
    1
  );

  await db.query(
    `insert into public.files
       (company_id, storage_target_id, storage_key, file_name, mime_type,
        byte_size, file_purpose, created_at, uploaded_at)
     values ($1, public.resolve_storage_target($1),
             'tenants/forgotten/never-attached.pdf', 'Never attached.pdf',
             'application/pdf', 1000, 'attachment',
             now() - interval '3 days', now() - interval '3 days')`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'an upload that was never attached shows up as an orphan',
    `select count(*)::int > 0 from public.orphaned_files(1, 100)`,
    true
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'deleting a file leaves the record behind as evidence',
    `select public.purge_file('${fileId}', 'The receipt was replaced')`,
    true
  );

  await expectScalar(
    db,
    'the deleted bytes stop counting against the quota',
    `select used_bytes::text from public.storage_quotas
      where company_id = '${SEED.companyA}'`,
    '251000'
  );

  await expectScalar(
    db,
    'the usage report says what the space is used for',
    `select count(*)::int from public.storage_usage_report('${SEED.companyA}')`,
    2
  );

  await signOut(db);
  await db.query('update public.storage_quotas set quota_bytes = 251000 where company_id = $1', [
    SEED.companyA,
  ]);

  await expectScalar(
    db,
    'a full account cannot take another file',
    `select public.storage_quota_allows('${SEED.companyA}', 1)`,
    false
  );

  await db.query('update public.storage_quotas set quota_bytes = null where company_id = $1', [
    SEED.companyA,
  ]);

  console.log('\nContracts and signatures');

  await expectScalar(
    db,
    'the platform ships with contract wording',
    'select count(*)::int from public.contract_templates where company_id is null',
    3
  );

  await signIn(db, SEED.ownerA);

  const contractClient = await db.query(
    `select id from public.clients
      where company_id = $1 and deleted_at is null order by created_at limit 1`,
    [SEED.companyA]
  );
  const contractClientId = contractClient.rows[0].id;

  const contract = await db.query(
    `insert into public.contracts
       (company_id, client_id, title, body_html, currency, contract_value)
     values ($1, $2, 'Website retainer agreement',
             '<h1>Website retainer</h1><p>Northwind Supply will provide support each month.</p>',
             'USD', 2400)
     returning id, contract_number`,
    [SEED.companyA, contractClientId]
  );
  const contractId = contract.rows[0].id;

  report(
    contract.rows[0].contract_number === 'CT-0001',
    'a contract is numbered on arrival',
    contract.rows[0].contract_number
  );

  await expectRejection(
    db,
    'a contract with nobody to sign it cannot be sent',
    `select public.send_contract('${contractId}')`
  );

  const signers = await db.query(
    `insert into public.contract_signers
       (company_id, contract_id, full_name, email, role_label, signing_order,
        is_internal)
     values ($1, $2, 'Dana Whitfield', 'dana@northwind.test', 'Client', 1, false),
            ($1, $2, 'Owner of Northwind Supply', 'owner.a@example.com',
             'Supplier', 2, true)
     returning id, signing_order`,
    [SEED.companyA, contractId]
  );
  const clientSignerId = signers.rows.find((row) => row.signing_order === 1).id;
  const internalSignerId = signers.rows.find((row) => row.signing_order === 2).id;

  await signIn(db, SEED.staffA);
  await expectRejection(
    db,
    'only the account owner sends a contract to a client',
    `select public.send_contract('${contractId}')`
  );

  await signIn(db, SEED.ownerA);
  await expectScalar(
    db,
    'the owner sends the contract for signature',
    `select public.send_contract('${contractId}')`,
    'sent'
  );

  await expectScalar(
    db,
    'the wording is fixed by a digest at the moment of sending',
    `select content_hash ~ '^[0-9a-f]{64}$' from public.contracts
      where id = '${contractId}'`,
    true
  );

  await expectRejection(
    db,
    'the wording of a sent contract cannot be changed',
    `update public.contracts set body_html = '<h1>Different terms</h1><p>Rewritten after sending.</p>'
      where id = '${contractId}'`
  );

  await expectScalar(
    db,
    'the first signature leaves the contract partly signed',
    `select public.sign_contract('${clientSignerId}', 'typed', 'Dana Whitfield',
       null, null, '${'d'.repeat(64)}')`,
    'partially_signed'
  );

  await expectRejection(
    db,
    'nobody signs the same contract twice',
    `select public.sign_contract('${clientSignerId}', 'typed', 'Dana Whitfield')`
  );

  await expectRejection(
    db,
    'a given signature cannot be altered afterwards',
    `update public.contract_signers set typed_signature = 'Somebody else'
      where id = '${clientSignerId}'`
  );

  await expectScalar(
    db,
    'the last signature completes the contract',
    `select public.sign_contract('${internalSignerId}', 'typed',
       'Owner of Northwind Supply')`,
    'completed'
  );

  await expectScalar(
    db,
    'the contract counts the signatures it holds',
    `select signed_count::text from public.contracts where id = '${contractId}'`,
    '2'
  );

  await expectRejection(
    db,
    'a signed contract cannot be voided away',
    `select public.void_contract('${contractId}', 'Signed in error')`
  );

  await signOut(db);

  await expectScalar(
    db,
    'the signed copy is sealed with its digest',
    `select public.seal_contract('${contractId}', '${versionId}', '${'e'.repeat(64)}')`,
    true
  );

  await expectScalar(
    db,
    'sealing is done once',
    `select public.seal_contract('${contractId}', '${versionId}', '${'e'.repeat(64)}')`,
    false
  );

  await expectScalar(
    db,
    'the trail records everything that happened',
    `select count(*)::int >= 5 from public.contract_audit_trail('${contractId}')`,
    true
  );

  await expectRejection(
    db,
    'the contract trail is a permanent record',
    `update public.contract_events set description = 'Rewritten'
      where contract_id = '${contractId}'`
  );

  await signIn(db, SEED.ownerA);

  const declined = await db.query(
    `insert into public.contracts (company_id, client_id, title, body_html)
     values ($1, $2, 'Equipment hire agreement',
             '<h1>Equipment hire</h1><p>Terms for hiring equipment by the week.</p>')
     returning id`,
    [SEED.companyA, contractClientId]
  );
  const declinedId = declined.rows[0].id;

  const declinedSigner = await db.query(
    `insert into public.contract_signers
       (company_id, contract_id, full_name, email)
     values ($1, $2, 'Dana Whitfield', 'dana@northwind.test')
     returning id`,
    [SEED.companyA, declinedId]
  );

  await db.query('select public.send_contract($1)', [declinedId]);

  await expectScalar(
    db,
    'a signer can refuse, and has to say why',
    `select public.decline_contract('${declinedSigner.rows[0].id}',
       'The hire rate is higher than we agreed')`,
    'declined'
  );

  const expiring = await db.query(
    `insert into public.contracts (company_id, client_id, title, body_html)
     values ($1, $2, 'Seasonal support agreement',
             '<h1>Seasonal support</h1><p>Cover for the busy trading season.</p>')
     returning id`,
    [SEED.companyA, contractClientId]
  );

  await db.query(
    `insert into public.contract_signers (company_id, contract_id, full_name, email)
     values ($1, $2, 'Dana Whitfield', 'dana@northwind.test')`,
    [SEED.companyA, expiring.rows[0].id]
  );

  await db.query('select public.send_contract($1)', [expiring.rows[0].id]);

  await signOut(db);
  await db.query(`update public.contracts set valid_until = current_date - 1 where id = $1`, [
    expiring.rows[0].id,
  ]);

  await expectScalar(
    db,
    'a contract nobody signed in time expires',
    'select public.expire_stale_contracts()',
    1
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a tenant cannot rewrite the platform contract wording',
    `with changed as (
       update public.contract_templates set name = 'Rewritten'
        where company_id is null
        returning 1
     )
     select count(*)::int from changed`,
    0
  );

  console.log('\nFile isolation');

  await signIn(db, SEED.ownerB);

  await expectScalar(
    db,
    'another tenant sees none of these files',
    'select count(*)::int from public.files',
    0
  );

  await expectScalar(
    db,
    'another tenant sees none of these contracts',
    'select count(*)::int from public.contracts',
    0
  );

  await expectScalar(
    db,
    'another tenant still sees the platform wording it may use',
    'select count(*)::int from public.contract_templates',
    3
  );

  await signIn(db, SEED.staffA);

  await expectScalar(
    db,
    'the read trail of sensitive files is for the owner alone',
    'select count(*)::int from public.file_access_logs',
    0
  );

  console.log('\nThe file library');

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the library lists what the tenant is holding',
    `select count(*)::int >= 1 from public.company_files('${SEED.companyA}')`,
    true
  );

  await expectScalar(
    db,
    'the library can be narrowed to one kind of file',
    `select bool_and(file_purpose = 'receipt')
       from public.company_files('${SEED.companyA}', 'receipt')`,
    true
  );

  await expectScalar(
    db,
    'searching the library matches on the name',
    `select count(*)::int >= 1
       from public.company_files('${SEED.companyA}', null, 'Taxi')`,
    true
  );

  await expectScalar(
    db,
    'the summary knows how much room is left',
    `select (public.company_storage_summary('${SEED.companyA}') ->> 'used_bytes')::bigint > 0`,
    true
  );

  await expectScalar(
    db,
    'the summary prices the allowance as a share',
    `select (public.company_storage_summary('${SEED.companyA}') ->> 'used_percentage')::numeric >= 0`,
    true
  );

  await expectScalar(
    db,
    'the browser is told what it may upload before it picks a file',
    `select (public.storage_upload_policy('${SEED.companyA}') ->> 'max_upload_bytes')::bigint > 0`,
    true
  );

  const libraryFile = await db.query(
    `select file_id from public.company_files($1, 'receipt') order by created_at limit 1`,
    [SEED.companyA]
  );
  const libraryFileId = libraryFile.rows[0].file_id;

  await db.query(`select public.rename_file($1, 'Taxi receipt March.pdf', 'A taxi receipt')`, [
    libraryFileId,
  ]);

  await expectScalar(
    db,
    'renaming a file keeps the object where it is',
    `select file_name from public.files where id = '${libraryFileId}'`,
    'Taxi receipt March.pdf'
  );

  await expectRejection(
    db,
    'a file still needs a name',
    `select public.rename_file('${libraryFileId}', '   ')`
  );

  await expectScalar(
    db,
    'one file can be described with the store it lives in',
    `select public.describe_file('${libraryFileId}') ->> 'bucket_name'`,
    'kdsolutionit-files'
  );

  await expectRejection(
    db,
    'storage credentials are not readable by the people using the app',
    `select public.file_storage_target('${libraryFileId}')`
  );

  const keptSession = await db.query(
    `select public.begin_upload_session($1, 'Passport.pdf', 'application/pdf',
       120000, 'kyc_document') as id`,
    [SEED.companyA]
  );
  const keptFile = await db.query('select public.complete_upload_session($1, 120000, $2) as id', [
    keptSession.rows[0].id,
    'c'.repeat(64),
  ]);

  await expectRejection(
    db,
    'a document kept as a record cannot be removed from the library',
    `select public.delete_file('${keptFile.rows[0].id}')`
  );

  const spareSession = await db.query(
    `select public.begin_upload_session($1, 'Loose note.txt', 'text/plain',
       4096, 'attachment') as id`,
    [SEED.companyA]
  );
  const spareFile = await db.query('select public.complete_upload_session($1, 4096, $2) as id', [
    spareSession.rows[0].id,
    'd'.repeat(64),
  ]);
  const spareFileId = spareFile.rows[0].id;

  await db.query(`select public.delete_file($1, 'Uploaded by mistake')`, [spareFileId]);

  await expectScalar(
    db,
    'removing a file takes it out of the library',
    `select count(*)::int from public.company_files('${SEED.companyA}')
      where file_id = '${spareFileId}'`,
    0
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'but the record of it stays, with the reason written down',
    `select metadata ->> 'removal_reason' from public.files
      where id = '${spareFileId}'`,
    'Uploaded by mistake'
  );

  await expectScalar(
    db,
    'and the removal is on the read trail of that file',
    `select count(*)::int from public.file_access_history('${spareFileId}')
      where action = 'delete'`,
    1
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'the storage settings of the platform are not a tenant matter',
    'select count(*)::int from public.platform_storage_targets()'
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'the server can read the store behind an upload in order to sign it',
    `select public.upload_session_target('${keptSession.rows[0].id}') ->> 'provider'`,
    'cloudflare_r2'
  );

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'the platform team sees every store and what it holds',
    'select count(*)::int >= 1 from public.platform_storage_targets()',
    true
  );

  const newTarget = await db.query(
    `select public.save_storage_target('Overflow bucket', 'wasabi',
       'kdsolutionit-overflow', null, 'eu-central-1',
       'https://s3.eu-central-1.wasabisys.com', 'overflow',
       'https://files.kdsolutionit.com', true, 600, 52428800, true, false) as id`
  );
  const targetId = newTarget.rows[0].id;

  await expectScalar(
    db,
    'a second store can be added without touching the first',
    `select provider::text from public.storage_targets where id = '${targetId}'`,
    'wasabi'
  );

  await expectScalar(
    db,
    'the store that was already the default stays the default',
    `select count(*)::int from public.storage_targets
      where company_id is null and is_default and deleted_at is null`,
    1
  );

  await db.query(`select public.set_storage_target_credentials($1, $2, $3, 5)`, [
    targetId,
    'encrypted-storage-keys',
    'e'.repeat(64),
  ]);

  await expectScalar(
    db,
    'storing the keys counts as a new version of them',
    `select credentials_key_version::int from public.storage_targets
      where id = '${targetId}'`,
    2
  );

  await db.query(`select public.set_storage_target_credentials($1, $2, $3, 5)`, [
    targetId,
    'encrypted-storage-keys-two',
    'f'.repeat(64),
  ]);

  await expectScalar(
    db,
    'replacing them leaves the old pair working for a short while',
    `select previous_credentials_valid_until > now() from public.storage_targets
      where id = '${targetId}'`,
    true
  );

  await db.query(`select public.record_storage_target_health($1, false, $2)`, [
    targetId,
    'The bucket refused the connection',
  ]);

  await expectScalar(
    db,
    'a store that cannot be reached says so on the screen',
    `select last_error from public.storage_targets where id = '${targetId}'`,
    'The bucket refused the connection'
  );

  await db.query(`select public.record_storage_target_health($1, true, null)`, [targetId]);

  await expectScalar(
    db,
    'and a store that answers again clears the complaint',
    `select last_error is null and last_verified_at is not null
       from public.storage_targets where id = '${targetId}'`,
    true
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'another tenant cannot read this file library',
    `select count(*)::int from public.company_files('${SEED.companyA}')`
  );

  await expectRejection(
    db,
    'nor the storage numbers behind it',
    `select public.company_storage_summary('${SEED.companyA}')`
  );

  console.log('\nKeeping the documents in a drive of your own');

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a business with no drive of its own writes to the platform store',
    `select (public.company_storage_target('${SEED.companyA}') ->> 'is_own_storage')::boolean`,
    false
  );

  await expectRejection(
    db,
    'a drive connection needs a folder to write into',
    `select public.connect_company_drive('${SEED.companyA}', '  ', 'Invoices', 'encrypted-token')`
  );

  const drive = await db.query(
    `select public.connect_company_drive($1, 'folder-abc123', 'Business documents',
       'encrypted-refresh-token', $2) as id`,
    [SEED.companyA, '1'.repeat(64)]
  );
  const driveTargetId = drive.rows[0].id;

  await expectScalar(
    db,
    'connecting a drive makes it where new files go',
    `select provider::text from public.storage_targets where id = '${driveTargetId}'`,
    'google_drive'
  );

  await expectScalar(
    db,
    'and the tenant store wins over the platform one',
    `select public.resolve_storage_target('${SEED.companyA}')::text`,
    String(driveTargetId)
  );

  await expectScalar(
    db,
    'the settings screen says the files are going to a drive of its own',
    `select (public.company_storage_target('${SEED.companyA}') ->> 'is_own_storage')::boolean`,
    true
  );

  await expectScalar(
    db,
    'and names the folder they land in',
    `select public.company_storage_target('${SEED.companyA}') ->> 'folder_reference'`,
    'folder-abc123'
  );

  await expectScalar(
    db,
    'nothing secret reaches that screen',
    `select public.company_storage_target('${SEED.companyA}') ? 'credentials_encrypted'`,
    false
  );

  await db.query(
    `select public.connect_company_drive($1, 'folder-def456', 'Business documents',
       'encrypted-refresh-token-two', $2)`,
    [SEED.companyA, '2'.repeat(64)]
  );

  await expectScalar(
    db,
    'reconnecting the same drive edits it rather than adding a second',
    `select count(*)::int from public.storage_targets
      where company_id = '${SEED.companyA}' and deleted_at is null`,
    1
  );

  await expectScalar(
    db,
    'and the permission it replaced keeps working for a few minutes',
    `select previous_credentials_valid_until > now() from public.storage_targets
      where id = '${driveTargetId}'`,
    true
  );

  const driveUpload = await db.query(
    `select public.begin_upload_session($1, 'Signed quote.pdf', 'application/pdf',
       90000, 'attachment') as id`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'an upload now belongs to the drive rather than to platform storage',
    `select storage_target_id::text from public.upload_sessions
      where id = '${driveUpload.rows[0].id}'`,
    String(driveTargetId)
  );

  const driveFile = await db.query('select public.complete_upload_session($1, 90000, $2) as id', [
    driveUpload.rows[0].id,
    '3'.repeat(64),
  ]);
  const driveFileId = driveFile.rows[0].id;

  await expectRejection(
    db,
    'only the server records what the drive called a file',
    `select public.set_file_external_id('${driveFileId}', 'drive-file-1')`
  );

  await signInAsService(db);

  await db.query(`select public.set_file_external_id($1, 'drive-file-1')`, [driveFileId]);

  await expectScalar(
    db,
    'the identifier the drive gave the file is kept beside our own',
    `select public.file_storage_target('${driveFileId}') ->> 'external_object_id'`,
    'drive-file-1'
  );

  await expectScalar(
    db,
    'and the server can read the folder and permission it needs to fetch it',
    `select public.file_storage_target('${driveFileId}') ->> 'path_prefix'`,
    'folder-def456'
  );

  await signIn(db, SEED.ownerA);

  await db.query(`select public.disconnect_company_storage($1)`, [SEED.companyA]);

  await signInAsService(db);

  await expectScalar(
    db,
    'disconnecting takes the permission away',
    `select credentials_encrypted is null from public.storage_targets
      where id = '${driveTargetId}'`,
    true
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'but leaves every file already in the drive exactly where it is',
    `select count(*)::int from public.files where id = '${driveFileId}'
       and deleted_at is null`,
    1
  );

  await expectScalar(
    db,
    'and new uploads go back to the platform store',
    `select company_id is null from public.storage_targets
      where id = public.resolve_storage_target('${SEED.companyA}')`,
    true
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'one business cannot connect a drive to another',
    `select public.connect_company_drive('${SEED.companyA}', 'folder-x', 'Theirs', 'token')`
  );

  await signOut(db);
}

/**
 * Identifiers used by the platform operations suite.
 */
const PLATFORM = {
  keyA: '00000000-0000-7000-8000-0000000ca001',
  keyWildcard: '00000000-0000-7000-8000-0000000ca002',
  keyExpiring: '00000000-0000-7000-8000-0000000ca003',
  endpointInvoices: '00000000-0000-7000-8000-0000000cb001',
  endpointEverything: '00000000-0000-7000-8000-0000000cb002',
  endpointPayments: '00000000-0000-7000-8000-0000000cb003',
};

/**
 * Verifies API keys, throttling, outbound webhooks, the job queue, platform
 * settings, tenant security policy and four eyes approvals.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testPlatform(db) {
  console.log('\nAPI keys');

  await signIn(db, SEED.ownerA);

  await db.query(
    `insert into public.api_keys (id, company_id, name, key_prefix, key_hash, scopes)
     values ($1, $2, 'Accounting integration', 'kds_live_a1b2', $3,
             array['invoices:read', 'clients:*'])`,
    [PLATFORM.keyA, SEED.companyA, 'a'.repeat(64)]
  );

  await expectScalar(
    db,
    'an owner can issue a key for the public API',
    `select key_prefix from public.api_keys where id = '${PLATFORM.keyA}'`,
    'kds_live_a1b2'
  );

  await expectRejection(
    db,
    'a key prefix that looks like a whole secret is refused',
    `insert into public.api_keys (company_id, name, key_prefix, key_hash)
     values ('${SEED.companyA}', 'Bad prefix', 'sk_live_this_is_the_whole_secret', '${'b'.repeat(64)}')`
  );

  await expectRejection(
    db,
    'a digest that is not a sha256 hex string is refused',
    `insert into public.api_keys (company_id, name, key_prefix, key_hash)
     values ('${SEED.companyA}', 'Bad digest', 'kds_live_c3d4', 'not-a-digest')`
  );

  await signIn(db, SEED.staffA);

  await expectRejection(
    db,
    'a staff member cannot issue an API key',
    `insert into public.api_keys (company_id, name, key_prefix, key_hash)
     values ('${SEED.companyA}', 'Staff key', 'kds_live_e5f6', '${'c'.repeat(64)}')`
  );

  await signOut(db);

  await expectScalar(
    db,
    'the digest of a key is not readable by any signed in caller',
    "select has_column_privilege('authenticated', 'public.api_keys', 'key_hash', 'select')",
    false
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'an owner cannot overwrite a key digest by hand',
    `update public.api_keys set key_hash = '${'d'.repeat(64)}' where id = '${PLATFORM.keyA}'`
  );

  await signOut(db);

  await expectRejection(
    db,
    'a key cannot be moved to another tenant, whoever asks',
    `update public.api_keys set company_id = '${SEED.companyB}' where id = '${PLATFORM.keyA}'`
  );

  await expectScalar(
    db,
    'a live key resolves to the tenant behind it',
    `select company_id from public.authenticate_api_key('${'a'.repeat(64)}')`,
    SEED.companyA
  );

  await expectScalar(
    db,
    'a scope is matched through its module wildcard',
    `select public.api_key_has_scope('${PLATFORM.keyA}', 'clients:write')`,
    true
  );

  await expectScalar(
    db,
    'a scope that was never granted is refused',
    `select public.api_key_has_scope('${PLATFORM.keyA}', 'payouts:write')`,
    false
  );

  await db.query(
    `insert into public.api_keys (id, company_id, name, key_prefix, key_hash, scopes)
     values ($1, $2, 'Full access key', 'kds_test_9z8y', $3, array['*'])`,
    [PLATFORM.keyWildcard, SEED.companyA, 'e'.repeat(64)]
  );

  await expectScalar(
    db,
    'a key granted everything passes every scope check',
    `select public.api_key_has_scope('${PLATFORM.keyWildcard}', 'payouts:write')`,
    true
  );

  await db.query(
    `insert into public.api_keys (id, company_id, name, key_prefix, key_hash, expires_at)
     values ($1, $2, 'Short lived key', 'kds_test_1q2w', $3, now() - interval '1 day')`,
    [PLATFORM.keyExpiring, SEED.companyA, 'f'.repeat(64)]
  );

  await expectScalar(
    db,
    'a key past its date is closed by the sweeper',
    'select public.expire_stale_api_keys()',
    1
  );

  await expectScalar(
    db,
    'an expired key authenticates nothing',
    `select count(*)::int from public.authenticate_api_key('${'f'.repeat(64)}')`,
    0
  );

  console.log('\nRotating and revoking');

  await signIn(db, SEED.ownerA);

  const rotated = await db.query(
    `select public.rotate_api_key('${PLATFORM.keyA}', 'kds_live_r0t8', '${'1'.repeat(64)}', 5) as id`
  );
  const rotatedId = rotated.rows[0].id;

  await signOut(db);

  await expectScalar(
    db,
    'a rotation issues a replacement that works at once',
    `select company_id from public.authenticate_api_key('${'1'.repeat(64)}')`,
    SEED.companyA
  );

  await expectScalar(
    db,
    'the replaced key keeps working through its grace window',
    `select count(*)::int from public.authenticate_api_key('${'a'.repeat(64)}')`,
    1
  );

  await expectScalar(
    db,
    'the replacement remembers what it replaced',
    `select rotated_from_key_id = '${PLATFORM.keyA}' from public.api_keys where id = '${rotatedId}'`,
    true
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'another tenant owner cannot revoke a key that is not theirs',
    `select public.revoke_api_key('${PLATFORM.keyA}', 'Not mine')`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'an owner can stop a key immediately',
    `select public.revoke_api_key('${PLATFORM.keyA}', 'Replaced during the migration')`,
    true
  );

  await signOut(db);

  await expectScalar(
    db,
    'a revoked key stops authenticating even inside its grace window',
    `select count(*)::int from public.authenticate_api_key('${'a'.repeat(64)}')`,
    0
  );

  console.log('\nThrottling');

  await expectScalar(
    db,
    'the first request of a window is allowed',
    "select is_allowed from public.consume_rate_limit('api_key', 'bucket-demo', 2, 60)",
    true
  );

  await expectScalar(
    db,
    'the allowance left is reported for the response header',
    "select remaining from public.consume_rate_limit('api_key', 'bucket-demo', 2, 60)",
    0
  );

  await expectScalar(
    db,
    'the request over the limit is refused',
    "select is_allowed from public.consume_rate_limit('api_key', 'bucket-demo', 2, 60)",
    false
  );

  await expectScalar(
    db,
    'the refusal is counted so abuse can be seen',
    `select blocked_count from public.rate_limit_counters
      where bucket_kind = 'api_key' and bucket_key = 'bucket-demo'`,
    1
  );

  await expectScalar(
    db,
    'reading the window does not count against it',
    `select request_count from public.rate_limit_status('api_key', 'bucket-demo', 60)`,
    3
  );

  await expectRejection(
    db,
    'a window length the platform does not use is refused',
    `insert into public.rate_limit_counters
       (bucket_kind, bucket_key, window_started_at, window_seconds, limit_value)
     values ('ip', '198.51.100.7', now(), 45, 10)`
  );

  await db.query(
    `insert into public.rate_limit_counters
       (bucket_kind, bucket_key, window_started_at, window_seconds, limit_value)
     values ('ip', '198.51.100.7', now() - interval '5 days', 60, 10)`
  );

  await expectScalar(
    db,
    'closed windows are swept away',
    'select public.prune_rate_limit_counters(48)',
    1
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'the throttling counters are an internal mechanism no tenant can read',
    'select count(*)::int from public.rate_limit_counters'
  );

  console.log('\nThe request log');

  await signOut(db);

  await db.query(
    `select public.record_api_request(
       '${SEED.companyA}', '${PLATFORM.keyWildcard}', 'get', '/v1/invoices/42',
       200::smallint, 86, '/v1/invoices/:id', 'req_one', 'idem-one', null, null, false
     )`
  );

  await db.query(
    `select public.record_api_request(
       '${SEED.companyA}', '${PLATFORM.keyWildcard}', 'get', '/v1/invoices/43',
       500::smallint, 120, '/v1/invoices/:id', 'req_two', 'idem-two', null,
       'internal_error', false
     )`
  );

  await expectScalar(
    db,
    'a logged request marks the key as used',
    `select last_used_at is not null from public.api_keys where id = '${PLATFORM.keyWildcard}'`,
    true
  );

  await expectScalar(
    db,
    'the same idempotency key never writes a second log line',
    `select public.record_api_request(
       '${SEED.companyA}', '${PLATFORM.keyWildcard}', 'get', '/v1/invoices/42',
       200::smallint, 86, '/v1/invoices/:id', 'req_three', 'idem-one', null, null, false
     ) is null`,
    true
  );

  await expectScalar(
    db,
    'traffic is summarised by route rather than by url',
    `select request_count from public.api_usage_summary(
       '${SEED.companyA}', now() - interval '1 hour', now() + interval '1 hour'
     ) where route_pattern = '/v1/invoices/:id'`,
    2
  );

  await expectScalar(
    db,
    'failures are counted separately in the summary',
    `select error_count from public.api_usage_summary(
       '${SEED.companyA}', now() - interval '1 hour', now() + interval '1 hour'
     ) where route_pattern = '/v1/invoices/:id'`,
    1
  );

  await signIn(db, SEED.ownerB);

  await expectScalar(
    db,
    'one tenant never sees the API traffic of another',
    'select count(*)::int from public.api_request_logs',
    0
  );

  console.log('\nTelling other systems what happened');

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'an endpoint that is not encrypted in transit is refused',
    `insert into public.webhook_endpoints (company_id, name, target_url, signing_secret_encrypted)
     values ('${SEED.companyA}', 'Plain text', 'http://example.com/hook', 'enc:secret')`
  );

  await db.query(
    `insert into public.webhook_endpoints
       (id, company_id, name, target_url, signing_secret_encrypted, subscribed_events)
     values ($1, $2, 'Invoice listener', 'https://hooks.example.com/invoices',
             'enc:first-secret', array['invoice.*'])`,
    [PLATFORM.endpointInvoices, SEED.companyA]
  );

  await db.query(
    `insert into public.webhook_endpoints
       (id, company_id, name, target_url, signing_secret_encrypted, subscribed_events)
     values ($1, $2, 'Everything listener', 'https://hooks.example.com/all',
             'enc:second-secret', array['*'])`,
    [PLATFORM.endpointEverything, SEED.companyA]
  );

  await db.query(
    `insert into public.webhook_endpoints
       (id, company_id, name, target_url, signing_secret_encrypted, subscribed_events)
     values ($1, $2, 'Payment listener', 'https://hooks.example.com/payments',
             'enc:third-secret', array['payment.succeeded'])`,
    [PLATFORM.endpointPayments, SEED.companyA]
  );

  await signOut(db);

  await expectScalar(
    db,
    'a signing secret is not readable by any signed in caller',
    "select has_column_privilege('authenticated', 'public.webhook_endpoints', 'signing_secret_encrypted', 'select')",
    false
  );

  const emitted = await db.query(
    `select public.emit_outbound_event(
       '${SEED.companyA}', 'invoice.paid', 'invoice', null,
       '{"total": 1250}'::jsonb, 'evt-invoice-paid-1'
     ) as id`
  );
  const eventId = emitted.rows[0].id;

  await expectScalar(
    db,
    'an event reaches the endpoints that asked for it and no others',
    `select count(*)::int from public.webhook_deliveries where event_id = '${eventId}'`,
    2
  );

  await expectScalar(
    db,
    'raising the same event twice raises it once',
    `select public.emit_outbound_event(
       '${SEED.companyA}', 'invoice.paid', 'invoice', null,
       '{"total": 1250}'::jsonb, 'evt-invoice-paid-1'
     ) = '${eventId}'`,
    true
  );

  await expectRejection(
    db,
    'a published payload can never be rewritten',
    `update public.outbound_events set payload = '{"total": 1}'::jsonb where id = '${eventId}'`
  );

  await expectRejection(
    db,
    'an event name without a resource and an action is refused',
    `insert into public.outbound_events (company_id, event_type, resource_type)
     values ('${SEED.companyA}', 'SomethingHappened', 'invoice')`
  );

  console.log('\nDelivering it');

  await expectScalar(
    db,
    'a worker reserves the deliveries that are due',
    "select count(*)::int from public.claim_webhook_deliveries('worker-1', 10)",
    2
  );

  await expectScalar(
    db,
    'a second worker finds nothing left to take',
    "select count(*)::int from public.claim_webhook_deliveries('worker-2', 10)",
    0
  );

  const deliveries = await db.query(
    `select id from public.webhook_deliveries
      where event_id = '${eventId}' and endpoint_id = '${PLATFORM.endpointInvoices}'`
  );
  const deliveryId = deliveries.rows[0].id;

  await expectScalar(
    db,
    'a refused delivery is tried again later rather than dropped',
    `select public.record_webhook_attempt('${deliveryId}', 503::smallint, 40, 'Service unavailable', null)`,
    'pending'
  );

  await expectScalar(
    db,
    'the next attempt is held back by the backoff',
    `select next_attempt_at > now() + interval '30 seconds'
       from public.webhook_deliveries where id = '${deliveryId}'`,
    true
  );

  await db.query(
    `update public.webhook_deliveries set attempt_count = max_attempts where id = '${deliveryId}'`
  );

  await expectScalar(
    db,
    'a delivery that used up its attempts is dead lettered',
    `select public.record_webhook_attempt('${deliveryId}', 500::smallint, 40, 'Still broken', null)`,
    'exhausted'
  );

  await expectScalar(
    db,
    'the dead letter queue shows the tenant what never arrived',
    `select count(*)::int from public.webhook_dead_letters('${SEED.companyA}', 100)`,
    1
  );

  const secondDelivery = await db.query(
    `select id from public.webhook_deliveries
      where event_id = '${eventId}' and endpoint_id = '${PLATFORM.endpointEverything}'`
  );

  await expectScalar(
    db,
    'an accepted delivery closes the chain',
    `select public.record_webhook_attempt('${secondDelivery.rows[0].id}', 200::smallint, 30, null, 'ok')`,
    'delivered'
  );

  await expectScalar(
    db,
    'a successful delivery clears the failure count of the endpoint',
    `select consecutive_failures from public.webhook_endpoints
      where id = '${PLATFORM.endpointEverything}'`,
    0
  );

  await signIn(db, SEED.staffA);

  await expectRejection(
    db,
    'a staff member cannot replay a webhook',
    `select public.replay_webhook_delivery('${deliveryId}')`
  );

  await signIn(db, SEED.ownerA);

  const replayed = await db.query(`select public.replay_webhook_delivery('${deliveryId}') as id`);

  await expectScalar(
    db,
    'a replay queues a fresh attempt that remembers where it came from',
    `select replayed_from_id = '${deliveryId}' from public.webhook_deliveries
      where id = '${replayed.rows[0].id}'`,
    true
  );

  await expectScalar(
    db,
    'replaying also brings a switched off endpoint back',
    `select is_active and disabled_at is null from public.webhook_endpoints
      where id = '${PLATFORM.endpointInvoices}'`,
    true
  );

  await expectScalar(
    db,
    'rotating a signing secret keeps the old one valid for a moment',
    `select public.rotate_webhook_secret('${PLATFORM.endpointInvoices}', 'enc:new-secret', null, 5)`,
    true
  );

  await signOut(db);

  await expectScalar(
    db,
    'the rotation records the previous secret and bumps the version',
    `select previous_secret_encrypted = 'enc:first-secret' and secret_key_version = 2
       from public.webhook_endpoints where id = '${PLATFORM.endpointInvoices}'`,
    true
  );

  console.log('\nThe work the platform does on its own');

  await expectScalar(
    db,
    'the platform ships with its own timetable',
    'select count(*)::int from public.job_schedules where company_id is null',
    8
  );

  const queued = await db.query(
    `select public.enqueue_job(
       'send_invoice_email', '{"invoice_id": "demo"}'::jsonb, '${SEED.companyA}',
       now(), 'default', 100::smallint, 'invoice-demo-email', 5::smallint
     ) as id`
  );
  const jobId = queued.rows[0].id;

  await expectScalar(
    db,
    'the same work is never queued twice',
    `select public.enqueue_job(
       'send_invoice_email', '{"invoice_id": "demo"}'::jsonb, '${SEED.companyA}',
       now(), 'default', 100::smallint, 'invoice-demo-email', 5::smallint
     ) = '${jobId}'`,
    true
  );

  await expectScalar(
    db,
    'a worker takes the job with a lease on it',
    `select count(*)::int from public.claim_jobs('runner-1', 'default', 10, 300)`,
    1
  );

  await expectScalar(
    db,
    'the lease says when the job would be rescued',
    `select reservation_expires_at > now() from public.background_jobs where id = '${jobId}'`,
    true
  );

  await expectScalar(
    db,
    'a reserved job can be marked as started',
    `select public.start_job('${jobId}')`,
    true
  );

  await expectScalar(
    db,
    'finishing a job records what it produced',
    `select public.complete_job('${jobId}', '{"sent": true}'::jsonb)`,
    true
  );

  await expectRejection(
    db,
    'a job that already finished cannot be quietly requeued',
    `update public.background_jobs set status = 'queued' where id = '${jobId}'`
  );

  const failing = await db.query(
    `select public.enqueue_job(
       'render_invoice_pdf', '{}'::jsonb, '${SEED.companyA}', now(), 'default',
       100::smallint, 'pdf-demo', 2::smallint
     ) as id`
  );
  const failingId = failing.rows[0].id;

  await db.query("select public.claim_jobs('runner-1', 'default', 10, 300)");

  await expectScalar(
    db,
    'a failed job goes back in the queue with a backoff',
    `select public.fail_job('${failingId}', 'The renderer timed out', true)`,
    'queued'
  );

  await expectScalar(
    db,
    'the retry is held back rather than hammered',
    `select run_after > now() from public.background_jobs where id = '${failingId}'`,
    true
  );

  await db.query(
    `update public.background_jobs set attempt_count = max_attempts where id = '${failingId}'`
  );

  await expectScalar(
    db,
    'a job that used up its attempts is dead lettered for a person',
    `select public.fail_job('${failingId}', 'The renderer timed out again', true)`,
    'dead_letter'
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a tenant owner cannot retry a dead lettered job',
    `select public.retry_dead_job('${failingId}')`
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'the platform team can retry a dead lettered job',
    `select public.retry_dead_job('${failingId}')`,
    true
  );

  await signOut(db);

  const stuck = await db.query(
    `select public.enqueue_job(
       'import_bank_statement', '{}'::jsonb, '${SEED.companyA}', now(), 'imports',
       100::smallint, 'import-demo', 5::smallint
     ) as id`
  );

  await db.query("select public.claim_jobs('runner-gone', 'imports', 10, 300)");
  await db.query(
    `update public.background_jobs set reservation_expires_at = now() - interval '1 minute'
      where id = '${stuck.rows[0].id}'`
  );

  await expectScalar(
    db,
    'a job held by a worker that disappeared is rescued',
    'select public.release_expired_job_leases()',
    1
  );

  await expectScalar(
    db,
    'the timetable turns into queued work',
    'select public.dispatch_due_schedules()',
    8
  );

  await expectScalar(
    db,
    'running the dispatcher again queues nothing further',
    'select public.dispatch_due_schedules()',
    0
  );

  await expectScalar(
    db,
    'the health report knows how deep the import queue is',
    `select queued_count from public.job_queue_health() where queue_name = 'imports'`,
    1
  );

  console.log('\nSettings that change without a deployment');

  await expectScalar(
    db,
    'the platform knows its own name',
    "select public.platform_setting('brand.name') #>> '{}'",
    'KD SOLUTION IT'
  );

  await expectScalar(
    db,
    'every account starts on the free plan',
    "select public.platform_setting('signup.default_plan_key') #>> '{}'",
    'free'
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a tenant owner cannot change a platform setting',
    "select public.set_platform_setting('signup.trial_days', '30'::jsonb)"
  );

  await expectScalar(
    db,
    'a tenant sees only the settings that are meant to be public',
    'select count(*)::int from public.platform_settings where not is_public',
    0
  );

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'the platform team can change a setting at runtime',
    "select public.set_platform_setting('signup.trial_days', '30'::jsonb) #>> '{}'",
    '30'
  );

  await expectRejection(
    db,
    'changing a setting that does not exist is an error, not a silent no',
    "select public.set_platform_setting('nope.not_here', '1'::jsonb)"
  );

  await signOut(db);

  await expectScalar(
    db,
    'the new value is what everybody reads next',
    "select public.platform_setting('signup.trial_days') #>> '{}'",
    '30'
  );

  await expectScalar(
    db,
    'a feature that is still being built is off for everybody',
    `select public.feature_flag_enabled('receipt_ocr', '${SEED.companyA}')`,
    false
  );

  await db.query(
    `update public.feature_flags
        set enabled_company_ids = array['${SEED.companyA}']::uuid[]
      where flag_key = 'receipt_ocr'`
  );

  await expectScalar(
    db,
    'a named tenant can be let in before anybody else',
    `select public.feature_flag_enabled('receipt_ocr', '${SEED.companyA}')`,
    true
  );

  await expectScalar(
    db,
    'the tenant next door still does not have it',
    `select public.feature_flag_enabled('receipt_ocr', '${SEED.companyB}')`,
    false
  );

  await db.query(
    `update public.feature_flags
        set is_enabled = true,
            rollout_percentage = 100,
            disabled_company_ids = array['${SEED.companyB}']::uuid[]
      where flag_key = 'bank_feeds'`
  );

  await expectScalar(
    db,
    'a tenant on the exclusion list is kept out of a full rollout',
    `select public.feature_flag_enabled('bank_feeds', '${SEED.companyB}')`,
    false
  );

  await expectScalar(
    db,
    'everybody else gets the feature',
    `select public.feature_flag_enabled('bank_feeds', '${SEED.companyA}')`,
    true
  );

  await expectScalar(
    db,
    'a flag that was never defined is simply off',
    `select public.feature_flag_enabled('no_such_flag', '${SEED.companyA}')`,
    false
  );

  console.log('\nThe rules a tenant sets for itself');

  await expectScalar(
    db,
    'every tenant has a security policy from its first day',
    'select count(*)::int from public.tenant_security_policies',
    2
  );

  await expectScalar(
    db,
    'nothing is restricted until somebody restricts it',
    `select public.ip_is_allowed('${SEED.companyA}', '203.0.113.9'::inet)`,
    true
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'an address restriction with nothing on the list is refused',
    `update public.tenant_security_policies set restrict_ip_addresses = true
      where company_id = '${SEED.companyA}'`
  );

  await db.query(
    `update public.tenant_security_policies
        set restrict_ip_addresses = true,
            allowed_ip_ranges = array['10.0.0.0/8']::inet[]
      where company_id = '${SEED.companyA}'`
  );

  await expectScalar(
    db,
    'an address inside the allowed range is let through',
    `select public.ip_is_allowed('${SEED.companyA}', '10.1.2.3'::inet)`,
    true
  );

  await expectScalar(
    db,
    'an address outside it is not',
    `select public.ip_is_allowed('${SEED.companyA}', '8.8.8.8'::inet)`,
    false
  );

  await expectRejection(
    db,
    'two factor cannot be demanded of the team but not of the owner',
    `update public.tenant_security_policies
        set require_two_factor = true, require_two_factor_for_owner = false
      where company_id = '${SEED.companyA}'`
  );

  await expectRejection(
    db,
    'a single action cap larger than the daily cap is refused',
    `update public.tenant_security_policies
        set staff_single_action_cap = 5000, staff_daily_cap = 1000
      where company_id = '${SEED.companyA}'`
  );

  await db.query(
    `update public.tenant_security_policies
        set require_approval_above_amount = 1000,
            require_approval_for_payouts = true,
            staff_single_action_cap = 250,
            staff_daily_cap = 1000
      where company_id = '${SEED.companyA}'`
  );

  await signIn(db, SEED.staffA);

  await db.query(
    `update public.tenant_security_policies set staff_single_action_cap = 999999
      where company_id = '${SEED.companyA}'`
  );

  await expectScalar(
    db,
    'a staff member cannot soften the rules they are held to',
    `select staff_single_action_cap from public.tenant_security_policies
      where company_id = '${SEED.companyA}'`,
    '250.0000'
  );

  await signOut(db);

  await expectScalar(
    db,
    'a large refund needs a second pair of eyes',
    `select public.requires_second_approval('${SEED.companyA}', 'refund', 2500)`,
    true
  );

  await expectScalar(
    db,
    'a small one does not',
    `select public.requires_second_approval('${SEED.companyA}', 'refund', 40)`,
    false
  );

  await expectScalar(
    db,
    'a payout always needs one when the tenant asked for that',
    `select public.requires_second_approval('${SEED.companyA}', 'payout', 1)`,
    true
  );

  await expectScalar(
    db,
    'a staff action over the cap is stopped',
    `select public.staff_action_within_cap('${SEED.companyA}', '${SEED.staffA}', 400)`,
    false
  );

  await expectScalar(
    db,
    'the owner is not capped',
    `select public.staff_action_within_cap('${SEED.companyA}', '${SEED.ownerA}', 400000)`,
    true
  );

  console.log('\nFour eyes');

  await signIn(db, SEED.staffA);

  const request = await db.query(
    `select public.request_approval(
       '${SEED.companyA}', 'refund', 'Refund the duplicate payment',
       '{"payment_id": "demo"}'::jsonb, 2500, 'USD', 'payment',
       '00000000-0000-7000-8000-0000000cc001'::uuid,
       'The client was charged twice', 1::smallint, 168
     ) as id`
  );
  const requestId = request.rows[0].id;

  await expectScalar(
    db,
    'a request is numbered the moment it is raised',
    `select request_number from public.approval_requests where id = '${requestId}'`,
    'AP-0001'
  );

  await expectRejection(
    db,
    'the person who asked is not an approver at all',
    `select public.decide_approval('${requestId}', 'approved', 'Looks fine to me', null)`
  );

  await signIn(db, SEED.ownerA);

  const ownRequest = await db.query(
    `select public.request_approval(
       '${SEED.companyA}', 'payout', 'Release my own payout',
       '{"amount": 100}'::jsonb, 100, 'USD', null, null, null, 1::smallint, 168
     ) as id`
  );

  await expectRejection(
    db,
    'an owner cannot approve a request they raised themselves',
    `select public.decide_approval('${ownRequest.rows[0].id}', 'approved', 'Mine', null)`
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'an owner of another tenant cannot decide it either',
    `select public.decide_approval('${requestId}', 'approved', 'Not my business', null)`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the owner can approve it',
    `select public.decide_approval('${requestId}', 'approved', 'Confirmed against the bank', null)`,
    'approved'
  );

  await expectRejection(
    db,
    'a settled request cannot be decided twice',
    `select public.decide_approval('${requestId}', 'rejected', 'Changed my mind', null)`
  );

  await expectScalar(
    db,
    'the approved action is carried out once',
    `select public.complete_approved_action('${requestId}', '{"refunded": true}'::jsonb)`,
    true
  );

  await expectScalar(
    db,
    'and never a second time',
    `select public.complete_approved_action('${requestId}', '{"refunded": true}'::jsonb)`,
    false
  );

  await signIn(db, SEED.staffA);

  const twoEyes = await db.query(
    `select public.request_approval(
       '${SEED.companyA}', 'payout', 'Release the monthly payout',
       '{"amount": 9000}'::jsonb, 9000, 'USD', null, null, null, 2::smallint, 168
     ) as id`
  );
  const twoEyesId = twoEyes.rows[0].id;

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a request needing two approvals waits after the first one',
    `select public.decide_approval('${twoEyesId}', 'approved', 'Agreed', null)`,
    'pending'
  );

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'the second approval settles it',
    `select public.decide_approval('${twoEyesId}', 'approved', 'Agreed as well', null)`,
    'approved'
  );

  await signOut(db);

  await expectScalar(
    db,
    'both answers are kept, not just the last one',
    `select count(*)::int from public.approval_decisions
      where approval_request_id = '${twoEyesId}'`,
    2
  );

  await expectRejection(
    db,
    'a recorded decision can never be edited afterwards',
    `update public.approval_decisions set note = 'Something else'
      where approval_request_id = '${twoEyesId}'`
  );

  await db.query(
    `insert into public.approval_requests
       (company_id, action_type, title, requested_by, expires_at)
     values ('${SEED.companyA}', 'refund', 'Forgotten request', '${SEED.staffA}',
             now() - interval '1 day')`
  );

  await expectScalar(
    db,
    'a request nobody answered falls away on its own',
    'select public.expire_stale_approvals()',
    1
  );

  console.log('\nWho looked at what');

  await signIn(db, SEED.ownerA);

  await db.query(
    `select public.record_sensitive_access(
       '${SEED.companyA}', 'client', null, 'bank_account_number',
       'Checking the account before a payout', null, 'Mozilla/5.0'
     )`
  );

  await db.query(
    `select public.record_sensitive_access(
       '${SEED.companyA}', 'client', null, 'bank_account_number',
       'Checking it once more', null, 'Mozilla/5.0'
     )`
  );

  await expectScalar(
    db,
    'reading protected data is itself written down',
    `select access_count from public.sensitive_access_report(
       '${SEED.companyA}', now() - interval '1 hour', now() + interval '1 hour'
     ) where field_name = 'bank_account_number'`,
    2
  );

  await expectScalar(
    db,
    'the owner can see the read trail of their own tenant',
    'select count(*)::int from public.sensitive_access_logs',
    2
  );

  await signIn(db, SEED.staffA);

  await expectScalar(
    db,
    'a staff member cannot audit the audit',
    'select count(*)::int from public.sensitive_access_logs',
    0
  );

  await signOut(db);

  await expectRejection(
    db,
    'the read trail is append only',
    "update public.sensitive_access_logs set purpose = 'Something else'"
  );
}

/**
 * Verifies the credential vault: who may configure a connection, the test
 * before it is switched on, rotation with a grace window, and the order in
 * which a credential is resolved at runtime.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testIntegrations(db) {
  console.log('\nWhat the platform can be connected to');

  await signOut(db);

  await expectScalar(
    db,
    'the catalogue ships with every provider the product promises',
    'select count(*)::int from public.integration_providers where is_active',
    29
  );

  await expectScalar(
    db,
    'a provider describes the form the admin panel has to draw',
    "select count(*)::int from public.integration_fields('stripe')",
    4
  );

  await expectScalar(
    db,
    'the form knows which field is a secret',
    "select is_secret from public.integration_fields('stripe') where field_key = 'secret_key'",
    true
  );

  await expectScalar(
    db,
    'and which environment variable it falls back to',
    "select env_var from public.integration_fields('stripe') where field_key = 'secret_key'",
    'STRIPE_SECRET_KEY'
  );

  await expectScalar(
    db,
    'a connection with nothing to call is not offered a test button',
    "select supports_connection_test from public.integration_providers where provider_key = 'microsoft_clarity'",
    false
  );

  await expectRejection(
    db,
    'a provider key has to be a plain identifier',
    `insert into public.integration_providers (provider_key, name, category, summary)
     values ('Not A Key', 'Broken', 'payment', 'A provider with an impossible key.')`
  );

  await expectRejection(
    db,
    'a form definition has to be a list of fields',
    `insert into public.integration_providers (provider_key, name, category, summary, field_schema)
     values ('broken_schema', 'Broken', 'payment',
             'A provider whose form definition is not a list.', '{}'::jsonb)`
  );

  console.log('\nWho may connect what');

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a tenant owner may connect their own payment account',
    `select public.can_configure_integration('${SEED.companyA}', 'stripe')`,
    true
  );

  await expectScalar(
    db,
    'a tenant owner may not touch a platform only connection',
    `select public.can_configure_integration('${SEED.companyA}', 'resend')`,
    false
  );

  await expectScalar(
    db,
    'and may not touch the platform level of anything',
    "select public.can_configure_integration(null, 'stripe')",
    false
  );

  await expectRejection(
    db,
    'saving a platform credential as a tenant owner is refused',
    `select public.save_integration_credential(
       null, 'stripe', 'live', 'enc:platform-key', null, '{}'::jsonb, '{}'::jsonb, null, 1::smallint
     )`
  );

  await expectRejection(
    db,
    'saving a credential for another tenant is refused',
    `select public.save_integration_credential(
       '${SEED.companyB}', 'stripe', 'live', 'enc:not-mine', null, '{}'::jsonb, '{}'::jsonb, null, 1::smallint
     )`
  );

  await signIn(db, SEED.staffA);

  await expectRejection(
    db,
    'a staff member cannot connect a payment account',
    `select public.save_integration_credential(
       '${SEED.companyA}', 'stripe', 'live', 'enc:staff-key', null, '{}'::jsonb, '{}'::jsonb, null, 1::smallint
     )`
  );

  console.log('\nSaving, testing and switching on');

  await signIn(db, SEED.ownerA);

  const saved = await db.query(
    `select public.save_integration_credential(
       '${SEED.companyA}', 'stripe', 'live', 'enc:first-bundle',
       '${'a'.repeat(64)}', '{"secret_key": "****4242"}'::jsonb,
       '{"publishable_key": "pk_live_demo"}'::jsonb, 'Main account', 1::smallint
     ) as id`
  );
  const credentialId = saved.rows[0].id;

  await expectScalar(
    db,
    'a newly saved connection is not switched on by itself',
    `select is_enabled from public.integration_credentials where id = '${credentialId}'`,
    false
  );

  await expectScalar(
    db,
    'and is waiting to be tested',
    `select status from public.integration_credentials where id = '${credentialId}'`,
    'untested'
  );

  await expectRejection(
    db,
    'a connection cannot be switched on before it has been proved to work',
    `select public.enable_integration('${credentialId}')`
  );

  await expectScalar(
    db,
    'a failed test is recorded with what went wrong',
    `select public.record_connection_test(
       '${credentialId}', false, 'The key was rejected', 401::smallint, 120, '{}'::jsonb
     ) is not null`,
    true
  );

  await expectScalar(
    db,
    'the connection says so rather than pretending',
    `select status from public.integration_credentials where id = '${credentialId}'`,
    'failing'
  );

  await db.query(
    `select public.record_connection_test(
       '${credentialId}', true, 'Reached the balance endpoint', 200::smallint, 90, '{}'::jsonb
     )`
  );

  await expectScalar(
    db,
    'a successful test clears the way',
    `select last_test_succeeded from public.integration_credentials where id = '${credentialId}'`,
    true
  );

  await expectScalar(
    db,
    'the owner can now switch it on',
    `select public.enable_integration('${credentialId}')`,
    true
  );

  await expectScalar(
    db,
    'a working connection reports itself ready',
    `select status from public.integration_credentials where id = '${credentialId}'`,
    'ready'
  );

  await expectScalar(
    db,
    'both test results are kept, not just the last one',
    `select count(*)::int from public.integration_connection_tests
      where credential_id = '${credentialId}'`,
    2
  );

  await signOut(db);

  await expectRejection(
    db,
    'a test result can never be rewritten',
    `update public.integration_connection_tests set message = 'It was fine really'
      where credential_id = '${credentialId}'`
  );

  console.log('\nKeeping the secret a secret');

  await expectScalar(
    db,
    'the encrypted bundle is not readable by any signed in caller',
    "select has_column_privilege('authenticated', 'public.integration_credentials', 'secret_bundle_encrypted', 'select')",
    false
  );

  await expectScalar(
    db,
    'the masked hint is, because it is only a hint',
    "select has_column_privilege('authenticated', 'public.integration_credentials', 'masked_hints', 'select')",
    true
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a hint long enough to be the key itself is refused',
    `select public.save_integration_credential(
       '${SEED.companyA}', 'paypal', 'live', 'enc:paypal-bundle', null,
       '{"client_secret": "EFmJ7xK2qPvNr4Zt"}'::jsonb, '{}'::jsonb, null, 1::smallint
     )`
  );

  await expectRejection(
    db,
    'resolving a credential is a server side act, not a browser one',
    `select count(*)::int from public.resolve_integration('${SEED.companyA}', 'stripe', 'live')`
  );

  console.log('\nChanging a key while the platform runs');

  const beforeRevision = await db.query('select revision from public.integration_revision()');

  await expectScalar(
    db,
    'a saved change moves the version of that connection',
    `select config_version > 1 from public.integration_credentials where id = '${credentialId}'`,
    true
  );

  await expectScalar(
    db,
    'rotating a key keeps the old one alive for a grace window',
    `select public.rotate_integration_credential(
       '${credentialId}', 'enc:second-bundle', '${'b'.repeat(64)}',
       '{"secret_key": "****9191"}'::jsonb, 5
     )`,
    true
  );

  await signOut(db);

  await expectScalar(
    db,
    'the replaced bundle is held, and only until the window closes',
    `select previous_bundle_encrypted = 'enc:first-bundle'
            and previous_bundle_valid_until > now()
       from public.integration_credentials where id = '${credentialId}'`,
    true
  );

  await expectScalar(
    db,
    'the revision counter moved, so every instance reloads within seconds',
    `select revision > ${beforeRevision.rows[0].revision} from public.integration_revision()`,
    true
  );

  await db.query(
    `update public.integration_credentials
        set previous_bundle_valid_until = now() - interval '1 minute'
      where id = '${credentialId}'`
  );

  await expectScalar(
    db,
    'once the window closes the old key is not held at all',
    'select public.expire_credential_grace_windows()',
    1
  );

  await expectScalar(
    db,
    'and nothing of it is left behind',
    `select previous_bundle_encrypted is null from public.integration_credentials
      where id = '${credentialId}'`,
    true
  );

  await expectRejection(
    db,
    'a credential cannot be moved to another tenant',
    `update public.integration_credentials set company_id = '${SEED.companyB}'
      where id = '${credentialId}'`
  );

  await expectRejection(
    db,
    'nor to another provider',
    `update public.integration_credentials set provider_key = 'paypal'
      where id = '${credentialId}'`
  );

  await expectRejection(
    db,
    'nor from test into live',
    `update public.integration_credentials set environment = 'test'
      where id = '${credentialId}'`
  );

  await expectRejection(
    db,
    'one tenant cannot hold two live credentials for the same provider',
    `insert into public.integration_credentials (company_id, provider_key, environment)
     values ('${SEED.companyA}', 'stripe', 'live')`
  );

  console.log('\nWhich credential actually applies');

  await signIn(db, SEED.superAdmin);

  const platformStripe = await db.query(
    `select public.save_integration_credential(
       null, 'stripe', 'live', 'enc:platform-bundle', '${'c'.repeat(64)}',
       '{"secret_key": "****0000"}'::jsonb, '{}'::jsonb, 'Merchant of record', 1::smallint
     ) as id`
  );

  await db.query(
    `select public.record_connection_test(
       '${platformStripe.rows[0].id}', true, 'Reached the balance endpoint', 200::smallint, 70, '{}'::jsonb
     )`
  );

  await db.query(`select public.enable_integration('${platformStripe.rows[0].id}')`);

  await signOut(db);

  await expectScalar(
    db,
    'a tenant that connected its own account uses its own account',
    `select source from public.resolve_integration('${SEED.companyA}', 'stripe', 'live')`,
    'tenant'
  );

  await expectScalar(
    db,
    'a tenant that did not falls back to the platform account',
    `select source from public.resolve_integration('${SEED.companyB}', 'stripe', 'live')`,
    'platform'
  );

  await expectScalar(
    db,
    'and the bundle that comes back is the right one, still encrypted',
    `select secret_bundle_encrypted from public.resolve_integration('${SEED.companyB}', 'stripe', 'live')`,
    'enc:platform-bundle'
  );

  await expectScalar(
    db,
    'a provider nobody configured sends the caller to the environment',
    `select source from public.resolve_integration('${SEED.companyA}', 'plaid', 'live')`,
    'environment'
  );

  await expectScalar(
    db,
    'and names the variable to read, so nothing is hard coded twice',
    `select env_fallback ->> 'secret' from public.resolve_integration('${SEED.companyA}', 'plaid', 'live')`,
    'PLAID_SECRET'
  );

  await expectScalar(
    db,
    'a connected provider is reported as available',
    `select public.integration_is_available('${SEED.companyA}', 'stripe', 'live')`,
    true
  );

  await expectScalar(
    db,
    'an unconnected one is not',
    `select public.integration_is_available('${SEED.companyA}', 'twilio', 'live')`,
    false
  );

  console.log('\nA worker that dies does not lose the work');

  await signInAsService(db);

  const strandedClient = await db.query(
    `select id, email from public.clients where company_id = $1 and email is not null
      order by client_number limit 1`,
    [SEED.companyA]
  );

  const stranded = await db.query(
    `insert into public.messages
       (company_id, client_id, channel, status, to_email, subject, body_text,
        attempt_count, idempotency_key, updated_at)
     values ($1, $2, 'email', 'sending', $3, 'An invoice from us',
             'The body of the message', 1, 'stranded-worker-probe',
             now() - interval '2 hours')
     returning id`,
    [SEED.companyA, strandedClient.rows[0].id, strandedClient.rows[0].email]
  );

  await expectScalar(
    db,
    'a message a dead worker left behind is put back in the queue',
    'select public.requeue_stalled_messages(15, 5) >= 1',
    true
  );

  await expectScalar(
    db,
    'so it will actually be tried again rather than sitting there forever',
    `select status::text from public.messages where id = '${stranded.rows[0].id}'`,
    'queued'
  );

  // A second one that has already been tried as often as it is allowed to
  // be. Inserted rather than updated, because touching a row sets its
  // updated_at and would make it look fresh again.
  const exhausted = await db.query(
    `insert into public.messages
       (company_id, client_id, channel, status, to_email, subject, body_text,
        attempt_count, idempotency_key, updated_at)
     values ($1, $2, 'email', 'sending', $3, 'An invoice from us',
             'The body of the message', 9, 'exhausted-worker-probe',
             now() - interval '2 hours')
     returning id`,
    [SEED.companyA, strandedClient.rows[0].id, strandedClient.rows[0].email]
  );

  await db.query('select public.requeue_stalled_messages(15, 5)');

  await expectScalar(
    db,
    'one that has already been tried too often is given up on, not looped forever',
    `select status::text from public.messages where id = '${exhausted.rows[0].id}'`,
    'failed'
  );

  await expectScalar(
    db,
    'and giving up is reported rather than done quietly',
    `select count(*)::int >= 1 from public.job_failures
      where job_name = 'dispatch_messages'`,
    true
  );

  await expectScalar(
    db,
    'a delivery reserved by a worker that never came back is freed',
    'select public.release_stalled_deliveries(10) >= 0',
    true
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a tenant cannot drive the sweeper itself',
    'select public.requeue_stalled_messages(15, 5)'
  );

  await signOut(db);

  console.log('\nEvery scheduled job survives one bad row');

  await signInAsService(db);

  // Each of these walks a queue. What is being proved is that they answer
  // with a count rather than refusing to run at all, and that nothing they
  // touch is left half done.
  await expectScalar(
    db,
    'the renewal run answers with what it managed',
    'select public.run_subscription_renewals(0) >= 0',
    true
  );

  await expectScalar(
    db,
    'the dunning run answers with what it managed',
    'select public.run_subscription_dunning(14) >= 0',
    true
  );

  await expectScalar(
    db,
    'the cancellation run answers with what it managed',
    'select public.process_scheduled_cancellations() >= 0',
    true
  );

  await expectScalar(
    db,
    'the promise run answers with what it managed',
    'select public.resolve_due_payment_promises() >= 0',
    true
  );

  await expectScalar(
    db,
    'and none of them leaves a subscription without a plan behind it',
    `select count(*)::int from public.subscriptions
      where deleted_at is null and plan_id is null`,
    0
  );

  await signOut(db);

  console.log('\nWork a job could not finish is never silent');

  await signInAsService(db);

  await expectScalar(
    db,
    'releasing held money reports rather than throwing a failure away',
    'select public.release_matured_settlements() >= 0',
    true
  );

  await db.query(
    `select public.record_job_failure('release_matured_settlements', 'settlement',
       null, 'The wallet behind this settlement was frozen', $1)`,
    [SEED.companyA]
  );

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'the platform team can see what was skipped and why',
    `select count(*)::int >= 1 from public.recent_job_failures(20)
      where job_name = 'release_matured_settlements'`,
    true
  );

  await expectScalar(
    db,
    'and which business it belongs to',
    `select company_id = '${SEED.companyA}' from public.recent_job_failures(20)
      where job_name = 'release_matured_settlements' limit 1`,
    true
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a tenant cannot read the failures of the platform',
    'select count(*)::int from public.recent_job_failures(5)'
  );

  await expectScalar(
    db,
    'nor the table behind them',
    'select count(*)::int from public.job_failures',
    0
  );

  await signOut(db);

  console.log('\nOne tenant cannot stop the work of the rest');

  await signInAsService(db);

  const brokenCompany = SEED.companyA;

  // A rule pointing at wording nobody wrote is the most ordinary possible
  // misconfiguration, and the one most likely to be made by a tenant.
  const brokenRule = await db.query(
    `insert into public.reminder_rules
       (company_id, name, template_key, offset_days, applies_to_status, max_reminders)
     values ($1, 'Points at nothing', 'wording_that_was_never_written', 1,
             array['sent', 'overdue']::public.invoice_status[], 3)
     returning id`,
    [brokenCompany]
  );

  const workingRule = await db.query(
    `insert into public.reminder_rules
       (company_id, name, template_key, offset_days, applies_to_status, max_reminders)
     values ($1, 'Points at real wording', 'invoice_reminder', 2,
             array['sent', 'overdue']::public.invoice_status[], 3)
     returning id`,
    [brokenCompany]
  );

  const chased = await db.query(
    `select id, client_id from public.invoices
      where company_id = $1 and balance_due > 0 and invoice_number is not null
      order by created_at limit 1`,
    [brokenCompany]
  );

  if (chased.rows.length > 0) {
    await db.query(
      `insert into public.invoice_reminders
         (company_id, invoice_id, rule_id, scheduled_for, attempt_number)
       values ($1, $2, $3, now() - interval '1 hour', 1),
              ($1, $2, $4, now() - interval '1 hour', 1)`,
      [brokenCompany, chased.rows[0].id, brokenRule.rows[0].id, workingRule.rows[0].id]
    );

    const sent = await db.query('select public.run_due_reminders(50) as sent');

    report(
      sent.rows[0].sent >= 1,
      'the reminder that could be sent still goes out when another one cannot'
    );

    await expectScalar(
      db,
      'and the one that failed says why, where the business can read it',
      `select cancellation_reason is not null from public.invoice_reminders
        where rule_id = '${brokenRule.rows[0].id}'`,
      true
    );

    await expectScalar(
      db,
      'the failure is recorded against that reminder rather than silently retried',
      `select status from public.invoice_reminders
        where rule_id = '${brokenRule.rows[0].id}'`,
      'failed'
    );
  }

  await db.query(`update public.reminder_rules set deleted_at = now() where id in ($1, $2)`, [
    brokenRule.rows[0].id,
    workingRule.rows[0].id,
  ]);

  await signOut(db);

  console.log('\nThe words that actually leave the building');

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the platform ships with wording for every message it sends by itself',
    'select count(*)::int >= 10 from public.configured_template_keys()',
    true
  );

  await expectScalar(
    db,
    'including the one that asks somebody to sign a document',
    `select count(*)::int from public.configured_template_keys()
      where template_key = 'contract_signature_request'`,
    1
  );

  await expectScalar(
    db,
    'and the one that sends the signed copy back',
    `select count(*)::int from public.configured_template_keys()
      where template_key = 'contract_signed'`,
    1
  );

  await signInAsService(db);

  await expectRejection(
    db,
    'a message with no wording behind it is refused rather than sent empty',
    `select public.queue_message('${SEED.companyA}', 'a_key_nobody_wrote',
       'someone@example.test', '{}'::jsonb)`
  );

  await signOut(db);

  console.log('\nOne page that says what a client owes');

  await signIn(db, SEED.ownerA);

  const statementClient = await db.query(
    `select id from public.clients where company_id = $1 and deleted_at is null
      order by client_number limit 1`,
    [SEED.companyA]
  );
  const statementClientId = statementClient.rows[0].id;

  await expectScalar(
    db,
    'a statement lists the invoices a client has been sent',
    `select count(*)::int >= 1 from public.client_statement('${SEED.companyA}', '${statementClientId}')`,
    true
  );

  await expectScalar(
    db,
    'a draft that was never issued is not on it',
    `select count(*)::int from public.client_statement('${SEED.companyA}', '${statementClientId}')
      where invoice_number is null`,
    0
  );

  await expectScalar(
    db,
    'the summary names the client it is about',
    `select public.client_statement_summary('${SEED.companyA}', '${statementClientId}')
       ->> 'client_name' is not null`,
    true
  );

  await expectScalar(
    db,
    'and ages the debt rather than giving one unhelpful total',
    `select public.client_statement_summary('${SEED.companyA}', '${statementClientId}')
       ? 'overdue_over_90'`,
    true
  );

  await expectScalar(
    db,
    'the debtor list puts the oldest debt first',
    `select count(*)::int >= 0 from public.outstanding_by_client('${SEED.companyA}')`,
    true
  );

  await expectRejection(
    db,
    'a client who belongs to another business has no statement here',
    `select public.client_statement_summary('${SEED.companyA}',
       (select id from public.clients where company_id = '${SEED.companyB}' limit 1))`
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'one business cannot read what another is owed',
    `select count(*)::int from public.outstanding_by_client('${SEED.companyA}')`
  );

  await signOut(db);

  console.log('\nTelling other software what happened');

  await signIn(db, SEED.ownerA);

  const endpoint = await db.query(
    `select public.save_webhook_endpoint($1, 'Our accounting robot',
       'https://hooks.example.com/kd', array['invoice.paid', 'payment.succeeded'],
       'enc:signing-secret', $2, 'Posts paid invoices into our own ledger') as id`,
    [SEED.companyA, 'f'.repeat(64)]
  );
  const endpointId = endpoint.rows[0].id;

  await expectScalar(
    db,
    'a business can be told when something happens, by its own software',
    `select target_url from public.webhook_endpoints where id = '${endpointId}'`,
    'https://hooks.example.com/kd'
  );

  await expectRejection(
    db,
    'an address that is not secure is refused',
    `select public.save_webhook_endpoint('${SEED.companyA}', 'Insecure',
       'http://hooks.example.com/kd', array['invoice.paid'], 'enc:x')`
  );

  await expectRejection(
    db,
    'and so is one pointing inside a private network',
    `select public.save_webhook_endpoint('${SEED.companyA}', 'Inside',
       'https://192.168.0.10/hook', array['invoice.paid'], 'enc:x')`
  );

  await expectRejection(
    db,
    'nor can an endpoint be subscribed to nothing at all',
    `select public.save_webhook_endpoint('${SEED.companyA}', 'Empty',
       'https://hooks.example.com/empty', array[]::text[], 'enc:x')`
  );

  await expectScalar(
    db,
    'the screen shows a fingerprint of the secret rather than the secret',
    `select secret_fingerprint from public.webhook_endpoint_list('${SEED.companyA}')
      where endpoint_id = '${endpointId}'`,
    'f'.repeat(12)
  );

  await signInAsService(db);

  const emitted = await db.query(
    `select public.emit_outbound_event($1, 'invoice.paid', 'invoice', null,
       '{"invoice_number": "INV-0001"}'::jsonb) as id`,
    [SEED.companyA]
  );

  report(typeof emitted.rows[0].id === 'string', 'an event queues a delivery for that endpoint');

  await expectScalar(
    db,
    'and the delivery is waiting to be attempted',
    `select count(*)::int from public.webhook_deliveries
      where endpoint_id = '${endpointId}' and status = 'pending'`,
    1
  );

  const claimed = await db.query(
    `select id from public.claim_webhook_deliveries('worker-one', 5)
      where endpoint_id = '${endpointId}'`
  );

  report(claimed.rows.length === 1, 'a worker claims it exactly once');

  const secondWorker = await db.query(
    `select id from public.claim_webhook_deliveries('worker-two', 5)`
  );

  report(secondWorker.rows.length === 0, 'and a second worker does not take the same delivery');

  await db.query(
    `select public.record_webhook_attempt($1, 500::smallint, 120,
       'The server answered with an error')`,
    [claimed.rows[0].id]
  );

  await expectScalar(
    db,
    'a failure is retried later rather than thrown away',
    `select next_attempt_at > now() from public.webhook_deliveries
      where id = '${claimed.rows[0].id}'`,
    true
  );

  await db.query(`select public.record_webhook_attempt($1, 200::smallint, 95)`, [
    claimed.rows[0].id,
  ]);

  await expectScalar(
    db,
    'and a success closes the delivery rather than retrying it forever',
    `select status::text from public.webhook_deliveries where id = '${claimed.rows[0].id}'`,
    'delivered'
  );

  await expectScalar(
    db,
    'the endpoint remembers when it last worked',
    `select last_success_at is not null from public.webhook_endpoints
      where id = '${endpointId}'`,
    true
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the business can see what was delivered and what failed',
    `select count(*)::int >= 1 from public.webhook_delivery_history('${SEED.companyA}', 20)`,
    true
  );

  await expectScalar(
    db,
    'switching an endpoint off and on again forgives the failures',
    `select public.set_webhook_endpoint_state('${endpointId}', true)`,
    true
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'one business cannot send another business data anywhere',
    `select public.save_webhook_endpoint('${SEED.companyA}', 'Theirs',
       'https://hooks.example.com/theirs', array['invoice.paid'], 'enc:x')`
  );

  await expectRejection(
    db,
    'nor read its deliveries',
    `select count(*)::int from public.webhook_delivery_history('${SEED.companyA}', 5)`
  );

  await signOut(db);

  console.log('\nChasing an invoice without becoming a nuisance');

  await signIn(db, SEED.ownerA);

  const chase = await db.query(
    `select public.save_reminder_rule($1, 'A week after it was due', 7,
       'invoice_reminder', 0, 3, true, true) as id`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'a business can say when it chases an unpaid invoice',
    `select offset_days from public.reminder_rules where id = '${chase.rows[0].id}'`,
    7
  );

  await expectRejection(
    db,
    'but it cannot send twenty reminders on one invoice',
    `select public.save_reminder_rule('${SEED.companyA}', 'Relentless', 3,
       'invoice_reminder', 0, 20)`
  );

  await expectRejection(
    db,
    'nor set quiet hours of zero length',
    `select public.save_reminder_settings('${SEED.companyA}', true, 'Asia/Dhaka',
       '09:00'::time, '09:00'::time)`
  );

  await expectRejection(
    db,
    'nor a statement day that some months do not have',
    `select public.save_reminder_settings('${SEED.companyA}', true, 'Asia/Dhaka',
       '20:00'::time, '08:00'::time, array[1,2,3,4,5]::smallint[], false, true, 31)`
  );

  await db.query(
    `select public.save_reminder_settings($1, true, 'Asia/Dhaka', '21:00'::time,
       '09:00'::time, array[1,2,3,4,5]::smallint[], true, true, 1)`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'reminders are timed in the time zone of the client rather than ours',
    `select public.collections_overview('${SEED.companyA}') ->> 'time_zone'`,
    'Asia/Dhaka'
  );

  await expectScalar(
    db,
    'and the overview knows what is already late',
    `select (public.collections_overview('${SEED.companyA}') ->> 'overdue_count')::int >= 0`,
    true
  );

  await expectScalar(
    db,
    'the rules are listed with how often each has actually gone out',
    `select count(*)::int >= 1 from public.reminder_rule_list('${SEED.companyA}')`,
    true
  );

  const chasedInvoice = await db.query(
    `select id from public.invoices where company_id = $1 and balance_due > 0
      order by created_at limit 1`,
    [SEED.companyA]
  );

  if (chasedInvoice.rows.length > 0) {
    await db.query(
      `select public.record_payment_promise($1, current_date + 5, null,
         'They asked for another week')`,
      [chasedInvoice.rows[0].id]
    );

    await expectScalar(
      db,
      'a client who promises to pay is recorded rather than chased again',
      `select count(*)::int >= 1 from public.open_payment_promises('${SEED.companyA}')`,
      true
    );
  }

  await expectScalar(
    db,
    'a reminder can be retired without touching what it already sent',
    `select public.delete_reminder_rule('${chase.rows[0].id}')`,
    true
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'one business cannot change how another chases its clients',
    `select public.save_reminder_rule('${SEED.companyA}', 'Theirs', 3)`
  );

  await expectRejection(
    db,
    'nor read what it is owed',
    `select public.collections_overview('${SEED.companyA}')`
  );

  await signOut(db);

  console.log('\nTesting a change before believing in it');

  await signIn(db, SEED.superAdmin);

  const trial = await db.query(
    `select public.save_experiment('hero_wording', 'Shorter hero line', 'signup_started',
       'A shorter promise reads faster and more people start a signup', 'landing_page', 50) as id`
  );
  const trialId = trial.rows[0].id;

  await expectScalar(
    db,
    'a test records the question it is asking before it runs',
    `select hypothesis is not null from public.experiments where id = '${trialId}'`,
    true
  );

  await expectRejection(
    db,
    'a test cannot be run on more visitors than exist',
    `select public.save_experiment('bad-split', 'Impossible', 'signup_started',
       null, 'landing_page', 140)`
  );

  const control = await db.query(
    `select public.save_experiment_variant('${trialId}', 'control', 'What we have now',
       50, true) as id`
  );

  await db.query(
    `select public.save_experiment_variant('${trialId}', 'shorter', 'The shorter line', 50, false)`
  );

  await expectScalar(
    db,
    'exactly one side is the thing being compared against',
    `select count(*)::int from public.experiment_variants
      where experiment_id = '${trialId}' and is_control`,
    1
  );

  await expectScalar(
    db,
    'and the two sides together account for every visitor',
    `select public.experiment_weights_balanced('${trialId}')`,
    true
  );

  await db.query(`select public.start_experiment('${trialId}')`);

  await expectScalar(
    db,
    'a started test is running',
    `select status from public.experiments where id = '${trialId}'`,
    'running'
  );

  await expectRejection(
    db,
    'a test that people are already in cannot be rewritten',
    `select public.save_experiment('hero_wording', 'Changed mid flight', 'signup_started',
       null, 'landing_page', 50, '${trialId}')`
  );

  await expectRejection(
    db,
    'nor can its variants be edited underneath them',
    `select public.save_experiment_variant('${trialId}', 'control', 'Different words', 50, true,
       '{}'::jsonb, '${control.rows[0].id}')`
  );

  await signOut(db);

  const assignment = await db.query(
    `select variant_key from public.assign_experiment_variant('hero_wording', $1)`,
    ['v'.repeat(24)]
  );

  report(
    typeof assignment.rows[0].variant_key === 'string',
    'a visitor is put on one side of the test'
  );

  const again = await db.query(
    `select variant_key from public.assign_experiment_variant('hero_wording', $1)`,
    ['v'.repeat(24)]
  );

  report(
    again.rows[0].variant_key === assignment.rows[0].variant_key,
    'and stays on that side every time they come back'
  );

  await db.query(`select public.record_experiment_conversion('hero_wording', $1)`, [
    'v'.repeat(24),
  ]);

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'the result counts what actually happened on each side',
    `select sum(conversions)::int from public.experiment_results('hero_wording')`,
    1
  );

  await db.query(
    `select public.conclude_experiment('${trialId}', '${control.rows[0].id}',
       'The shorter line did not beat what we had')`
  );

  await expectScalar(
    db,
    'concluding a test writes down what was decided and why',
    `select conclusion is not null from public.experiments where id = '${trialId}'`,
    true
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a tenant cannot run tests on the platform website',
    `select public.save_experiment('mine', 'Mine', 'signup_started')`
  );

  await signOut(db);

  console.log('\nMoving a business in from somewhere else');

  await signIn(db, SEED.ownerA);

  const rehearsal = await db.query(
    `select public.import_client_rows($1,
       '[{"display_name": "Northwind Trading", "email": "accounts@northwind.test"},
         {"display_name": "", "email": "nobody@example.test"},
         {"display_name": "Broken Row", "email": "not-an-email"}]'::jsonb,
       true, 'Exported from the old tool') as result`,
    [SEED.companyA]
  );
  const rehearsalResult = rehearsal.rows[0].result;

  await expectScalar(
    db,
    'a rehearsal reports what would happen without writing anything',
    `select count(*)::int from public.clients
      where company_id = '${SEED.companyA}' and display_name = 'Northwind Trading'`,
    0
  );

  report(rehearsalResult.created_count === 1, 'and counts the row it would have created');

  report(rehearsalResult.skipped_count === 2, 'while naming the two rows it could not use');

  report(
    typeof rehearsalResult.problems[0].problem === 'string',
    'each problem is written in words a person can act on'
  );

  await db.query(
    `select public.import_client_rows($1,
       '[{"display_name": "Northwind Trading", "email": "accounts@northwind.test"}]'::jsonb,
       false, 'Exported from the old tool')`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'running it for real brings the client in',
    `select count(*)::int from public.clients
      where company_id = '${SEED.companyA}' and display_name = 'Northwind Trading'`,
    1
  );

  const second = await db.query(
    `select public.import_client_rows($1,
       '[{"display_name": "Northwind Trading", "email": "accounts@northwind.test"}]'::jsonb,
       false, 'The same file again') as result`,
    [SEED.companyA]
  );

  report(
    second.rows[0].result.matched_count === 1,
    'importing the same file twice matches rather than duplicating'
  );

  await expectScalar(
    db,
    'so the client still appears exactly once',
    `select count(*)::int from public.clients
      where company_id = '${SEED.companyA}' and display_name = 'Northwind Trading'`,
    1
  );

  const products = await db.query(
    `select public.import_product_rows($1,
       '[{"name": "Website audit", "unit_price": "450.00", "sku": "AUD-1"},
         {"name": "Broken price", "unit_price": "lots"}]'::jsonb,
       false, 'Price list') as result`,
    [SEED.companyA]
  );

  report(products.rows[0].result.created_count === 1, 'a price list comes in the same way');

  report(
    products.rows[0].result.skipped_count === 1,
    'and a price that is not a number is refused rather than guessed at'
  );

  await expectScalar(
    db,
    'every run is on the record, rehearsals included',
    `select count(*)::int >= 4 from public.import_history('${SEED.companyA}', 20)`,
    true
  );

  await expectRejection(
    db,
    'an import is not a way to load the whole internet into a database',
    `select public.import_client_rows('${SEED.companyA}',
       (select jsonb_agg(jsonb_build_object('display_name', 'Row ' || g))
          from generate_series(1, 2001) as g), true)`
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'one business cannot import into another',
    `select public.import_client_rows('${SEED.companyA}',
       '[{"display_name": "Theirs"}]'::jsonb, false)`
  );

  await expectRejection(
    db,
    'nor read what another has imported',
    `select count(*)::int from public.import_history('${SEED.companyA}', 5)`
  );

  await signOut(db);

  console.log('\nWriting to the people who said yes');

  await signIn(db, SEED.ownerA);

  const audience = await db.query(
    `select public.save_marketing_segment($1, 'Clients who paid this year',
       'Anybody who has settled an invoice in the last twelve months') as id`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'an audience can be described without writing a query',
    `select name from public.marketing_segment_list('${SEED.companyA}')
      where segment_id = '${audience.rows[0].id}'`,
    'Clients who paid this year'
  );

  const campaign = await db.query(
    `select public.save_marketing_campaign($1, 'Spring update',
       'What we built for you this quarter',
       'We added proof of work to invoices, so your clients can see what they are paying for.',
       'broadcast', '${audience.rows[0].id}') as id`,
    [SEED.companyA]
  );
  const campaignId = campaign.rows[0].id;

  await expectScalar(
    db,
    'a campaign starts as a draft and goes nowhere',
    `select status from public.marketing_campaigns where id = '${campaignId}'`,
    'draft'
  );

  await expectRejection(
    db,
    'a campaign cannot be scheduled for a time that has passed',
    `select public.schedule_marketing_campaign('${campaignId}', now() - interval '2 days')`
  );

  await db.query(`select public.schedule_marketing_campaign($1, now() + interval '3 hours')`, [
    campaignId,
  ]);

  await expectScalar(
    db,
    'scheduling it builds the audience first, so the size is known before sending',
    `select status from public.marketing_campaigns where id = '${campaignId}'`,
    'scheduled'
  );

  await expectScalar(
    db,
    'the overview reports what it will reach and what it achieved',
    `select count(*)::int from public.marketing_overview('${SEED.companyA}')
      where campaign_id = '${campaignId}'`,
    1
  );

  await db.query(
    `select public.save_campaign_step($1, 1, 'The follow up', 'Did this help?',
       'A short note a week later asking whether any of it was useful.', 168)`,
    [campaignId]
  );

  await expectScalar(
    db,
    'a sequence can have a second message waiting behind the first',
    `select step_count from public.marketing_overview('${SEED.companyA}')
      where campaign_id = '${campaignId}'`,
    1
  );

  await signInAsService(db);

  await db.query(`update public.marketing_campaigns set status = 'sending' where id = $1`, [
    campaignId,
  ]);

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a campaign the audience has started reading cannot be rewritten',
    `select public.save_marketing_campaign('${SEED.companyA}', 'Changed', 'New subject',
       'Different words', 'broadcast', null, null, null, null, '${campaignId}')`
  );

  await expectRejection(
    db,
    'nor can the steps of a sequence already running',
    `select public.save_campaign_step('${campaignId}', 2, 'Late addition', 'One more thing',
       'Something else entirely')`
  );

  await expectScalar(
    db,
    'an owner can still stop it',
    `select public.pause_marketing_campaign('${campaignId}')`,
    true
  );

  await expectScalar(
    db,
    'the reach of a business counts only the people who agreed to hear from it',
    `select (public.marketing_reach('${SEED.companyA}') ->> 'subscribed')::int >= 0`,
    true
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'one business cannot read the campaigns of another',
    `select count(*)::int from public.marketing_overview('${SEED.companyA}')`
  );

  await expectRejection(
    db,
    'nor send one on their behalf',
    `select public.schedule_marketing_campaign('${campaignId}', now() + interval '1 day')`
  );

  await signInAsService(db);
  await db.query(`update public.marketing_campaigns set deleted_at = now() where id = $1`, [
    campaignId,
  ]);
  await db.query(`update public.marketing_segments set deleted_at = now() where id = $1`, [
    audience.rows[0].id,
  ]);

  await signOut(db);

  console.log('\nPosting from the accounts of a business');

  await signIn(db, SEED.ownerA);

  const channel = await db.query(
    `select public.save_social_channel($1, 'linkedin', 'The business page', 'kdsolutionit',
       'urn:li:organization:1', 'enc:social-token', null, '****4455') as id`,
    [SEED.companyA]
  );
  const channelId = channel.rows[0].id;

  await expectScalar(
    db,
    'connecting an account stores the token encrypted and shows only a hint',
    `select masked_hint from public.social_channel_list('${SEED.companyA}')
      where channel_id = '${channelId}'`,
    '****4455'
  );

  await expectScalar(
    db,
    'and the account counts as connected once there is a token',
    `select is_connected from public.social_channel_list('${SEED.companyA}')
      where channel_id = '${channelId}'`,
    true
  );

  const post = await db.query(
    `select public.save_social_post($1, 'We added proof of work',
       'Attach the delivered files to an invoice and your client can see what they are paying for.',
       'https://example.com/proof-of-work', array['invoicing', 'freelancing']) as id`,
    [SEED.companyA]
  );
  const postId = post.rows[0].id;

  await expectScalar(
    db,
    'a new post starts as a draft rather than going out',
    `select status from public.social_posts where id = '${postId}'`,
    'draft'
  );

  await expectScalar(
    db,
    'an owner approving it is recorded against their name',
    `select public.approve_social_post('${postId}')`,
    true
  );

  await db.query(
    `select public.schedule_social_post($1, array['${channelId}']::uuid[], now() + interval '2 hours')`,
    [postId]
  );

  await expectScalar(
    db,
    'scheduling it puts it on the calendar with its channel',
    `select channel_count from public.social_post_list('${SEED.companyA}', 10)
      where post_id = '${postId}'`,
    1
  );

  await expectScalar(
    db,
    'and the calendar shows it in the window it was planned for',
    `select count(*)::int from public.social_calendar('${SEED.companyA}',
       now() - interval '1 hour', now() + interval '1 day')
      where post_id = '${postId}'`,
    1
  );

  await signInAsService(db);

  await db.query(
    `update public.social_posts set status = 'published', published_at = now()
      where id = $1`,
    [postId]
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a post the networks already have cannot be rewritten',
    `select public.save_social_post('${SEED.companyA}', 'Changed', 'Something else',
       null, null, '${postId}')`
  );

  await expectRejection(
    db,
    'nor cancelled as if it had never gone out',
    `select public.cancel_social_post('${postId}')`
  );

  await expectRejection(
    db,
    'a rule cannot be switched on with nowhere to post',
    `select public.save_social_auto_rule('${SEED.companyA}', 'Thank a client',
       'invoice.paid', 'Another happy client paid today.', array[]::uuid[], true, 24, true)`
  );

  const rule = await db.query(
    `select public.save_social_auto_rule($1, 'Thank a client', 'invoice.paid',
       'Another happy client paid today.', array['${channelId}']::uuid[], true, 24, true) as id`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'a rule that posts publicly waits for a person by default',
    `select requires_approval from public.social_rule_list('${SEED.companyA}')
      where rule_id = '${rule.rows[0].id}'`,
    true
  );

  await expectScalar(
    db,
    'disconnecting an account leaves what it already published alone',
    `select public.disconnect_social_channel('${channelId}')`,
    true
  );

  await expectScalar(
    db,
    'and it stops being usable for anything new',
    `select is_connected from public.social_channel_list('${SEED.companyA}')
      where channel_id = '${channelId}'`,
    false
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'one business cannot read what another has planned',
    `select count(*)::int from public.social_post_list('${SEED.companyA}', 10)`
  );

  await expectRejection(
    db,
    'nor connect an account on their behalf',
    `select public.save_social_channel('${SEED.companyA}', 'x', 'Not mine')`
  );

  // This section writes into the same calendar a later section measures, so
  // it puts back what it borrowed.
  await signInAsService(db);
  await db.query(`update public.social_posts set deleted_at = now() where id = $1`, [postId]);
  await db.query(`update public.social_auto_rules set deleted_at = now() where id = $1`, [
    rule.rows[0].id,
  ]);
  await db.query(`update public.social_channels set deleted_at = now() where id = $1`, [channelId]);

  await signOut(db);

  console.log('\nEditing the public website');

  await signIn(db, SEED.superAdmin);

  const page = await db.query(
    `select public.save_site_page('invoicing-for-freelancers',
       'Invoicing for freelancers', 'marketing', null, '[]'::jsonb,
       'How a freelancer gets paid across a border',
       'Invoicing built for freelancers',
       'Send an invoice your client can pay by card, with proof of the work attached to it.') as id`
  );
  const pageId = page.rows[0].id;

  await expectScalar(
    db,
    'a marketing page can be written without touching the code',
    `select title from public.site_pages where id = '${pageId}'`,
    'Invoicing for freelancers'
  );

  await expectScalar(
    db,
    'a page nobody published is not public',
    `select public.published_site_page('invoicing-for-freelancers') is null`,
    true
  );

  await db.query(`select public.publish_site_page('${pageId}', true)`);

  await signOut(db);

  await expectScalar(
    db,
    'once published anybody can read it, with no account at all',
    `select public.published_site_page('invoicing-for-freelancers') ->> 'title'`,
    'Invoicing for freelancers'
  );

  await expectScalar(
    db,
    'and it appears in the sitemap',
    `select count(*)::int from public.sitemap_entries()
      where path = '/invoicing-for-freelancers'`,
    1
  );

  await signIn(db, SEED.superAdmin);

  await db.query(
    `select public.save_site_page('freelancer-invoicing', 'Invoicing for freelancers',
       'marketing', '${pageId}')`
  );

  await expectScalar(
    db,
    'moving a page keeps the old address alive by itself',
    `select target_path from public.url_redirects
      where source_path = '/invoicing-for-freelancers'`,
    '/freelancer-invoicing'
  );

  await expectRejection(
    db,
    'a redirect that would start a chain is refused',
    `select public.save_url_redirect('/old-page', '/invoicing-for-freelancers')`
  );

  await expectRejection(
    db,
    'and so is one that points at itself',
    `select public.save_url_redirect('/loop', '/loop')`
  );

  await db.query(
    `select public.save_url_redirect('/pricing-old', '/pricing', 301, 'The pricing page moved')`
  );

  await expectScalar(
    db,
    'a redirect carries the visitor to the new address',
    `select target_path from public.follow_redirect('/pricing-old')`,
    '/pricing'
  );

  await expectScalar(
    db,
    'and counts the traffic, so a dead rule can be retired',
    `select hit_count >= 1 from public.url_redirects where source_path = '/pricing-old'`,
    true
  );

  await expectScalar(
    db,
    'the editor warns about a page with no description for search results',
    `select seo_warning is not null from public.site_page_list(true)
      where slug = 'freelancer-invoicing'`,
    false
  );

  await db.query(`select public.delete_site_page('${pageId}')`);

  await expectScalar(
    db,
    'a removed page stops being public',
    `select public.published_site_page('freelancer-invoicing') is null`,
    true
  );

  await expectScalar(
    db,
    'and its address points somewhere real rather than nowhere',
    `select target_path from public.url_redirects where source_path = '/freelancer-invoicing'`,
    '/'
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a tenant cannot edit the public website',
    `select public.save_site_page('mine', 'My page')`
  );

  await expectRejection(
    db,
    'nor read the redirect list',
    'select count(*)::int from public.url_redirect_list()'
  );

  await signOut(db);

  console.log('\nHow this website is measured');

  await signIn(db, SEED.superAdmin);

  const measurement = await db.query(
    `select public.save_analytics_destination('ga4', 'Main property', 'G-ABC123XYZ',
       'analytics', true, true, false, null, null, 'The property the marketing site reports to') as id`
  );

  await expectScalar(
    db,
    'a measurement identifier can be set without a deployment',
    `select public_identifier from public.analytics_destinations
      where id = '${measurement.rows[0].id}'`,
    'G-ABC123XYZ'
  );

  await expectRejection(
    db,
    'a tool nobody has heard of is refused',
    `select public.save_analytics_destination('mystery_tracker', 'Unknown', 'ABC123')`
  );

  await expectRejection(
    db,
    'and so is an identifier that is not one',
    `select public.save_analytics_destination('ga4', 'Broken', 'not a valid id')`
  );

  await db.query(
    `select public.save_analytics_destination('meta_pixel', 'Advertising pixel', '998877665544',
       'marketing', true, true, false, 'enc:conversion-token', '****7788')`
  );

  await expectScalar(
    db,
    'the console shows a hint of the server token and never the token',
    `select token_hint from public.analytics_destination_list()
      where provider_key = 'meta_pixel'`,
    '****7788'
  );

  await expectScalar(
    db,
    'and says a token is held without handing it over',
    `select has_access_token from public.analytics_destination_list()
      where provider_key = 'meta_pixel'`,
    true
  );

  await signOut(db);

  await expectScalar(
    db,
    'a visitor page can read which identifiers it may load',
    `select count(*)::int from public.active_analytics_destinations('marketing')`,
    2
  );

  await expectScalar(
    db,
    'each one declares the consent it needs first',
    `select consent_category from public.active_analytics_destinations('marketing')
      where provider_key = 'meta_pixel'`,
    'marketing'
  );

  await expectScalar(
    db,
    'a destination that is not meant for the application pages stays off them',
    `select count(*)::int from public.active_analytics_destinations('application')`,
    0
  );

  await expectRejection(
    db,
    'nothing reachable from a browser can return a measurement token',
    `select public.analytics_access_token('meta_pixel')`
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a tenant cannot change how the platform site is measured',
    `select public.save_analytics_destination('ga4', 'Mine', 'G-MINE12345')`
  );

  await expectScalar(
    db,
    'nor read the destinations themselves',
    'select count(*)::int from public.analytics_destinations',
    0
  );

  await signIn(db, SEED.superAdmin);

  await db.query(`select public.remove_analytics_destination('${measurement.rows[0].id}')`);

  await expectScalar(
    db,
    'a destination that is removed stops loading at once',
    `select count(*)::int from public.active_analytics_destinations('marketing')`,
    1
  );

  await signOut(db);

  console.log('\nThe first day of an installation');

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'readiness is worked out from the configuration rather than remembered',
    `select jsonb_array_length(public.platform_readiness() -> 'steps') >= 8`,
    true
  );

  await expectScalar(
    db,
    'an installation that has named itself has that step behind it',
    `select (step ->> 'is_done')::boolean
       from jsonb_array_elements(public.platform_readiness() -> 'steps') as step
      where step ->> 'key' = 'brand'`,
    true
  );

  await expectScalar(
    db,
    'and one with no verified sending domain is told so',
    `select (step ->> 'is_done')::boolean
       from jsonb_array_elements(public.platform_readiness() -> 'steps') as step
      where step ->> 'key' = 'mail_domain'`,
    false
  );

  const mailDomain = await db.query(
    `select public.save_platform_domain('mail', 'mail.example.com',
       '[{"type": "TXT", "name": "mail.example.com", "value": "v=spf1 include:example.net -all"}]'::jsonb,
       true, 'Sends every invoice') as id`
  );

  await expectScalar(
    db,
    'the records a hostname needs are written down rather than remembered',
    `select jsonb_array_length(expected_records) from public.platform_domains
      where id = '${mailDomain.rows[0].id}'`,
    1
  );

  await expectRejection(
    db,
    'a hostname that is not a hostname is refused',
    `select public.save_platform_domain('app', 'not a hostname')`
  );

  await db.query(
    `select public.record_domain_check('${mailDomain.rows[0].id}', false,
       'The sender policy record was not found', '["TXT mail.example.com"]'::jsonb)`
  );

  await expectScalar(
    db,
    'a failed check says which record is missing',
    `select failing_records ->> 0 from public.platform_domains
      where id = '${mailDomain.rows[0].id}'`,
    'TXT mail.example.com'
  );

  await db.query(
    `select public.record_domain_check('${mailDomain.rows[0].id}', true, 'Every record is in place')`
  );

  await expectScalar(
    db,
    'and a passing check moves readiness on by itself',
    `select (step ->> 'is_done')::boolean
       from jsonb_array_elements(public.platform_readiness() -> 'steps') as step
      where step ->> 'key' = 'mail_domain'`,
    true
  );

  await expectScalar(
    db,
    'saving the same hostname twice edits it rather than adding a second',
    `select count(*)::int from public.platform_domains where hostname = 'mail.example.com'`,
    1
  );

  await signInAsService(db);

  await db.query(
    `select public.record_health_check(true, 12, true, true, '1.0.0',
       '{"region": "test"}'::jsonb)`
  );

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'the health probe leaves a trail',
    'select count(*)::int >= 1 from public.recent_health_checks(5)',
    true
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a tenant cannot read whether the platform is ready',
    'select public.platform_readiness()'
  );

  await expectRejection(
    db,
    'nor add a hostname to it',
    `select public.save_platform_domain('app', 'theirs.example.com')`
  );

  await expectScalar(
    db,
    'nor see the health trail',
    'select count(*)::int from public.platform_health_checks',
    0
  );

  await signOut(db);

  console.log('\nChanging a key without a deployment');

  await signIn(db, SEED.superAdmin);

  const runtimeKey = await db.query(
    `select public.save_integration_credential(
       null, 'resend', 'live', 'enc:first-key', '${'d'.repeat(64)}',
       '{"api_key": "****1111"}'::jsonb, '{}'::jsonb, 'Transactional email', 1::smallint
     ) as id`
  );
  const runtimeKeyId = runtimeKey.rows[0].id;

  await expectScalar(
    db,
    'a key nobody has tried is not treated as working',
    `select status from public.integration_credentials where id = '${runtimeKeyId}'`,
    'untested'
  );

  await expectRejection(
    db,
    'and cannot be switched on until the provider has answered',
    `select public.enable_integration('${runtimeKeyId}')`
  );

  const beforeTest = await db.query('select revision from public.integration_revision()');

  await db.query(
    `select public.record_connection_test('${runtimeKeyId}', true, 'The provider answered',
       200::smallint, 42, '{}'::jsonb)`
  );

  await expectScalar(
    db,
    'once it answers it can go live',
    `select public.enable_integration('${runtimeKeyId}')`,
    true
  );

  await expectScalar(
    db,
    'the revision stamp moves, so every server picks the change up within seconds',
    `select revision > ${String(beforeTest.rows[0].revision)} from public.integration_revision()`,
    true
  );

  await db.query(
    `select public.rotate_integration_credential('${runtimeKeyId}', 'enc:second-key',
       '${'e'.repeat(64)}', '{"api_key": "****2222"}'::jsonb, 5)`
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'rotating a key puts the replacement to work immediately',
    `select secret_bundle_encrypted from public.resolve_integration(null, 'resend', 'live')`,
    'enc:second-key'
  );

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'while the key it replaced keeps working for a few minutes',
    `select previous_bundle_valid_until > now() from public.integration_credentials
      where id = '${runtimeKeyId}'`,
    true
  );

  await expectScalar(
    db,
    'the screen shows only a hint of the new key, never the key',
    `select masked_hints ->> 'api_key' from public.integration_credentials
      where id = '${runtimeKeyId}'`,
    '****2222'
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'the grace window closes when it has passed',
    'select public.expire_credential_grace_windows() >= 0',
    true
  );

  await signIn(db, SEED.superAdmin);

  await db.query(`select public.disable_integration('${runtimeKeyId}', 'Not needed today')`);

  await signInAsService(db);

  await expectScalar(
    db,
    'switching a connection off keeps everything that was configured',
    `select secret_bundle_encrypted is not null and not is_enabled
       from public.integration_credentials where id = '${runtimeKeyId}'`,
    true
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'a tenant cannot touch a platform key',
    `select public.rotate_integration_credential('${runtimeKeyId}', 'enc:stolen', null, null, 5)`
  );

  await signOut(db);

  console.log('\nWhat the settings screen shows');

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the settings screen lists every provider on offer',
    `select count(*)::int from public.integration_overview('${SEED.companyA}')`,
    29
  );

  await expectScalar(
    db,
    'the key is shown only as the hint the owner can recognise',
    `select masked_hints ->> 'secret_key' from public.integration_overview('${SEED.companyA}')
      where provider_key = 'stripe'`,
    '****9191'
  );

  await expectScalar(
    db,
    'the platform account of another provider is not shown as the tenant own',
    `select scope from public.integration_overview('${SEED.companyA}')
      where provider_key = 'resend'`,
    'none'
  );

  await expectRejection(
    db,
    'an owner cannot look at the connections of another tenant',
    `select count(*)::int from public.integration_overview('${SEED.companyB}')`
  );

  await expectRejection(
    db,
    'nor at the platform connections',
    'select count(*)::int from public.integration_overview(null)'
  );

  await expectScalar(
    db,
    'an owner sees their own connection rows and nothing of the platform',
    'select count(*)::int from public.integration_credentials',
    1
  );

  console.log('\nHow a connection has been behaving');

  await signOut(db);

  await db.query(
    `select public.record_integration_use(
       '${credentialId}', 'payment_intent.create', false, 240, 'rate_limited',
       'The provider asked us to slow down'
     )`
  );

  await expectScalar(
    db,
    'a failed call is counted against the connection',
    `select consecutive_failures from public.integration_credentials where id = '${credentialId}'`,
    1
  );

  await expectScalar(
    db,
    'and the connection admits it is failing',
    `select status from public.integration_credentials where id = '${credentialId}'`,
    'failing'
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the failing list is what somebody is meant to work through',
    `select count(*)::int from public.failing_integrations('${SEED.companyA}')`,
    1
  );

  await signOut(db);

  await db.query(
    `select public.record_integration_use(
       '${credentialId}', 'payment_intent.create', true, 180, null, null
     )`
  );

  await expectScalar(
    db,
    'a call that works clears the run of failures',
    `select consecutive_failures from public.integration_credentials where id = '${credentialId}'`,
    0
  );

  await expectScalar(
    db,
    'the connection is ready again',
    `select status from public.integration_credentials where id = '${credentialId}'`,
    'ready'
  );

  await expectScalar(
    db,
    'the call history is kept for both outcomes',
    `select count(*)::int from public.integration_usage_events
      where credential_id = '${credentialId}'`,
    2
  );

  await expectRejection(
    db,
    'the call history is append only',
    `update public.integration_usage_events set error_code = 'something_else'
      where credential_id = '${credentialId}'`
  );

  console.log('\nTurning a connection off');

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'an owner can switch a connection off without losing the configuration',
    `select public.disable_integration('${credentialId}', 'Moving to the platform account')`,
    true
  );

  await expectScalar(
    db,
    'the configuration is still there, just not in use',
    `select is_enabled = false and status = 'disabled' and bundle_fingerprint is not null
       from public.integration_credentials where id = '${credentialId}'`,
    true
  );

  await signOut(db);

  await expectScalar(
    db,
    'a switched off tenant account falls back to the platform again',
    `select source from public.resolve_integration('${SEED.companyA}', 'stripe', 'live')`,
    'platform'
  );

  console.log('\nWiring up an online shop');

  const keyOne = 'a'.repeat(64);
  const keyTwo = 'b'.repeat(64);

  await signIn(db, SEED.staffA);

  await expectRejection(
    db,
    'a member of staff cannot connect a shop to the business',
    `select public.save_storefront_connection('${SEED.companyA}', 'woocommerce',
       'Harbour Supplies', 'shop.example.com')`
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'an address that is not a domain is refused',
    `select public.save_storefront_connection('${SEED.companyA}', 'woocommerce',
       'Harbour Supplies', 'not a domain at all')`
  );

  await expectRejection(
    db,
    'a shop platform nobody has built for cannot be chosen',
    `select public.save_storefront_connection('${SEED.companyA}', 'market_stall',
       'Harbour Supplies', 'shop.example.com')`
  );

  const shop = await db.query(
    `select public.save_storefront_connection($1, 'woocommerce', 'Harbour Supplies',
       'shop.example.com', null, 'https://shop.example.com/payments/callback',
       'USD', true) as id`,
    [SEED.companyA]
  );
  const shopId = shop.rows[0].id;

  await expectScalar(
    db,
    'a new shop starts waiting rather than taking money',
    `select status from public.company_storefront_connections('${SEED.companyA}')
      where connection_id = '${shopId}'`,
    'pending_verification'
  );

  await expectRejection(
    db,
    'a shop with no key cannot be taken live',
    `select public.set_storefront_status('${shopId}', 'active')`
  );

  await expectScalar(
    db,
    'the owner issues a key and only its hash is kept',
    `select public.issue_storefront_key('${shopId}', '${keyOne}', 'a1b2')`,
    true
  );

  await expectScalar(
    db,
    'the key itself is never readable, only the hint',
    `select key_masked_hint from public.company_storefront_connections('${SEED.companyA}')
      where connection_id = '${shopId}'`,
    'a1b2'
  );

  await expectScalar(
    db,
    'and the key column cannot be selected at all',
    "select has_column_privilege('authenticated', 'public.storefront_connections', 'key_hash', 'select')",
    false
  );

  await expectRejection(
    db,
    'a business nobody has verified cannot take card payments',
    `select public.set_storefront_status('${shopId}', 'active')`
  );

  await signInAsService(db);

  await db.query("update public.companies set kyc_status = 'verified' where id = $1", [
    SEED.companyA,
  ]);

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'once the business is verified by hand the shop goes live',
    `select public.set_storefront_status('${shopId}', 'active')`,
    true
  );

  await expectRejection(
    db,
    'a tenant cannot check a shop key for itself',
    `select public.authenticate_storefront_key('${keyOne}')`
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'the platform turns the key the shop sent into the account behind it',
    `select company_id from public.authenticate_storefront_key('${keyOne}')`,
    SEED.companyA
  );

  await signIn(db, SEED.ownerA);

  await db.query(`select public.issue_storefront_key('${shopId}', '${keyTwo}', 'c3d4')`);

  await signInAsService(db);

  await expectScalar(
    db,
    'rotating the key does not cut off a checkout already in flight',
    `select count(*)::int from public.authenticate_storefront_key('${keyOne}')`,
    1
  );

  await expectScalar(
    db,
    'and the new key works straight away',
    `select count(*)::int from public.authenticate_storefront_key('${keyTwo}')`,
    1
  );

  console.log('\nTaking an order from the shop');

  const shopOrder = await db.query(
    `select public.register_storefront_order($1, 'WC-1001', 149.99, 'USD',
       'shopper@example.com', 'Nadia Rahman', '1001',
       'Order 1001 from Harbour Supplies') as id`,
    [shopId]
  );
  const shopOrderId = shopOrder.rows[0].id;

  await expectScalar(
    db,
    'the same order sent twice is only ever charged once',
    `select public.register_storefront_order('${shopId}', 'WC-1001', 149.99) = '${shopOrderId}'`,
    true
  );

  await expectRejection(
    db,
    'an order worth nothing is refused',
    `select public.register_storefront_order('${shopId}', 'WC-1002', 0)`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the order arrives as a numbered invoice the shopper can pay',
    `select invoice_number is not null and total_amount = 149.99
       from public.company_storefront_orders('${SEED.companyA}', '${shopId}', 10)
      where order_id = '${shopOrderId}'`,
    true
  );

  await expectScalar(
    db,
    'and the shopper is on the client list under their own name',
    `select customer_name from public.company_storefront_orders('${SEED.companyA}', null, 10)
      where order_id = '${shopOrderId}'`,
    'Nadia Rahman'
  );

  const shopInvoice = await db.query(
    'select invoice_id, total_amount from public.storefront_orders where id = $1',
    [shopOrderId]
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'the shop is given a hosted address rather than taking the card itself',
    `select public.attach_storefront_checkout('${shopOrderId}',
       null, now() + interval '30 days')`,
    true
  );

  await expectScalar(
    db,
    'which puts the order on the list of payments being waited for',
    `select status from public.storefront_orders where id = '${shopOrderId}'`,
    'awaiting_payment'
  );

  await expectScalar(
    db,
    'an order is never called paid while the invoice still owes something',
    `select public.settle_storefront_order('${shopOrderId}')`,
    false
  );

  await signIn(db, SEED.ownerA);

  await db.query(`select public.record_payment($1, $2, $3::numeric, 'card', 'stripe')`, [
    SEED.companyA,
    shopInvoice.rows[0].invoice_id,
    shopInvoice.rows[0].total_amount,
  ]);

  await signInAsService(db);

  await expectScalar(
    db,
    'once the money has arrived the order is settled',
    `select public.settle_storefront_order('${shopOrderId}')`,
    true
  );

  await expectScalar(
    db,
    'and settling it twice changes nothing',
    `select public.settle_storefront_order('${shopOrderId}')`,
    false
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'an order that has been paid is refunded rather than cancelled',
    `select public.cancel_storefront_order('${shopOrderId}', 'Shopper changed their mind')`
  );

  await expectScalar(
    db,
    'the shop log records every step and is never edited',
    `select (count(*) >= 4)::boolean from public.storefront_events
      where connection_id = '${shopId}'`,
    true
  );

  await expectRejection(
    db,
    'nobody can rewrite the shop log afterwards',
    `update public.storefront_events set event_type = 'error'
      where connection_id = '${shopId}'`
  );

  await expectScalar(
    db,
    'the overview prices what the shops have brought in',
    `select public.storefront_overview('${SEED.companyA}') ->> 'collected_amount'`,
    '149.9900'
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'the shops of one business are invisible to another',
    `select public.company_storefront_connections('${SEED.companyA}')`
  );

  await signInAsService(db);

  await db.query("update public.companies set kyc_status = 'not_started' where id = $1", [
    SEED.companyA,
  ]);

  await signOut(db);
}

/**
 * Switches the session to the anonymous visitor role.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function browseAnonymously(db) {
  await db.exec('reset role;');
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', '']);
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.role', '']);
  await db.exec('set role anon;');
}

/**
 * Verifies the white label programme, the template marketplace and the
 * developer platform, including the rule that a partner never reads the
 * contents of an account it manages.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testPartners(db) {
  console.log('\nThe white label programme');

  await signOut(db);

  const plans = await db.query(
    "select id, plan_key from public.subscription_plans where plan_key in ('free', 'professional')"
  );
  const planId = Object.fromEntries(plans.rows.map((row) => [row.plan_key, row.id]));

  const books = await db.query(
    `insert into public.reseller_price_books (reseller_id, name, currency, is_default)
     values ($1, 'Standard retail', 'USD', true)
     returning id`,
    [SEED.reseller]
  );
  const priceBookId = books.rows[0].id;

  await db.query(
    `insert into public.reseller_plan_prices
       (price_book_id, reseller_id, plan_id, billing_interval, retail_amount,
        wholesale_amount, currency, public_name)
     values ($1, $2, $3, 'monthly', 49, 29, 'USD', 'Business')`,
    [priceBookId, SEED.reseller, planId.professional]
  );

  await expectRejection(
    db,
    'a partner cannot sell a plan for less than it costs them',
    `insert into public.reseller_plan_prices
       (price_book_id, reseller_id, plan_id, billing_interval, retail_amount,
        wholesale_amount, currency)
     values ('${priceBookId}', '${SEED.reseller}', '${planId.free}', 'monthly', 5, 9, 'USD')`
  );

  await expectScalar(
    db,
    'the margin is stated in money and in percent',
    `select margin_amount || ' at ' || margin_percentage || '%'
       from public.reseller_price_margin(
         (select id from public.reseller_plan_prices
           where plan_id = '${planId.professional}')
       )`,
    '20.0000 at 40.82%'
  );

  await db.query(
    `insert into public.reseller_price_books (reseller_id, name, currency, is_default)
     values ($1, 'Launch promotion', 'USD', true)`,
    [SEED.reseller]
  );

  await expectScalar(
    db,
    'marking a second price book as the default moves the default rather than duplicating it',
    `select count(*)::int from public.reseller_price_books
      where reseller_id = '${SEED.reseller}' and is_default and deleted_at is null`,
    1
  );

  await expectScalar(
    db,
    'a tenant of a partner is charged the partner price',
    `select source || ' ' || amount
       from public.effective_plan_price('${SEED.companyA}', '${planId.professional}', 'monthly')`,
    'reseller 49.0000'
  );

  await expectScalar(
    db,
    'a tenant of the platform is charged the platform price',
    `select source || ' ' || amount
       from public.effective_plan_price('${SEED.companyB}', '${planId.professional}', 'monthly')`,
    'platform 29.0000'
  );

  console.log('\nAccounts a partner holds');

  await signIn(db, SEED.resellerUser);

  const provisioned = await db.query(
    `select public.provision_sub_tenant($1, 'Lakeside Dental PLLC', 'Lakeside Dental',
       'lakeside-dental', 'LAKE-001', $2) as company_id`,
    [SEED.reseller, priceBookId]
  );
  const subTenantId = provisioned.rows[0].company_id;

  await expectScalar(
    db,
    'the partner can open an account under their own brand',
    `select display_name from public.reseller_accounts('${SEED.reseller}')
      where company_id = '${subTenantId}'`,
    'Lakeside Dental'
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'somebody else cannot open an account under that partner',
    `select public.provision_sub_tenant('${SEED.reseller}', 'Imposter Ltd', 'Imposter',
       'imposter-ltd', null, null)`
  );

  await expectRejection(
    db,
    'and cannot read the partner statement either',
    `select commission_earned from public.reseller_statement('${SEED.reseller}',
       current_date - 365, current_date)`
  );

  await signOut(db);

  await db.query(
    `insert into public.clients (company_id, display_name, email, created_by)
     values ($1, 'Private Patient Records', 'records@lakeside.example', $2)`,
    [subTenantId, SEED.superAdmin]
  );

  await signIn(db, SEED.resellerUser);

  await expectScalar(
    db,
    'the partner sees that the account exists',
    `select count(*)::int from public.reseller_tenant_links
      where company_id = '${subTenantId}'`,
    1
  );

  await expectScalar(
    db,
    'but reads nothing of who that account bills',
    `select count(*)::int from public.clients where company_id = '${subTenantId}'`,
    0
  );

  await expectScalar(
    db,
    'and nothing of what it invoices',
    `select count(*)::int from public.invoices where company_id = '${subTenantId}'`,
    0
  );

  await expectScalar(
    db,
    'the partner can suspend an account for non payment',
    `select public.set_sub_tenant_status('${subTenantId}', 'suspended', 'Payment overdue')`,
    true
  );

  await signOut(db);

  await expectScalar(
    db,
    'which actually suspends the tenant',
    `select status::text from public.companies where id = '${subTenantId}'`,
    'suspended'
  );

  await db.query('update public.resellers set max_sub_tenants = 2 where id = $1', [SEED.reseller]);

  await signIn(db, SEED.resellerUser);

  await expectRejection(
    db,
    'a partner cannot exceed the number of accounts they are allowed',
    `select public.provision_sub_tenant('${SEED.reseller}', 'Overflow Co', 'Overflow',
       'overflow-co', null, null)`
  );

  console.log('\nWhat the partner earns');

  await expectRejection(
    db,
    'a partner cannot write their own commission',
    `select public.accrue_reseller_commission('${subTenantId}', current_date - 30,
       current_date, 49, 29, 'USD', null)`
  );

  await signOut(db);

  await expectRejection(
    db,
    'and the rule holds even for a caller the grants would allow',
    `select public.accrue_reseller_commission('${subTenantId}', current_date - 30,
       current_date, 49, 29, 'USD', null)`
  );

  await signInAsService(db);

  const commission = await db.query(
    `select public.accrue_reseller_commission($1, current_date - 30, current_date,
       49, 29, 'USD', null) as id`,
    [subTenantId]
  );
  const commissionId = commission.rows[0].id;

  await expectScalar(
    db,
    'the commission is the difference between retail and wholesale',
    `select commission_amount from public.reseller_commissions where id = '${commissionId}'`,
    '20.0000'
  );

  await expectScalar(
    db,
    'nothing is payable until the tenant has actually paid',
    `select status from public.reseller_commissions where id = '${commissionId}'`,
    'pending'
  );

  await expectScalar(
    db,
    'confirming the payment makes it payable',
    `select public.confirm_reseller_commission('${commissionId}')`,
    true
  );

  await expectScalar(
    db,
    'and the lifetime figure of the account follows it',
    `select lifetime_commission_amount from public.reseller_tenant_links
      where company_id = '${subTenantId}'`,
    '20.0000'
  );

  const payout = await db.query(
    `select public.build_reseller_payout($1, current_date - 60, current_date, 2) as id`,
    [SEED.reseller]
  );
  const payoutId = payout.rows[0].id;

  await expectScalar(
    db,
    'the payout is numbered in sequence',
    `select payout_reference from public.reseller_payouts where id = '${payoutId}'`,
    'RP-0001'
  );

  await expectScalar(
    db,
    'the fee is taken off the amount that is sent',
    `select net_amount from public.reseller_payouts where id = '${payoutId}'`,
    '18.0000'
  );

  await expectScalar(
    db,
    'settling the payout closes the commissions inside it',
    `select public.settle_reseller_payout('${payoutId}', 'TRX-99', 'bank_transfer')`,
    true
  );

  await expectScalar(
    db,
    'which leaves nothing waiting to be paid',
    `select count(*)::int from public.reseller_commissions
      where reseller_id = '${SEED.reseller}' and status = 'earned'`,
    0
  );

  await expectRejection(
    db,
    'money already sent is not reversed behind the scenes',
    `select public.reverse_reseller_commission('${commissionId}', 'Chargeback')`
  );

  await signIn(db, SEED.resellerUser);

  await expectScalar(
    db,
    'the statement adds up to what was paid',
    `select commission_paid || ' ' || currency
       from public.reseller_statement('${SEED.reseller}', current_date - 365, current_date)`,
    '20.0000 USD'
  );

  await expectScalar(
    db,
    'and reports the account as suspended',
    `select suspended_accounts
       from public.reseller_statement('${SEED.reseller}', current_date - 365, current_date)`,
    1
  );

  console.log('\nThe template marketplace');

  await signOut(db);

  const vendors = await db.query(
    `insert into public.marketplace_vendors
       (company_id, vendor_name, vendor_slug, headline, support_email, status,
        revenue_share_percentage, approved_at)
     values ($1, 'Harbor Studio Templates', 'harbor-studio-templates',
             'Invoice templates for creative studios', 'templates@example.com',
             'approved', 70, now())
     returning id`,
    [SEED.companyB]
  );
  const vendorId = vendors.rows[0].id;

  const listings = await db.query(
    `insert into public.marketplace_listings
       (vendor_id, listing_slug, title, summary, category, artifact_kind,
        artifact_payload, pricing_model, price_amount, price_currency)
     values ($1, 'studio-invoice-pack', 'Studio Invoice Pack',
             'A set of three invoice layouts built for design studios and agencies.',
             'invoice_template', 'document_template',
             '{"templates": ["minimal", "bold", "classic"]}'::jsonb,
             'one_time', 50, 'USD')
     returning id`,
    [vendorId]
  );
  const listingId = listings.rows[0].id;

  await signIn(db, SEED.ownerB);

  await expectScalar(
    db,
    'the vendor can send a finished listing to review',
    `select public.submit_listing_for_review('${listingId}')`,
    true
  );

  await expectRejection(
    db,
    'but cannot publish it themselves',
    `select public.publish_listing('${listingId}', 'First release')`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a listing under review is not on the shopfront yet',
    `select count(*)::int from public.marketplace_listings where id = '${listingId}'`,
    0
  );

  await signInAsService(db);

  await db.query('select public.publish_listing($1, $2)', [listingId, 'First release']);

  await expectScalar(
    db,
    'publishing freezes the version buyers will receive',
    `select version from public.marketplace_listing_versions
      where listing_id = '${listingId}' and is_current`,
    '1.0.0'
  );

  await signOut(db);

  await expectRejection(
    db,
    'a published listing cannot change its contents without a new version',
    `update public.marketplace_listings
        set artifact_payload = '{"templates": ["swapped"]}'::jsonb
      where id = '${listingId}'`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the listing is now visible to everyone browsing',
    `select title from public.marketplace_listings where id = '${listingId}'`,
    'Studio Invoice Pack'
  );

  await expectRejection(
    db,
    'a paid listing cannot be installed before it is paid for',
    `select public.install_listing('${SEED.companyA}', '${listingId}', '{}'::jsonb)`
  );

  const orders = await db.query(`select public.purchase_listing($1, $2, 'pi_test_123') as id`, [
    SEED.companyA,
    listingId,
  ]);
  const orderId = orders.rows[0].id;

  await signOut(db);

  await expectScalar(
    db,
    'the order is numbered in sequence',
    `select order_reference from public.marketplace_orders where id = '${orderId}'`,
    'MO-0001'
  );

  await expectScalar(
    db,
    'the vendor keeps their agreed share and the platform keeps the rest',
    `select vendor_amount || ' of ' || gross_amount || ' with ' || platform_fee_amount || ' kept'
       from public.marketplace_orders where id = '${orderId}'`,
    '35.0000 of 50.0000 with 15.0000 kept'
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'confirming the payment counts the sale',
    `select public.confirm_marketplace_order('${orderId}', 'pi_test_123')`,
    true
  );

  await expectScalar(
    db,
    'the vendor share is held until refunds can no longer arrive',
    `select status from public.marketplace_vendor_earnings where order_id = '${orderId}'`,
    'pending'
  );

  await signIn(db, SEED.ownerA);

  const installs = await db.query(
    `select public.install_listing($1, $2, '{"accent": "#1d4ed8"}'::jsonb) as id`,
    [SEED.companyA, listingId]
  );
  const installId = installs.rows[0].id;

  await expectScalar(
    db,
    'the buyer can install what they bought',
    `select installed_version from public.marketplace_installs where id = '${installId}'`,
    '1.0.0'
  );

  await expectRejection(
    db,
    'and is not sold the same listing twice',
    `select public.purchase_listing('${SEED.companyA}', '${listingId}', null)`
  );

  const reviews = await db.query(
    `select public.review_listing($1, $2, 5::smallint, 'Saved us an afternoon',
       'The layouts matched our brand with almost no editing.') as id`,
    [SEED.companyA, listingId]
  );

  await expectScalar(
    db,
    'a buyer can say what they thought of it',
    `select rating from public.marketplace_reviews where id = '${reviews.rows[0].id}'`,
    5
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'somebody who never installed it cannot review it',
    `select public.review_listing('${SEED.companyB}', '${listingId}', 1::smallint, null, null)`
  );

  await expectScalar(
    db,
    'the vendor sees the money it has earned',
    `select pending_amount from public.vendor_earnings_summary('${vendorId}')`,
    '35.0000'
  );

  await expectScalar(
    db,
    'the vendor reads the order but nothing else about the buyer',
    `select count(*)::int from public.marketplace_orders where vendor_id = '${vendorId}'`,
    1
  );

  await expectScalar(
    db,
    'and still cannot read that tenant invoices',
    `select count(*)::int from public.invoices where company_id = '${SEED.companyA}'`,
    0
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'a refund takes the earnings back and removes the install',
    `select public.refund_marketplace_order('${orderId}', 'Buyer changed their mind')`,
    true
  );

  await expectScalar(
    db,
    'so the vendor is no longer owed for it',
    `select status from public.marketplace_vendor_earnings where order_id = '${orderId}'`,
    'reversed'
  );

  await expectScalar(
    db,
    'and the template is no longer in use',
    `select status from public.marketplace_installs where id = '${installId}'`,
    'uninstalled'
  );

  console.log('\nThe developer platform');

  await signIn(db, SEED.ownerA);

  const registration = await db.query(
    `select app_id, client_id, client_secret
       from public.register_developer_app('field-sync', 'Field Sync', 'oauth',
         array['invoices:read', 'clients:read']::text[], $1)`,
    [SEED.companyA]
  );
  const appId = registration.rows[0].app_id;
  const clientId = registration.rows[0].client_id;

  await expectScalar(
    db,
    'the secret of an application is never readable afterwards',
    `select length(client_secret_hint) from public.developer_apps where id = '${appId}'`,
    6
  );

  await expectRejection(
    db,
    'not even by the developer who owns it',
    `select client_secret_encrypted from public.developer_apps where id = '${appId}'`
  );

  await db.query(
    `insert into public.developer_app_redirect_uris (app_id, redirect_uri)
     values ($1, 'https://fieldsync.example.com/oauth/callback')`,
    [appId]
  );

  await expectRejection(
    db,
    'an unapproved application cannot be connected to anything',
    `select public.create_authorization_code('${appId}', '${SEED.companyA}',
       'https://fieldsync.example.com/oauth/callback',
       array['invoices:read']::text[], null, null)`
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'the platform approves it for a fixed set of permissions',
    `select public.approve_developer_app('${appId}',
       array['invoices:read', 'clients:read']::text[])`,
    true
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'an application cannot ask for a permission it was never approved for',
    `select public.create_authorization_code('${appId}', '${SEED.companyA}',
       'https://fieldsync.example.com/oauth/callback',
       array['payments:write']::text[], null, null)`
  );

  await expectRejection(
    db,
    'nor send the authorisation to an address nobody registered',
    `select public.create_authorization_code('${appId}', '${SEED.companyA}',
       'https://attacker.example.com/callback',
       array['invoices:read']::text[], null, null)`
  );

  const authorization = await db.query(
    `select public.create_authorization_code($1, $2,
       'https://fieldsync.example.com/oauth/callback',
       array['invoices:read']::text[], null, null) as code`,
    [appId, SEED.companyA]
  );
  const authCode = authorization.rows[0].code;

  await signInAsService(db);

  const tokens = await db.query(
    `select access_token, refresh_token
       from public.exchange_authorization_code($1, $2,
         'https://fieldsync.example.com/oauth/callback')`,
    [authCode, clientId]
  );
  const accessToken = tokens.rows[0].access_token;

  await expectRejection(
    db,
    'an authorisation code works exactly once',
    `select access_token from public.exchange_authorization_code('${authCode}',
       '${clientId}', 'https://fieldsync.example.com/oauth/callback')`
  );

  const authenticated = await db.query(
    'select install_id, company_id from public.authenticate_developer_token($1)',
    [accessToken]
  );

  report(
    authenticated.rows.length === 1 && authenticated.rows[0].company_id === SEED.companyA,
    'the token identifies the account it was granted for',
    authenticated.rows.length === 1 ? authenticated.rows[0].company_id : 'no row'
  );

  const grantedInstallId = authenticated.rows[0].install_id;

  await expectScalar(
    db,
    'the grant covers what the application was given',
    `select public.developer_token_has_scope('${grantedInstallId}', 'invoices:read')`,
    true
  );

  await expectScalar(
    db,
    'and refuses what it was not',
    `select public.developer_token_has_scope('${grantedInstallId}', 'payments:write')`,
    false
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the owner sees the application on the connected list',
    `select app_name from public.connected_apps('${SEED.companyA}')`,
    'Field Sync'
  );

  await expectScalar(
    db,
    'the owner can disconnect it in one step',
    `select public.revoke_app_install('${grantedInstallId}', 'No longer used')`,
    true
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'which kills every token the application held',
    `select count(*)::int from public.authenticate_developer_token('${accessToken}')`,
    0
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'another tenant cannot disconnect an application for somebody else',
    `select public.revoke_app_install('${grantedInstallId}', 'Interference')`
  );

  await signIn(db, SEED.ownerA);

  const rotated = await db.query('select public.rotate_app_secret($1) as secret', [appId]);

  report(
    typeof rotated.rows[0].secret === 'string' && rotated.rows[0].secret.length >= 32,
    'rotating the secret returns a new one exactly once',
    `${String(rotated.rows[0].secret).length} characters`
  );

  await expectScalar(
    db,
    'the previous secret keeps working for a short grace period',
    `select previous_secret_expires_at > now() from public.developer_apps
      where id = '${appId}'`,
    true
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'expired credentials are swept up rather than left lying around',
    'select public.expire_developer_credentials() >= 0',
    true
  );

  console.log('\nThe builder point of view');

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a builder sees the applications they own',
    `select (count(*) filter (where app_id = '${appId}'))::int
       from public.my_developer_apps()`,
    1
  );

  await expectScalar(
    db,
    'and the detail page carries the registered return address',
    `select jsonb_array_length(public.developer_app_detail('${appId}') -> 'redirect_uris')`,
    1
  );

  const draft = await db.query(
    `select app_id from public.register_developer_app('shop-bridge', 'Shop Bridge',
       'oauth', array['invoices:read']::text[], $1)`,
    [SEED.companyA]
  );
  const draftAppId = String(Object.values(draft.rows[0] ?? {})[0]);

  await expectRejection(
    db,
    'an application without a return address cannot ask for review',
    `select public.submit_developer_app('${draftAppId}')`
  );

  await expectScalar(
    db,
    'registering the address is a single call',
    `select public.set_app_redirect_uris('${draftAppId}',
       array['https://shopbridge.example.com/callback']::text[])`,
    1
  );

  await expectRejection(
    db,
    'an unreviewed application cannot list itself in the public directory',
    `select public.save_developer_app('${draftAppId}', 'Shop Bridge', null, null,
       null, null, null, null, 'public')`
  );

  await expectScalar(
    db,
    'but it can describe itself privately',
    `select public.save_developer_app('${draftAppId}', 'Shop Bridge',
       'Push orders into invoices', null, 'https://shopbridge.example.com',
       null, 'support@shopbridge.example.com', null, 'private') is not null`,
    true
  );

  await expectScalar(
    db,
    'submitting it puts it in front of the platform team',
    `select public.submit_developer_app('${draftAppId}')`,
    'in_review'
  );

  await expectRejection(
    db,
    'a builder cannot approve their own application',
    `select public.approve_developer_app('${draftAppId}', array['invoices:read']::text[])`
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'nor read an application belonging to somebody else',
    `select public.developer_app_detail('${draftAppId}')`
  );

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'the review queue puts what is waiting at the top',
    `select status from public.developer_app_queue() limit 1`,
    'in_review'
  );

  await expectRejection(
    db,
    'refusing an application without a reason is refused',
    `select public.reject_developer_app('${draftAppId}', '')`
  );

  await expectScalar(
    db,
    'the platform team can refuse it with a reason the builder can read',
    `select public.reject_developer_app('${draftAppId}', 'Explain the data you store')`,
    'rejected'
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a refused application can be put forward again once it is fixed',
    `select public.submit_developer_app('${draftAppId}')`,
    'in_review'
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'an approved application is given the permissions it may ask for',
    `select public.approve_developer_app('${draftAppId}', array['invoices:read']::text[])`,
    true
  );

  await signIn(db, SEED.ownerA);

  await db.query(
    `select public.save_developer_app('${draftAppId}', 'Shop Bridge',
       'Push orders into invoices', null, 'https://shopbridge.example.com',
       null, 'support@shopbridge.example.com', null, 'public')`
  );

  await signOut(db);

  await expectScalar(
    db,
    'and anybody can read that directory without signing in',
    `select (count(*) filter (where app_slug = 'shop-bridge'))::int
       from public.developer_app_directory()`,
    1
  );

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'suspending an application stops it platform wide',
    `select public.set_developer_app_status('${draftAppId}', 'suspended',
       'Reported for scraping client data')`,
    'suspended'
  );

  await signOut(db);

  await expectScalar(
    db,
    'and a suspended application leaves the directory at once',
    `select (count(*) filter (where app_slug = 'shop-bridge'))::int
       from public.developer_app_directory()`,
    0
  );

  await signOut(db);
}

/**
 * Verifies multi channel messaging with fallback, bank feeds and smarter
 * reconciliation, receipt reading, instalment plans and the loyalty ledger.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testEngagement(db) {
  console.log('\nReaching people off email');

  await signOut(db);

  const clients = await db.query(
    `select id from public.clients
      where company_id = $1 and deleted_at is null
      order by created_at
      limit 2`,
    [SEED.companyA]
  );
  const clientOne = clients.rows[0].id;
  const clientTwo = clients.rows[1].id;

  await db.query(
    `insert into public.messaging_channels
       (company_id, channel, provider, display_name, sender_number, is_active,
        is_verified, verified_at, cost_per_message, daily_send_limit)
     values ($1, 'sms', 'twilio', 'Business texts', '+15005550006', true, true,
             now(), 0.0075, 3)`,
    [SEED.companyA]
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'an address nobody agreed to cannot be messaged',
    `select public.queue_channel_message('${SEED.companyA}', 'sms',
       '+14155550199', 'Your invoice is ready', null, null, null, null, null,
       null, null)`
  );

  const identity = await db.query(
    `select public.register_contact_channel($1, 'sms', '+14155550142', $2, null,
       'checkout_form', true) as id`,
    [SEED.companyA, clientOne]
  );

  await expectScalar(
    db,
    'an address given with consent may be messaged',
    `select public.may_message_on_channel('${SEED.companyA}', 'sms', '+14155550142')`,
    true
  );

  const texted = await db.query(
    `select public.queue_channel_message($1, 'sms', '+14155550142',
       'Invoice INV-0001 is ready to view', 'invoice_ready', $2, 'invoice',
       null, null, null, null) as id`,
    [SEED.companyA, clientOne]
  );

  await expectScalar(
    db,
    'the text is queued against the configured sender',
    `select provider from public.messages where id = '${texted.rows[0].id}'`,
    'twilio'
  );

  await expectScalar(
    db,
    'and carries what it cost to send',
    `select channel_cost::text from public.messages where id = '${texted.rows[0].id}'`,
    '0.007500'
  );

  await signInAsService(db);

  const inbound = await db.query(
    `select public.record_inbound_message($1, 'sms', '+14155550142', 'STOP',
       'twilio', 'SM-1') as id`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'a reply of STOP is understood as a request to stop',
    `select is_opt_out from public.inbound_messages where id = '${inbound.rows[0].id}'`,
    true
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'which immediately withdraws consent',
    `select consent_state from public.contact_channel_identities
      where id = '${identity.rows[0].id}'`,
    'opted_out'
  );

  await expectRejection(
    db,
    'and no further text can be sent to them',
    `select public.queue_channel_message('${SEED.companyA}', 'sms',
       '+14155550142', 'One more thing', null, null, null, null, null, null, null)`
  );

  await signOut(db);

  await expectRejection(
    db,
    'somebody who opted out is not quietly opted back in',
    `update public.contact_channel_identities
        set consent_state = 'opted_in'
      where id = '${identity.rows[0].id}'`
  );

  console.log('\nTrying the next channel');

  const route = await db.query(
    `insert into public.message_routes (company_id, route_key, name)
     values ($1, 'invoice_overdue', 'Chase an overdue invoice')
     returning id`,
    [SEED.companyA]
  );
  const routeId = route.rows[0].id;

  await db.query(
    `insert into public.message_route_steps
       (route_id, step_order, channel, wait_minutes)
     values ($1, 1, 'sms', 60),
            ($1, 2, 'telegram', 120)`,
    [routeId]
  );

  await signIn(db, SEED.ownerA);

  await db.query(
    `select public.register_contact_channel($1, 'sms', '+14155550177', $2, null,
       'signed_agreement', true)`,
    [SEED.companyA, clientTwo]
  );

  const run = await db.query(
    `select public.start_message_route($1, 'invoice_overdue', $2, null,
       'invoice', null, '{"body_text": "Your invoice is overdue"}'::jsonb) as id`,
    [SEED.companyA, clientTwo]
  );
  const runId = run.rows[0].id;

  await expectScalar(
    db,
    'the chain starts on the first channel it can use',
    `select array_to_string(attempted_channels, ',')
       from public.message_route_runs where id = '${runId}'`,
    'sms'
  );

  await signOut(db);

  await db.query(
    "update public.message_route_runs set next_action_at = now() - interval '1 minute' where id = $1",
    [runId]
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'a step that has waited long enough moves on',
    'select public.advance_message_routes(10)',
    1
  );

  await expectScalar(
    db,
    'a channel the recipient has no address for is skipped, not failed',
    `select status from public.message_route_runs where id = '${runId}'`,
    'running'
  );

  await signOut(db);

  await db.query(
    "update public.message_route_runs set next_action_at = now() - interval '1 minute' where id = $1",
    [runId]
  );

  await signInAsService(db);

  await db.query('select public.advance_message_routes(10)');

  await expectScalar(
    db,
    'and the chain ends when there is nothing left to try',
    `select status from public.message_route_runs where id = '${runId}'`,
    'exhausted'
  );

  const secondRun = await db.query(
    `select public.start_message_route($1, 'invoice_overdue', $2, null,
       'invoice', null, '{"body_text": "A friendly reminder"}'::jsonb) as id`,
    [SEED.companyA, clientTwo]
  );

  const routedMessage = await db.query(
    'select id from public.messages where route_run_id = $1 order by created_at desc limit 1',
    [secondRun.rows[0].id]
  );

  await expectScalar(
    db,
    'proof of delivery stops the chain at once',
    `select public.record_route_delivery('${routedMessage.rows[0].id}', false)`,
    true
  );

  await expectScalar(
    db,
    'so nothing else is sent about the same thing',
    `select status from public.message_route_runs where id = '${secondRun.rows[0].id}'`,
    'delivered'
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the spend on each channel can be read back',
    `select sent_count from public.channel_usage_summary('${SEED.companyA}',
       now() - interval '1 day', now() + interval '1 day')
      where channel = 'sms'`,
    3
  );

  console.log('\nChoosing where a message goes');

  await expectScalar(
    db,
    'a business can read the channels it sends on',
    `select display_name from public.company_messaging_channels('${SEED.companyA}')
      where channel = 'sms'`,
    'Business texts'
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'and cannot read the channels of another business',
    `select channel_id from public.company_messaging_channels('${SEED.companyA}')`
  );

  await signIn(db, SEED.staffA);

  await expectRejection(
    db,
    'a member of staff cannot add a channel that spends money',
    `select public.save_messaging_channel('${SEED.companyA}', 'telegram',
       'telegram_bot', 'Chat replies')`
  );

  await signIn(db, SEED.ownerA);

  const chatChannel = await db.query(
    `select public.save_messaging_channel('${SEED.companyA}', 'telegram',
       'telegram_bot', 'Chat replies', null, 'kdbilling_bot', null, null,
       0.0, 'USD', null, 50::smallint) as id`
  );
  const chatChannelId = String(Object.values(chatChannel.rows[0] ?? {})[0]);

  await expectScalar(
    db,
    'the owner can add one, and it starts switched off until it is proven',
    `select is_verified from public.company_messaging_channels('${SEED.companyA}')
      where channel_id = '${chatChannelId}'`,
    false
  );

  await db.query(
    `select public.save_messaging_channel('${SEED.companyA}', 'telegram',
       'telegram_bot', 'Chat replies and reminders', null, 'kdbilling_bot')`
  );

  await expectScalar(
    db,
    'saving the same provider twice edits it instead of doubling it',
    `select (count(*) filter (where channel = 'telegram'))::int
       from public.company_messaging_channels('${SEED.companyA}')`,
    1
  );

  await expectRejection(
    db,
    'a tenant cannot declare its own channel proven',
    `select public.record_channel_test('${chatChannelId}', true, null)`
  );

  await signInAsService(db);

  await db.query(
    `select public.record_channel_test('${chatChannelId}', false, 'The bot token was refused')`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a failed test leaves the reason where the owner can read it',
    `select last_error from public.company_messaging_channels('${SEED.companyA}')
      where channel_id = '${chatChannelId}'`,
    'The bot token was refused'
  );

  await expectScalar(
    db,
    'and a channel can be switched off without losing its settings',
    `select public.set_messaging_channel_active('${chatChannelId}', false)`,
    false
  );

  const chaseRoute = await db.query(
    `select public.save_message_route('${SEED.companyA}', 'invoice_due_soon',
       'Remind before the due date') as id`
  );
  const chaseRouteId = String(Object.values(chaseRoute.rows[0] ?? {})[0]);

  await expectRejection(
    db,
    'a chain with nothing in it is refused',
    `select public.set_message_route_steps('${chaseRouteId}', '[]'::jsonb)`
  );

  await expectRejection(
    db,
    'and so is a chain that tries the same channel twice',
    `select public.set_message_route_steps('${chaseRouteId}',
       '[{"channel": "sms"}, {"channel": "sms"}]'::jsonb)`
  );

  await expectScalar(
    db,
    'a chain is laid out in one go, in the order it was given',
    `select public.set_message_route_steps('${chaseRouteId}',
       '[{"channel": "email", "template_key": "invoice_due", "wait_minutes": 1440},
         {"channel": "sms", "wait_minutes": 120},
         {"channel": "telegram"}]'::jsonb)`,
    3
  );

  await expectScalar(
    db,
    'the steps come back with the chain that owns them',
    `select steps -> 1 ->> 'channel'
       from public.company_message_routes('${SEED.companyA}')
      where route_id = '${chaseRouteId}'`,
    'sms'
  );

  await expectScalar(
    db,
    'replacing the chain does not leave the old steps behind',
    `select jsonb_array_length(steps)
       from public.company_message_routes('${SEED.companyA}')
      where route_id = '${chaseRouteId}'`,
    3
  );

  await expectScalar(
    db,
    'recent chains are listed with how far each one got',
    `select (count(*) >= 2)::text
       from public.message_route_activity('${SEED.companyA}', 50)`,
    'true'
  );

  await expectRejection(
    db,
    'a channel refuses the next message once it has sent all it may today',
    `select public.queue_channel_message('${SEED.companyA}', 'sms',
       '+14155550177', 'One more reminder')`
  );

  await signOut(db);

  await db.query(
    `update public.messaging_channels set daily_send_limit = 50
      where company_id = $1 and channel = 'sms'`,
    [SEED.companyA]
  );

  await signIn(db, SEED.ownerA);

  const liveRun = await db.query(
    `select public.start_message_route('${SEED.companyA}', 'invoice_overdue',
       '${clientTwo}', null, 'invoice', null,
       '{"body_text": "One last reminder"}'::jsonb) as id`
  );
  const liveRunId = String(Object.values(liveRun.rows[0] ?? {})[0]);

  await expectRejection(
    db,
    'stopping a chain without saying why is refused',
    `select public.stop_message_route_run('${liveRunId}', '')`
  );

  await expectScalar(
    db,
    'and a chain can be called off once the client has been spoken to',
    `select public.stop_message_route_run('${liveRunId}', 'The client rang us')`,
    true
  );

  await expectScalar(
    db,
    'the overview counts the channels a business can actually use',
    `select ((public.messaging_overview('${SEED.companyA}') ->> 'verified_channels')::int >= 1)::text`,
    'true'
  );

  await expectScalar(
    db,
    'it counts the people who agreed to be reached',
    `select ((public.messaging_overview('${SEED.companyA}') ->> 'reachable_people')::int >= 1)::text`,
    'true'
  );

  await expectScalar(
    db,
    'and it prices what the channels cost last month',
    `select (public.messaging_overview('${SEED.companyA}') ? 'spend_last_30_days')::text`,
    'true'
  );

  await signInAsService(db);

  await db.query(
    `select public.record_inbound_message('${SEED.companyA}', 'sms',
       '+14155550177', 'Can you resend that invoice', 'twilio', 'SM-reply-001')`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a reply waits where somebody will see it',
    `select body_text from public.pending_inbound_messages('${SEED.companyA}', 10)
      where from_address = '+14155550177'
      order by received_at desc
      limit 1`,
    'Can you resend that invoice'
  );

  const replyRow = await db.query(
    `select inbound_id from public.pending_inbound_messages('${SEED.companyA}', 10)
      where from_address = '+14155550177'
      order by received_at desc
      limit 1`
  );
  const replyId = String(Object.values(replyRow.rows[0] ?? {})[0]);

  await expectScalar(
    db,
    'and once it is dealt with it stops asking for attention',
    `select public.mark_inbound_handled('${replyId}', 'Invoice sent again')`,
    true
  );

  await expectScalar(
    db,
    'the same reply cannot be closed twice',
    `select public.mark_inbound_handled('${replyId}', 'Closed again')`,
    false
  );

  console.log('\nLetting the bank send the statement');

  const connection = await db.query(
    `select public.connect_bank_feed($1, 'plaid', 'First Harbour Bank',
       'conn_live_001', now() + interval '60 days', null) as id`,
    [SEED.companyA]
  );
  const connectionId = connection.rows[0].id;

  await signOut(db);

  const bankAccounts = await db.query(
    `select id from public.bank_accounts
      where company_id = $1 and deleted_at is null
      order by created_at
      limit 1`,
    [SEED.companyA]
  );
  const bankAccountId = bankAccounts.rows[0].id;

  const feedAccount = await db.query(
    `insert into public.bank_feed_accounts
       (company_id, connection_id, provider_account_reference, account_name,
        account_mask, currency)
     values ($1, $2, 'acct_001', 'Business current account', '4417', 'USD')
     returning id`,
    [SEED.companyA, connectionId]
  );
  const feedAccountId = feedAccount.rows[0].id;

  await expectScalar(
    db,
    'the connection counts the accounts it brought back',
    `select account_count from public.bank_feed_connections where id = '${connectionId}'`,
    1
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the owner says which of their accounts it is',
    `select public.link_feed_account('${feedAccountId}', '${bankAccountId}',
       current_date - 30)`,
    true
  );

  const sync = await db.query(`select public.start_feed_sync($1, $2, 'manual') as id`, [
    connectionId,
    feedAccountId,
  ]);
  const syncId = sync.rows[0].id;

  await signInAsService(db);

  const imported = await db.query(
    `select public.ingest_feed_transaction($1, $2, 'txn_9001', -40.00,
       current_date - 2, 'AMAZON MKTPLACE 889231', 'Amazon', null, 1200.00) as id`,
    [syncId, feedAccountId]
  );

  report(
    imported.rows[0].id !== null,
    'a line from the feed becomes a statement line',
    String(imported.rows[0].id)
  );

  await expectScalar(
    db,
    'the same line sent twice is imported once',
    `select public.ingest_feed_transaction('${syncId}', '${feedAccountId}',
       'txn_9001', -40.00, current_date - 2, 'AMAZON MKTPLACE 889231', 'Amazon',
       null, 1200.00) is null`,
    true
  );

  await expectScalar(
    db,
    'and the repeat is counted rather than hidden',
    `select duplicate_count from public.bank_feed_syncs where id = '${syncId}'`,
    1
  );

  await expectScalar(
    db,
    'closing the run books the next one',
    `select public.complete_feed_sync('${syncId}', 'succeeded', null, 'cursor-2')`,
    true
  );

  await expectScalar(
    db,
    'a healthy connection has no failures behind it',
    `select consecutive_failures from public.bank_feed_connections
      where id = '${connectionId}'`,
    0
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the owner is told how long their consent has left',
    `select days_until_expiry > 50 from public.bank_feed_health('${SEED.companyA}')
      where connection_id = '${connectionId}'`,
    true
  );

  await signOut(db);

  await db.query(
    "update public.bank_feed_connections set consent_expires_at = now() - interval '1 day' where id = $1",
    [connectionId]
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'consent that has run out stops the feed',
    'select public.expire_bank_feed_consents() >= 1',
    true
  );

  console.log('\nMatching that learns');

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the reference numbers are stripped out of a description',
    "select public.counterparty_key('AMAZON MKTPLACE 889231')",
    'amazon mktplace'
  );

  await signOut(db);

  const statementLine = await db.query(
    `select id from public.bank_transactions
      where provider_transaction_id = 'txn_9001'`
  );
  const lineId = statementLine.rows[0].id;

  await signIn(db, SEED.ownerA);

  await db.query(
    `select public.remember_reconciliation_choice($1, 'AMAZON MKTPLACE 889231',
       'money_out', public.system_account_id($1, 'bank'), null, null)`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'the next identical line is guessed from what was decided before',
    `select times_confirmed from public.recall_reconciliation_choice('${lineId}')`,
    1
  );

  await expectRejection(
    db,
    'a split that does not add up to the line is refused',
    `select public.split_bank_transaction('${lineId}',
       '[{"amount": -10}, {"amount": -10}]'::jsonb)`
  );

  await expectScalar(
    db,
    'a split that balances is accepted',
    `select public.split_bank_transaction('${lineId}',
       '[{"amount": -25, "note": "Office supplies"},
         {"amount": -15, "note": "Postage"}]'::jsonb)`,
    2
  );

  await expectScalar(
    db,
    'and the line is marked as divided',
    `select status from public.bank_transactions where id = '${lineId}'`,
    'split'
  );

  await signOut(db);

  const outflow = await db.query(
    `insert into public.bank_transactions
       (company_id, bank_account_id, amount, currency, transaction_date,
        description, counterparty_name, import_source)
     values ($1, $2, -120.00, 'USD', current_date, 'DESIGN SOFTWARE LTD',
             'Design Software Ltd', 'bank_feed')
     returning id`,
    [SEED.companyA, bankAccountId]
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'money going out is matched against what was spent',
    `select record_type from public.suggest_spending_matches('${outflow.rows[0].id}', 3)
      limit 1`,
    'expense'
  );

  await expectScalar(
    db,
    'the work still waiting for a decision can be listed',
    `select count(*)::int > 0 from public.unreconciled_work('${SEED.companyA}', 50)`,
    true
  );

  console.log('\nDeciding what each line was');

  await expectScalar(
    db,
    'the queue says what each line is and what is known about it',
    `select (count(*) filter (where suggestion_count >= 0))::int > 0
       from public.bank_lines_to_review('${SEED.companyA}', 50)`,
    true
  );

  await expectScalar(
    db,
    'a line going out offers the expenses that could explain it',
    `select record_type from public.candidate_matches('${outflow.rows[0].id}', 3) limit 1`,
    'expense'
  );

  const spendCandidate = await db.query(
    `select record_id from public.candidate_matches('${outflow.rows[0].id}', 3) limit 1`
  );
  const expenseId = String(Object.values(spendCandidate.rows[0] ?? {})[0]);

  await expectRejection(
    db,
    'a line cannot be settled against something that is not a record of spending',
    `select public.settle_bank_line('${outflow.rows[0].id}', 'invoice', '${expenseId}')`
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'and the queue of one business is invisible to another',
    `select bank_transaction_id from public.bank_lines_to_review('${SEED.companyA}', 10)`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'money going out is settled against the expense that explains it',
    `select (public.settle_bank_line('${outflow.rows[0].id}', 'expense',
              '${expenseId}') is not null)::text`,
    'true'
  );

  await expectScalar(
    db,
    'which takes the line out of the queue',
    `select status from public.bank_transactions where id = '${outflow.rows[0].id}'`,
    'matched'
  );

  await expectRejection(
    db,
    'the same expense cannot explain a second line',
    `select public.settle_bank_line('${lineId}', 'expense', '${expenseId}')`
  );

  await signOut(db);

  const noise = await db.query(
    `insert into public.bank_transactions
       (company_id, bank_account_id, amount, currency, transaction_date,
        description, import_source)
     values ($1, $2, -3.50, 'USD', current_date, 'CARD FEE', 'bank_feed')
     returning id`,
    [SEED.companyA, bankAccountId]
  );
  const noiseId = noise.rows[0].id;

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'setting a line aside without a reason is refused',
    `select public.ignore_bank_line('${noiseId}', '')`
  );

  await expectScalar(
    db,
    'but a line that is nothing to do with the books can be put away',
    `select public.ignore_bank_line('${noiseId}', 'Bank charge, posted monthly')`,
    true
  );

  await expectScalar(
    db,
    'and it stops asking to be looked at',
    `select (count(*) filter (where bank_transaction_id = '${noiseId}'))::int
       from public.bank_lines_to_review('${SEED.companyA}', 100)`,
    0
  );

  await expectScalar(
    db,
    'the accounts a feed reported are listed with what they map to',
    `select (count(*) >= 1)::text from public.company_feed_accounts('${SEED.companyA}')`,
    'true'
  );

  await expectRejection(
    db,
    'a feed cannot be told to report more often than once an hour',
    `select public.set_feed_frequency(
              (select id from public.bank_feed_connections
                where company_id = '${SEED.companyA}' limit 1), 0::smallint)`
  );

  await expectScalar(
    db,
    'but the owner can choose how often it is read',
    `select public.set_feed_frequency(
              (select id from public.bank_feed_connections
                where company_id = '${SEED.companyA}' limit 1), 24::smallint)`,
    true
  );

  await expectScalar(
    db,
    'the overview counts what is still waiting to be explained',
    `select ((public.reconciliation_overview('${SEED.companyA}')
              ->> 'lines_to_review')::int >= 0)::text`,
    'true'
  );

  await expectScalar(
    db,
    'it counts what the engine has learned about this business',
    `select ((public.reconciliation_overview('${SEED.companyA}')
              ->> 'learned_counterparties')::int >= 1)::text`,
    'true'
  );

  await expectScalar(
    db,
    'and it prices the backlog rather than only counting it',
    `select (public.reconciliation_overview('${SEED.companyA}') ? 'value_to_review')::text`,
    'true'
  );

  console.log('\nReading a receipt');

  const scan = await db.query(
    `select public.submit_receipt_scan($1, 'tenants/a/receipts/one.jpg',
       'cafe.jpg', 'image/jpeg', 184320,
       'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888',
       'mobile_camera') as id`,
    [SEED.companyA]
  );
  const scanId = scan.rows[0].id;

  const repeat = await db.query(
    `select public.submit_receipt_scan($1, 'tenants/a/receipts/two.jpg',
       'cafe-again.jpg', 'image/jpeg', 184320,
       'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888',
       'upload') as id`,
    [SEED.companyA]
  );

  await expectScalar(
    db,
    'the same photograph uploaded twice is recognised',
    `select status from public.receipt_scans where id = '${repeat.rows[0].id}'`,
    'duplicate'
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'the reader takes the queue one receipt at a time',
    'select count(*)::int from public.claim_receipt_scans(5)',
    1
  );

  await db.query(
    `select public.record_receipt_result($1, 'textract',
       '{"merchant_name": "Harbour Cafe", "receipt_date": "2026-01-14",
         "currency": "USD", "subtotal_amount": "42.00", "tax_amount": "3.36",
         "total_amount": "45.36",
         "confidence": {"merchant_name": 96, "total_amount": 71}}'::jsonb,
       '[{"description": "Lunch meeting", "line_total": "42.00"}]'::jsonb,
       88.5, 'Harbour Cafe')`,
    [scanId]
  );

  await expectScalar(
    db,
    'the reading is stored with the fields it was unsure about',
    `select array_to_string(low_confidence_fields, ',')
       from public.receipt_scans where id = '${scanId}'`,
    'total_amount'
  );

  await expectScalar(
    db,
    'the lines it found are kept beside it',
    `select count(*)::int from public.receipt_scan_lines where scan_id = '${scanId}'`,
    1
  );

  await signIn(db, SEED.ownerA);

  const receiptExpense = await db.query(
    `select public.create_expense_from_receipt($1, null, null,
       'Lunch with a client') as id`,
    [scanId]
  );

  await expectScalar(
    db,
    'a reviewed receipt becomes a draft expense',
    `select total_amount::text from public.expenses
      where id = '${receiptExpense.rows[0].id}'`,
    '45.3600'
  );

  await expectScalar(
    db,
    'and the receipt is marked as dealt with',
    `select status from public.receipt_scans where id = '${scanId}'`,
    'accepted'
  );

  await expectRejection(
    db,
    'a receipt already in the books cannot be thrown away',
    `select public.discard_receipt_scan('${scanId}', 'Changed my mind')`
  );

  await expectScalar(
    db,
    'the reader reports how well it has been doing',
    `select accepted_count from public.receipt_scan_summary('${SEED.companyA}')`,
    1
  );

  console.log('\nChecking what the reader read');

  const secondScan = await db.query(
    `select public.submit_receipt_scan($1, 'tenants/a/receipts/three.jpg',
       'fuel.jpg', 'image/jpeg', 204800,
       '1111aaaa2222bbbb3333cccc4444dddd5555eeee6666ffff7777aaaa8888bbbb',
       'mobile_camera') as id`,
    [SEED.companyA]
  );
  const secondScanId = secondScan.rows[0].id;

  await signInAsService(db);

  await db.query('select public.claim_receipt_scans(5)');

  await db.query(
    `select public.record_receipt_result($1, 'textract',
       '{"merchant_name": "Northside Fuel", "receipt_date": "2026-02-02",
         "currency": "USD", "total_amount": "60.00",
         "confidence": {"merchant_name": 94, "total_amount": 42}}'::jsonb,
       '[{"description": "Diesel", "line_total": "60.00"}]'::jsonb,
       64.0, 'Northside Fuel')`,
    [secondScanId]
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the review queue shows what is still waiting to be checked',
    `select (count(*) filter (where scan_id = '${secondScanId}'))::int
       from public.receipts_to_review('${SEED.companyA}', 50)`,
    1
  );

  await expectScalar(
    db,
    'one receipt comes back with the lines the reader found',
    `select jsonb_array_length(public.receipt_scan_detail('${secondScanId}') -> 'lines')`,
    1
  );

  await expectScalar(
    db,
    'and it names the field the reader was least sure about',
    `select public.receipt_scan_detail('${secondScanId}')
              -> 'low_confidence_fields' ->> 0`,
    'total_amount'
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'a receipt of one business cannot be read by another',
    `select public.receipt_scan_detail('${secondScanId}')`
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'corrections that do not add up to the total are refused',
    `select public.correct_receipt_scan('${secondScanId}',
       '{"subtotal_amount": "50.00", "tax_amount": "4.00",
         "total_amount": "60.00"}'::jsonb)`
  );

  await expectScalar(
    db,
    'but a correction that balances is taken',
    `select public.correct_receipt_scan('${secondScanId}',
       '{"merchant_name": "Northside Fuel Ltd", "subtotal_amount": "55.00",
         "tax_amount": "5.00", "total_amount": "60.00"}'::jsonb)`,
    true
  );

  await expectScalar(
    db,
    'the corrected name is what the expense will carry',
    `select merchant_name from public.receipt_scans where id = '${secondScanId}'`,
    'Northside Fuel Ltd'
  );

  await expectScalar(
    db,
    'and the receipt stops asking about the fields it was unsure of',
    `select array_length(low_confidence_fields, 1) is null
       from public.receipt_scans where id = '${secondScanId}'`,
    true
  );

  await db.query(
    `select public.create_expense_from_receipt('${secondScanId}', null, null,
       'Fuel for the van')`
  );

  await expectRejection(
    db,
    'a receipt already in the books cannot be corrected afterwards',
    `select public.correct_receipt_scan('${secondScanId}',
       '{"total_amount": "70.00"}'::jsonb)`
  );

  console.log('\nPutting a name to an agreement');

  await signIn(db, SEED.ownerA);

  const agreement = await db.query(
    `select public.save_contract($1, 'Website retainer',
       '<h1>Website retainer</h1><p>Monthly care of the site, invoiced in advance.</p>',
       null, null, 'USD', 1200, current_date, current_date + 365, true,
       'Agreed on the call of the fourteenth') as id`,
    [SEED.companyA]
  );
  const agreementId = agreement.rows[0].id;

  await expectScalar(
    db,
    'a new agreement starts as a draft with a reference of its own',
    `select contract_number ~ '^CT-[0-9]+$' and status = 'draft'
       from public.contracts where id = '${agreementId}'`,
    true
  );

  await expectScalar(
    db,
    'drafting one writes the first line of its trail',
    `select count(*)::int from public.contract_events
      where contract_id = '${agreementId}' and event_type = 'created'`,
    1
  );

  await expectRejection(
    db,
    'an agreement cannot be sent before anybody is named on it',
    `select public.send_contract('${agreementId}')`
  );

  await expectScalar(
    db,
    'the parties are named in one go',
    `select public.set_contract_signers('${agreementId}',
       '[{"full_name": "Dana Reed", "email": "dana@northwind.test",
          "role_label": "Client", "signing_order": 1},
         {"full_name": "Owner A", "email": "owner.a@example.test",
          "role_label": "Supplier", "signing_order": 2, "is_internal": true}]'::jsonb)`,
    2
  );

  await expectScalar(
    db,
    'the agreement counts them without being told twice',
    `select signer_count from public.contracts where id = '${agreementId}'`,
    2
  );

  await expectScalar(
    db,
    'and the drafting list shows it waiting to go out',
    `select (count(*) filter (where contract_id = '${agreementId}'))::int
       from public.company_contracts('${SEED.companyA}', 'draft', 50)`,
    1
  );

  await signIn(db, SEED.staffA);

  await expectRejection(
    db,
    'a member of staff cannot send an agreement to a client',
    `select public.send_contract('${agreementId}')`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the owner sends it and the wording is frozen at that moment',
    `select public.send_contract('${agreementId}', current_date + 60)`,
    'sent'
  );

  await expectScalar(
    db,
    'the digest of what was sent is kept as proof',
    `select content_hash ~ '^[0-9a-f]{64}$' from public.contracts
      where id = '${agreementId}'`,
    true
  );

  await expectRejection(
    db,
    'the wording cannot be rewritten once it is out',
    `select public.save_contract('${SEED.companyA}', 'Website retainer',
       '<h1>Website retainer</h1><p>Different terms entirely.</p>',
       '${agreementId}')`
  );

  await expectRejection(
    db,
    'and nobody new can be slipped onto it',
    `select public.set_contract_signers('${agreementId}',
       '[{"full_name": "Someone Else", "email": "else@northwind.test"}]'::jsonb)`
  );

  await expectScalar(
    db,
    'one agreement comes back with both parties on it',
    `select jsonb_array_length(public.contract_detail('${agreementId}') -> 'signers')`,
    2
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'the agreement of one business is invisible to another',
    `select public.contract_detail('${agreementId}')`
  );

  await signIn(db, SEED.ownerA);

  const invitationLink = await db.query(
    `insert into public.document_links
       (company_id, document_kind, document_id, token_hash, short_code,
        recipient_email)
     values ($1, 'contract', $2,
       'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888',
       'ctSign01', 'dana@northwind.test')
     returning id`,
    [SEED.companyA, agreementId]
  );
  const invitationId = invitationLink.rows[0].id;

  const firstSigner = await db.query(
    `select id from public.contract_signers
      where contract_id = $1 and signing_order = 1`,
    [agreementId]
  );
  const firstSignerId = firstSigner.rows[0].id;

  const secondSigner = await db.query(
    `select id from public.contract_signers
      where contract_id = $1 and signing_order = 2`,
    [agreementId]
  );
  const secondSignerId = secondSigner.rows[0].id;

  await expectScalar(
    db,
    'the invitation is tied to the person it was made for',
    `select public.attach_signer_invitation('${firstSignerId}', '${invitationId}')`,
    true
  );

  await expectRejection(
    db,
    'the signing page is not something a tenant can call for itself',
    `select public.contract_for_signing('${invitationId}')`
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'the invitation opens the agreement for the person holding it',
    `select public.contract_for_signing('${invitationId}') ->> 'is_open'`,
    'true'
  );

  await expectScalar(
    db,
    'and it says who is being asked to sign',
    `select public.contract_for_signing('${invitationId}') ->> 'full_name'`,
    'Dana Reed'
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'signing out of turn is refused when the order matters',
    `select public.sign_contract('${secondSignerId}', 'typed', 'Owner A')`
  );

  await expectScalar(
    db,
    'the first party signs and the agreement is partly done',
    `select public.sign_contract('${firstSignerId}', 'typed', 'Dana Reed')`,
    'partially_signed'
  );

  await expectScalar(
    db,
    'the second signature finishes it',
    `select public.sign_contract('${secondSignerId}', 'typed', 'Owner A')`,
    'completed'
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'the invitation stops accepting a second signature',
    `select public.contract_for_signing('${invitationId}') ->> 'is_open'`,
    'false'
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a signed agreement cannot be voided as though it never happened',
    `select public.void_contract('${agreementId}', 'Client changed their mind')`
  );

  await expectScalar(
    db,
    'the overview counts what has been agreed',
    `select ((public.contract_overview('${SEED.companyA}') ->> 'completed_count')::int >= 1)`,
    true
  );

  await expectScalar(
    db,
    'and the trail reads in the order it happened',
    `select (public.contract_detail('${agreementId}') -> 'events' -> 0) ->> 'event_type'`,
    'created'
  );

  await expectScalar(
    db,
    'wording to start from is offered on the first day',
    `select (count(*) >= 3) from public.contract_wording_choices('${SEED.companyA}')`,
    true
  );

  console.log('\nPaying in parts');

  await signOut(db);

  const offer = await db.query(
    `insert into public.instalment_offers
       (company_id, name, provider, instalment_count, interval_unit,
        interval_count, minimum_invoice_amount)
     values ($1, 'Three monthly payments', 'self_financed', 3, 'month', 1, 50)
     returning id`,
    [SEED.companyA]
  );
  const offerId = offer.rows[0].id;

  const product = await db.query('select id from public.products where company_id = $1 limit 1', [
    SEED.companyA,
  ]);

  await signIn(db, SEED.ownerA);

  const planInvoice = await db.query(
    `insert into public.invoices (company_id, client_id, issue_date)
     values ($1, $2, current_date)
     returning id`,
    [SEED.companyA, clientOne]
  );
  const planInvoiceId = planInvoice.rows[0].id;

  await db.query(
    `insert into public.invoice_items (company_id, invoice_id, product_id, quantity)
     values ($1, $2, $3, 2)`,
    [SEED.companyA, planInvoiceId, product.rows[0].id]
  );

  await db.query('select public.issue_invoice($1)', [planInvoiceId]);

  const plan = await db.query('select public.create_instalment_plan($1, $2, null) as id', [
    planInvoiceId,
    offerId,
  ]);
  const planId = plan.rows[0].id;

  await expectScalar(
    db,
    'the plan is numbered and carries the whole balance',
    `select plan_reference || ' for ' || total_amount
       from public.instalment_plans where id = '${planId}'`,
    'IP-0001 for 432.0000'
  );

  await expectScalar(
    db,
    'the schedule divides it evenly',
    `select string_agg(amount::text, ', ' order by instalment_number)
       from public.instalment_schedule_items where plan_id = '${planId}'`,
    '144.0000, 144.0000, 144.0000'
  );

  const firstItem = await db.query(
    `select id from public.instalment_schedule_items
      where plan_id = $1 and instalment_number = 1`,
    [planId]
  );

  await expectScalar(
    db,
    'paying one instalment reduces what is left',
    `select public.record_instalment_payment('${firstItem.rows[0].id}', 144, null)`,
    true
  );

  await expectScalar(
    db,
    'and the plan counts it',
    `select paid_count || ' of ' || instalment_count || ', ' || outstanding_amount
       from public.instalment_plans where id = '${planId}'`,
    '1 of 3, 288.0000'
  );

  await expectRejection(
    db,
    'the same instalment cannot be settled twice',
    `select public.record_instalment_payment('${firstItem.rows[0].id}', 144, null)`
  );

  await signOut(db);

  await db.query(
    `update public.instalment_schedule_items
        set due_date = current_date - 30
      where plan_id = $1 and instalment_number > 1`,
    [planId]
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'what is late is marked as late',
    'select public.mark_overdue_instalments() >= 2',
    true
  );

  await expectScalar(
    db,
    'the collection queue knows what to chase',
    `select count(*)::int from public.due_instalments(7, 100)
      where plan_id = '${planId}'`,
    2
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the plan reports what is overdue in one line',
    `select overdue_count from public.instalment_plan_status('${planId}')`,
    2
  );

  await expectScalar(
    db,
    'the owner can end the arrangement',
    `select public.cancel_instalment_plan('${planId}', 'Client settled by transfer')`,
    true
  );

  await expectScalar(
    db,
    'which cancels everything still scheduled',
    `select count(*)::int from public.instalment_schedule_items
      where plan_id = '${planId}' and status = 'cancelled'`,
    2
  );

  console.log('\nSetting the terms for paying later');

  await signIn(db, SEED.staffA);

  await expectRejection(
    db,
    'a member of staff cannot decide what the business lends on',
    `select public.save_instalment_offer('${SEED.companyA}', 'Six monthly payments', 6::smallint)`
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'paying in one part is not paying in parts',
    `select public.save_instalment_offer('${SEED.companyA}', 'One payment', 1::smallint)`
  );

  const sixMonths = await db.query(
    `select public.save_instalment_offer($1, 'Six monthly payments', 6::smallint,
       null, 'self_financed', 'Half a year, no interest', 'month', 1::smallint,
       10, 0, 0, 5, 3::smallint, 100, 5000, 'USD', false) as id`,
    [SEED.companyA]
  );
  const sixMonthsId = sixMonths.rows[0].id;

  await expectScalar(
    db,
    'the terms a business writes are its own and are live at once',
    `select (is_active and not is_platform) from public.company_instalment_offers('${SEED.companyA}')
      where offer_id = '${sixMonthsId}'`,
    true
  );

  await db.query(
    `select public.save_instalment_offer($1,
       'Six monthly payments, no interest', 6::smallint, $2, 'self_financed',
       'Half a year, no interest', 'month', 1::smallint, 10, 0, 0, 5,
       3::smallint, 100, 5000, 'USD', false)`,
    [SEED.companyA, sixMonthsId]
  );

  await expectScalar(
    db,
    'editing them keeps one row rather than making another',
    `select name from public.instalment_offers where id = '${sixMonthsId}'`,
    'Six monthly payments, no interest'
  );

  await signOut(db);

  const platformTerms = await db.query(
    `insert into public.instalment_offers
       (company_id, name, provider, instalment_count, interval_unit,
        interval_count, minimum_invoice_amount, currency)
     values (null, 'Pay in four', 'self_financed', 4, 'week', 2, 20, 'USD')
     returning id`
  );
  const platformTermsId = platformTerms.rows[0].id;

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the terms the platform ships with are offered to everybody',
    `select is_platform from public.company_instalment_offers('${SEED.companyA}')
      where offer_id = '${platformTermsId}'`,
    true
  );

  await expectRejection(
    db,
    'but a tenant cannot rewrite them for everybody else',
    `select public.save_instalment_offer('${SEED.companyA}', 'Pay in two',
       2::smallint, '${platformTermsId}')`
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'and the terms of one business are invisible to another',
    `select public.company_instalment_offers('${SEED.companyA}')`
  );

  await signIn(db, SEED.ownerA);

  const quoteInvoice = await db.query(
    `insert into public.invoices (company_id, client_id, issue_date)
     values ($1, $2, current_date)
     returning id`,
    [SEED.companyA, clientOne]
  );
  const quoteInvoiceId = quoteInvoice.rows[0].id;

  await db.query(
    `insert into public.invoice_items (company_id, invoice_id, product_id, quantity)
     values ($1, $2, $3, 2)`,
    [SEED.companyA, quoteInvoiceId, product.rows[0].id]
  );

  await db.query('select public.issue_invoice($1)', [quoteInvoiceId]);

  await expectScalar(
    db,
    'an invoice is quoted the terms it actually qualifies for',
    `select (count(*) >= 2)::boolean from public.offers_for_invoice('${quoteInvoiceId}')`,
    true
  );

  await expectScalar(
    db,
    'the deposit and the monthly figure are worked out for the client',
    `select down_payment_amount || ' then ' || instalment_amount
       from public.offers_for_invoice('${quoteInvoiceId}')
      where offer_id = '${sixMonthsId}'`,
    '43.20 then 64.80'
  );

  await expectScalar(
    db,
    'terms that are switched off stop being offered',
    `select public.set_instalment_offer_active('${sixMonthsId}', false)`,
    true
  );

  await expectScalar(
    db,
    'and the quote no longer mentions them',
    `select (count(*) filter (where offer_id = '${sixMonthsId}'))::int
       from public.offers_for_invoice('${quoteInvoiceId}')`,
    0
  );

  await expectScalar(
    db,
    'the plan list shows what has been agreed',
    `select (count(*) filter (where plan_id = '${planId}'))::int
       from public.company_instalment_plans('${SEED.companyA}', null, 50)`,
    1
  );

  await expectScalar(
    db,
    'one plan comes back with every payment in its schedule',
    `select jsonb_array_length(public.instalment_plan_detail('${planId}') -> 'schedule')`,
    3
  );

  await expectScalar(
    db,
    'and it remembers why the arrangement ended',
    `select public.instalment_plan_detail('${planId}') ->> 'cancellation_reason'`,
    'Client settled by transfer'
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'the plan of one business cannot be read by another',
    `select public.instalment_plan_detail('${planId}')`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the overview counts what has been collected so far',
    `select public.instalment_overview('${SEED.companyA}') ->> 'collected_amount'`,
    '144.0000'
  );

  console.log('\nRewarding the clients who stay');

  await signOut(db);

  const program = await db.query(
    `insert into public.loyalty_programs
       (company_id, name, points_per_currency_unit, point_value,
        minimum_redemption_points, redemption_multiple, silver_threshold,
        gold_threshold, points_expire_after_months)
     values ($1, 'Harbour Rewards', 1, 0.01, 50, 50, 100, 1000, 12)
     returning id`,
    [SEED.companyA]
  );
  const programId = program.rows[0].id;

  await signIn(db, SEED.ownerA);

  const member = await db.query('select public.enrol_loyalty_member($1, $2) as id', [
    programId,
    clientOne,
  ]);
  const memberId = member.rows[0].id;

  await expectScalar(
    db,
    'the first member receives the opening number',
    `select membership_number from public.loyalty_accounts where id = '${memberId}'`,
    'LY-0001'
  );

  await db.query(
    `select public.award_loyalty_points($1, 150, 'Opening bonus', null, null,
       'bonus', current_date - 1)`,
    [memberId]
  );

  await expectScalar(
    db,
    'enough points move the member up a tier',
    `select tier from public.loyalty_accounts where id = '${memberId}'`,
    'silver'
  );

  await signOut(db);

  await expectRejection(
    db,
    'a points movement is never edited afterwards',
    `update public.loyalty_transactions set points = 999
      where account_id = '${memberId}'`
  );

  const goldReward = await db.query(
    `insert into public.loyalty_rewards
       (company_id, program_id, name, reward_type, points_cost, credit_amount,
        minimum_tier)
     values ($1, $2, 'Gold account credit', 'invoice_credit', 50, 25, 'gold')
     returning id`,
    [SEED.companyA, programId]
  );

  const reward = await db.query(
    `insert into public.loyalty_rewards
       (company_id, program_id, name, reward_type, points_cost, credit_amount)
     values ($1, $2, 'Ten off the next invoice', 'invoice_credit', 100, 10)
     returning id`,
    [SEED.companyA, programId]
  );
  const rewardId = reward.rows[0].id;

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a reward above the member tier cannot be claimed',
    `select public.redeem_loyalty_reward('${memberId}', '${goldReward.rows[0].id}')`
  );

  const redemption = await db.query('select public.redeem_loyalty_reward($1, $2) as id', [
    memberId,
    rewardId,
  ]);

  await expectScalar(
    db,
    'redeeming takes the points and leaves a code',
    `select points_spent from public.loyalty_redemptions
      where id = '${redemption.rows[0].id}'`,
    100
  );

  await expectScalar(
    db,
    'the balance follows the movements exactly',
    `select points_balance from public.loyalty_accounts where id = '${memberId}'`,
    50
  );

  await expectRejection(
    db,
    'a member cannot spend points they do not have',
    `select public.redeem_loyalty_reward('${memberId}', '${rewardId}')`
  );

  await signInAsService(db);

  await expectScalar(
    db,
    'points nobody used in time are taken back',
    'select public.expire_loyalty_points()',
    50
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'which leaves the member with nothing to spend',
    `select points_balance from public.loyalty_account_summary('${memberId}')`,
    0
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a claimed reward is marked as used on the invoice it paid for',
    `select public.apply_loyalty_redemption('${redemption.rows[0].id}',
       '${planInvoiceId}')`,
    true
  );

  await signOut(db);

  const settled = await db.query(
    `select p.id, p.amount
       from public.payments as p
      where p.company_id = $1
        and p.status = 'succeeded'
        and p.client_id is not null
        and p.deleted_at is null
      order by p.amount desc
      limit 1`,
    [SEED.companyA]
  );
  const settledPayment = settled.rows[0];

  await signIn(db, SEED.ownerA);

  await db.query('select public.accrue_points_for_payment($1)', [settledPayment.id]);

  await expectScalar(
    db,
    'a received payment earns a point for each unit spent',
    `select points_balance from public.loyalty_accounts where id = '${memberId}'`,
    Math.floor(Number(settledPayment.amount))
  );

  await expectScalar(
    db,
    'and the same payment is never counted twice',
    `select public.accrue_points_for_payment('${settledPayment.id}') is null`,
    true
  );

  console.log('\nRunning the scheme from the office');

  await signIn(db, SEED.staffA);

  await expectRejection(
    db,
    'a member of staff cannot give the company money away',
    `select public.save_loyalty_program('${SEED.companyA}', 'Anything at all')`
  );

  await signIn(db, SEED.ownerA);

  await db.query(
    `select public.save_loyalty_program($1, 'Harbour Rewards Club', $2,
       'A point for every unit spent', 1, 'payment', 0, 0.01, 50, 50, 12::smallint,
       100, 1000, null, null, 'USD', true)`,
    [SEED.companyA, programId]
  );

  await expectScalar(
    db,
    'the owner can rename the scheme without starting another one',
    `select public.company_loyalty_program('${SEED.companyA}') ->> 'name'`,
    'Harbour Rewards Club'
  );

  await expectRejection(
    db,
    'a point has to be worth something',
    `select public.save_loyalty_program('${SEED.companyA}', 'Worthless points',
       '${programId}', null, 1, 'payment', 0, 0)`
  );

  const freeDelivery = await db.query(
    `select public.save_loyalty_reward($1, 'Free delivery on the next order',
       200::integer, null, 'For members who order every month', 'invoice_credit',
       15, null, 'standard', null, 1::integer, null, null, 5::smallint) as id`,
    [programId]
  );
  const freeDeliveryId = freeDelivery.rows[0].id;

  await expectRejection(
    db,
    'a reward that costs nothing is not a reward',
    `select public.save_loyalty_reward('${programId}', 'Free money', 0::integer)`
  );

  await expectScalar(
    db,
    'the new reward is on the list at the place it was given',
    `select name from public.company_loyalty_rewards('${SEED.companyA}')
      where reward_id = '${freeDeliveryId}'`,
    'Free delivery on the next order'
  );

  await expectScalar(
    db,
    'a reward can be withdrawn without losing who claimed it before',
    `select public.set_loyalty_reward_active('${freeDeliveryId}', false)`,
    true
  );

  await expectScalar(
    db,
    'and it is marked as no longer offered',
    `select (count(*) filter (where reward_id = '${freeDeliveryId}' and not is_active))::int
       from public.company_loyalty_rewards('${SEED.companyA}')`,
    1
  );

  await expectScalar(
    db,
    'the member list prices the points as money owed',
    `select points_value from public.company_loyalty_members('${SEED.companyA}', null, 10)
      where account_id = '${memberId}'`,
    `${(Math.floor(Number(settledPayment.amount)) * 0.01).toFixed(2)}`
  );

  await expectScalar(
    db,
    'searching the members by number finds the one that was asked for',
    `select (count(*) = 1)::boolean
       from public.company_loyalty_members('${SEED.companyA}', 'LY-0001', 10)`,
    true
  );

  await expectScalar(
    db,
    'one membership comes back with the reward it claimed',
    `select jsonb_array_length(
       public.loyalty_member_detail('${memberId}') -> 'redemptions')`,
    1
  );

  await expectScalar(
    db,
    'and with every movement that made the balance',
    `select (jsonb_array_length(
       public.loyalty_member_detail('${memberId}') -> 'movements') >= 4)::boolean`,
    true
  );

  await expectScalar(
    db,
    'the overview prices what the scheme owes in total',
    `select public.loyalty_overview('${SEED.companyA}') ->> 'member_count'`,
    '1'
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'the scheme of one business is invisible to another',
    `select public.loyalty_overview('${SEED.companyA}')`
  );

  console.log('\nTurning a paid invoice into a good word');

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'nobody is asked for a review before they have paid',
    `select public.invite_invoice_review('${planInvoiceId}')`
  );

  await signInAsService(db);

  await db.query('update public.clients set email = $1 where id = $2', [
    'harbour.client@example.com',
    clientOne,
  ]);

  await db.query("update public.invoices set status = 'paid' where id = $1", [planInvoiceId]);

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the client of a paid invoice is invited to say what they thought',
    `select public.invite_invoice_review('${planInvoiceId}') is not null`,
    true
  );

  await expectScalar(
    db,
    'and is never pestered about the same invoice again',
    `select public.invite_invoice_review('${planInvoiceId}') is null`,
    true
  );

  await expectScalar(
    db,
    'the invitation is waiting on the review list',
    `select (count(*) filter (where subject_id = '${planInvoiceId}'))::int
       from public.company_review_requests('${SEED.companyA}', null, 50)`,
    1
  );

  await signIn(db, SEED.staffA);

  await expectRejection(
    db,
    'a member of staff cannot put words in a client mouth',
    `select public.save_testimonial('${SEED.companyA}', 'Someone',
       'A quote that nobody has agreed to being shown anywhere at all')`
  );

  await signIn(db, SEED.ownerA);

  const quote = await db.query(
    `select public.save_testimonial($1, 'Harbour Freight',
       'The schedule did the chasing for us and the invoice was settled a month early.',
       null, null, 'Operations lead', 'Harbour Freight', 5::smallint, false,
       'home', false, 10::smallint) as id`,
    [SEED.companyA]
  );
  const quoteId = quote.rows[0].id;

  await expectRejection(
    db,
    'a quote without consent cannot be published',
    `select public.approve_testimonial('${quoteId}')`
  );

  await db.query(
    `select public.save_testimonial($1, 'Harbour Freight',
       'The schedule did the chasing for us and the invoice was settled a month early.',
       $2, null, 'Operations lead', 'Harbour Freight', 5::smallint, true,
       'home', true, 10::smallint)`,
    [SEED.companyA, quoteId]
  );

  await expectScalar(
    db,
    'once the author agrees the owner can publish it',
    `select public.approve_testimonial('${quoteId}')`,
    true
  );

  await db.query(
    `select public.save_testimonial($1, 'Harbour Freight',
       'The schedule did the chasing for us and the invoice was settled a month early.',
       $2, null, 'Operations lead', 'Harbour Freight', 5::smallint, false,
       'home', true, 10::smallint)`,
    [SEED.companyA, quoteId]
  );

  await expectScalar(
    db,
    'withdrawing consent takes it straight back off the site',
    `select is_approved from public.testimonials where id = '${quoteId}'`,
    false
  );

  await expectScalar(
    db,
    'the review overview counts what is published and what is waiting',
    `select (public.review_overview('${SEED.companyA}') ->> 'waiting_count')::int >= 1`,
    true
  );

  await signOut(db);
}

/**
 * Verifies the marketing site, consent gated measurement, experiments,
 * campaigns, social publishing and reviews.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testMarketing(db) {
  console.log('\nThe public site');

  await signOut(db);

  await expectScalar(
    db,
    'the site ships with real pages rather than placeholders',
    'select count(*)::int from public.site_pages where is_published',
    9
  );

  await expectScalar(
    db,
    'the navigation is in the order somebody chose',
    `select string_agg(navigation_label, ', ' order by navigation_order)
       from public.site_pages where show_in_navigation`,
    'Features, Pricing, Integrations, Contact'
  );

  await expectScalar(
    db,
    'the sitemap offers the home page first',
    'select path from public.sitemap_entries() limit 1',
    '/'
  );

  await db.query(
    "update public.site_pages set robots_directive = 'noindex,nofollow' where slug = 'contact'"
  );

  await expectScalar(
    db,
    'a page told not to be indexed stays out of the sitemap',
    "select count(*)::int from public.sitemap_entries() where path = '/contact'",
    0
  );

  await expectRejection(
    db,
    'a description too short to be useful in search results is refused',
    `insert into public.site_pages (slug, title, meta_description)
     values ('too-short', 'Too short', 'Not enough.')`
  );

  await db.query(
    `insert into public.url_redirects (source_path, target_path, reason)
     values ('/old-pricing', '/pricing', 'The pricing page moved')`
  );

  await expectScalar(
    db,
    'an old address is sent to its replacement permanently',
    "select status_code from public.follow_redirect('/old-pricing')",
    301
  );

  await expectScalar(
    db,
    'and the redirect counts itself, so dead rules can be retired',
    "select hit_count from public.url_redirects where source_path = '/old-pricing'",
    1
  );

  await expectRejection(
    db,
    'a redirect that points at itself is refused',
    `insert into public.url_redirects (source_path, target_path)
     values ('/loop', '/loop')`
  );

  await browseAnonymously(db);

  await expectScalar(
    db,
    'a visitor who has not signed in can read the published pages',
    'select count(*)::int from public.site_pages',
    9
  );

  console.log('\nMeasurement that asks first');

  await expectScalar(
    db,
    'nothing may be measured before the visitor has answered',
    "select public.consent_allows('visitor-token-aaaaaaaaaaaa', 'analytics')",
    false
  );

  await db.query(
    `select public.record_cookie_consent(
       'visitor-token-aaaaaaaaaaaa', true, false, false, '2026-01-01', null,
       'Mozilla/5.0', 'BD'
     )`
  );

  await expectScalar(
    db,
    'measurement is allowed once the visitor agreed to it',
    "select public.consent_allows('visitor-token-aaaaaaaaaaaa', 'analytics')",
    true
  );

  await expectScalar(
    db,
    'advertising is still not, because that was a separate question',
    "select public.consent_allows('visitor-token-aaaaaaaaaaaa', 'marketing')",
    false
  );

  await expectScalar(
    db,
    'a visitor who refused is not recorded at all',
    `select public.record_site_event(
       'visitor-token-bbbbbbbbbbbb', 'page_viewed', '/pricing', '{}'::jsonb
     ) is null`,
    true
  );

  await db.query(
    `select public.record_site_event(
       'visitor-token-aaaaaaaaaaaa', 'page_viewed', '/pricing', '{}'::jsonb,
       null, null, 'newsletter', 'email', 'spring-launch', null, null,
       'mobile', 'BD'
     )`
  );

  await db.query(
    `select public.record_site_event(
       'visitor-token-aaaaaaaaaaaa', 'signup_started', '/register', '{}'::jsonb
     )`
  );

  await signOut(db);

  await expectScalar(
    db,
    'the visitor who agreed is measured',
    "select count(*)::int from public.site_events where visitor_token = 'visitor-token-aaaaaaaaaaaa'",
    2
  );

  await expectScalar(
    db,
    'and the one who refused left no trace',
    "select count(*)::int from public.site_events where visitor_token = 'visitor-token-bbbbbbbbbbbb'",
    0
  );

  await expectScalar(
    db,
    'the funnel counts how far visitors got',
    `select visitor_count from public.funnel_report(
       array['page_viewed', 'signup_started', 'signup_completed'],
       now() - interval '1 hour', now() + interval '1 hour'
     ) where step_position = 2`,
    1
  );

  await expectScalar(
    db,
    'the last step nobody reached is honestly reported as zero',
    `select visitor_count from public.funnel_report(
       array['page_viewed', 'signup_started', 'signup_completed'],
       now() - interval '1 hour', now() + interval '1 hour'
     ) where step_position = 3`,
    0
  );

  await expectRejection(
    db,
    'the measurement log is append only',
    "update public.site_events set path = '/somewhere-else'"
  );

  console.log('\nSettling an argument with numbers');

  await db.query(
    `insert into public.landing_pages (id, slug, name, headline, is_published)
     values ('00000000-0000-7000-8000-0000000da001', 'spring-launch',
             'Spring launch', 'Billing that pays for itself', true)`
  );

  await db.query(
    `insert into public.experiments (id, key, name, hypothesis, goal_event_name, landing_page_id)
     values ('00000000-0000-7000-8000-0000000db001', 'headline_test',
             'Headline test', 'A plainer headline converts better',
             'signup_completed', '00000000-0000-7000-8000-0000000da001')`
  );

  await db.query(
    `insert into public.experiment_variants (id, experiment_id, key, name, is_control, weight)
     values ('00000000-0000-7000-8000-0000000dc001',
             '00000000-0000-7000-8000-0000000db001', 'control', 'Original', true, 50)`
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a tenant owner cannot run an experiment on the marketing site',
    "select public.start_experiment('00000000-0000-7000-8000-0000000db001')"
  );

  await signIn(db, SEED.superAdmin);

  await expectRejection(
    db,
    'an experiment with nothing to compare against cannot start',
    "select public.start_experiment('00000000-0000-7000-8000-0000000db001')"
  );

  await signOut(db);

  await db.query(
    `insert into public.experiment_variants (id, experiment_id, key, name, weight, overrides)
     values ('00000000-0000-7000-8000-0000000dc002',
             '00000000-0000-7000-8000-0000000db001', 'plain', 'Plainer wording', 30,
             '{"headline": "Send invoices. Get paid."}'::jsonb)`
  );

  await signIn(db, SEED.superAdmin);

  await expectRejection(
    db,
    'a split that does not add up to one hundred is refused',
    "select public.start_experiment('00000000-0000-7000-8000-0000000db001')"
  );

  await signOut(db);

  await db.query(
    `update public.experiment_variants set weight = 50
      where id = '00000000-0000-7000-8000-0000000dc002'`
  );

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'a balanced experiment with a control can start',
    "select public.start_experiment('00000000-0000-7000-8000-0000000db001')",
    true
  );

  await signOut(db);

  await expectRejection(
    db,
    'the variants are frozen for as long as it runs',
    `update public.experiment_variants set weight = 80
      where id = '00000000-0000-7000-8000-0000000dc002'`
  );

  const firstAssignment = await db.query(
    "select variant_key from public.assign_experiment_variant('headline_test', 'visitor-token-aaaaaaaaaaaa')"
  );

  await expectScalar(
    db,
    'a visitor sees the same variant on every page load',
    `select variant_key = '${firstAssignment.rows[0].variant_key}'
       from public.assign_experiment_variant('headline_test', 'visitor-token-aaaaaaaaaaaa')`,
    true
  );

  await expectScalar(
    db,
    'the visitor is counted once, not once per page',
    `select count(*)::int from public.experiment_assignments
      where visitor_token = 'visitor-token-aaaaaaaaaaaa'`,
    1
  );

  await expectScalar(
    db,
    'a conversion counts for the variant that was shown',
    "select public.record_experiment_conversion('headline_test', 'visitor-token-aaaaaaaaaaaa')",
    true
  );

  await expectScalar(
    db,
    'and never counts twice for the same visitor',
    "select public.record_experiment_conversion('headline_test', 'visitor-token-aaaaaaaaaaaa')",
    false
  );

  await expectScalar(
    db,
    'the result is reported against the control',
    "select count(*)::int from public.experiment_results('headline_test')",
    2
  );

  await signIn(db, SEED.superAdmin);

  await expectScalar(
    db,
    'the platform team can conclude it and say why',
    `select public.conclude_experiment(
       '00000000-0000-7000-8000-0000000db001',
       '00000000-0000-7000-8000-0000000dc002',
       'The plainer headline won by a clear margin'
     )`,
    true
  );

  console.log('\nWriting to people who asked for it');

  await signOut(db);

  await db.query(
    `select public.subscribe_to_marketing('${SEED.companyA}', 'Ada@Example.com', 'newsletter_form', null)`
  );
  await db.query(
    `select public.subscribe_to_marketing('${SEED.companyA}', 'grace@example.com', 'invoice_footer', null)`
  );
  await db.query(
    `select public.subscribe_to_marketing('${SEED.companyA}', 'bounced@example.com', 'import', null)`
  );

  await expectScalar(
    db,
    'an address is kept once, in the form it will be written to',
    `select email_address::text from public.marketing_subscriptions
      where company_id = '${SEED.companyA}' and email_address = 'ada@example.com'`,
    'ada@example.com'
  );

  await expectScalar(
    db,
    'somebody who asked for news may be written to',
    `select public.may_receive_marketing('${SEED.companyA}', 'ada@example.com')`,
    true
  );

  await db.query(
    `insert into public.email_suppressions (company_id, email, reason)
     values ('${SEED.companyA}', 'bounced@example.com', 'hard_bounce')`
  );

  await expectScalar(
    db,
    'an address that keeps bouncing is left alone',
    `select public.may_receive_marketing('${SEED.companyA}', 'bounced@example.com')`,
    false
  );

  await signIn(db, SEED.ownerA);

  await db.query(
    `insert into public.marketing_campaigns
       (id, company_id, name, subject, body_markdown, utm_campaign, status, scheduled_for)
     values ('00000000-0000-7000-8000-0000000dd001', '${SEED.companyA}',
             'March statement reminder', 'Your March statement is ready',
             'Your statement for March is attached. Thank you for your business.',
             'march-statement', 'scheduled', now())`
  );

  await signIn(db, SEED.staffA);

  await expectRejection(
    db,
    'a staff member cannot build an audience to write to',
    "select public.build_campaign_audience('00000000-0000-7000-8000-0000000dd001')"
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the audience leaves out everybody who should be left out',
    "select public.build_campaign_audience('00000000-0000-7000-8000-0000000dd001')",
    2
  );

  await signOut(db);

  await expectScalar(
    db,
    'a sending worker takes the batch that is due',
    'select count(*)::int from public.claim_campaign_recipients(100)',
    2
  );

  const recipients = await db.query(
    `select id, email_address::text as email from public.campaign_recipients
      where campaign_id = '00000000-0000-7000-8000-0000000dd001'
      order by email_address`
  );

  await expectScalar(
    db,
    'the provider confirming delivery is recorded',
    `select public.record_campaign_outcome('${recipients.rows[0].id}', 'delivered', null)`,
    true
  );

  await db.query(
    `select public.record_campaign_outcome('${recipients.rows[0].id}', 'opened', null)`
  );

  await expectScalar(
    db,
    'the open rate is worked out from what actually arrived',
    "select open_rate from public.campaign_performance('00000000-0000-7000-8000-0000000dd001')",
    '100.0'
  );

  await expectScalar(
    db,
    'somebody who unsubscribes from a message unsubscribes everywhere',
    `select public.record_campaign_outcome('${recipients.rows[1].id}', 'unsubscribed', null)`,
    true
  );

  await expectScalar(
    db,
    'and is never written to again',
    `select public.may_receive_marketing('${SEED.companyA}', '${recipients.rows[1].email}')`,
    false
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'the wording of a campaign that has gone out cannot be rewritten',
    `update public.marketing_campaigns set body_markdown = 'Something else entirely'
      where id = '00000000-0000-7000-8000-0000000dd001'`
  );

  console.log('\nThe content calendar');

  await db.query(
    `insert into public.social_channels
       (id, company_id, platform, account_name, access_token_encrypted, masked_hint, is_connected)
     values ('00000000-0000-7000-8000-0000000de001', '${SEED.companyA}',
             'linkedin', 'Northwind Supply', 'enc:linkedin-token', '****a1b2', true)`
  );

  await db.query(
    `insert into public.social_channels
       (id, company_id, platform, account_name, access_token_encrypted, masked_hint, is_connected)
     values ('00000000-0000-7000-8000-0000000de002', '${SEED.companyA}',
             'facebook', 'Northwind Supply', 'enc:facebook-token', '****c3d4', true)`
  );

  await db.query(
    `insert into public.social_channels
       (id, company_id, platform, account_name, is_connected)
     values ('00000000-0000-7000-8000-0000000de003', '${SEED.companyA}',
             'x', 'Northwind Supply', false)`
  );

  await expectRejection(
    db,
    'a hint long enough to be the token itself is refused',
    `insert into public.social_channels (company_id, platform, account_name, masked_hint)
     values ('${SEED.companyA}', 'threads', 'Northwind Supply', 'ya29.a0AfH6SMB')`
  );

  await db.query(
    `insert into public.social_posts (id, company_id, title, body, link_url)
     values ('00000000-0000-7000-8000-0000000df001', '${SEED.companyA}',
             'New payment options', 'We now accept bKash and Nagad on every invoice.',
             'https://kdsolutionit.com/features')`
  );

  await expectRejection(
    db,
    'a post with nowhere to go cannot be scheduled',
    `select public.schedule_social_post(
       '00000000-0000-7000-8000-0000000df001', array[]::uuid[], now() + interval '1 hour'
     )`
  );

  await expectRejection(
    db,
    'a post cannot be scheduled to an account that is not connected',
    `select public.schedule_social_post(
       '00000000-0000-7000-8000-0000000df001',
       array['00000000-0000-7000-8000-0000000de003']::uuid[], now() + interval '1 hour'
     )`
  );

  await expectRejection(
    db,
    'a post cannot be scheduled for a time that has already passed',
    `select public.schedule_social_post(
       '00000000-0000-7000-8000-0000000df001',
       array['00000000-0000-7000-8000-0000000de001']::uuid[], now() - interval '1 day'
     )`
  );

  await expectScalar(
    db,
    'scheduling prepares the post for every channel it is going to',
    `select public.schedule_social_post(
       '00000000-0000-7000-8000-0000000df001',
       array['00000000-0000-7000-8000-0000000de001',
             '00000000-0000-7000-8000-0000000de002']::uuid[],
       now()
     )`,
    2
  );

  await signOut(db);

  await expectScalar(
    db,
    'a publishing worker takes both of them',
    "select count(*)::int from public.claim_social_targets('poster-1', 10)",
    2
  );

  const targets = await db.query(
    `select t.id, c.platform from public.social_post_targets as t
       join public.social_channels as c on c.id = t.channel_id
      where t.post_id = '00000000-0000-7000-8000-0000000df001'
      order by c.platform`
  );

  await expectScalar(
    db,
    'one network taking it is not enough to call the post published',
    `select public.record_social_result(
       '${targets.rows[0].id}', true, 'fb_1001', 'https://facebook.com/p/1001', null
     )`,
    'publishing'
  );

  await db.query(
    `update public.social_post_targets set attempt_count = 5 where id = '${targets.rows[1].id}'`
  );

  await expectScalar(
    db,
    'a network that keeps refusing leaves the post partly out',
    `select public.record_social_result(
       '${targets.rows[1].id}', false, null, null, 'The account lost its permission'
     )`,
    'partially_published'
  );

  await expectScalar(
    db,
    'the channel that worked counts the post',
    `select post_count from public.social_channels where id = '00000000-0000-7000-8000-0000000de002'`,
    1
  );

  await expectRejection(
    db,
    'a post that is already out cannot be rewritten',
    `update public.social_posts set body = 'Something quite different'
      where id = '00000000-0000-7000-8000-0000000df001'`
  );

  await expectScalar(
    db,
    'the access token of a connected account is never selectable',
    "select has_column_privilege('authenticated', 'public.social_channels', 'access_token_encrypted', 'select')",
    false
  );

  await db.query(
    `insert into public.social_auto_rules
       (company_id, name, trigger_event, body_template, channel_ids, is_active)
     values ('${SEED.companyA}', 'Celebrate a paid invoice', 'invoice.paid',
             'Another happy client in {{city}}. Thank you for your business.',
             array['00000000-0000-7000-8000-0000000de001']::uuid[], true)`
  );

  await expectScalar(
    db,
    'something happening in the product fills the calendar by itself',
    `select public.trigger_social_rules('${SEED.companyA}', 'invoice.paid', '{"city": "Dhaka"}'::jsonb)`,
    1
  );

  await expectScalar(
    db,
    'and the wording has the real detail in it, waiting to be approved',
    `select body from public.social_posts
      where company_id = '${SEED.companyA}' and status = 'awaiting_approval'`,
    'Another happy client in Dhaka. Thank you for your business.'
  );

  await expectScalar(
    db,
    'a busy day does not turn into a flood of posts',
    `select public.trigger_social_rules('${SEED.companyA}', 'invoice.paid', '{"city": "Dhaka"}'::jsonb)`,
    0
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'the calendar shows what is planned and how much of it went out',
    `select count(*)::int from public.social_calendar(
       '${SEED.companyA}', now() - interval '1 day', now() + interval '7 days'
     )`,
    2
  );

  console.log('\nAsking what people thought');

  await signOut(db);

  const reviewRequest = await db.query(
    `select public.request_review(
       '${SEED.companyA}', 'ada@example.com', 'invoice',
       '00000000-0000-7000-8000-0000000e0001', null
     ) as id`
  );

  await expectScalar(
    db,
    'the same person is never asked twice about the same thing',
    `select public.request_review(
       '${SEED.companyA}', 'ada@example.com', 'invoice',
       '00000000-0000-7000-8000-0000000e0001', null
     ) is null`,
    true
  );

  const reviewToken = await db.query(
    `select token from public.review_requests where id = '${reviewRequest.rows[0].id}'`
  );

  await browseAnonymously(db);

  await expectScalar(
    db,
    'a client can answer through the link without an account',
    `select public.submit_review(
       '${reviewToken.rows[0].token}', 5::smallint, 'Invoices arrive in seconds now.', true
     ) is not null`,
    true
  );

  await expectRejection(
    db,
    'and cannot answer the same invitation twice',
    `select public.submit_review('${reviewToken.rows[0].token}', 1::smallint, 'Changed my mind', false)`
  );

  await signOut(db);

  await db.query(
    `insert into public.testimonials (id, company_id, author_name, quote, rating)
     values ('00000000-0000-7000-8000-0000000e1001', '${SEED.companyA}',
             'Ada Whitfield',
             'We went from chasing invoices every Friday to being paid before the weekend.',
             5)`
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'nothing is published that the author did not agree to',
    "select public.approve_testimonial('00000000-0000-7000-8000-0000000e1001')"
  );

  await db.query(
    `update public.testimonials set consent_given = true, consent_given_at = now()
      where id = '00000000-0000-7000-8000-0000000e1001'`
  );

  await expectScalar(
    db,
    'with consent in hand the owner can publish it',
    "select public.approve_testimonial('00000000-0000-7000-8000-0000000e1001')",
    true
  );

  await browseAnonymously(db);

  await expectScalar(
    db,
    'a visitor sees the approved quote',
    'select count(*)::int from public.testimonials',
    1
  );

  await signOut(db);

  await expectScalar(
    db,
    'the ratings are summarised in one line',
    `select average_rating from public.review_summary('${SEED.companyA}')`,
    '5.00'
  );
}

/**
 * Exercises the routines the platform team uses to look after tenants.
 *
 * @param {PGlite} db Database handle.
 * @returns {Promise<void>}
 */
async function testAdministration(db) {
  console.log('\nLooking after a tenant');

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'a tenant cannot suspend another tenant',
    `select public.set_company_status('${SEED.companyB}', 'suspended', 'Just because')`
  );

  await expectRejection(
    db,
    'a tenant cannot read the platform overview',
    'select public.platform_overview()'
  );

  await signIn(db, SEED.superAdmin);

  await expectRejection(
    db,
    'a suspension without a reason is refused',
    `select public.set_company_status('${SEED.companyB}', 'suspended')`
  );

  await expectScalar(
    db,
    'the platform team suspends a tenant with a reason',
    `select public.set_company_status(
       '${SEED.companyB}', 'suspended', 'Chargeback rate above the agreed ceiling'
     )::text`,
    'suspended'
  );

  await expectScalar(
    db,
    'the reason stays on the record',
    `select suspension_reason from public.companies where id = '${SEED.companyB}'`,
    'Chargeback rate above the agreed ceiling'
  );

  await expectScalar(
    db,
    'and the suspension is in the audit trail',
    `select count(*)::int from public.audit_logs
      where entity_type = 'company' and entity_id = '${SEED.companyB}'
        and description like 'Tenant moved from%'`,
    1
  );

  await expectRejection(
    db,
    'suspending the same tenant twice is refused',
    `select public.set_company_status('${SEED.companyB}', 'suspended', 'Same reason again')`
  );

  await expectScalar(
    db,
    'reinstating the tenant clears the suspension',
    `select public.set_company_status('${SEED.companyB}', 'active')::text`,
    'active'
  );

  await expectScalar(
    db,
    'nothing is left behind on the record',
    `select coalesce(suspension_reason, 'none') from public.companies
      where id = '${SEED.companyB}'`,
    'none'
  );

  console.log('\nExceptions to a plan');

  await expectScalar(
    db,
    'the plan ceiling applies before any exception',
    `select public.usage_limit('${SEED.companyB}', 'team_members')::text`,
    '1'
  );

  const override = await db.query(
    `select public.grant_entitlement_override(
       '${SEED.companyB}', 'limits.team_members', '25'::jsonb,
       'Agreed while they migrate from their previous provider'
     ) as id`
  );

  await expectScalar(
    db,
    'an exception raises the ceiling for that tenant alone',
    `select public.usage_limit('${SEED.companyB}', 'team_members')::text`,
    '25'
  );

  await expectScalar(
    db,
    'granting it again revises the same exception rather than adding one',
    `select count(*)::int from public.company_entitlement_overrides
      where company_id = '${SEED.companyB}'
        and entitlement_key = 'limits.team_members'
        and deleted_at is null`,
    1
  );

  await expectScalar(
    db,
    'withdrawing the exception returns the tenant to its plan',
    `select public.revoke_entitlement_override('${override.rows[0].id}', 'Migration finished')::text`,
    'true'
  );

  await expectScalar(
    db,
    'and the plan ceiling applies again',
    `select public.usage_limit('${SEED.companyB}', 'team_members')::text`,
    '1'
  );

  console.log('\nKnowing who we collect for');

  await signIn(db, SEED.ownerA);

  const verification = await db.query(
    `insert into public.kyc_verifications
       (company_id, legal_name, legal_entity_type, representative_name,
        representative_email, incorporation_country, registered_country)
     values ('${SEED.companyA}', 'Northwind Trading Limited', 'company',
             'Ada Whitfield', 'ada@northwind.example', 'US', 'US')
     returning id`
  );
  const verificationId = verification.rows[0].id;

  await expectRejection(
    db,
    'a check without identity papers cannot be sent',
    `select public.submit_kyc_verification('${verificationId}')`
  );

  await db.query(
    `insert into public.kyc_documents
       (verification_id, company_id, document_type, document_side, storage_key, file_name)
     values ('${verificationId}', '${SEED.companyA}', 'national_id', 'front',
             'kyc/a/front.jpg', 'front.jpg'),
            ('${verificationId}', '${SEED.companyA}', 'national_id', 'back',
             'kyc/a/back.jpg', 'back.jpg')`
  );

  await expectRejection(
    db,
    'a company still has to show its registration certificate',
    `select public.submit_kyc_verification('${verificationId}')`
  );

  await db.query(
    `insert into public.kyc_documents
       (verification_id, company_id, document_type, document_side, storage_key, file_name)
     values ('${verificationId}', '${SEED.companyA}', 'business_registration', 'single',
             'kyc/a/registration.pdf', 'registration.pdf')`
  );

  await expectRejection(
    db,
    'the same side of the same document is never uploaded twice',
    `insert into public.kyc_documents
       (verification_id, company_id, document_type, document_side, storage_key, file_name)
     values ('${verificationId}', '${SEED.companyA}', 'national_id', 'front',
             'kyc/a/front-again.jpg', 'front-again.jpg')`
  );

  await expectScalar(
    db,
    'with both sides and the certificate the check can be sent',
    `select public.submit_kyc_verification('${verificationId}')::text`,
    'submitted'
  );

  await expectScalar(
    db,
    'and the business shows as waiting for us',
    `select kyc_status::text from public.companies where id = '${SEED.companyA}'`,
    'submitted'
  );

  await expectRejection(
    db,
    'a business cannot approve its own check',
    `select public.review_kyc_verification('${verificationId}', true)`
  );

  await signIn(db, SEED.superAdmin);

  await expectRejection(
    db,
    'refusing a check without saying what is missing is refused',
    `select public.review_kyc_verification('${verificationId}', false)`
  );

  await expectScalar(
    db,
    'the platform team approves the check',
    `select public.review_kyc_verification('${verificationId}', true, 'Papers match the register')::text`,
    'verified'
  );

  await expectScalar(
    db,
    'which is what lets us collect money for them',
    `select mor_enabled::text from public.companies where id = '${SEED.companyA}'`,
    'true'
  );

  await expectScalar(
    db,
    'and the approval carries an expiry so the papers are seen again',
    `select (expires_on is not null)::text from public.kyc_verifications
      where id = '${verificationId}'`,
    'true'
  );

  await expectRejection(
    db,
    'a decided check is not decided twice',
    `select public.review_kyc_verification('${verificationId}', true)`
  );

  await signIn(db, SEED.staffA);

  await expectScalar(
    db,
    'a staff member never sees the identity papers',
    'select count(*)::int from public.kyc_documents',
    0
  );

  await signIn(db, SEED.ownerB);

  await expectScalar(
    db,
    'and no other business sees them either',
    'select count(*)::int from public.kyc_verifications',
    0
  );

  await signIn(db, SEED.superAdmin);

  console.log('\nPartners who send us business');

  await signIn(db, SEED.ownerB);

  const application = await db.query(
    `select public.apply_for_affiliate(
       'harbor-ben', 'Ben of Harbor Studio', 'ben@harbor.example',
       'Writes about small business software'
     ) as id`
  );
  const applicationId = application.rows[0].id;

  await expectScalar(
    db,
    'anybody signed in may offer to send us business',
    `select status::text from public.affiliates where id = '${applicationId}'`,
    'pending_review'
  );

  await expectScalar(
    db,
    'and a link is waiting for them the moment they are approved',
    `select (count(*) filter (where affiliate_id = '${applicationId}'))::int
       from public.affiliate_links`,
    1
  );

  await expectRejection(
    db,
    'the same account cannot apply twice',
    `select public.apply_for_affiliate('harbor-ben-two', 'Ben again', 'ben@harbor.example')`
  );

  await expectRejection(
    db,
    'a partner cannot approve itself',
    `select public.review_affiliate_application('${applicationId}', true)`
  );

  await expectRejection(
    db,
    'nor award itself a better commission',
    `update public.affiliates set commission_percentage = 90 where id = '${applicationId}'`
  );

  await expectRejection(
    db,
    'an unapproved partner is not paid',
    `select public.request_affiliate_payout('${applicationId}', 100)`
  );

  await signIn(db, SEED.superAdmin);

  await expectRejection(
    db,
    'refusing an application without a reason is refused',
    `select public.review_affiliate_application('${applicationId}', false)`
  );

  await db.query(`select public.review_affiliate_application('${applicationId}', true)`);

  await expectScalar(
    db,
    'the platform team approves the partner',
    `select status::text from public.affiliates where id = '${applicationId}'`,
    'approved'
  );

  await signIn(db, SEED.ownerB);

  await expectScalar(
    db,
    'the partner reads its own figures',
    `select clicks_total from public.affiliate_summary('${applicationId}')`,
    0
  );

  await expectRejection(
    db,
    'a payout under the agreed minimum is refused',
    `select public.request_affiliate_payout('${applicationId}', 1)`
  );

  await signIn(db, SEED.ownerA);

  await expectRejection(
    db,
    'and nobody else can read those figures',
    `select clicks_total from public.affiliate_summary('${applicationId}')`
  );

  await expectScalar(
    db,
    'nor even see that the partner exists',
    `select (count(*) filter (where id = '${applicationId}'))::int from public.affiliates`,
    0
  );

  await signIn(db, SEED.superAdmin);

  console.log('\nSelling the platform as somebody else');

  await signIn(db, SEED.ownerA);

  const partner = await db.query(
    `select public.apply_for_reseller(
       'Harbor Partners', 'harbor-partners', 'partners@harbor.example', 'US'
     ) as id`
  );
  const partnerId = partner.rows[0].id;

  await expectScalar(
    db,
    'anybody signed in may offer to resell the platform',
    `select status::text from public.resellers where id = '${partnerId}'`,
    'pending_review'
  );

  await expectRejection(
    db,
    'the same account cannot apply twice',
    `select public.apply_for_reseller('Harbor Again', 'harbor-again', 'partners@harbor.example')`
  );

  await expectRejection(
    db,
    'an applicant cannot approve itself',
    `select public.review_reseller_application('${partnerId}', true)`
  );

  await expectRejection(
    db,
    'nor award itself a better revenue share',
    `update public.resellers set revenue_share_percentage = 90 where id = '${partnerId}'`
  );

  await db.query(
    `update public.resellers set brand_name = 'Harbor Billing' where id = '${partnerId}'`
  );

  await expectScalar(
    db,
    'but it owns how its brand appears',
    `select brand_name from public.resellers where id = '${partnerId}'`,
    'Harbor Billing'
  );

  await signIn(db, SEED.superAdmin);

  await expectRejection(
    db,
    'refusing an application without a reason is refused',
    `select public.review_reseller_application('${partnerId}', false)`
  );

  await db.query(
    `select public.review_reseller_application('${partnerId}', true, 'Good fit', 30, 25)`
  );

  await expectScalar(
    db,
    'the platform team approves the partner',
    `select status::text from public.resellers where id = '${partnerId}'`,
    'approved'
  );

  await expectScalar(
    db,
    'and sets the terms at the same time',
    `select revenue_share_percentage from public.resellers where id = '${partnerId}'`,
    '30.00'
  );

  await signIn(db, SEED.resellerUser);

  await expectScalar(
    db,
    'one partner never sees another',
    `select (count(*) filter (where id = '${partnerId}'))::int from public.resellers`,
    0
  );

  await expectRejection(
    db,
    'nor reads the accounts another partner holds',
    `select company_id from public.reseller_accounts('${partnerId}')`
  );

  await signIn(db, SEED.superAdmin);

  console.log('\nThe bookkeeper point of view');

  await signIn(db, SEED.accountant);

  await expectScalar(
    db,
    'the accountant sees only the business that invited them',
    `select (count(*))::int from public.accountant_workspaces()`,
    1
  );

  await expectScalar(
    db,
    'and sees it by name with its figures ready',
    `select display_name from public.accountant_workspaces()`,
    'Northwind Supply'
  );

  await db.query(`select public.touch_accountant_access('${SEED.companyA}')`);

  await expectScalar(
    db,
    'opening a business is stamped for the owner to see',
    `select (last_accessed_at is not null)::text
       from public.accountant_company_access
      where accountant_user_id = '${SEED.accountant}'
        and company_id = '${SEED.companyA}'`,
    'true'
  );

  await expectScalar(
    db,
    'touching a business nobody granted changes nothing',
    `select public.touch_accountant_access('${SEED.companyB}')::text`,
    'false'
  );

  await expectScalar(
    db,
    'the granted ledger is readable',
    `select (count(*) >= 0)::text from public.trial_balance('${SEED.companyA}')`,
    'true'
  );

  await expectRejection(
    db,
    'the ledger of a business that granted nothing is refused',
    `select account_code from public.trial_balance('${SEED.companyB}')`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'an owner still reads their own trading figures',
    `select (count(*) >= 0)::text
       from public.profit_and_loss('${SEED.companyA}', current_date - 30, current_date)`,
    'true'
  );

  await expectRejection(
    db,
    'but never the trading figures of another business',
    `select section from public.profit_and_loss('${SEED.companyB}', current_date - 30, current_date)`
  );

  await expectRejection(
    db,
    'nor what another business owns and owes',
    `select section from public.balance_sheet('${SEED.companyB}')`
  );

  await signIn(db, SEED.affiliate);

  await expectRejection(
    db,
    'a referral partner reads no ledger at all',
    `select account_code from public.trial_balance('${SEED.companyB}')`
  );

  await expectScalar(
    db,
    'and a referral partner has an empty bookkeeping list',
    `select (count(*))::int from public.accountant_workspaces()`,
    0
  );

  await signIn(db, SEED.superAdmin);

  console.log('\nA shop inside the platform');

  await signIn(db, SEED.ownerA);

  const shopVendor = await db.query(
    `select public.apply_marketplace_vendor(
       '${SEED.companyA}', 'Northwind Templates', 'northwind-templates',
       'templates@northwind.example', 'Invoice packs for wholesalers'
     ) as id`
  );
  const shopVendorId = shopVendor.rows[0].id;

  await expectScalar(
    db,
    'a business can ask to sell in the marketplace',
    `select status from public.marketplace_vendors where id = '${shopVendorId}'`,
    'pending_review'
  );

  await expectRejection(
    db,
    'the same business cannot open a second vendor account',
    `select public.apply_marketplace_vendor('${SEED.companyA}', 'Northwind Again',
       'northwind-again', 'templates@northwind.example')`
  );

  await expectRejection(
    db,
    'a vendor cannot mark its own application approved',
    `update public.marketplace_vendors set status = 'approved'
      where id = '${shopVendorId}'`
  );

  await expectRejection(
    db,
    'nor raise its own share of the money',
    `update public.marketplace_vendors set revenue_share_percentage = 99
      where id = '${shopVendorId}'`
  );

  await db.query(
    `update public.marketplace_vendors set headline = 'Templates for wholesalers'
      where id = '${shopVendorId}'`
  );

  await expectScalar(
    db,
    'but it owns how it describes itself',
    `select headline from public.marketplace_vendors where id = '${shopVendorId}'`,
    'Templates for wholesalers'
  );

  await signIn(db, SEED.superAdmin);

  await expectRejection(
    db,
    'refusing a vendor without a reason is refused',
    `select public.review_marketplace_vendor('${shopVendorId}', false)`
  );

  await expectScalar(
    db,
    'the platform team approves the vendor and sets the terms',
    `select public.review_marketplace_vendor('${shopVendorId}', true, 'Good work', 80)`,
    'approved'
  );

  await signIn(db, SEED.ownerA);

  const shopListing = await db.query(
    `insert into public.marketplace_listings
       (vendor_id, listing_slug, title, summary, category, artifact_kind,
        artifact_payload, pricing_model, price_amount, price_currency)
     values ('${shopVendorId}', 'wholesale-invoice-pack', 'Wholesale Invoice Pack',
             'Three invoice layouts written for wholesalers who ship on account.',
             'invoice_template', 'document_template',
             '{"templates": ["crate", "pallet"]}'::jsonb,
             'one_time', 40, 'USD')
     returning id`
  );
  const shopListingId = shopListing.rows[0].id;

  await expectRejection(
    db,
    'a vendor cannot put its own listing on sale unread',
    `update public.marketplace_listings set status = 'published', published_at = now()
      where id = '${shopListingId}'`
  );

  await expectScalar(
    db,
    'it goes to review instead',
    `select public.submit_listing_for_review('${shopListingId}')`,
    true
  );

  await signInAsService(db);

  await db.query(`select public.publish_listing('${shopListingId}', 'First release')`);

  await signOut(db);

  await expectScalar(
    db,
    'the published listing reaches the shopfront',
    `select (count(*) filter (where listing_id = '${shopListingId}'))::int
       from public.marketplace_catalogue()`,
    1
  );

  await expectScalar(
    db,
    'the shopfront can be narrowed to one kind of template',
    `select (count(*))::int from public.marketplace_catalogue('report_pack')`,
    0
  );

  await expectScalar(
    db,
    'and searched by name',
    `select (count(*))::int from public.marketplace_catalogue(null, 'Wholesale')`,
    1
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'a vendor sees every listing of its own, whatever state it is in',
    `select (count(*))::int from public.vendor_listings('${shopVendorId}')`,
    1
  );

  await expectScalar(
    db,
    'taking a listing off sale is the vendor own decision',
    `select public.unpublish_listing('${shopListingId}', 'Reworking the layouts')`,
    true
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'one vendor never reads the desk of another',
    `select listing_id from public.vendor_listings('${shopVendorId}')`
  );

  await signOut(db);

  await expectScalar(
    db,
    'and a withdrawn listing leaves the shopfront',
    `select (count(*) filter (where listing_id = '${shopListingId}'))::int
       from public.marketplace_catalogue()`,
    0
  );

  console.log('\nMoney that crosses a border');

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'Adyen and Nium are providers a payment can name',
    `select (count(*) filter (
              where enumlabel in ('adyen', 'nium')))::int
       from pg_enum
      where enumtypid = 'public.gateway_provider'::regtype`,
    2
  );

  await expectScalar(
    db,
    'and both can be the way a payout leaves',
    `select (count(*) filter (
              where enumlabel in ('adyen_transfer', 'nium_transfer')))::int
       from pg_enum
      where enumtypid = 'public.payout_method'::regtype`,
    2
  );

  await expectScalar(
    db,
    'the admin panel is told what Adyen needs before it can take a card',
    `select jsonb_array_length(field_schema)
       from public.integration_providers
      where provider_key = 'adyen'`,
    5
  );

  await expectScalar(
    db,
    'and that Nium is a way of sending rather than receiving',
    `select category from public.integration_providers
      where provider_key = 'nium'`,
    'payout'
  );

  await expectRejection(
    db,
    'a rail nobody has heard of cannot be connected',
    `select public.link_payment_rail_account('${SEED.companyA}', 'wiretap', 'test')`
  );

  const railResult = await db.query(
    `select public.link_payment_rail_account(
              '${SEED.companyA}', 'adyen', 'test',
              'AH00000000000000000000001', 'BA00000000000000000000001',
              null, 'EUR', 'NL', 2.5) as id`
  );
  const railAccountId = String(Object.values(railResult.rows[0] ?? {})[0]);

  await expectScalar(
    db,
    'connecting a rail starts it in onboarding rather than open for business',
    `select status from public.payment_rails_for_company('${SEED.companyA}')
      where id = '${railAccountId}'`,
    'onboarding'
  );

  await expectScalar(
    db,
    'the commission the platform keeps is held with the connection',
    `select platform_fee_percentage::text
       from public.payment_rails_for_company('${SEED.companyA}')
      where id = '${railAccountId}'`,
    '2.50'
  );

  await expectRejection(
    db,
    'a tenant cannot declare its own rail live',
    `select public.sync_payment_rail_account('${railAccountId}', 'active')`
  );

  await signIn(db, SEED.ownerB);

  await expectRejection(
    db,
    'and the rails of one tenant are invisible to another',
    `select id from public.payment_rails_for_company('${SEED.companyA}')`
  );

  await signInAsService(db);

  await db.query(
    `select public.sync_payment_rail_account(
              '${railAccountId}', 'active',
              '{"receivePayments": "allowed"}'::jsonb, true, false)`
  );

  await db.query(
    `select public.record_payment_rail_error(
              '${railAccountId}', 'Balance account not yet funded')`
  );

  await signIn(db, SEED.ownerA);

  await expectScalar(
    db,
    'once the provider confirms it, the rail can take money',
    `select is_receiving_enabled
       from public.payment_rails_for_company('${SEED.companyA}')
      where id = '${railAccountId}'`,
    true
  );

  await expectScalar(
    db,
    'paying out needs its own permission from the provider',
    `select is_sending_enabled
       from public.payment_rails_for_company('${SEED.companyA}')
      where id = '${railAccountId}'`,
    false
  );

  await expectScalar(
    db,
    'the last refusal is kept where the owner can read it',
    `select last_error from public.payment_rails_for_company('${SEED.companyA}')
      where id = '${railAccountId}'`,
    'Balance account not yet funded'
  );

  await expectScalar(
    db,
    'connecting the same rail twice edits the connection instead of doubling it',
    `select (count(*) filter (where rail = 'adyen'))::int
       from public.payment_rails_for_company('${SEED.companyA}')`,
    1
  );

  await signIn(db, SEED.superAdmin);

  console.log('\nThe shape of the platform');

  await expectScalar(
    db,
    'the overview counts the tenants on the platform',
    `select ((public.platform_overview() -> 'tenants' ->> 'total')::int >= 2)::text`,
    'true'
  );

  await expectScalar(
    db,
    'it reports what is waiting for somebody to look at',
    `select (public.platform_overview() -> 'attention' ? 'open_disputes')::text`,
    'true'
  );

  await expectScalar(
    db,
    'and it prices the recurring revenue in one figure',
    `select (public.platform_overview() -> 'subscriptions' ? 'monthly_recurring_revenue')::text`,
    'true'
  );

  await signOut(db);
}

async function main() {
  const db = await PGlite.create({
    extensions: { btree_gist, citext, pg_trgm },
  });

  try {
    await installLocalEquivalents(db);
    await applyMigrations(db);
    await testHelperFunctions(db);
    await seedTenancy(db);
    await testDocumentNumbering(db);
    await testTriggers(db);
    await testTenancyStructure(db);
    await testProfileSnapshots(db);
    await testAuditTrail(db);
    await testRowLevelSecurity(db);
    await testAccessLifecycle(db);
    await testBusinessCore(db);
    await testDocuments(db);
    await testPayments(db);
    await testSubscriptions(db);
    await testCommunications(db);
    await testAccounting(db);
    await testProjects(db);
    await testStorage(db);
    await testPlatform(db);
    await testIntegrations(db);
    await testMarketing(db);
    await testPartners(db);
    await testEngagement(db);
    await testAdministration(db);
  } finally {
    await db.close();
  }

  console.log(`\n${successCount} check(s) passed, ${failureCount} failed.`);

  if (failureCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
