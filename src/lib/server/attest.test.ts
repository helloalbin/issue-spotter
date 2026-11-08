import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAttestation, attestInput, parseAttest, passagesFrom } from './attest.ts';
import type { Report } from '../spotter.ts';

const line = (text: string, source: number, quote: string) => ({ text, cites: [source], basis: 'source' as const, check: { status: 'confirmed' as const, source, quote } });
const report: Report = {
	kind: 'research',
	title: 't',
	dropped: 0,
	sections: [
		{ id: 'synopsis', heading: 'S', numbered: true, lines: [line('From a page.', 1, 'quote from the page one'), line('From the PDF first.', 2, 'quote from the pdf alpha')] },
		{ id: 'authorities', heading: 'A', numbered: false, lines: [], children: [{ heading: 'Case', lines: [line('From the PDF second.', 2, 'quote from the pdf beta')] }] },
		{ id: 'notConfirmed', heading: 'N', numbered: false, lines: [], notes: ['One note.'] }
	]
};

test('the quotes taken from the PDF are listed in print order, and pages are left out', () => {
	const passages = passagesFrom(report, new Set([2]));
	assert.deepEqual(passages.map((p) => [p.id, p.source, p.quote]), [[1, 2, 'quote from the pdf alpha'], [2, 2, 'quote from the pdf beta']]);
	assert.equal(attestInput(passages), '1. quote from the pdf alpha\n2. quote from the pdf beta');
});

test('the reply is read, and nonsense gives no answers', () => {
	assert.deepEqual([...parseAttest('{"results":[{"id":1,"present":true},{"id":2,"present":false},{"id":"x","present":true}]}')], [[1, true], [2, false]]);
	assert.equal(parseAttest('nope').size, 0);
});

test('a quote the model could not find in the PDF is dropped and named; one it found is attested', () => {
	const passages = passagesFrom(report, new Set([2]));
	const out = applyAttestation(report, passages, new Map([[2, new Map([[1, true], [2, false]])]]));
	const synopsis = out.sections[0].lines;
	assert.equal(synopsis.length, 2);
	assert.equal(synopsis[0].check?.attested, undefined, 'a page quote is not touched');
	assert.equal(synopsis[1].check?.attested, true);
	assert.equal(out.sections[1].children!.length, 0, 'a case left with no lines is removed');
	assert.equal(out.dropped, 1);
	assert.ok(out.sections[2].notes!.some((n) => n === 'Could not verify against the official PDF: From the PDF second.'));
});

test('when the check could not run the report is left as it was', () => {
	const passages = passagesFrom(report, new Set([2]));
	const out = applyAttestation(report, passages, new Map([[2, null]]));
	assert.equal(out.dropped, 0);
	assert.equal(out.sections[0].lines.length, 2);
	assert.equal(out.sections[0].lines[1].check?.attested, undefined);
});
