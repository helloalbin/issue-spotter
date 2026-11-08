import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ResearchBrief } from '../spotter.ts';
import { applyChecks, checkTally, claimsOf, parseVerdicts, pickSources, quoteSupported } from './ground.ts';

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

test('verdicts that are malformed are ignored', () => {
	assert.deepEqual(parseVerdicts('nonsense'), []);
	assert.deepEqual(parseVerdicts('{"checks":[{"claim":"1","verdict":"supported"},{"claim":2,"verdict":"maybe"},{"claim":3,"verdict":"partly","source":2,"quote":" a b "}]}'), [
		{ claim: 3, verdict: 'partly', source: 2, quote: 'a b' }
	]);
});

test('checks are applied by what could be verified', () => {
	const verdicts = parseVerdicts(
		JSON.stringify({
			checks: [
				{ claim: 1, verdict: 'supported', source: 2, quote: 'we hold that it would be necessary, henceforth, that a copy of such written grounds of arrest is furnished' },
				{ claim: 2, verdict: 'supported', source: 1, quote: 'the order is set aside and the appeal is allowed in full' },
				{ claim: 3, verdict: 'supported', source: 2, quote: 'words that the page simply does not contain anywhere in it' }
			]
		})
	);
	const out = applyChecks(brief, verdicts, new Map([[2, PAGE]]), new Set([1]));
	const sentences = out.blocks.flatMap((b) => (b.kind === 'paragraph' ? b.sentences : []));
	assert.equal(sentences[0].check?.status, 'confirmed');
	assert.equal(sentences[1].check, undefined);
	assert.equal(sentences[2].check?.status, 'read');
	assert.equal(sentences[3].check?.status, 'unverified');
	assert.deepEqual(checkTally(out), { checked: 3, confirmed: 2, cited: 3 });
});

test('a claim the model says is unsupported is marked, and one it did not answer is left alone', () => {
	const out = applyChecks(brief, [{ claim: 1, verdict: 'not_supported' }], new Map([[2, PAGE]]), new Set());
	const sentences = out.blocks.flatMap((b) => (b.kind === 'paragraph' ? b.sentences : []));
	assert.equal(sentences[0].check?.status, 'unsupported');
	assert.equal(sentences[2].check, undefined);
});
