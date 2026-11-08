import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityKey, clearPreferences, exportData, storageSummary } from './data-controls.ts';

const fake = (entries: Record<string, string>) => {
	const data = new Map(Object.entries(entries));
	return { getItem: (k: string) => data.get(k) ?? null, removeItem: (k: string) => void data.delete(k), keys: () => [...data.keys()] };
};

test('the activity key is the email when signed in, and one shared key for a visitor', () => {
	assert.equal(activityKey('a@b.c'), 'legalspotter:activity:a@b.c');
	assert.equal(activityKey(null), 'legalspotter:activity:anonymous');
	assert.equal(activityKey(undefined), 'legalspotter:activity:anonymous');
});

test('the export holds the person’s own activity and preferences, and nobody else’s', () => {
	const storage = fake({
		'legalspotter:activity:me@x.com': JSON.stringify({ version: 1, days: { '2026-11-08': { runs: 2, issues: 3 } } }),
		'legalspotter:activity:other@x.com': JSON.stringify({ version: 1, days: { '2026-11-01': { runs: 99, issues: 0 } } }),
		theme: 'light',
		'legalspotter:speech': JSON.stringify({ rate: 1.5 })
	});
	const out = exportData(storage, 'me@x.com', new Date(2026, 10, 9, 23, 30));
	const data = JSON.parse(out.text);
	assert.equal(out.fileName, 'legalspotter-data-2026-11-09.json');
	assert.equal(data.signedInAs, 'me@x.com');
	assert.deepEqual(data.activity.days, { '2026-11-08': { runs: 2, issues: 3 } });
	assert.deepEqual(data.preferences, { theme: 'light', verificationPane: null, speech: { rate: 1.5 } });
	assert.ok(!out.text.includes('other@x.com') && !out.text.includes('99'));
	assert.ok(out.text.endsWith('\n'));
});

test('with nothing stored the export is still a valid file, with empty values', () => {
	const data = JSON.parse(exportData(fake({}), null, new Date(2026, 0, 2, 9)).text);
	assert.equal(data.activity, null);
	assert.equal(data.signedInAs, null);
	assert.deepEqual(data.preferences, { theme: null, verificationPane: null, speech: null });
});

test('the list of what is kept says whether each item is there now and how big it is', () => {
	const items = storageSummary(fake({ theme: 'dark', 'legalspotter:activity:me@x.com': '{"version":1}' }), 'me@x.com');
	assert.deepEqual(items.map((i) => i.name), ['anon_id', 'theme', 'pane', 'legalspotter:speech', 'legalspotter:activity']);
	assert.equal(items[0].where, 'Cookie');
	assert.equal(items[0].present, null, 'the cookie cannot be read from the page');
	assert.deepEqual([items[1].present, items[1].bytes], [true, 4]);
	assert.deepEqual([items[2].present, items[2].bytes], [false, null]);
	assert.equal(items[4].present, true);
});

test('clearing preferences removes them and keeps the activity numbers', () => {
	const storage = fake({ theme: 'light', pane: 'closed', 'legalspotter:speech': '{}', 'legalspotter:activity:me@x.com': '{}' });
	clearPreferences(storage);
	assert.deepEqual(storage.keys(), ['legalspotter:activity:me@x.com']);
});
