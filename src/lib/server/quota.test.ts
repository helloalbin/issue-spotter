import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentPeriod, periodEnd } from './quota.ts';

const at = (iso: string) => Date.parse(iso);

test('a daily counter is keyed by the UTC day, a monthly one by the UTC month', () => {
	assert.equal(currentPeriod(undefined, at('2026-11-08T23:59:59Z')), '2026-11-08');
	assert.equal(currentPeriod('month', at('2026-11-08T23:59:59Z')), '2026-11');
	assert.equal(currentPeriod('month', at('2026-12-01T00:00:00Z')), '2026-12');
});

test('a monthly counter starts over on the first of next month, including across a year', () => {
	assert.equal(periodEnd('month', at('2026-11-08T10:00:00Z')), at('2026-12-01T00:00:00Z'));
	assert.equal(periodEnd('month', at('2026-12-31T23:59:59Z')), at('2027-01-01T00:00:00Z'));
	assert.equal(periodEnd('month', at('2028-02-29T12:00:00Z')), at('2028-03-01T00:00:00Z'));
});

test('a daily counter starts over at the next UTC midnight', () => {
	assert.equal(periodEnd(undefined, at('2026-11-08T10:00:00Z')), at('2026-11-09T00:00:00Z'));
});
