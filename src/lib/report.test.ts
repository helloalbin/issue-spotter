import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESEARCH_TEMPLATE, clampWords, headingOf, renderMarkdown } from './report.ts';
import type { Report, ResearchSource } from './spotter.ts';

const line = (text: string, cites = [1]) => ({ text, cites, basis: 'source' as const });
const sources: ResearchSource[] = [{ n: 1, url: 'https://indiankanoon.org/doc/1/', title: 'Case', host: 'indiankanoon.org', official: false, read: 'text' }];
const report: Report = {
	kind: 'research',
	title: 'Grounds of arrest',
	dropped: 1,
	sections: [
		{ id: 'synopsis', heading: 'Synopsis', numbered: true, lines: [line('First point.'), line('Second point.')] },
		{ id: 'law', heading: 'Governing law', numbered: false, lines: [line('Section 19 applies.')] },
		{ id: 'authorities', heading: 'Key authorities', numbered: false, lines: [], children: [{ heading: 'Pankaj Bansal v. Union of India (2023)', lines: [line('Written grounds are required.')] }] },
		{ id: 'application', heading: 'Application to your facts', numbered: false, lines: [{ text: 'Your arrest was oral only.', cites: [], basis: 'inference' }] },
		{ id: 'notConfirmed', heading: 'Not confirmed', numbered: false, lines: [], notes: ['Whether remand cures it.'] }
	]
};

test('sections are numbered after the synopsis and empty ones say so', () => {
	const md = renderMarkdown(report, sources);
	const headings = md.split('\n').filter((l) => /^#{1,3} /.test(l));
	assert.deepEqual(headings, [
		'# Grounds of arrest',
		'## Synopsis',
		'## 1. Governing law',
		'## 2. Key authorities',
		'### 2.1 Pankaj Bansal v. Union of India (2023)',
		'## 3. Application to your facts',
		'## 4. What cuts the other way',
		'## 5. Not confirmed',
		'## Sources'
	]);
	assert.match(md, /\*No qualifying or contrary authority was found/);
});

test('lines carry their source numbers and an inference is labelled', () => {
	const md = renderMarkdown(report, sources);
	assert.match(md, /^1\. First point\. \[1\]$/m);
	assert.match(md, /^2\. Second point\. \[1\]$/m);
	assert.match(md, /Your arrest was oral only\. \*\(inference from your facts\)\*/);
	assert.match(md, /^1\. \[Case\]\(https:\/\/indiankanoon\.org\/doc\/1\/\) — indiankanoon\.org, copy on Indian Kanoon, page read$/m);
	assert.match(md, /1 statement was left out/);
});

test('a long statement is cut at a word limit', () => {
	assert.equal(clampWords('one two three', 5), 'one two three');
	assert.equal(clampWords('one two three four five six', 4), 'one two three four…');
	assert.equal(clampWords('First clause is quite long here, then a second part follows after it', 10), 'First clause is quite long here…');
});

test('the template is a fixed list: synopsis first, then numbered sections', () => {
	assert.deepEqual(RESEARCH_TEMPLATE.map((s) => s.id), ['synopsis', 'law', 'authorities', 'application', 'against', 'notConfirmed']);
	assert.equal(headingOf(RESEARCH_TEMPLATE[0], 0), 'Synopsis');
	assert.equal(headingOf(RESEARCH_TEMPLATE[1], 1), '1. Governing law');
});
