import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actLink, caseLink, searchLink, sectionLink } from './sources.ts';

test('searches Indian Kanoon for Indian law, and when the jurisdiction is not stated', () => {
	for (const jurisdiction of ['India', 'Republic of India', 'india', undefined]) {
		assert.equal(searchLink('x', jurisdiction).host, 'indiankanoon.org');
	}
});

test('falls back to a web search for another jurisdiction', () => {
	const link = searchLink('Donoghue v Stevenson', 'England and Wales');
	assert.equal(link.host, 'google.com');
	assert.equal(link.href, 'https://www.google.com/search?q=Donoghue%20v%20Stevenson');
});

test('builds a case, act and section query', () => {
	assert.equal(
		caseLink({ name: 'M.C. Mehta v. Union of India', year: '1987' }).href,
		'https://indiankanoon.org/search/?formInput=M.C.%20Mehta%20v.%20Union%20of%20India'
	);
	assert.equal(
		actLink('The Transfer of Property Act, 1882').href,
		'https://indiankanoon.org/search/?formInput=The%20Transfer%20of%20Property%20Act%2C%201882'
	);
	assert.equal(
		sectionLink('The Indian Contract Act, 1872', 'Section 73').href,
		'https://indiankanoon.org/search/?formInput=Section%2073%20The%20Indian%20Contract%20Act%2C%201872'
	);
});

test('encodes characters that could break out of the query', () => {
	const { href } = searchLink('A & B v. C #1 "x" <script>', 'India');
	assert.ok(href.startsWith('https://indiankanoon.org/search/?formInput='));
	assert.ok(!/[ "<>#]/.test(href.slice('https://indiankanoon.org/search/?formInput='.length)));
	assert.equal(new URL(href).searchParams.get('formInput'), 'A & B v. C #1 "x" <script>');
});

test('collapses stray whitespace', () => {
	assert.equal(new URL(searchLink('  Kumar   v.\n State ').href).searchParams.get('formInput'), 'Kumar v. State');
});
