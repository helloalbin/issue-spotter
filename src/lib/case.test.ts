import assert from 'node:assert/strict';
import { test } from 'node:test';
import { caseText } from './case.ts';

const first = 'I was detained at the airport and officials confiscated my passport.';
const second = 'They suspected a substance, which turned out to be flour, and I lost my flight.';

test('a first message is sent exactly as typed', () => {
	assert.equal(caseText([], first), first);
	assert.equal(caseText([], '  spaced\nout  '), '  spaced\nout  ');
});

test('a follow-up continues the case instead of replacing it', () => {
	const text = caseText([first], second);
	assert.ok(text.startsWith(first), 'the earlier facts come first');
	assert.ok(text.endsWith(second), 'the new facts come last');
	assert.equal(text, `${first}\n\nFurther facts: ${second}`);
});

test('every later message is labelled, in order', () => {
	assert.equal(caseText([first, second], 'Third.'), `${first}\n\nFurther facts: ${second}\n\nFurther facts: Third.`);
});

test('with nothing added it returns the case so far', () => {
	assert.equal(caseText([first, second]), `${first}\n\nFurther facts: ${second}`);
	assert.equal(caseText([]), '');
});
