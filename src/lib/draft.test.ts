import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftToText, gapCount, splitGaps } from './draft.ts';

test('splits text around [bracketed] gaps and loses nothing', () => {
	const text = 'I, [Name of complainant], reside at [Address] and state under [Section 303 BNS, 2023] that:';
	const pieces = splitGaps(text);
	assert.equal(pieces.map((p) => p.text).join(''), text);
	assert.deepEqual(pieces.filter((p) => p.gap).map((p) => p.text), ['[Name of complainant]', '[Address]', '[Section 303 BNS, 2023]']);
});

test('text with no brackets is one plain piece, and unclosed or multi-line brackets are not gaps', () => {
	assert.deepEqual(splitGaps('Plain text.'), [{ text: 'Plain text.', gap: false }]);
	assert.equal(splitGaps('An unclosed [bracket here').some((p) => p.gap), false);
	assert.equal(splitGaps('Spans [two\nlines] only').some((p) => p.gap), false);
	assert.deepEqual(splitGaps(''), []);
});

test('counts the gaps across a whole draft, headings included', () => {
	assert.equal(gapCount([{ heading: 'To [Station House Officer]', text: 'On [Date] at [Place]' }, { heading: 'Facts', text: 'None' }]), 3);
	assert.equal(gapCount([]), 0);
});

test('builds copyable text with the title and each heading', () => {
	const text = draftToText('Complaint under Section 173 BNSS', [
		{ heading: 'To', text: 'The Station House Officer, [Police Station]' },
		{ heading: '', text: '1. On [Date], I was...' }
	]);
	assert.equal(text, 'COMPLAINT UNDER SECTION 173 BNSS\n\n\nTO\n\nThe Station House Officer, [Police Station]\n\n\n1. On [Date], I was...\n');
	assert.equal(draftToText(undefined, [{ heading: 'Prayer', text: 'Register the FIR.' }]), 'PRAYER\n\nRegister the FIR.\n');
});
