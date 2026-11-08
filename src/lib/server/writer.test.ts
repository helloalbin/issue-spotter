import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REPORT_SCHEMA, buildReport, parseDraft, reportTally, writerInput } from './writer.ts';

const PAGE = '35. On the above analysis, we hold that it would be necessary, henceforth, that a copy of such written grounds of arrest is furnished to the arrested person as a matter of course and without exception.';
const readable = { pages: new Map([[1, PAGE]]), pdfs: new Set([2]) };
const good = { text: 'Written grounds of arrest must be given.', source: 1, quote: 'it would be necessary, henceforth, that a copy of such written grounds of arrest is furnished' };

test('the schema names every slot of the template, all required', () => {
	assert.deepEqual(REPORT_SCHEMA.required, ['title', 'synopsis', 'law', 'authorities', 'application', 'against', 'notConfirmed']);
});

test('a reply with text around the JSON is read; nonsense is not', () => {
	assert.ok(parseDraft('Here you go: {"title":"T","synopsis":[],"law":[],"authorities":[],"application":[],"against":[],"notConfirmed":[]} done'));
	assert.equal(parseDraft('no json here'), null);
	assert.equal(parseDraft('{broken'), null);
});

test('statements whose quote is on the page stay; others are dropped and counted', () => {
	const draft = parseDraft(JSON.stringify({
		title: 'Grounds of arrest',
		synopsis: [good, { text: 'Invented holding.', source: 1, quote: 'the court also held that bail is automatic in every such case' }, { text: 'Source that was not given.', source: 9, quote: 'it would be necessary henceforth' }],
		law: [], authorities: [], application: [], against: [], notConfirmed: []
	}))!;
	const report = buildReport(draft, 'topic', readable);
	const synopsis = report.sections.find((s) => s.id === 'synopsis')!;
	assert.equal(synopsis.lines.length, 1);
	assert.equal(synopsis.lines[0].check?.status, 'confirmed');
	assert.equal(report.dropped, 2);
	const notes = report.sections.find((s) => s.id === 'notConfirmed')!.notes!;
	assert.ok(notes.some((n) => n.startsWith('Could not verify against the page: Invented holding.')));
});

test('a PDF the model read is marked read, not confirmed', () => {
	const draft = parseDraft(JSON.stringify({ title: 't', synopsis: [{ text: 'A point from the PDF.', source: 2, quote: 'some passage from the pdf judgment' }], law: [], authorities: [], application: [], against: [], notConfirmed: [] }))!;
	const line = buildReport(draft, 't', readable).sections[0].lines[0];
	assert.equal(line.check?.status, 'read');
});

test('only the application section may reason beyond a source, and says so', () => {
	const inference = { text: 'Your arrest was oral only.', source: 0, quote: '' };
	const draft = parseDraft(JSON.stringify({ title: 't', synopsis: [inference], law: [], authorities: [], application: [inference], against: [], notConfirmed: [] }))!;
	const report = buildReport(draft, 't', readable);
	assert.equal(report.sections.find((s) => s.id === 'synopsis')!.lines.length, 0);
	assert.equal(report.sections.find((s) => s.id === 'application')!.lines[0].basis, 'inference');
});

test('sizes and lengths are clamped to the template; markup is removed', () => {
	const many = Array.from({ length: 12 }, () => ({ ...good, text: '**Bold** ' + 'word '.repeat(80) }));
	const draft = parseDraft(JSON.stringify({ title: '*T*', synopsis: many, law: [], authorities: [{ name: 'A v. B (SC, 2023)', claims: many }, { name: 'Empty v. Case', claims: [{ text: 'x', source: 1, quote: 'not on the page at all anywhere' }] }], application: [], against: [], notConfirmed: [] }))!;
	const report = buildReport(draft, 't', readable);
	const synopsis = report.sections[0].lines;
	assert.equal(synopsis.length, 5);
	assert.ok(synopsis[0].text.split(' ').length <= 46 && !synopsis[0].text.includes('**'));
	const authorities = report.sections.find((s) => s.id === 'authorities')!.children!;
	assert.equal(authorities.length, 1, 'a case with nothing verified is left out');
	assert.equal(authorities[0].lines.length, 3);
	assert.equal(report.title, 'T');
});

test('the tally counts what rests on a page', () => {
	const draft = parseDraft(JSON.stringify({ title: 't', synopsis: [good], law: [], authorities: [], application: [{ text: 'Applies to you.', source: 0, quote: '' }], against: [], notConfirmed: [] }))!;
	assert.deepEqual(reportTally(buildReport(draft, 't', readable)), { lines: 2, confirmed: 1, read: 0, inferred: 1 });
});

test('the input gives the case, the question, the leads and each labelled source', () => {
	const text = writerInput('facts here', 'the question', 'a lead', [{ n: 3, host: 'indiankanoon.org', title: 'Case', text: 'body', cut: true }]);
	assert.match(text, /Research question:\nthe question/);
	assert.match(text, /SOURCE \[3\] Case \(indiankanoon\.org\) \(excerpts of a long document/);
});
