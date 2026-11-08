import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analysisScript, briefScript, chunkText, draftScript, forSpeech, parsePrefs, pickVoice, reportScript } from './speech.ts';
import type { Report, SpotterResult } from './spotter.ts';

test('legal shorthand is written out, and a case name keeps its words', () => {
	assert.equal(forSpeech('Pankaj Bansal v. Union of India'), 'Pankaj Bansal versus Union of India');
	assert.equal(forSpeech('Sec. 106 and ss. 12 of the Transfer of Property Act'), 'Section 106 and Sections 12 of the Transfer of Property Act');
	assert.equal(forSpeech('Art. 22(1) of the Constitution'), 'Article 22, sub-section 1 of the Constitution');
	assert.equal(forSpeech('Section 19(1)(a) applies'), 'Section 19, sub-section 1, clause a applies');
	assert.equal(forSpeech('Writ Petition No. 12 of 1986, i.e. the first'), 'Writ Petition Number 12 of 1986, that is, the first');
	assert.equal(forSpeech('Smith & Co. Ors. v. State'), 'Smith and Co. Others versus State');
});

test('citation markers, links and markup are not read out', () => {
	assert.equal(forSpeech('Written grounds are required. [1][3] See https://indiankanoon.org/doc/1/ now.'), 'Written grounds are required. See now.');
	assert.equal(forSpeech('**Bold** and [a link](https://x.y) and `code`'), 'Bold and a link and code');
});

const result: SpotterResult = {
	headline: 'The new facts make the notice defective',
	jurisdiction: 'India',
	update: ['The notice gave only fifteen days.'],
	issues: ['Termination of the tenancy', 'Arrears of rent'],
	doctrines: ['Notice to quit'],
	precedents: [{ name: 'Example v. Example', year: '1990', court: 'SC' } as any],
	acts: [{ act: 'The Transfer of Property Act, 1882', sections: ['Section 106'], relevance: 'Notice to terminate a tenancy.' }],
	counterArguments: [{ issue: 'Notice', argument: 'It was served in time' }],
	openQuestions: ['Was rent accepted after the notice?']
};

test('an analysis is spoken section by section, without the facts or the disclaimer', () => {
	const text = analysisScript(result);
	const lines = text.split('\n');
	assert.equal(lines[0], 'The new facts make the notice defective.');
	assert.ok(lines.includes('Jurisdiction: India.'));
	assert.ok(lines.includes('Primary legal issues.'));
	assert.ok(lines.includes('1. Termination of the tenancy.'));
	assert.ok(lines.includes('Example versus Example, 1990.'));
	assert.ok(lines.includes('The Transfer of Property Act, 1882, Section 106. Notice to terminate a tenancy.'));
	assert.ok(lines.includes('Notice: It was served in time.'));
	assert.ok(!/not legal advice|Study aid/i.test(text));
});

test('a section with nothing in it is not announced', () => {
	const text = analysisScript({ ...result, update: [], counterArguments: [], openQuestions: [], summary: undefined });
	assert.ok(!text.includes('What these facts change'));
	assert.ok(!text.includes('Counter-arguments'));
});

test('a draft reads its gaps as blanks', () => {
	const text = draftScript({ ...result, documentTitle: 'Police complaint', draft: [{ heading: 'To', text: 'The Station House Officer,\n[Name of Police Station], [City]' }], draftNotes: ['An advocate must review this.'] });
	assert.match(text, /^Police complaint\./);
	assert.match(text, /blank for Name of Police Station/);
	assert.match(text, /Notes before use\./);
});

const report: Report = {
	kind: 'research',
	title: 'Grounds of arrest',
	dropped: 2,
	sections: [
		{ id: 'synopsis', heading: 'Synopsis', numbered: true, lines: [{ text: 'Written grounds are required.', cites: [1], basis: 'source' }, { text: 'Oral grounds sufficed before.', cites: [2], basis: 'source' }] },
		{ id: 'authorities', heading: 'Key authorities', numbered: false, lines: [], children: [{ heading: 'Pankaj Bansal v. Union of India (SC, 2023)', lines: [{ text: 'It required written grounds.', cites: [1], basis: 'source' }] }] },
		{ id: 'application', heading: 'Application to your facts', numbered: false, lines: [{ text: 'Your arrest was oral only.', cites: [], basis: 'inference' }] },
		{ id: 'notConfirmed', heading: 'Not confirmed', numbered: false, lines: [], notes: ['Whether remand cures it.'] }
	]
};

