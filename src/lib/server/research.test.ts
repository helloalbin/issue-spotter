import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBrief, isOfficialHost, splitSentences, uncitedCount } from './research.ts';

const cite = (text: string, link: string, url: string, title = 'Page') => {
	const marker = `([${link}](${url}))`;
	const from = text.indexOf(marker);
	assert.ok(from >= 0, marker);
	return { type: 'url_citation', start_index: from, end_index: from + marker.length, url, title };
};
const SC = 'https://main.sci.gov.in/supremecourt/2014/1/1_2014_judgment.pdf';
const IC = 'https://www.indiacode.nic.in/handle/123456789/2263';

test('does not cut a sentence after v., No., Art. or s.', () => {
	const sentences = splitSentences('In Rylands v. Fletcher the rule was laid down. Article 21 and Art. 14 apply under s. 106 of the Act. It followed Writ Petition No. 12 of 1986.');
	assert.deepEqual(sentences.map((s) => s.text), [
		'In Rylands v. Fletcher the rule was laid down.',
		'Article 21 and Art. 14 apply under s. 106 of the Act.',
		'It followed Writ Petition No. 12 of 1986.'
	]);
});

test('numbers the sources in order of first use and attaches each marker to its sentence', () => {
	const text = `The detention needs a recorded ground. ([sci.gov.in](${SC})) The notice period is thirty days. ([indiacode.nic.in](${IC})) The first source also covers arrest. ([sci.gov.in](${SC}))`;
	const brief = buildBrief('detention', [{ text, annotations: [cite(text, 'sci.gov.in', SC), cite(text, 'indiacode.nic.in', IC), { ...cite(text, 'sci.gov.in', SC), start_index: text.lastIndexOf('([sci.gov.in]'), end_index: text.length }] }], 2);
	const sentences = brief.blocks.flatMap((b) => (b.kind === 'paragraph' ? b.sentences : []));
	assert.deepEqual(sentences.map((s) => s.cites), [[1], [2], [1]]);
	assert.equal(brief.sources.length, 2);
	assert.deepEqual(brief.sources.map((s) => [s.n, s.host]), [[1, 'main.sci.gov.in'], [2, 'indiacode.nic.in']]);
	assert.equal(sentences[0].text, 'The detention needs a recorded ground.', 'the link text is cut out of the sentence');
	assert.equal(uncitedCount(brief), 0);
});

test('flags a statement with no source, but not a question, a short phrase or the could-not-confirm section', () => {
	const text = `## Answer\nA person arrested must be told the grounds of arrest. ([sci.gov.in](${SC}))\nCourts have always required this in every single case without exception.\nIs this settled?\n## What I could not confirm\nI could not find a ruling on detention at airports specifically.`;
	const brief = buildBrief('t', [{ text, annotations: [cite(text, 'sci.gov.in', SC)] }], 1);
	const flagged = brief.blocks.flatMap((b) => (b.kind === 'paragraph' ? b.sentences.filter((s) => s.uncited).map((s) => s.text) : []));
	assert.deepEqual(flagged, ['Courts have always required this in every single case without exception.']);
	assert.deepEqual(brief.blocks.filter((b) => b.kind === 'heading').map((b) => (b as { text: string }).text), ['Answer', 'What I could not confirm']);
});

test('never trusts a citation to a site outside the allowed list', () => {
	const evil = 'https://evil.example/doc/1';
	const text = `The court so held. ([evil.example](${evil})) Another point stands here with a source. ([sci.gov.in](${SC}))`;
	const brief = buildBrief('t', [{ text, annotations: [cite(text, 'evil.example', evil), cite(text, 'sci.gov.in', SC)] }], 1);
	assert.deepEqual(brief.sources.map((s) => s.host), ['main.sci.gov.in']);
	const first = brief.blocks[0].kind === 'paragraph' ? brief.blocks[0].sentences[0] : null;
	assert.equal(first?.cites.length, 0, 'the claim cited to the bad site has no citation');
	assert.equal(first?.text, 'The court so held.');
});

test('tells official sources from a copy on Indian Kanoon', () => {
	assert.equal(isOfficialHost('main.sci.gov.in'), true);
	assert.equal(isOfficialHost('delhihighcourt.nic.in'), true);
	assert.equal(isOfficialHost('indiankanoon.org'), false);
	const ik = 'https://indiankanoon.org/doc/1486949/';
	const text = `Absolute liability applies to hazardous industries. ([indiankanoon.org](${ik}))`;
	assert.equal(buildBrief('t', [{ text, annotations: [cite(text, 'indiankanoon.org', ik)] }], 1).sources[0].official, false);
});

test('ignores overlapping or out-of-range annotations and survives an answer with none', () => {
	const text = `One sentence with a source here today. ([sci.gov.in](${SC}))`;
	const good = cite(text, 'sci.gov.in', SC);
	const brief = buildBrief('t', [{ text, annotations: [good, { ...good, start_index: good.start_index + 2 }, { type: 'url_citation', start_index: 5, end_index: 9999, url: SC }, { type: 'file_citation' }] }], 1);
	assert.equal(brief.sources.length, 1);
	const none = buildBrief('t', [{ text: 'Plain text with no citations at all anywhere.', annotations: [] }], 0);
	assert.equal(none.sources.length, 0);
	assert.equal(uncitedCount(none), 1);
	assert.deepEqual(buildBrief('t', [], 0).blocks, []);
});

test('lists keep their bullets, and bold markers and empty brackets are cleaned out', () => {
	const text = `- **Maneka Gandhi** held that procedure must be fair and reasonable. ([sci.gov.in](${SC}))\n- A second point that is supported by the same source. ([sci.gov.in](${SC}))`;
	const brief = buildBrief('t', [{ text, annotations: [cite(text, 'sci.gov.in', SC), { ...cite(text, 'sci.gov.in', SC), start_index: text.lastIndexOf('(['), end_index: text.length }] }], 1);
	assert.equal(brief.blocks.length, 2);
	assert.ok(brief.blocks.every((b) => b.kind === 'paragraph' && b.bullet));
	assert.equal(brief.blocks[0].kind === 'paragraph' && brief.blocks[0].sentences[0].text, 'Maneka Gandhi held that procedure must be fair and reasonable.');
});
