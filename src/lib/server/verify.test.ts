import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowedHost, matchSources, score, tokens } from './verify.ts';
import type { Reference } from './verify.ts';

const mehta: Reference = { key: 'case:0', kind: 'case', name: 'M.C. Mehta v. Union of India', year: '1987' };
const IK = 'https://indiankanoon.org/doc/';

test('tokenises case names regardless of punctuation and "vs"', () => {
	assert.deepEqual(tokens('M.C. Mehta vs. Union Of India & Ors'), ['m', 'c', 'mehta', 'vs', 'union', 'of', 'india', 'and', 'ors']);
});

test('matches a case to its page on the party names, not on the noise words', () => {
	assert.equal(score(mehta, 'M C Mehta vs Union Of India & Ors on 20 December, 1986'), 1);
	assert.equal(score(mehta, 'Rajesh Kumar vs Union Of India on 3 May, 2001'), 0, 'only noise words in common');
});

test('verifies a case from a real-looking citation list and ignores the rest', () => {
	const matches = matchSources(
		[mehta],
		[
			{ url: `${IK}1486949/`, title: 'M C Mehta vs Union Of India & Ors on 20 December, 1986' },
			{ url: 'https://example.com/mehta', title: 'M C Mehta vs Union Of India' }
		]
	);
	assert.equal(matches.length, 1);
	assert.equal(matches[0].url, `${IK}1486949/`);
	assert.equal(matches[0].host, 'indiankanoon.org');
	assert.equal(matches[0].key, 'case:0');
});

test('never accepts a page from a site that is not allowed, whatever its title says', () => {
	assert.deepEqual(
		matchSources([mehta], [{ url: 'https://evil.example/indiankanoon.org/doc/1/', title: 'M C Mehta vs Union Of India' }]),
		[]
	);
	assert.equal(isAllowedHost('indiankanoon.org.evil.example'), false);
	assert.equal(isAllowedHost('www.indiankanoon.org'.replace(/^www\./, '')), true);
	assert.equal(isAllowedHost('main.sci.gov.in'), true);
});

test('rejects a page whose year is far from the reference year (a different case)', () => {
	const matches = matchSources([mehta], [{ url: `${IK}1/`, title: 'M C Mehta vs Union Of India on 4 July, 2012' }]);
	assert.deepEqual(matches, []);
	assert.equal(matchSources([mehta], [{ url: `${IK}2/`, title: 'M C Mehta vs Union Of India on 4 July, 1986' }]).length, 1, 'within two years');
});

test('does not verify a case the search did not find', () => {
	const fake: Reference = { key: 'case:1', kind: 'case', name: 'Kishore v. State of Maharashtra', year: '1998' };
	assert.deepEqual(matchSources([fake], [{ url: `${IK}9/`, title: 'Ramesh vs State Of Maharashtra on 1 June, 1998' }]), []);
});

test('verifies an act and a section by every word, numbers included', () => {
	const act: Reference = { key: 'act:0', kind: 'statute', name: 'The Indian Contract Act, 1872' };
	const section: Reference = { key: 'sec:0:0', kind: 'section', name: 'Section 73 The Indian Contract Act, 1872' };
	const citations = [
		{ url: `${IK}1/`, title: 'The Indian Contract Act, 1872' },
		{ url: `${IK}2/`, title: 'Section 73 in The Indian Contract Act, 1872' },
		{ url: `${IK}3/`, title: 'Section 74 in The Indian Contract Act, 1872' }
	];
	const matches = matchSources([act, section], citations);
	assert.equal(matches.find((m) => m.key === 'act:0')?.url, `${IK}1/`);
	assert.equal(matches.find((m) => m.key === 'sec:0:0')?.url, `${IK}2/`, 'section 73, not 74');
});

test('prefers a document page when two pages match equally', () => {
	const matches = matchSources([mehta], [
		{ url: 'https://indiankanoon.org/search/?formInput=mehta', title: 'M C Mehta vs Union Of India' },
		{ url: `${IK}77/`, title: 'M C Mehta vs Union Of India' }
	]);
	assert.equal(matches[0].url, `${IK}77/`);
});

test('a section is verified only by its own page: Section 74 is not Section 73', () => {
	const section74: Reference = { key: 'sec:0:1', kind: 'section', name: 'Section 74 The Indian Contract Act, 1872' };
	assert.deepEqual(matchSources([section74], [{ url: `${IK}2/`, title: 'Section 73 in The Indian Contract Act, 1872' }]), []);
	assert.deepEqual(matchSources([section74], [{ url: `${IK}2/`, title: 'Section 740 in The Indian Contract Act, 1872' }]), []);
});

test('a page for a section covers a sub-clause of it, but not another section', () => {
	const sub: Reference = { key: 'sec:1:0', kind: 'section', name: 'Section 2(1)(d) The Consumer Protection Act, 2019' };
	assert.equal(matchSources([sub], [{ url: `${IK}3/`, title: 'Section 2 in The Consumer Protection Act, 2019' }]).length, 1);
	assert.deepEqual(matchSources([sub], [{ url: `${IK}4/`, title: 'Section 20 in The Consumer Protection Act, 2019' }]), []);
});

test('an act is not verified by a page for the same act in a different year', () => {
	const act: Reference = { key: 'act:1', kind: 'statute', name: 'The Transfer of Property Act, 1882' };
	assert.deepEqual(matchSources([act], [{ url: `${IK}5/`, title: 'The Transfer of Property Act, 1892' }]), []);
});

import { hostOf as hostOfUrl } from './verify.ts';

test('only web addresses have a host', () => {
	assert.equal(hostOfUrl('https://www.indiankanoon.org/doc/1/'), 'indiankanoon.org');
	assert.equal(hostOfUrl('javascript://indiankanoon.org/%0Aalert(1)'), null);
	assert.equal(hostOfUrl('data://indiankanoon.org/x'), null);
	assert.equal(hostOfUrl('not a url'), null);
});
