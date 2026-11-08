import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectExcerpts, splitParagraphs } from './excerpt.ts';

const filler = (n: number) => `${n}. ${'The matter was considered at length by the bench on the record before it. '.repeat(6)}`;

test('a short page is returned whole', () => {
	const text = 'One paragraph that is short enough to keep whole in full.\nAnother paragraph.';
	const out = selectExcerpts(text, 'anything', 5000);
	assert.equal(out.cut, false);
	assert.equal(out.text, text);
});

test('short stray lines are joined to the paragraph before them but numbered paragraphs are not', () => {
	assert.deepEqual(splitParagraphs('First paragraph that is long enough to stand on its own here.\nv.\n2. Second paragraph that is long enough to stand on its own.'), [
		'First paragraph that is long enough to stand on its own here. v.',
		'2. Second paragraph that is long enough to stand on its own.'
	]);
});

test('a long judgment keeps its opening, its order and the paragraphs about the question', () => {
	const paras = Array.from({ length: 200 }, (_, i) => filler(i + 1));
	paras[0] = '1. Bench: Justice A and Justice B. Appeal by the appellant against the detention order of the High Court of Delhi.';
	paras[120] = '121. We hold that written grounds of arrest must be furnished to the arrested person under Section 19 of the PMLA without exception.';
	paras[199] = '200. The appeal is allowed and the arrest is set aside. Order accordingly.';
	const text = paras.join('\n');

	const out = selectExcerpts(text, 'grounds of arrest written PMLA Section 19', 6000);
	assert.equal(out.cut, true);
	assert.ok(out.text.length <= 6000, `size ${out.text.length}`);
	assert.ok(out.text.includes('121. We hold that written grounds of arrest'), 'the relevant paragraph is kept');
	assert.ok(out.text.startsWith('1. Bench: Justice A'), 'the opening is kept');
	assert.ok(out.text.includes('200. The appeal is allowed'), 'the order is kept');
	assert.ok(out.text.indexOf('121. We hold') < out.text.indexOf('200. The appeal'), 'order is preserved');
	assert.match(out.text, /\[… \d+ paragraphs? omitted …\]/);
	for (const kept of out.text.split('\n').filter((line) => !line.startsWith('[…'))) assert.ok(text.includes(kept), 'every kept paragraph is verbatim');
});

test('with nothing to match on, it still returns the opening and the closing', () => {
	const text = Array.from({ length: 100 }, (_, i) => filler(i + 1)).join('\n');
	const out = selectExcerpts(text, '', 3000);
	assert.equal(out.cut, true);
	assert.ok(out.text.startsWith('1. '));
	assert.ok(out.text.includes('100. '));
});
