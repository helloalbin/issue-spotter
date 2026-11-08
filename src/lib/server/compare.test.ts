import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isReady, nameWords, pageIsCase, parseIdentification } from './compare.ts';
import type { CaseCandidate } from '../spotter.ts';

test('the identification reply is read and capped at two cases', () => {
	const reply = 'Here: {"cases":[{"query":"pankaj bansal","name":"Pankaj Bansal v. Union of India","court":"Supreme Court","year":"2023","url":"https://indiankanoon.org/doc/189692408/"},{"query":"ram kishor","name":"Ram Kishor Arora v. ED","court":"","year":"2023","url":""},{"name":"Third v. Case"},{"name":""}]}';
	const found = parseIdentification(reply);
	assert.equal(found.length, 2);
	assert.equal(found[0].url, 'https://indiankanoon.org/doc/189692408/');
	assert.equal(found[1].url, '');
	assert.deepEqual(parseIdentification('no json'), []);
	assert.deepEqual(parseIdentification('{"cases":"x"}'), []);
});

test('name words keep the parties and drop "Union of India" and the like', () => {
	assert.deepEqual(nameWords('Pankaj Bansal v. Union of India'), ['pankaj', 'bansal']);
	assert.deepEqual(nameWords('Ram Kishor Arora v. Directorate of Enforcement'), ['ram', 'kishor', 'arora', 'enforcement']);
});

test('a page is the case when most name words are in its title or opening, and not when it is a different case', () => {
	assert.ok(pageIsCase('Pankaj Bansal v. Union of India', 'Pankaj Bansal vs Union Of India on 3 October, 2023', 'Supreme Court of India'));
	assert.ok(pageIsCase('Ram Kishor Arora v. Directorate of Enforcement', 'Ram Kishor Arora vs Directorate Of Enforcement on 15 December, 2023', ''));
	assert.equal(pageIsCase('Pankaj Bansal v. Union of India', 'Vikas Bansal vs Directorate Of Enforcement on 30 May, 2024', 'Vikas Bansal the appellant'), false);
	assert.equal(pageIsCase('Union of India v. State', 'Anything', 'text'), false, 'a name with no distinguishing words cannot be checked');
});

test('a comparison needs two cases that are both verified and readable', () => {
	const ok: CaseCandidate = { query: 'q', name: 'A v. B', court: '', year: '', url: 'u', title: 't', host: 'indiankanoon.org', official: false, verified: true, readable: true };
	assert.equal(isReady([ok, ok]), true);
	assert.equal(isReady([ok]), false);
	assert.equal(isReady([ok, { ...ok, verified: false }]), false);
	assert.equal(isReady([ok, { ...ok, readable: false }]), false);
});
