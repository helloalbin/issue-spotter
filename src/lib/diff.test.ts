import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareBy, sameEntry } from './diff.ts';

const id = (s: string) => s;

test('recognises the same point worded a little differently', () => {
	assert.equal(sameEntry('Negligence of the landlord', 'negligence of the landlord.'), true);
	assert.equal(sameEntry('Negligence of the landlord', "Landlord's negligence"), true);
	assert.equal(sameEntry('M.C. Mehta v. Union of India', 'M C Mehta vs Union Of India & Ors'), true);
	assert.equal(sameEntry('The Indian Contract Act, 1872', 'Indian Contract Act, 1872'), true);
});

test('does not confuse different points, or different years of the same act', () => {
	assert.equal(sameEntry('Negligence of the landlord', 'Breach of duty to maintain premises'), false);
	assert.equal(sameEntry('Wrongful detention', 'Wrongful confinement of a passenger'), false);
	assert.equal(sameEntry('The Transfer of Property Act, 1882', 'The Transfer of Property Act, 1892'), false);
	assert.equal(sameEntry('', 'anything'), false);
});

test('splits an updated list into new, still applying and set aside, keeping positions', () => {
	const before = ['Wrongful detention', 'Seizure of the passport', 'Right to travel'];
	const after = ['Wrongful detention', 'Negligent search procedure', 'Seizure of the passport', 'Damages for the lost flight'];
	const { fresh, kept, gone } = compareBy(before, after, id);

	assert.deepEqual(fresh, [{ item: 'Negligent search procedure', index: 1 }, { item: 'Damages for the lost flight', index: 3 }]);
	assert.deepEqual(kept, [{ item: 'Wrongful detention', index: 0 }, { item: 'Seizure of the passport', index: 2 }]);
	assert.deepEqual(gone, ['Right to travel']);
});

test('an earlier entry can match only one new entry', () => {
	const { fresh, kept } = compareBy(['Negligence of the landlord'], ['Negligence of the landlord', 'Landlord negligence in repairs'], id);
	assert.equal(kept.length, 1);
	assert.equal(fresh.length, 1, 'the second phrasing is new, not a second match');
});

test('with nothing before, everything is new; with nothing after, everything is set aside', () => {
	assert.deepEqual(compareBy([], ['a b', 'c d'], id).fresh.map((p) => p.item), ['a b', 'c d']);
	assert.deepEqual(compareBy(['a b'], [], id).gone, ['a b']);
});

test('works on objects through a key', () => {
	const prev = [{ name: 'D.K. Basu v. State of West Bengal' }];
	const next = [{ name: 'D K Basu vs State Of West Bengal' }, { name: 'Maneka Gandhi v. Union of India' }];
	const { fresh, kept } = compareBy(prev, next, (p) => p.name);
	assert.equal(kept.length, 1);
	assert.equal(fresh[0].item.name, 'Maneka Gandhi v. Union of India');
});
