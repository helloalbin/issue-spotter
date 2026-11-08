import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildVerifyReport, checkDetails, describeDetails, findInput, parseFound, parseItems, parseSupport } from './verify-cites.ts';
import type { Item, Located } from './verify-cites.ts';

const TITLE = 'Pankaj Bansal vs Union Of India on 3 October, 2023';
const PAGE = 'IN THE SUPREME COURT OF INDIA CRIMINAL APPELLATE JURISDICTION. 35. On the above analysis, we hold that it would be necessary, henceforth, that a copy of such written grounds of arrest is furnished to the arrested person as a matter of course and without exception. (2024) 7 SCC 576';
const item = (over: Partial<Item> = {}): Item => ({ id: 1, cite: 'Pankaj Bansal v. Union of India (2023)', name: 'Pankaj Bansal v. Union of India', year: '2023', court: 'Supreme Court', reporter: '', proposition: 'written grounds of arrest must be furnished', ...over });

test('citations are parsed in order, numbered, capped at five, with nothing corrected', () => {
	const many = Array.from({ length: 7 }, (_, i) => ({ cite: `Case ${i} v. State`, name: '', year: '', court: '', reporter: '', proposition: '' }));
	const out = parseItems(JSON.stringify({ items: many }));
	assert.equal(out.length, 5);
	assert.deepEqual(out.map((i) => i.id), [1, 2, 3, 4, 5]);
	assert.deepEqual(parseItems('nonsense'), []);
	assert.deepEqual(parseItems('{"items":[{"cite":""}]}'), []);
});

test('the search reply gives a page for each citation it found', () => {
	const found = parseFound('{"found":[{"id":1,"url":"https://indiankanoon.org/doc/1/"},{"id":2,"url":""},{"id":"x","url":"y"}]}');
	assert.deepEqual([...found], [[1, 'https://indiankanoon.org/doc/1/']]);
	assert.equal(parseFound('no').size, 0);
	assert.match(findInput([item(), item({ id: 2, cite: 'AIR 2020 SC 1', name: '', reporter: '' })]), /^1\. Pankaj Bansal v\. Union of India \(2023\)[\s\S]*\n2\. AIR 2020 SC 1/);
});

test('name, year, court and reference are each compared with the page', () => {
	assert.deepEqual(checkDetails(item({ reporter: '(2024) 7 SCC 576' }), TITLE, PAGE), { name: 'match', year: 'match', pageYear: undefined, court: 'match', reporter: 'found' });
	const wrong = checkDetails(item({ year: '2021', court: 'Delhi High Court', reporter: '(2019) 1 SCC 1' }), TITLE, PAGE);
	assert.equal(wrong.year, 'mismatch');
	assert.equal(wrong.pageYear, '2023');
	assert.equal(wrong.court, 'mismatch');
	assert.equal(wrong.reporter, 'not-found');
	assert.equal(checkDetails(item({ name: '', year: '', court: '', reporter: '' }), TITLE, PAGE).name, 'not-given');
	assert.equal(checkDetails(item({ name: 'Vikas Bansal v. Directorate' }), TITLE, PAGE).name, 'mismatch');
});

test('a difference in year is stated as a fact, not an accusation', () => {
	const text = describeDetails(item({ year: '2021' }), checkDetails(item({ year: '2021' }), TITLE, PAGE));
	assert.equal(text.mark, 'warn');
	assert.match(text.text, /gives 2023 as the year/);
	assert.match(text.text, /year of the report/);
});

test('each citation is reported at the three levels, and a quote that is not on the page is not trusted', () => {
	const items = [item(), item({ id: 2, cite: 'Imaginary v. Nobody (2019) 3 SCC 3', name: 'Imaginary v. Nobody', year: '2019', proposition: 'anything at all' }), item({ id: 3, cite: 'Pankaj Bansal v. Union of India', proposition: 'bail is automatic' })];
	const page: Located = { n: 1, title: TITLE, page: PAGE, excerpt: PAGE, cut: false, verified: true };
	const located = new Map<number, Located>([[1, page], [3, page]]);
	const support = new Map(
		parseSupport(JSON.stringify({ checks: [
			{ id: 1, verdict: 'supported', quote: 'we hold that it would be necessary, henceforth, that a copy of such written grounds of arrest is furnished', note: 'It requires written grounds.' },
			{ id: 3, verdict: 'supported', quote: 'the court also held that bail is automatic whenever grounds are late', note: 'Bail follows.' }
		] })).map((s) => [s.id, s])
	);
	const report = buildVerifyReport(items, located, support);
	const groups = report.sections.find((s) => s.id === 'citations')!.children!;

	assert.equal(groups.length, 3);
	assert.equal(groups[0].lines[0].mark, 'ok');
	assert.equal(groups[0].lines[2].check?.status, 'confirmed', 'a quote on the page confirms support');
	assert.equal(groups[1].lines[0].mark, 'fail', 'a citation with no page is reported as not found');
	assert.equal(groups[1].lines.length, 2, 'with no page there is no details line');
	assert.match(groups[1].lines[1].text, /not checked because the judgment was not found/);
	assert.equal(groups[2].lines[2].check, undefined, 'a quote that is not on the page confirms nothing');
	assert.match(groups[2].lines[2].text, /not on the page, so this is not confirmed/);

	const synopsis = report.sections[0].lines;
	assert.match(synopsis[0].text, /^3 citations checked: 2 found, 1 of 2 supporting the point they are cited for\.$/);
	assert.ok(report.sections.find((s) => s.id === 'notConfirmed')!.notes!.some((n) => /overruled, reversed or distinguished/.test(n)));
});

test('a citation with no point given is checked for existence and details only', () => {
	const page: Located = { n: 1, title: TITLE, page: PAGE, excerpt: PAGE, cut: false, verified: true };
	const report = buildVerifyReport([item({ proposition: '' })], new Map([[1, page]]), new Map());
	const lines = report.sections.find((s) => s.id === 'citations')!.children![0].lines;
	assert.match(lines[2].text, /No point was given/);
});

test('a page that is a different case is reported as such and support is not checked', () => {
	const other: Located = { n: 1, title: 'Vikas Bansal vs Directorate Of Enforcement', page: 'x', excerpt: 'x', cut: false, verified: false };
	const report = buildVerifyReport([item()], new Map([[1, other]]), new Map());
	const lines = report.sections.find((s) => s.id === 'citations')!.children![0].lines;
	assert.match(lines[0].text, /does not look like this case/);
	assert.match(lines[1].text, /not checked because the judgment was not found/);
});

test('the year in a law-report reference is not compared with the year of the decision', () => {
	const cited = item({ cite: 'Pankaj Bansal v. Union of India, (2024) 7 SCC 576', year: '2024', reporter: '(2024) 7 SCC 576' });
	const details = checkDetails(cited, TITLE, PAGE);
	assert.equal(details.year, 'not-given');
	assert.equal(details.reporter, 'found');
	assert.equal(describeDetails(cited, details).mark, 'ok');
});
