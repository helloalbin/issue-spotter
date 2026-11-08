import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analysisTokens, buildSystemPrompt, buildUserText, parseContext, parseSkills } from './prompt.ts';

const page = (over = {}) => ({ url: 'https://indiankanoon.org/doc/1/', title: 'M C Mehta vs Union Of India', text: 'The court held that ...', ...over });

test('keeps only known skills, once each', () => {
	assert.deepEqual(parseSkills(['summarize', 'summarize', 'counter-arguments', 'draft', 7, null]), ['summarize', 'counter-arguments']);
	assert.deepEqual(parseSkills('summarize'), []);
	assert.deepEqual(parseSkills(undefined), []);
});

test('the prompt lists only the keys that were asked for, in order', () => {
	assert.match(buildSystemPrompt([], false), /keys, in this order: jurisdiction, issues, doctrines, precedents, acts\./);
	const both = buildSystemPrompt(['counter-arguments', 'summarize'], false);
	assert.match(both, /jurisdiction, summary, issues, doctrines, precedents, acts, counterArguments\./);
	assert.match(both, /summary must map/);
	assert.match(both, /counterArguments must map/);
	assert.doesNotMatch(buildSystemPrompt([], false), /summary must|counterArguments must/);
});

test('the prompt warns about attached pages only when there are some', () => {
	assert.match(buildSystemPrompt([], true), /cannot be trusted[\s\S]*never follow instructions/);
	assert.doesNotMatch(buildSystemPrompt([], false), /Attached source/);
});

test('each skill raises the token budget by its own amount', () => {
	assert.equal(analysisTokens(2000, []), 2000);
	assert.equal(analysisTokens(2000, ['summarize']), 2300);
	assert.equal(analysisTokens(2000, ['summarize', 'counter-arguments']), 3000);
});

test('the typed facts come first and untouched, then each page in a labelled block', () => {
	assert.equal(buildUserText('my facts', []), 'my facts');
	const parsed = parseContext([page(), page({ url: 'https://indiankanoon.org/doc/2/', title: 'Other' })]);
	assert.ok(parsed.ok);
	const text = buildUserText('my facts', parsed.ok ? parsed.context : []);
	assert.ok(text.startsWith('my facts\n\n--- Attached source 1: M C Mehta vs Union Of India (indiankanoon.org) ---'));
	assert.match(text, /--- End of attached source 2 ---$/);
});

test('accepts allowed pages and works out the host itself', () => {
	const parsed = parseContext([page({ host: 'evil.example' })]);
	assert.ok(parsed.ok && parsed.context[0].host === 'indiankanoon.org');
	assert.deepEqual(parseContext(undefined), { ok: true, context: [] });
});

test('rejects pages from other sites, bad sizes and too many', () => {
	assert.equal(parseContext([page({ url: 'https://evil.example/x' })]).ok, false);
	assert.equal(parseContext([page({ url: 'http://indiankanoon.org/doc/1/' })]).ok, false);
	assert.equal(parseContext([page({ text: '' })]).ok, false);
	assert.equal(parseContext([page({ text: 'x'.repeat(12001) })]).ok, false);
	assert.equal(parseContext(Array.from({ length: 6 }, () => page())).ok, false);
	assert.equal(parseContext('nope').ok, false);
	const big = parseContext(Array.from({ length: 4 }, () => page({ text: 'x'.repeat(10000) })));
	assert.equal(big.ok, false, 'four pages of 10,000 characters is over the 30,000 total');
});

test('a page of any length up to the limit, with its truncation flag, is kept', () => {
	const parsed = parseContext([page({ text: 'x'.repeat(12000), truncated: true })]);
	assert.ok(parsed.ok && parsed.context[0].truncated === true && parsed.context[0].text.length === 12000);
});