test('a report is spoken in its template order; citations are dropped and reasoning is labelled', () => {
	const text = reportScript(report);
	const lines = text.split('\n');
	assert.equal(lines[0], 'Grounds of arrest.');
	assert.ok(lines.indexOf('Synopsis.') < lines.indexOf('Key authorities.'));
	assert.ok(lines.includes('Point 1. Written grounds are required.'));
	assert.ok(lines.includes('Pankaj Bansal versus Union of India (SC, 2023).'));
	assert.ok(lines.includes('Reasoning: Your arrest was oral only.'));
	assert.ok(lines.includes('Whether remand cures it.'));
	assert.ok(!text.includes('[1]'));
	assert.ok(!lines.includes('Governing law.'), 'empty sections are skipped');
	assert.match(text, /2 statements were left out/);
});

test('checked lines say how they came out', () => {
	const verify: Report = { kind: 'verify', title: 'Citation check', dropped: 0, sections: [{ id: 'citations', heading: 'Citations checked', numbered: false, lines: [], children: [{ heading: 'A v. B', lines: [{ text: 'Found: A vs B.', cites: [1], basis: 'app', mark: 'ok' }, { text: 'No page was found.', cites: [], basis: 'app', mark: 'fail' }] }] }] };
	const text = reportScript(verify);
	assert.match(text, /Checked\. Found: A versus B\./);
	assert.match(text, /Not found\. No page was found\./);
});

test('the first search brief is spoken with its headings, and unsourced sentences are said to be', () => {
	const text = briefScript({ topic: 'Grounds of arrest', searches: 1, sources: [], blocks: [{ kind: 'heading', text: 'Answer' }, { kind: 'paragraph', bullet: false, sentences: [{ text: 'A claim with a source.', cites: [1], uncited: false }, { text: 'A claim without one.', cites: [], uncited: true }] }] });
	assert.match(text, /Answer\./);
	assert.match(text, /No source for this one: A claim without one\./);
});

test('text is spoken in pieces no longer than the limit, with a break at each paragraph', () => {
	const long = 'This is the first sentence of the judgment. ' + 'And a much longer second sentence, which goes on and on with commas, clauses and more clauses, ' + 'until it has to be cut somewhere sensible by the splitter so that no piece is too long to be spoken.';
	const chunks = chunkText(long + '\nNext paragraph starts here.', 90);
	assert.ok(chunks.every((c) => c.length <= 90), chunks.map((c) => c.length).join());
	assert.equal(chunks.at(-1), 'Next paragraph starts here.');
	assert.equal(chunks.join(' ').replace(/\s+/g, ' ').includes('by the splitter so that'), true);
	assert.deepEqual(chunkText(''), []);
});

test('the voice: a saved one wins; else English, Indian first, and on-device before online', () => {
	const v = (name: string, lang: string, localService: boolean) => ({ name, lang, localService, voiceURI: name });
	const voices = [v('Daniel', 'en-GB', true), v('Rishi', 'en-IN', true), v('Google US', 'en-US', false), v('Google India', 'en-IN', false), v('Kanya', 'hi-IN', true)];
	assert.equal(pickVoice(voices)?.name, 'Rishi');
	assert.equal(pickVoice(voices.filter((x) => x.name !== 'Rishi'))?.name, 'Google India');
	assert.equal(pickVoice(voices, 'Daniel')?.name, 'Daniel');
	assert.equal(pickVoice([v('Kanya', 'hi-IN', true)]), null);
	assert.equal(pickVoice([]), null);
});

test('saved preferences are made safe', () => {
	assert.deepEqual(parsePrefs(null), { rate: 1 });
	assert.deepEqual(parsePrefs('{"rate":1.5,"voice":"Rishi"}'), { rate: 1.5, voice: 'Rishi' });
	assert.deepEqual(parsePrefs('{"rate":9,"voice":42}'), { rate: 1 });
	assert.deepEqual(parsePrefs('nonsense'), { rate: 1 });
});
