import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../src/lib/csv.ts';
import { fill } from '../src/lib/settings-shared.ts';
import { slugify } from '../src/lib/inventory-schema.ts';
import { nightsBetween, money, addDays } from '../src/lib/format.ts';
import { requireEnv } from '../src/lib/env.ts';
import { isSameOrigin } from '../src/lib/origin.ts';

test('CSV quotes fields and neutralises spreadsheet formulas', () => {
  const out = toCsv([{ a: 'x,y', b: 'say "hi"', c: '=SUM(A1)', d: -5, e: null }]);
  assert.ok(out.includes('"x,y"'));
  assert.ok(out.includes('"say ""hi"""'));
  assert.ok(out.includes("'=SUM(A1)"));
  assert.ok(out.includes(',-5,'));          // plain negative numbers are left alone
  assert.ok(out.startsWith('﻿a,b,c,d,e'));
});

test('copy placeholders are filled from live values', () => {
  const s = { rooms: 32, free_cancel_hours: 48 };
  assert.equal(fill('{rooms} rooms, {free_cancel_hours}h, {unknown}', s), '32 rooms, 48h, {unknown}');
});

test('slugify makes URL-safe slugs', () => {
  assert.equal(slugify('  Royal Presidential Suite! '), 'royal-presidential-suite');
  assert.equal(slugify('Café & Terrace #2'), 'caf-terrace-2');
});

test('date and money helpers', () => {
  assert.equal(nightsBetween('2026-12-01', '2026-12-04'), 3);
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(money(1234567), '₹12,34,567');
});

test('required secrets have no fallback: missing, short or placeholder values are rejected', () => {
  delete process.env.TEST_SECRET;
  assert.throws(() => requireEnv('TEST_SECRET'), /not set/);
  process.env.TEST_SECRET = 'change-me-to-a-long-random-string';
  assert.throws(() => requireEnv('TEST_SECRET'), /real value/);
  process.env.TEST_SECRET = 'short';
  assert.throws(() => requireEnv('TEST_SECRET', 32), /min 32/);
  process.env.TEST_SECRET = 'x'.repeat(40);
  assert.equal(requireEnv('TEST_SECRET', 32).length, 40);
  delete process.env.TEST_SECRET;
});

test('cross-site guard: same-origin and header-less requests pass, other sites are refused', () => {
  assert.equal(isSameOrigin(null, 'localhost:3000'), true);                                   // curl, scripts, server-to-server
  assert.equal(isSameOrigin('http://localhost:3000', 'localhost:3000'), true);               // the app's own pages
  assert.equal(isSameOrigin('https://evil.example', 'localhost:3000'), false);               // another website
  assert.equal(isSameOrigin('http://localhost:3001', 'localhost:3000'), false);              // same host, different port
  assert.equal(isSameOrigin('null', 'localhost:3000'), false);                               // sandboxed / opaque origin
  assert.equal(isSameOrigin('not a url', 'localhost:3000'), false);
  assert.equal(isSameOrigin('https://app.example.com', 'internal:3000', 'app.example.com'), true);          // behind a proxy
  assert.equal(isSameOrigin('https://app.example.com', 'internal:3000', 'app.example.com, other'), true);
  assert.equal(isSameOrigin('https://app.example.com', 'internal:3000', null, 'app.example.com'), true);    // APP_URL
  assert.equal(isSameOrigin('https://APP.example.com', 'app.example.com'), true);            // case-insensitive
});
