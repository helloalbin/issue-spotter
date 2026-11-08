import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ResearchBrief } from '../spotter.ts';
import { claimsOf, pickSources, quoteSupported } from './ground.ts';

const PAGE =
	'35. On the above analysis, to give true meaning and purpose to the constitutional and the statutory mandate of Section 19(1) of the Act of 2002 of informing the arrested person of the grounds of arrest, we hold that it would be necessary, henceforth, that a copy of such written grounds of arrest is furnished to the arrested person as a matter of course and without exception.';

test('a quote copied from the page is supported, whatever the line breaks and punctuation', () => {
	assert.ok(quoteSupported('we hold that it would be necessary, henceforth, that a copy of such written grounds of arrest is furnished', PAGE));
	assert.ok(quoteSupported('we hold that it would be necessary,\nhenceforth that a copy of such WRITTEN grounds of arrest', PAGE));
});

test('a quote may start mid-sentence and change capitalisation, but not change the words', () => {
	assert.equal(
		quoteSupported('We hold that it would be necessary, henceforth, that a copy of such written grounds of arrest is furnished to the arrested person as a matter of course and without exception.', PAGE),
		true
	);
	assert.equal(
		quoteSupported('We hold that written grounds of arrest must always be given to the arrested person before any remand.', PAGE),
		false
	);
});

test('parts joined by an ellipsis must each be on the page, in order', () => {
	assert.ok(quoteSupported('informing the arrested person of the grounds of arrest … a copy of such written grounds of arrest is furnished', PAGE));
	assert.equal(quoteSupported('a copy of such written grounds of arrest is furnished … informing the arrested person of the grounds of arrest', PAGE), false);
	assert.equal(quoteSupported('informing the arrested person of the grounds … made up words that are not there at all', PAGE), false);
});

test('a quote that is too short to mean anything is not supported', () => {
	assert.equal(quoteSupported('grounds of arrest', PAGE), false);
	assert.equal(quoteSupported('', PAGE), false);
	assert.equal(quoteSupported('…', PAGE), false);
});

const brief: ResearchBrief = {
	topic: 't',
	searches: 1,
	sources: [
		{ n: 1, url: 'https://api.sci.gov.in/a.pdf', title: 'A', host: 'api.sci.gov.in', official: true },
		{ n: 2, url: 'https://indiankanoon.org/doc/1/', title: 'B', host: 'indiankanoon.org', official: false },
		{ n: 3, url: 'https://indiacode.nic.in/x', title: 'C', host: 'indiacode.nic.in', official: true }
	],
	blocks: [
		{ kind: 'heading', text: 'H' },
		{
			kind: 'paragraph',
			bullet: false,
			sentences: [
				{ text: 'Written grounds are required.', cites: [2], uncited: false },
				{ text: 'No source for this one here.', cites: [], uncited: true },
				{ text: 'The order was set aside by the court.', cites: [1], uncited: false },
				{ text: 'A third claim that is made.', cites: [2], uncited: false }
			]
		}
	]
};

test('claims are the cited sentences, numbered in order', () => {
	const claims = claimsOf(brief);
	assert.deepEqual(claims.map((c) => [c.id, c.cites]), [[1, [2]], [2, [1]], [3, [2]]]);
});

test('sources are picked by being official first, then by how many claims they carry', () => {
	assert.deepEqual(pickSources(brief, 5).map((s) => s.n), [1, 2]);
	assert.deepEqual(pickSources(brief, 1).map((s) => s.n), [1]);
	assert.deepEqual(pickSources(brief, 0), []);
});

import { closestPassage } from './ground.ts';

const LONG =
	'Introductory words of the judgment that do not matter here at all. ' +
	'As such, the action of informing the person arrested about the grounds of his arrest is sufficient compliance of Section 19 of the PML Act as also Article 22(1) of the Constitution of India, as held in Vijay Madanlal Choudhary. ' +
	'Other matters follow in later paragraphs of the order which are unrelated to this point entirely.';

test('a quote changed by a word or two snaps to the page\'s own wording', () => {
	const snapped = closestPassage('the action of informing the person arrested about the grounds of his arrest is sufficient compliance of Section 19(1) of the PML Act as also Article 22(1) of the Constitution', LONG);
	assert.ok(snapped);
	assert.ok(LONG.includes(snapped!), 'what it returns is the page\'s own text');
	assert.match(snapped!, /Section 19 of the PML Act/);
	assert.doesNotMatch(snapped!, /19\(1\) of the PML/);
});

test('a dropped word is repaired but a different claim is not matched', () => {
	assert.ok(closestPassage('the person arrested about the grounds of his arrest is sufficient compliance of Section 19 of the PML Act', LONG));
	assert.equal(closestPassage('the court ordered the immediate release of every person arrested under the Act without any further inquiry whatsoever', LONG), null);
});

test('too short to snap, or far from any passage, returns nothing', () => {
	assert.equal(closestPassage('grounds of his arrest', LONG), null);
	assert.equal(closestPassage('', LONG), null);
});

test('parts joined by an ellipsis each snap, in order', () => {
	const snapped = closestPassage('the action of informing the person arrested about the grounds of his arrest is sufficient … as held in Vijay Madanlal Choudhary', LONG);
	assert.ok(snapped);
	assert.match(snapped!, / … /);
});
