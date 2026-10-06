// tests/unit/csv-import.test.ts
// Reading the spreadsheet a business arrives with. Real exports are messy,
// so the tests use messy input on purpose.

import { describe, expect, it } from 'vitest';

import { MAXIMUM_ROWS, parseDelimitedText } from '@/lib/imports/csv';

describe('reading an export', () => {
  it('reads a plain comma separated file', () => {
    const table = parseDelimitedText('display_name,email\nNorthwind,accounts@northwind.test');

    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]?.['display_name']).toBe('Northwind');
    expect(table.rows[0]?.['email']).toBe('accounts@northwind.test');
  });

  it('survives the byte order mark a spreadsheet leaves at the front', () => {
    const table = parseDelimitedText('\uFEFFdisplay_name,email\nNorthwind,a@b.test');

    expect(table.headers[0]).toBe('display_name');
  });

  it('reads a file that uses semicolons, as much of Europe exports', () => {
    const table = parseDelimitedText('display_name;email\nNorthwind;a@b.test');

    expect(table.rows[0]?.['email']).toBe('a@b.test');
  });

  it('keeps a comma that is inside a quoted field', () => {
    const table = parseDelimitedText('display_name,legal_name\nNorthwind,"Northwind, Limited"');

    expect(table.rows[0]?.['legal_name']).toBe('Northwind, Limited');
  });

  it('understands a doubled quote inside a quoted field', () => {
    const table = parseDelimitedText('name,note\nThing,"He said ""yes"" twice"');

    expect(table.rows[0]?.['note']).toBe('He said "yes" twice');
  });

  it('turns a header with spaces into something a column can be called', () => {
    const table = parseDelimitedText('Display Name,Payment Terms\nNorthwind,30');

    expect(table.headers).toContain('display_name');
    expect(table.rows[0]?.['payment_terms']).toBe('30');
  });

  it('handles lines ending the way an older operating system ends them', () => {
    const table = parseDelimitedText('name,sku\r\nAudit,A-1\r\nBuild,B-2');

    expect(table.rows).toHaveLength(2);
  });

  it('fills a missing trailing field rather than dropping the row', () => {
    const table = parseDelimitedText('display_name,email,phone\nNorthwind,a@b.test');

    expect(table.rows[0]?.['phone']).toBe('');
  });

  it('says so when the file is empty', () => {
    expect(parseDelimitedText('   ').problem).not.toBeNull();
  });

  it('says so when the first line is not a list of columns', () => {
    expect(parseDelimitedText('just one column\nvalue').problem).not.toBeNull();
  });

  it('stops at the row limit and says what it did', () => {
    const lines = ['name,sku'];

    for (let index = 0; index < MAXIMUM_ROWS + 50; index += 1) {
      lines.push(`Thing ${String(index)},SKU-${String(index)}`);
    }

    const table = parseDelimitedText(lines.join('\n'));

    expect(table.rows).toHaveLength(MAXIMUM_ROWS);
    expect(table.problem).not.toBeNull();
  });
});
