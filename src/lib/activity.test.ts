import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyActivity, formatDuration, heatmap, levelOf, parseActivity, recordRun, siteOf, streaks, topShare, totalsOf, weekly } from './activity.ts';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

test('a run adds to its local day, the totals and the maps; the input is untouched', () => {
	const before = emptyActivity();
	const after = recordRun(before, { at: at(2026, 11, 8), kind: 'analysis', ms: 19_000, issues: 4, skills: ['summarize', 'summarize'], acts: ['Transfer of Property Act, 1882', ' '], jurisdiction: 'India' });
	assert.deepEqual(after.days['2026-11-08'], { runs: 1, issues: 4 });
	assert.equal(after.longestMs, 19_000);
	assert.deepEqual(after.skills, { summarize: 1 });
	assert.deepEqual(after.acts, { 'Transfer of Property Act, 1882': 1 });
	assert.deepEqual(after.jurisdictions, { India: 1 });
	assert.deepEqual(before, emptyActivity());
});

test('late evening stays on its own day, and the longest run only ever grows', () => {
	let a = recordRun(emptyActivity(), { at: at(2026, 11, 8, 23), kind: 'verify', ms: 50_000, citations: 4 });
	a = recordRun(a, { at: at(2026, 11, 9, 0), kind: 'verify', ms: 10_000, citations: 2 });
	assert.deepEqual(Object.keys(a.days).sort(), ['2026-11-08', '2026-11-09']);
	assert.equal(a.longestMs, 50_000);
	assert.equal(a.citations, 6);
});

test('pages are tallied by the site they were read at', () => {
	assert.equal(siteOf('indiankanoon.org'), 'Indian Kanoon');
	assert.equal(siteOf('api.sci.gov.in'), 'Supreme Court of India');
	assert.equal(siteOf('www.indiacode.nic.in'), 'India Code');
	assert.equal(siteOf('delhihighcourt.nic.in'), 'High Courts');
	assert.equal(siteOf('example.com'), null);
	const a = recordRun(emptyActivity(), { at: at(2026, 11, 8), kind: 'research', hosts: ['indiankanoon.org', 'indiankanoon.org', 'api.sci.gov.in', 'example.com'] });
	assert.deepEqual(a.sites, { 'Indian Kanoon': 2, 'Supreme Court of India': 1 });
});

const daysOf = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, { runs: 1, issues: 0 }]));

test('streaks: the longest run of days, and the one still going', () => {
	const days = daysOf('2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-07', '2026-11-08', '2026-11-09');
	assert.deepEqual(streaks(days, at(2026, 11, 9)), { longest: 4, current: 3 });
});

test('a streak survives a day not yet used, but not a missed day', () => {
	const days = daysOf('2026-11-07', '2026-11-08');
	assert.equal(streaks(days, at(2026, 11, 9)).current, 2, 'nothing yet today');
	assert.equal(streaks(days, at(2026, 11, 10)).current, 0, 'a whole day missed');
	assert.deepEqual(streaks({}, at(2026, 11, 9)), { longest: 0, current: 0 });
});

test('streaks count across month ends and a clock change', () => {
	const days = daysOf('2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02');
	assert.equal(streaks(days, at(2026, 11, 2)).longest, 4);
	assert.equal(streaks(daysOf('2026-03-28', '2026-03-29', '2026-03-30'), at(2026, 3, 30)).current, 3);
});

test('totals add up days, issues and the skills used', () => {
	let a = recordRun(emptyActivity(), { at: at(2026, 11, 8), kind: 'analysis', issues: 3, skills: ['draft'] });
	a = recordRun(a, { at: at(2026, 11, 9), kind: 'analysis', issues: 5, skills: ['summarize', 'draft'] });
	assert.deepEqual(totalsOf(a, at(2026, 11, 9)), { analyses: 2, issues: 8, longestMs: 0, longestStreak: 2, currentStreak: 2, skillsUsed: 2, citations: 0 });
});

test('durations are written for people', () => {
	assert.equal(formatDuration(0), '—');
	assert.equal(formatDuration(400), '<1s');
	assert.equal(formatDuration(45_000), '45s');
	assert.equal(formatDuration(19 * 60_000 + 35_000), '19m 35s');
	assert.equal(formatDuration(3_720_000), '1h 2m');
});

test('the most used entry and its share', () => {
	assert.equal(topShare({}), null);
	assert.deepEqual(topShare({ A: 3, B: 1, C: 0 }), { name: 'A', pct: 75 });
	assert.deepEqual(topShare({ B: 2, A: 2 }), { name: 'A', pct: 50 }, 'a tie goes to the first name');
});

test('levels compare a day with the busiest one in view', () => {
	assert.deepEqual([0, 1, 5, 10, 14].map((c) => levelOf(c, 14)), [0, 1, 2, 3, 4]);
	assert.equal(levelOf(1, 1), 4);
	assert.equal(levelOf(3, 0), 0);
});

test('the heatmap is 53 columns of 7 days ending with today, with month labels', () => {
	const now = at(2026, 11, 9);
	const a = recordRun(recordRun(emptyActivity(), { at: now, kind: 'analysis' }), { at: now, kind: 'analysis' });
	const map = heatmap(a, now);
	assert.equal(map.columns.length, 53);
	assert.ok(map.columns.every((column) => column.length === 7));
	const today = map.columns.flat().find((cell) => cell.date === '2026-11-09')!;
	assert.deepEqual([today.count, today.level, today.future], [2, 4, false]);
	assert.ok(map.columns.at(-1)!.some((cell) => cell.future), 'days after today are not filled in');
	assert.equal(map.total, 2);
	assert.equal(map.months.length, 13);
	assert.equal(map.months.at(-1)!.label, 'Nov');
});

test('weekly counts and a running total that includes everything before the window', () => {
	const now = at(2026, 11, 9);
	let a = recordRun(emptyActivity(), { at: at(2025, 1, 5), kind: 'analysis' });
	a = recordRun(a, { at: now, kind: 'analysis' });
	const bars = weekly(a, now, 4);
	assert.equal(bars.length, 4);
	assert.deepEqual(bars.at(-1), { label: 'Week of Nov 8', count: 1, total: 2 });
	assert.equal(bars[0].total, 1);
});

test('stored data that is the wrong shape is dropped, and good data survives a round trip', () => {
	assert.deepEqual(parseActivity(null), emptyActivity());
	assert.deepEqual(parseActivity('not json'), emptyActivity());
	assert.deepEqual(parseActivity('{"version":2}'), emptyActivity());
	const a = recordRun(emptyActivity(), { at: at(2026, 11, 8), kind: 'analysis', issues: 2, acts: ['X Act'], ms: 5000 });
	assert.deepEqual(parseActivity(JSON.stringify(a)), a);
	const bad = parseActivity(JSON.stringify({ version: 1, days: { 'nope': { runs: 1 }, '2026-11-08': { runs: -3 }, '2026-11-09': { runs: 2 } }, acts: { A: 'x', B: 2 } }));
	assert.deepEqual(bad.days, { '2026-11-09': { runs: 2, issues: 0 } });
	assert.deepEqual(bad.acts, { B: 2 });
});
