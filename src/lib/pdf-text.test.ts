import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pagesToMarkdown, readPdfPages } from './pdf-text.ts';

const page = (...lines: string[]) => lines;

test('wrapped lines are joined into one paragraph and numbered paragraphs start new ones', () => {
	const md = pagesToMarkdown([
		page('35. On the above analysis, to give true meaning and purpose to the statutory', 'mandate of Section 19, we hold that written grounds must be furnished.', '36. The decisions of the High Court are set aside as they cannot stand.')
	]);
	assert.deepEqual(md.split('\n'), [
		'35. On the above analysis, to give true meaning and purpose to the statutory mandate of Section 19, we hold that written grounds must be furnished.',
		'36. The decisions of the High Court are set aside as they cannot stand.'
	]);
});

test('a word split by a hyphen at the end of a line is rejoined', () => {
	assert.equal(pagesToMarkdown([page('The arrested person must be informed of the grounds of his arrest with-', 'out any delay whatsoever.')]), 'The arrested person must be informed of the grounds of his arrest without any delay whatsoever.');
});

test('running headers, page numbers and signature stamps are dropped', () => {
	const pages = [1, 2, 3, 4].map((n) => page('REPORTABLE', `${n}. A real paragraph number ${n} of the judgment with enough words in it.`, 'Signature Not Verified', String(n)));
	const md = pagesToMarkdown(pages);
	assert.ok(!md.includes('REPORTABLE'));
	assert.ok(!md.includes('Signature'));
	assert.equal(md.split('\n').length, 4);
});

test('a short line that ends a sentence ends the paragraph', () => {
	const long = 'This is a long line of the judgment that runs most of the way across the page text';
	const md = pagesToMarkdown([page(long, long + ' and ends here.', 'The appeal is allowed.', 'Next paragraph begins with a capital letter and carries on across the line')]);
	assert.equal(md.split('\n').length, 2);
	assert.ok(md.split('\n')[0].endsWith('The appeal is allowed.'));
});

test('lines are read from pdf.js items by their end-of-line marks', async () => {
	const doc = { numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: 'First ', hasEOL: false }, { str: 'line', hasEOL: true }, { str: 'Second line', hasEOL: false }, { type: 'x' } as any] }) }) };
	assert.deepEqual(await readPdfPages(doc), [['First line', 'Second line']]);
});
