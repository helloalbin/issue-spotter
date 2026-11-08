import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyActivity, recentDays, recordRun } from './activity.ts';
import { describeReset, leftShare, limitRows } from './usage.ts';
import type { QuotaInfo } from './spotter.ts';

const quota = (limit: number, remaining: number, resetsAt = 0): QuotaInfo => ({ signedIn: true, limit, remaining, resetsAt });

test('the limits are listed in order, and one that has not been read is left out', () => {
	const rows = limitRows({ searches: quota(20, 15), research: quota(3, 3), compare: null, verify: quota(3, 0) });
	assert.deepEqual(rows.map((r) => r.key), ['searches', 'research', 'verify']);
	assert.equal(rows[0].label, 'Searches');
	assert.deepEqual(limitRows({ searches: null, research: null, compare: null, verify: null }), []);
});

test('what is left never goes below zero or above the limit', () => {
	const rows = limitRows({ searches: quota(5, 9), research: quota(3, -2), compare: null, verify: null });
	assert.deepEqual(rows.map((r) => r.remaining), [5, 0]);
	assert.equal(leftShare({ limit: 20, remaining: 15 }), 0.75);
	assert.equal(leftShare({ limit: 0, remaining: 0 }), 0);
});

test('a reset is described in minutes, hours, or as a date', () => {
	const now = new Date(2026, 10, 9, 12, 0).getTime();
	assert.equal(describeReset(now + 42 * 60_000, now), 'Resets in 42m');
	assert.equal(describeReset(now + (6 * 60 + 12) * 60_000, now), 'Resets in 6h 12m');
	assert.equal(describeReset(new Date(2026, 11, 1).getTime(), now), 'Resets Dec 1');
	assert.equal(describeReset(now - 1, now), 'Resets now');
});

test('recent days are the last thirty, oldest first, ending today, with a total', () => {
	const now = new Date(2026, 10, 9, 12).getTime();
	let a = recordRun(emptyActivity(), { at: now, kind: 'analysis' });
	a = recordRun(a, { at: now - 86400000, kind: 'analysis' });
	a = recordRun(a, { at: now - 86400000, kind: 'analysis' });
	a = recordRun(a, { at: now - 40 * 86400000, kind: 'analysis' });
	const recent = recentDays(a, now);
	assert.equal(recent.days.length, 30);
	assert.equal(recent.days.at(-1)!.date, '2026-11-09');
	assert.equal(recent.days[0].date, '2026-10-11');
	assert.deepEqual([recent.days.at(-1)!.count, recent.days.at(-2)!.count, recent.total], [1, 2, 3]);
	assert.equal(recent.days.at(-1)!.label, 'Nov 9, 2026');
});
